CREATE TABLE IF NOT EXISTS public.club_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  club_name text,
  reporter_id uuid REFERENCES auth.users(id),
  reason text NOT NULL CHECK (reason IN (
    'incorrect_information', 'duplicate_club', 'no_longer_active',
    'inappropriate_content', 'fake_unauthorized', 'wrong_contact_links', 'other'
  )),
  description text,
  current_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_reports_status_created
  ON public.club_reports(status, created_at DESC);

ALTER TABLE public.club_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit reports" ON public.club_reports;
CREATE POLICY "Users can submit reports"
  ON public.club_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can manage reports" ON public.club_reports;
CREATE POLICY "Admins can manage reports"
  ON public.club_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email LIKE '%@uoguelph.ca'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email LIKE '%@uoguelph.ca'
    )
  );

DROP POLICY IF EXISTS "Platform admins can manage club reports" ON public.club_reports;
CREATE POLICY "Platform admins can manage club reports"
  ON public.club_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );
