ALTER TABLE events ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_frequency text CHECK (recurrence_frequency IN ('weekly', 'biweekly', 'monthly'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_end_date timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES events(id) ON DELETE SET NULL;
