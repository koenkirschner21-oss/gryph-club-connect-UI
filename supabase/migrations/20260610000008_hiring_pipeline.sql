ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS sub_status text DEFAULT 'submitted'
  CHECK (sub_status IN ('submitted', 'viewed', 'reviewed', 'notes_added',
    'interview_invite_sent', 'interview_scheduled', 'interview_completed',
    'offer_sent', 'offer_accepted', 'offer_declined', 'rejected', 'withdrawn'));

ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS interview_times jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS selected_interview_time text;
ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS interview_type text CHECK (interview_type IN ('online', 'in_person', 'phone'));
ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS meeting_location text;
ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS meeting_link text;
ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS offered_access_level text;
ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS offered_role_title text;
ALTER TABLE public.hiring_applications ADD COLUMN IF NOT EXISTS position_handling text DEFAULT 'keep_open'
  CHECK (position_handling IN ('keep_open', 'close_after_accept', 'close_now'));

CREATE TABLE IF NOT EXISTS public.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.hiring_applications(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id),
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_notes_application_created
  ON public.application_notes(application_id, created_at ASC);

ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privileged club members can manage notes" ON public.application_notes;
CREATE POLICY "Privileged club members can manage notes"
  ON public.application_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hiring_applications ha
      JOIN public.hiring_listings hl ON ha.listing_id = hl.id
      JOIN public.club_members cm ON cm.club_id = hl.club_id
      WHERE ha.id = application_notes.application_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'executive')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hiring_applications ha
      JOIN public.hiring_listings hl ON ha.listing_id = hl.id
      JOIN public.club_members cm ON cm.club_id = hl.club_id
      WHERE ha.id = application_notes.application_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'executive')
    )
  );

DROP POLICY IF EXISTS "Executives can view club hiring applications" ON public.hiring_applications;
CREATE POLICY "Executives can view club hiring applications"
  ON public.hiring_applications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.hiring_listings hl
      JOIN public.club_members cm ON cm.club_id = hl.club_id
      WHERE hl.id = hiring_applications.listing_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'executive')
    )
  );

DROP POLICY IF EXISTS "Executives can update club hiring applications" ON public.hiring_applications;
CREATE POLICY "Executives can update club hiring applications"
  ON public.hiring_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hiring_listings hl
      JOIN public.club_members cm ON cm.club_id = hl.club_id
      WHERE hl.id = hiring_applications.listing_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'executive')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hiring_listings hl
      JOIN public.club_members cm ON cm.club_id = hl.club_id
      WHERE hl.id = hiring_applications.listing_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'executive')
    )
  );
