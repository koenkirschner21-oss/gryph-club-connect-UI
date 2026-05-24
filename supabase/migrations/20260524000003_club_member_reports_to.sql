ALTER TABLE club_members
ADD COLUMN IF NOT EXISTS reports_to uuid REFERENCES auth.users(id);
