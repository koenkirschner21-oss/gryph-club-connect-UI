-- =============================================================================
-- P1.2 — Layer 000004 — Schema only
-- Tables, columns, indexes, foreign keys only.
-- No INSERT/UPDATE, no RLS, no ENABLE/DISABLE ROW LEVEL SECURITY, no policies.
-- FK uses pg_catalog guard (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
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

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'f'
      AND c.conname = 'messages_channel_id_fkey'
      AND n.nspname = 'public'
      AND t.relname = 'messages'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_channel_id_fkey
      FOREIGN KEY (channel_id)
      REFERENCES public.channels(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
