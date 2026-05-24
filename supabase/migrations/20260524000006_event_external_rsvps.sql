CREATE TABLE IF NOT EXISTS event_external_rsvps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  answers jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_external_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit external RSVP" ON event_external_rsvps;
CREATE POLICY "Anyone can submit external RSVP"
ON event_external_rsvps FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Executives can view external RSVPs" ON event_external_rsvps;
CREATE POLICY "Executives can view external RSVPs"
ON event_external_rsvps FOR SELECT USING (true);
