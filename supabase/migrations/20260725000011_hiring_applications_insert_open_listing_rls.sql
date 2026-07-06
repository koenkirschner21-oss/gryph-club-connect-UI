-- Block applications to closed or past-deadline listings at the RLS boundary.
-- Frontend apply uses apply_to_hiring_listing (SECURITY DEFINER), which enforces the
-- same rules; this closes the direct PostgREST insert bypass.

DROP POLICY IF EXISTS "Logged in users can apply" ON public.hiring_applications;

CREATE POLICY "hiring_applications_insert_open_listing"
  ON public.hiring_applications
  FOR INSERT
  WITH CHECK (
    auth.uid() = applicant_id
    AND EXISTS (
      SELECT 1
      FROM public.hiring_listings AS hl
      WHERE hl.id = listing_id
        AND hl.is_open = true
        AND (hl.deadline IS NULL OR hl.deadline >= CURRENT_DATE)
    )
  );
