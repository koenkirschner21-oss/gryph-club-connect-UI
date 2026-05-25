CREATE TABLE IF NOT EXISTS chat_polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  question text NOT NULL,
  options jsonb NOT NULL,
  votes jsonb DEFAULT '{}',
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view polls"
ON chat_polls FOR SELECT USING (true);

CREATE POLICY "Members can create polls"
ON chat_polls FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can vote on polls"
ON chat_polls FOR UPDATE USING (true);
