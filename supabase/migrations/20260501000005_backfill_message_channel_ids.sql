-- =============================================================================
-- P1.2 — Layer 000005 — Data only
-- Seeds default channels per club and backfills messages.channel_id only.
-- No ALTER TABLE / CREATE INDEX / FK DDL, no RLS, no policy statements,
-- no DROP COLUMN.
--
-- Prerequisites: migrations that created legacy public.messages.channel (text).
-- Applies before 20260501000007 drops that column (see ordering).
-- =============================================================================

INSERT INTO public.channels (club_id, name, description, is_announcement_only)
SELECT c.id, 'general', 'General discussion', false
FROM public.clubs AS c
ON CONFLICT (club_id, name) DO NOTHING;

INSERT INTO public.channels (club_id, name, description, is_announcement_only)
SELECT c.id, 'announcements', 'Club announcements', true
FROM public.clubs AS c
ON CONFLICT (club_id, name) DO NOTHING;

-- Map legacy TEXT channel names to canonical channel IDs (club-scoped rows).
UPDATE public.messages AS m
SET channel_id = c.id
FROM public.channels AS c
WHERE m.channel_id IS NULL
  AND c.club_id = m.club_id
  AND c.name = m.channel;

-- Remaining NULLs → club #general
UPDATE public.messages AS m
SET channel_id = c.id
FROM public.channels AS c
WHERE m.channel_id IS NULL
  AND c.club_id = m.club_id
  AND c.name = 'general';
