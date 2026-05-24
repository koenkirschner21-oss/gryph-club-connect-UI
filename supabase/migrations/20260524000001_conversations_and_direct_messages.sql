-- Conversations and direct messages (Instagram-style DMs per club).

CREATE TABLE IF NOT EXISTS conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  name text,
  avatar_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  content text,
  attachment_url text,
  attachment_type text,
  read_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_conversations_club_id ON public.conversations(club_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON public.direct_messages(conversation_id);

-- Profile FK aliases for PostgREST joins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_members_user_profile_fkey'
  ) THEN
    ALTER TABLE public.conversation_members
      ADD CONSTRAINT conversation_members_user_profile_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_sender_profile_fkey'
  ) THEN
    ALTER TABLE public.direct_messages
      ADD CONSTRAINT direct_messages_sender_profile_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── conversations ───
DROP POLICY IF EXISTS "conversations_select_member" ON public.conversations;
CREATE POLICY "conversations_select_member"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversations.id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversations_insert_club_member" ON public.conversations;
CREATE POLICY "conversations_insert_club_member"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    club_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.club_members AS m
      WHERE m.club_id = conversations.club_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
    AND (
      conversations.type = 'direct'
      OR EXISTS (
        SELECT 1 FROM public.club_members AS m
        WHERE m.club_id = conversations.club_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'
          AND m.role IN ('owner', 'executive')
      )
    )
  );

DROP POLICY IF EXISTS "conversations_update_member" ON public.conversations;
CREATE POLICY "conversations_update_member"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversations.id
        AND cm.user_id = auth.uid()
    )
  );

-- ─── conversation_members ───
DROP POLICY IF EXISTS "conversation_members_select" ON public.conversation_members;
CREATE POLICY "conversation_members_select"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;
CREATE POLICY "conversation_members_insert"
  ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations AS c
      INNER JOIN public.club_members AS m ON m.club_id = c.club_id
      WHERE c.id = conversation_members.conversation_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- ─── direct_messages ───
DROP POLICY IF EXISTS "direct_messages_select_member" ON public.direct_messages;
CREATE POLICY "direct_messages_select_member"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = direct_messages.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "direct_messages_insert_member" ON public.direct_messages;
CREATE POLICY "direct_messages_insert_member"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = direct_messages.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "direct_messages_update_member" ON public.direct_messages;
CREATE POLICY "direct_messages_update_member"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members AS cm
      WHERE cm.conversation_id = direct_messages.conversation_id
        AND cm.user_id = auth.uid()
    )
  );
