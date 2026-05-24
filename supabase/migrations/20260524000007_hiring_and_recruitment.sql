CREATE TABLE IF NOT EXISTS club_positions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  requirements text,
  position_type text DEFAULT 'executive',
  deadline timestamptz,
  is_open boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS position_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id uuid REFERENCES club_positions(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('text', 'multiple_choice', 'yes_no')),
  options jsonb,
  required boolean DEFAULT false,
  order_index integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS position_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id uuid REFERENCES club_positions(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb DEFAULT '{}',
  status text DEFAULT 'applied' CHECK (status IN ('applied', 'under_review', 'interview', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(position_id, applicant_id)
);

ALTER TABLE club_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view open positions" ON club_positions;
CREATE POLICY "Anyone can view open positions"
ON club_positions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Executives can manage positions" ON club_positions;
CREATE POLICY "Executives can manage positions"
ON club_positions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Executives can update positions" ON club_positions;
CREATE POLICY "Executives can update positions"
ON club_positions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Executives can delete positions" ON club_positions;
CREATE POLICY "Executives can delete positions"
ON club_positions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Anyone can view position questions" ON position_questions;
CREATE POLICY "Anyone can view position questions"
ON position_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Executives can manage questions" ON position_questions;
CREATE POLICY "Executives can manage questions"
ON position_questions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Executives can update questions" ON position_questions;
CREATE POLICY "Executives can update questions"
ON position_questions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Executives can delete questions" ON position_questions;
CREATE POLICY "Executives can delete questions"
ON position_questions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Members can apply" ON position_applications;
CREATE POLICY "Members can apply"
ON position_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Applicants can view own applications" ON position_applications;
CREATE POLICY "Applicants can view own applications"
ON position_applications FOR SELECT USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Executives can view all applications" ON position_applications;
CREATE POLICY "Executives can view all applications"
ON position_applications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Executives can update application status" ON position_applications;
CREATE POLICY "Executives can update application status"
ON position_applications FOR UPDATE USING (true);
