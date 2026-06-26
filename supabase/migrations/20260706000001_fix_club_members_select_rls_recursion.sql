-- Fix infinite RLS recursion on club_members SELECT (42P17).
-- club_members_select_tenant re-introduced in 20260703000001 queried club_members
-- inside its own policy. Use SECURITY DEFINER is_active_club_member() instead.

DROP POLICY IF EXISTS "club_members_select_tenant" ON public.club_members;
CREATE POLICY "club_members_select_tenant"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_active_club_member(club_id, auth.uid())
  );
