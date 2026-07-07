-- Defense-in-depth: re-check current executive/president status at read/write time
-- for the default Executive Team chat. Complements Batch 3 de-provisioning — if a
-- demoted executive still has a stale conversation_members row, RLS blocks access.
--
-- IDENTIFIER CHOICE (name-based, intentional):
-- Executive Team is identified by type = 'group' AND lower(trim(name)) = 'executive team'.
-- No new column (e.g. is_default_executive_chat) was added in this batch — provisioning,
-- de-provisioning, and unique index conversations_club_default_group_name_unique all
-- use the same name convention. Renaming "Executive Team" in the UI/DB without updating
-- these helpers would break access control and provisioning. A durable flag may be
-- added in a future migration if custom exec-named groups are introduced.

-- ─── Helpers ───

CREATE OR REPLACE FUNCTION public.is_default_executive_team_conversation(
  p_conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations AS c
    WHERE c.id = p_conversation_id
      AND c.type = 'group'
      AND lower(trim(c.name)) = 'executive team'
  );
$$;

-- Read/write gate for conversations: active membership (via is_conversation_member)
-- plus, for the default Executive Team chat only, current exec/president status.
CREATE OR REPLACE FUNCTION public.can_access_conversation(
  p_conversation_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_conversation_member(p_conversation_id, p_user_id)
    AND (
      NOT public.is_default_executive_team_conversation(p_conversation_id)
      OR EXISTS (
        SELECT 1
        FROM public.conversations AS c
        WHERE c.id = p_conversation_id
          AND c.club_id IS NOT NULL
          AND public.is_club_chat_executive(c.club_id, p_user_id)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_default_executive_team_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(uuid, uuid) TO authenticated;

-- Message visibility cutoff: additive exec re-check on top of joined_at gate.
CREATE OR REPLACE FUNCTION public.can_view_direct_message(
  p_conversation_id uuid,
  p_created_at timestamptz,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_access_conversation(p_conversation_id, p_user_id)
    AND p_created_at >= COALESCE(
      public.conversation_member_joined_at(p_conversation_id, p_user_id),
      p_created_at
    );
$$;

-- ─── conversations ───
DROP POLICY IF EXISTS "conversations_select_member" ON public.conversations;
CREATE POLICY "conversations_select_member"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_conversation(id, auth.uid())
    OR (
      created_by = auth.uid()
      AND public.is_active_club_member(club_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "conversations_update_member" ON public.conversations;
CREATE POLICY "conversations_update_member"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (public.can_access_conversation(id, auth.uid()));

-- ─── direct_messages ───
DROP POLICY IF EXISTS "direct_messages_insert_member" ON public.direct_messages;
CREATE POLICY "direct_messages_insert_member"
  ON public.direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_access_conversation(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "direct_messages_update_sender" ON public.direct_messages;
CREATE POLICY "direct_messages_update_sender"
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND public.can_access_conversation(conversation_id, auth.uid())
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_access_conversation(conversation_id, auth.uid())
  );

-- direct_messages_select_member unchanged (uses can_view_direct_message above).

-- ─── chat_polls ───
DROP POLICY IF EXISTS "chat_polls_insert_member" ON public.chat_polls;
CREATE POLICY "chat_polls_insert_member"
  ON public.chat_polls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_access_conversation(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "chat_polls_update_member" ON public.chat_polls;
CREATE POLICY "chat_polls_update_member"
  ON public.chat_polls
  FOR UPDATE
  TO authenticated
  USING (public.can_access_conversation(conversation_id, auth.uid()))
  WITH CHECK (public.can_access_conversation(conversation_id, auth.uid()));

-- chat_polls_select_member unchanged (uses can_view_direct_message).

-- ─── message_reactions ───
DROP POLICY IF EXISTS "message_reactions_select_member" ON public.message_reactions;
CREATE POLICY "message_reactions_select_member"
  ON public.message_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.direct_messages AS dm
      WHERE dm.id = message_reactions.message_id
        AND public.can_access_conversation(dm.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_reactions_insert_member" ON public.message_reactions;
CREATE POLICY "message_reactions_insert_member"
  ON public.message_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.direct_messages AS dm
      WHERE dm.id = message_reactions.message_id
        AND public.can_access_conversation(dm.conversation_id, auth.uid())
    )
  );

-- ─── read-receipt RPCs ───
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_joined_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.can_access_conversation(p_conversation_id, v_user) THEN
    RAISE EXCEPTION 'Not a conversation member';
  END IF;

  v_joined_at := public.conversation_member_joined_at(p_conversation_id, v_user);

  UPDATE public.direct_messages
  SET read_by = array_append(COALESCE(read_by, '{}'), v_user)
  WHERE conversation_id = p_conversation_id
    AND sender_id IS DISTINCT FROM v_user
    AND NOT (v_user = ANY(COALESCE(read_by, '{}')))
    AND created_at >= COALESCE(v_joined_at, created_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_direct_message_read(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_conversation_id uuid;
  v_joined_at timestamptz;
  v_created_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT conversation_id, created_at
  INTO v_conversation_id, v_created_at
  FROM public.direct_messages
  WHERE id = p_message_id;

  IF v_conversation_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_access_conversation(v_conversation_id, v_user) THEN
    RAISE EXCEPTION 'Not a conversation member';
  END IF;

  v_joined_at := public.conversation_member_joined_at(v_conversation_id, v_user);
  IF v_created_at < COALESCE(v_joined_at, v_created_at) THEN
    RETURN;
  END IF;

  UPDATE public.direct_messages
  SET read_by = array_append(COALESCE(read_by, '{}'), v_user)
  WHERE id = p_message_id
    AND sender_id IS DISTINCT FROM v_user
    AND NOT (v_user = ANY(COALESCE(read_by, '{}')));
END;
$$;

NOTIFY pgrst, 'reload schema';
