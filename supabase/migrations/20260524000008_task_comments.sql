CREATE TABLE IF NOT EXISTS task_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view task comments" ON task_comments;
CREATE POLICY "Club members can view task comments"
ON task_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members can add comments" ON task_comments;
CREATE POLICY "Members can add comments"
ON task_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can delete own comments" ON task_comments;
CREATE POLICY "Members can delete own comments"
ON task_comments FOR DELETE
USING (auth.uid() = user_id);
