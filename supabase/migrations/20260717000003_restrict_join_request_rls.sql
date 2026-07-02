-- Restrict pending join-request visibility and approve/reject mutations to users
-- with explicit approve_members permission (president always passes).

DROP POLICY IF EXISTS "club_members_select_tenant" ON public.club_members;
CREATE POLICY "club_members_select_tenant"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      status = 'pending'
      AND public.club_has_permission(club_id, 'approve_members', auth.uid())
    )
    OR (
      COALESCE(status, 'active') <> 'pending'
      AND public.is_active_club_member(club_id, auth.uid())
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
    OR (
      status = 'pending'
      AND public.club_has_permission(club_id, 'approve_members', auth.uid())
    )
    OR (
      COALESCE(status, 'active') <> 'pending'
      AND (
        public.club_has_permission(club_id, 'manage_members', auth.uid())
        OR public.club_has_permission(club_id, 'manage_roles', auth.uid())
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.club_has_permission(club_id, 'approve_members', auth.uid())
    OR (
      COALESCE(status, 'active') <> 'pending'
      AND (
        public.club_has_permission(club_id, 'manage_members', auth.uid())
        OR public.club_has_permission(club_id, 'manage_roles', auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "club_members_delete_leave_or_manage" ON public.club_members;
DROP POLICY IF EXISTS "Admins and execs can delete members" ON public.club_members;
CREATE POLICY "club_members_delete_leave_or_manage"
  ON public.club_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      status = 'pending'
      AND public.club_has_permission(club_id, 'approve_members', auth.uid())
    )
    OR (
      COALESCE(status, 'active') <> 'pending'
      AND public.club_has_permission(club_id, 'manage_members', auth.uid())
    )
  );
