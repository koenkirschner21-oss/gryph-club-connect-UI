-- Allow analytics viewers to read hiring applications for their club (aggregates only in UI).

DROP POLICY IF EXISTS "hiring_applications_select_analytics" ON public.hiring_applications;
CREATE POLICY "hiring_applications_select_analytics"
  ON public.hiring_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hiring_listings AS hl
      WHERE hl.id = hiring_applications.listing_id
        AND public.club_has_permission(hl.club_id, 'view_analytics', auth.uid())
    )
  );
