-- =============================================================================
-- P1.2 — Layer 000006 — RLS / policies only
-- Rewrites public.channels and public.messages policies to channel_id semantics.
-- No ALTER TABLE / CREATE INDEX / DROP COLUMN / NOT NULL DDL.
--
-- Must run before 20260501000007: drop every policy referencing messages.channel
-- (TEXT), then finalize schema in that migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Channels (scoped access; aligns with migrations that used older policy names)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Messages — remove TEXT-channel INSERT policies before column drop (000007).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Club members can send messages" ON public.messages;

DROP POLICY IF EXISTS "Active members can send non-announcement messages" ON public.messages;

DROP POLICY IF EXISTS "Admins and execs can send announcements" ON public.messages;

DROP POLICY IF EXISTS "Members can send messages by channel permissions" ON public.messages;

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

DROP POLICY IF EXISTS "Messages are viewable by club members" ON public.messages;

DROP POLICY IF EXISTS "Enable read access for messages" ON public.messages;

DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;

DROP POLICY IF EXISTS "Messages visible to club members only" ON public.messages;

DROP POLICY IF EXISTS "Club members can view messages" ON public.messages;

DROP POLICY IF EXISTS "messages_select_scoped" ON public.messages;

CREATE POLICY "messages_select_scoped"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );
