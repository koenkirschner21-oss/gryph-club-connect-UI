-- Platform admins must list and approve/reject new-club creation requests (club_requests).
-- Users keep INSERT + SELECT on their own rows only.

DROP POLICY IF EXISTS "Platform admins manage club requests" ON public.club_requests;
CREATE POLICY "Platform admins manage club requests"
  ON public.club_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );
