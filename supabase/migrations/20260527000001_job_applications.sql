CREATE TABLE IF NOT EXISTS job_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id uuid,
  applicant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  why_text text,
  experience_text text,
  portfolio_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants can insert own applications"
ON job_applications FOR INSERT
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Applicants can view own applications"
ON job_applications FOR SELECT
USING (auth.uid() = applicant_id OR club_id IN (
  SELECT club_id FROM club_members
  WHERE user_id = auth.uid()
  AND role IN ('owner', 'executive')
));

CREATE POLICY "Executives can update application status"
ON job_applications FOR UPDATE
USING (club_id IN (
  SELECT club_id FROM club_members
  WHERE user_id = auth.uid()
  AND role IN ('owner', 'executive')
));
