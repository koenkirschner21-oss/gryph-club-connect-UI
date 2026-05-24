CREATE TABLE IF NOT EXISTS club_resource_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_resource_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view resource links"
ON club_resource_links FOR SELECT USING (true);

CREATE POLICY "Executives can manage resource links"
ON club_resource_links FOR INSERT WITH CHECK (true);

CREATE POLICY "Executives can delete resource links"
ON club_resource_links FOR DELETE USING (true);
