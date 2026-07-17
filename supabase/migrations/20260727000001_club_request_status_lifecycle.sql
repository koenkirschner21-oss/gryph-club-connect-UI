-- Club creation requests: status lifecycle + submitter update/withdraw.
ALTER TABLE public.club_requests
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;

ALTER TABLE public.club_requests
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_requests_status_check'
      AND conrelid = 'public.club_requests'::regclass
  ) THEN
    ALTER TABLE public.club_requests DROP CONSTRAINT club_requests_status_check;
  END IF;
END $$;

ALTER TABLE public.club_requests
  ADD CONSTRAINT club_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'more_info', 'canceled'));

DROP POLICY IF EXISTS "Users can update own open club requests" ON public.club_requests;
CREATE POLICY "Users can update own open club requests"
  ON public.club_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = submitted_by
    AND status IN ('pending', 'more_info')
  )
  WITH CHECK (
    auth.uid() = submitted_by
    AND status IN ('pending', 'more_info', 'canceled')
  );
