-- Idempotent catch-up for objects cherry-picked without migration history.
-- Covers gaps found during AUDIT-1 reconciliation (20260701).

-- events.notes (20260617000001)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

COMMENT ON COLUMN public.events.notes IS
  'Internal post-event notes and recap for club executives; not shown on public event pages.';

-- tasks.status includes cancelled (20260615000001)
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled'));

-- club_positions hiring linkage (20260530000003, 20260530000005)
ALTER TABLE public.club_positions
  ADD COLUMN IF NOT EXISTS commitment_level text DEFAULT 'flexible';

ALTER TABLE public.club_positions
  DROP CONSTRAINT IF EXISTS club_positions_commitment_level_check;

ALTER TABLE public.club_positions
  ADD CONSTRAINT club_positions_commitment_level_check
  CHECK (commitment_level IN ('flexible', 'part_time', 'weekly_hours'));

ALTER TABLE public.club_positions
  ADD COLUMN IF NOT EXISTS weekly_hours integer;

ALTER TABLE public.club_positions
  ADD COLUMN IF NOT EXISTS hiring_listing_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'club_positions_hiring_listing_id_fkey'
  ) THEN
    ALTER TABLE public.club_positions
      ADD CONSTRAINT club_positions_hiring_listing_id_fkey
      FOREIGN KEY (hiring_listing_id) REFERENCES public.hiring_listings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- hiring_applications profile embed FK (20260603000003)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hiring_applications_applicant_fk'
  ) THEN
    ALTER TABLE public.hiring_applications
      ADD CONSTRAINT hiring_applications_applicant_fk
      FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- club claim cancel flow (20260614000002)
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
