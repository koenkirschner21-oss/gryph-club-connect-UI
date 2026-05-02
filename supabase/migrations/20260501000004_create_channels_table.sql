-- =============================================================================
-- P1.2 — Channels + messages.channel_id (idempotent; aligns RLS naming)
-- =============================================================================
-- Prerequisite: 20260420 may have already created channels + channel_id.
-- This migration is safe to apply on top: ensures schema, renames SELECT RLS,
-- backfills channel_id, drops legacy messages.channel text, sets NOT NULL.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_announcement_only boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_channels_club_id ON public.channels(club_id);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channels_select" ON public.channels;
DROP POLICY IF EXISTS "channels_select_scoped" ON public.channels;

CREATE POLICY "channels_select_scoped"
  ON public.channels
  FOR SELECT
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "channels_insert_admin" ON public.channels;
CREATE POLICY "channels_insert_admin"
  ON public.channels
  FOR INSERT
  WITH CHECK (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'exec')
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "channels_update_admin" ON public.channels;
CREATE POLICY "channels_update_admin"
  ON public.channels
  FOR UPDATE
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "channels_delete_admin" ON public.channels;
CREATE POLICY "channels_delete_admin"
  ON public.channels
  FOR DELETE
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'exec')
    )
  );

INSERT INTO public.channels (club_id, name, description, is_announcement_only)
SELECT c.id, 'general', 'General discussion', false
FROM public.clubs AS c
ON CONFLICT (club_id, name) DO NOTHING;

INSERT INTO public.channels (club_id, name, description, is_announcement_only)
SELECT c.id, 'announcements', 'Club announcements', true
FROM public.clubs AS c
ON CONFLICT (club_id, name) DO NOTHING;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_channel_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_channel_id_fkey
      FOREIGN KEY (channel_id)
      REFERENCES public.channels(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);

-- Backfill from legacy text column when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'channel'
  ) THEN
    UPDATE public.messages AS m
    SET channel_id = c.id
    FROM public.channels AS c
    WHERE m.channel_id IS NULL
      AND c.club_id = m.club_id
      AND c.name = m.channel;

    UPDATE public.messages AS m
    SET channel_id = c.id
    FROM public.channels AS c
    WHERE m.channel_id IS NULL
      AND c.club_id = m.club_id
      AND c.name = 'general';
  END IF;
END $$;

-- Any stragglers → club #general
UPDATE public.messages AS m
SET channel_id = c.id
FROM public.channels AS c
WHERE m.channel_id IS NULL
  AND c.club_id = m.club_id
  AND c.name = 'general';

ALTER TABLE public.messages DROP COLUMN IF EXISTS channel;

ALTER TABLE public.messages
  ALTER COLUMN channel_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_default_channels_for_new_club()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.channels (club_id, name, description, is_announcement_only)
  VALUES
    (NEW.id, 'general', 'General discussion', false),
    (NEW.id, 'announcements', 'Club announcements', true)
  ON CONFLICT (club_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_channels_for_new_club ON public.clubs;
CREATE TRIGGER create_default_channels_for_new_club
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_channels_for_new_club();
