-- C3: Restrict direct message visibility to on/after conversation_members.joined_at.

CREATE OR REPLACE FUNCTION public.conversation_member_joined_at(
  p_conversation_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.joined_at
  FROM public.conversation_members AS cm
  WHERE cm.conversation_id = p_conversation_id
    AND cm.user_id = p_user_id
  LIMIT 1;
$$;

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
    public.is_conversation_member(p_conversation_id, p_user_id)
    AND p_created_at >= COALESCE(
      public.conversation_member_joined_at(p_conversation_id, p_user_id),
      p_created_at
    );
$$;

GRANT EXECUTE ON FUNCTION public.conversation_member_joined_at(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_direct_message(uuid, timestamptz, uuid) TO authenticated;

DROP POLICY IF EXISTS "direct_messages_select_member" ON public.direct_messages;
CREATE POLICY "direct_messages_select_member"
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_direct_message(conversation_id, created_at, auth.uid())
  );

-- Polls: same visibility cutoff as messages in a conversation.
DROP POLICY IF EXISTS "Members can view polls" ON public.chat_polls;
CREATE POLICY "chat_polls_select_member"
  ON public.chat_polls
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_direct_message(
      conversation_id,
      created_at,
      auth.uid()
    )
  );

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

  IF NOT public.is_conversation_member(p_conversation_id, v_user) THEN
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

  IF NOT public.is_conversation_member(v_conversation_id, v_user) THEN
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
