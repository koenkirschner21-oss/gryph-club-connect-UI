-- Chat read receipts (RLS-safe), message editing, live sidebar refresh.

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Keep conversation ordering fresh when new messages arrive (powers live sidebar badges).
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS direct_messages_touch_conversation ON public.direct_messages;
CREATE TRIGGER direct_messages_touch_conversation
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_conversation_on_message();

-- Recipients mark threads read without needing UPDATE on other users' rows.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, v_user) THEN
    RAISE EXCEPTION 'Not a conversation member';
  END IF;

  UPDATE public.direct_messages
  SET read_by = array_append(COALESCE(read_by, '{}'), v_user)
  WHERE conversation_id = p_conversation_id
    AND sender_id IS DISTINCT FROM v_user
    AND NOT (v_user = ANY(COALESCE(read_by, '{}')));
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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT conversation_id
  INTO v_conversation_id
  FROM public.direct_messages
  WHERE id = p_message_id;

  IF v_conversation_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_conversation_member(v_conversation_id, v_user) THEN
    RAISE EXCEPTION 'Not a conversation member';
  END IF;

  UPDATE public.direct_messages
  SET read_by = array_append(COALESCE(read_by, '{}'), v_user)
  WHERE id = p_message_id
    AND sender_id IS DISTINCT FROM v_user
    AND NOT (v_user = ANY(COALESCE(read_by, '{}')));
END;
$$;

ALTER FUNCTION public.mark_conversation_read(uuid) OWNER TO postgres;
ALTER FUNCTION public.mark_direct_message_read(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_direct_message_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_direct_message_read(uuid) TO authenticated;

-- Senders may edit their own message content; read receipts use RPC above.
DROP POLICY IF EXISTS "direct_messages_update_member" ON public.direct_messages;
CREATE POLICY "direct_messages_update_sender"
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;
