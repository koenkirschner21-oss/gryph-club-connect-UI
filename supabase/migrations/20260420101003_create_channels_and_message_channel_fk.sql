-- =============================================================================
-- Introduce first-class channels and connect messages.channel_id
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
CREATE POLICY "channels_select"
  ON public.channels
  FOR SELECT
  USING (
    club_id IN (
      SELECT club_members.club_id
      FROM public.club_members
      WHERE club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "channels_insert_admin" ON public.channels;
CREATE POLICY "channels_insert_admin"
  ON public.channels
  FOR INSERT
  WITH CHECK (
    club_id IN (
      SELECT club_members.club_id
      FROM public.club_members
      WHERE club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "channels_update_admin" ON public.channels;
CREATE POLICY "channels_update_admin"
  ON public.channels
  FOR UPDATE
  USING (
    club_id IN (
      SELECT club_members.club_id
      FROM public.club_members
      WHERE club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "channels_delete_admin" ON public.channels;
CREATE POLICY "channels_delete_admin"
  ON public.channels
  FOR DELETE
  USING (
    club_id IN (
      SELECT club_members.club_id
      FROM public.club_members
      WHERE club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

INSERT INTO public.channels (club_id, name, description, is_announcement_only)
SELECT id, 'general', 'General discussion', false
FROM public.clubs
ON CONFLICT (club_id, name) DO NOTHING;

INSERT INTO public.channels (club_id, name, description, is_announcement_only)
SELECT id, 'announcements', 'Club announcements', true
FROM public.clubs
ON CONFLICT (club_id, name) DO NOTHING;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);

UPDATE public.messages AS m
SET channel_id = c.id
FROM public.channels AS c
WHERE c.club_id = m.club_id
  AND c.name = m.channel
  AND m.channel_id IS NULL;

UPDATE public.messages AS m
SET channel_id = c.id
FROM public.channels AS c
WHERE c.club_id = m.club_id
  AND c.name = 'general'
  AND m.channel_id IS NULL;

DROP POLICY IF EXISTS "Active members can send non-announcement messages" ON public.messages;
DROP POLICY IF EXISTS "Admins and execs can send announcements" ON public.messages;

CREATE POLICY "Members can send messages by channel permissions"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND channel_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.channels AS ch
      WHERE ch.id = messages.channel_id
        AND ch.club_id = messages.club_id
        AND (
          ch.is_announcement_only = false
          OR EXISTS (
            SELECT 1
            FROM public.club_members AS cm
            WHERE cm.club_id = messages.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
              AND cm.role IN ('admin', 'exec')
          )
        )
    )
  );

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
  FOR EACH ROW EXECUTE FUNCTION public.ensure_default_channels_for_new_club();
