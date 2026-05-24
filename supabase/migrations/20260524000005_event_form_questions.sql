CREATE TABLE IF NOT EXISTS event_form_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('text', 'multiple_choice', 'yes_no')),
  options jsonb,
  required boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_form_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES event_form_questions(id) ON DELETE CASCADE,
  answer text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, question_id)
);

ALTER TABLE event_form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_form_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view questions" ON event_form_questions;
CREATE POLICY "Club members can view questions"
ON event_form_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Executives and presidents can manage questions" ON event_form_questions;
CREATE POLICY "Executives and presidents can manage questions"
ON event_form_questions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Executives and presidents can update questions" ON event_form_questions;
CREATE POLICY "Executives and presidents can update questions"
ON event_form_questions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Executives and presidents can delete questions" ON event_form_questions;
CREATE POLICY "Executives and presidents can delete questions"
ON event_form_questions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Members can submit responses" ON event_form_responses;
CREATE POLICY "Members can submit responses"
ON event_form_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can view own responses" ON event_form_responses;
CREATE POLICY "Members can view own responses"
ON event_form_responses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Executives can view all responses" ON event_form_responses;
CREATE POLICY "Executives can view all responses"
ON event_form_responses FOR SELECT USING (true);
