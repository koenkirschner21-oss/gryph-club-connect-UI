ALTER TABLE public.club_claim_requests
  DROP CONSTRAINT IF EXISTS club_claim_requests_status_check;

ALTER TABLE public.club_claim_requests
  ADD CONSTRAINT club_claim_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'more_info', 'canceled'));

DROP POLICY IF EXISTS "Users can cancel own pending claim requests" ON public.club_claim_requests;
CREATE POLICY "Users can cancel own pending claim requests"
  ON public.club_claim_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = submitted_by AND status = 'pending')
  WITH CHECK (auth.uid() = submitted_by AND status = 'canceled');
