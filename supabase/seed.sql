-- Seed file for local Supabase development
-- This file is referenced in supabase/config.toml

INSERT INTO public.clubs (id, name, description, join_code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Club',
  'A club for local development testing',
  'TESTCODE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.channels (club_id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'general', 'General discussion'),
  ('00000000-0000-0000-0000-000000000001', 'announcements', 'Announcements')
ON CONFLICT (club_id, name) DO NOTHING;
