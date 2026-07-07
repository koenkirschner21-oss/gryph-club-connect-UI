-- Lock down the legacy channels/messages chat stack. The modern UI uses
-- conversations / conversation_members / direct_messages exclusively; these
-- tables and their hooks (useClubChannels, useClubMessages) are not mounted
-- anywhere in the app. Tables are retained for now; access is platform-admin
-- only to eliminate the latent exposure surface.

-- ─── channels ───
DROP POLICY IF EXISTS "channels_select" ON public.channels;
DROP POLICY IF EXISTS "channels_select_scoped" ON public.channels;
DROP POLICY IF EXISTS "channels_select_tenant" ON public.channels;
DROP POLICY IF EXISTS "channels_insert_admin" ON public.channels;
DROP POLICY IF EXISTS "channels_insert_privileged" ON public.channels;
DROP POLICY IF EXISTS "channels_update_admin" ON public.channels;
DROP POLICY IF EXISTS "channels_update_privileged" ON public.channels;
DROP POLICY IF EXISTS "channels_delete_admin" ON public.channels;
DROP POLICY IF EXISTS "channels_delete_privileged" ON public.channels;

CREATE POLICY "legacy_channels_platform_admin"
  ON public.channels
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  );

-- ─── messages (legacy channel messages, not direct_messages) ───
DROP POLICY IF EXISTS "Club members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Active members can send non-announcement messages" ON public.messages;
DROP POLICY IF EXISTS "Admins and execs can send announcements" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages by channel permissions" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_channel_policy" ON public.messages;
DROP POLICY IF EXISTS "Club members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Messages are viewable by club members" ON public.messages;
DROP POLICY IF EXISTS "messages_select_scoped" ON public.messages;
DROP POLICY IF EXISTS "messages_select_tenant" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "Messages visible to club members only" ON public.messages;
DROP POLICY IF EXISTS "Club members can post in general" ON public.messages;
DROP POLICY IF EXISTS "Admins and execs can post in announcements" ON public.messages;

CREATE POLICY "legacy_messages_platform_admin"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
