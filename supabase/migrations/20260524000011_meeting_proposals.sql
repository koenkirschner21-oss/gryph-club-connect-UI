CREATE TABLE IF NOT EXISTS meeting_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  location_type text CHECK (location_type IN ('in_person', 'online')),
  location_text text,
  meeting_link text,
  audience text DEFAULT 'everyone',
  invited_members uuid[] DEFAULT '{}',
  time_slots jsonb NOT NULL,
  votes jsonb DEFAULT '{}',
  status text DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'cancelled')),
  confirmed_slot jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invited members can view proposals"
ON meeting_proposals FOR SELECT USING (true);

CREATE POLICY "Executives can create proposals"
ON meeting_proposals FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can vote and executives can confirm"
ON meeting_proposals FOR UPDATE USING (true);
