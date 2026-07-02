-- Admin club approval: assign president membership without RLS false negatives.
-- The creator trigger may already insert the row; client upsert then fails on UPDATE
-- because platform admins lack club_members UPDATE for other users.

CREATE OR REPLACE FUNCTION public.club_has_active_president_membership(
  p_club_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
      AND cm.role = 'owner'
      AND cm.access_level = 'president'
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_president_membership(
  p_club_id uuid,
  p_user_id uuid,
  p_title text DEFAULT 'President'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text := COALESCE(NULLIF(btrim(p_title), ''), 'President');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_admins AS pa
    WHERE pa.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to assign president membership';
  END IF;

  IF p_club_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Club and user are required';
  END IF;

  INSERT INTO public.club_members (
    club_id,
    user_id,
    role,
    access_level,
    status,
    title
  )
  VALUES (
    p_club_id,
    p_user_id,
    'owner',
    'president',
    'active',
    v_title
  )
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET
    role = 'owner',
    access_level = 'president',
    status = 'active',
    title = COALESCE(NULLIF(btrim(EXCLUDED.title), ''), club_members.title);

  RETURN public.club_has_active_president_membership(p_club_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_has_active_president_membership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_president_membership(uuid, uuid, text) TO authenticated;
