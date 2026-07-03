-- Lock down club_members self-service RLS paths so members cannot self-escalate
-- role, access_level, status, or club/user identity fields.

CREATE OR REPLACE FUNCTION public.club_members_self_update_allowed(
  p_id uuid,
  p_club_id uuid,
  p_user_id uuid,
  p_role text,
  p_status text,
  p_joined_at timestamptz,
  p_created_at timestamptz,
  p_title text,
  p_reports_to uuid,
  p_access_level text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.club_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.club_members
  WHERE id = p_id;

  IF NOT FOUND OR v_existing.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  -- Self-service updates are only for pending join-request details.
  -- Active members leave via DELETE; approvals/promotions use privileged paths.
  IF v_existing.status IS DISTINCT FROM 'pending' THEN
    RETURN false;
  END IF;

  IF v_existing.role IS DISTINCT FROM 'member'
     OR COALESCE(v_existing.access_level, 'member') IS DISTINCT FROM 'member' THEN
    RETURN false;
  END IF;

  RETURN p_club_id IS NOT DISTINCT FROM v_existing.club_id
    AND p_user_id IS NOT DISTINCT FROM v_existing.user_id
    AND p_role IS NOT DISTINCT FROM v_existing.role
    AND p_status IS NOT DISTINCT FROM v_existing.status
    AND COALESCE(p_access_level, 'member') IS NOT DISTINCT FROM COALESCE(v_existing.access_level, 'member')
    AND p_joined_at IS NOT DISTINCT FROM v_existing.joined_at
    AND p_created_at IS NOT DISTINCT FROM v_existing.created_at
    AND p_title IS NOT DISTINCT FROM v_existing.title
    AND p_reports_to IS NOT DISTINCT FROM v_existing.reports_to;
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_members_self_update_allowed(
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  uuid,
  text
) TO authenticated;

DROP POLICY IF EXISTS "club_members_insert_self" ON public.club_members;
DROP POLICY IF EXISTS "club_members_insert_self_join" ON public.club_members;

CREATE POLICY "club_members_insert_self_join"
  ON public.club_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND access_level = 'member'
    AND (
      (
        status = 'active'
        AND EXISTS (
          SELECT 1
          FROM public.clubs AS c
          WHERE c.id = club_members.club_id
            AND c.membership_type = 'open'
        )
      )
      OR (
        status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM public.clubs AS c
          WHERE c.id = club_members.club_id
            AND c.membership_type = 'approval_required'
        )
      )
    )
  );

DROP POLICY IF EXISTS "club_members_update_privileged" ON public.club_members;
DROP POLICY IF EXISTS "Admins and execs can update members" ON public.club_members;

CREATE POLICY "club_members_update_privileged"
  ON public.club_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.club_has_permission(club_id, 'manage_members', auth.uid())
    OR public.club_has_permission(club_id, 'approve_members', auth.uid())
    OR public.club_has_permission(club_id, 'manage_roles', auth.uid())
  )
  WITH CHECK (
    public.club_members_self_update_allowed(
      id,
      club_id,
      user_id,
      role,
      status,
      joined_at,
      created_at,
      title,
      reports_to,
      access_level
    )
    OR public.club_has_permission(club_id, 'manage_members', auth.uid())
    OR public.club_has_permission(club_id, 'approve_members', auth.uid())
    OR public.club_has_permission(club_id, 'manage_roles', auth.uid())
  );
