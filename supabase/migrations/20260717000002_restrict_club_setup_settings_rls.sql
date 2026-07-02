-- Restrict club settings/setup updates to presidents and users with explicit
-- club-settings permissions. Remove manage_members / manage_roles as alternate
-- paths for updating clubs (setup checklist fields live on clubs).

DROP POLICY IF EXISTS "clubs_update_privileged" ON public.clubs;
CREATE POLICY "clubs_update_privileged"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.club_has_permission(id, 'manage_club_settings', auth.uid())
    OR public.club_has_permission(id, 'edit_club_settings', auth.uid())
  );
