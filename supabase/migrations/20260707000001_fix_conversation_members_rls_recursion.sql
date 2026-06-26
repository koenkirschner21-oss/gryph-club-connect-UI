-- Fix infinite RLS recursion on conversation_members (42P17).
-- Root cause: legacy + matrix policies on conversations/direct_messages read
-- conversation_members directly inside RLS, and conversation_members INSERT
-- WITH CHECK reads conversations — forming a loop. Also replace co-member
-- SELECT with a SECURITY DEFINER membership lookup (same pattern as club_members).

CREATE OR REPLACE FUNCTION public.is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members AS cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_insert_conversation_member(
  p_conversation_id uuid,
  p_target_user_id uuid,
  p_actor uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_created_by uuid;
BEGIN
  SELECT c.club_id, c.created_by
  INTO v_club_id, v_created_by
  FROM public.conversations AS c
  WHERE c.id = p_conversation_id;

  IF v_club_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_active_club_member(v_club_id, p_target_user_id) THEN
    RETURN false;
  END IF;

  IF p_target_user_id = p_actor THEN
    RETURN true;
  END IF;

  IF v_created_by = p_actor THEN
    RETURN true;
  END IF;

  IF public.is_conversation_member(p_conversation_id, p_actor) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_insert_conversation_member(uuid, uuid, uuid) TO authenticated;

-- ─── conversation_members ───
DROP POLICY IF EXISTS "conversation_members_select" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view co-members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view own membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can join conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;

CREATE POLICY "conversation_members_select_own"
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "conversation_members_select_peers"
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "conversation_members_insert"
  ON public.conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_insert_conversation_member(conversation_id, user_id, auth.uid())
  );

-- ─── conversations (drop legacy policies that subquery conversation_members) ───
DROP POLICY IF EXISTS "Members can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update conversations they are in" ON public.conversations;
DROP POLICY IF EXISTS "Members can insert conversations" ON public.conversations;

DROP POLICY IF EXISTS "conversations_select_member" ON public.conversations;
CREATE POLICY "conversations_select_member"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(id, auth.uid())
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
  USING (public.is_conversation_member(id, auth.uid()));

-- ─── direct_messages (drop legacy policies that subquery conversation_members) ───
DROP POLICY IF EXISTS "Members can view direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Members can send direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Members can update own messages" ON public.direct_messages;

DROP POLICY IF EXISTS "direct_messages_select_member" ON public.direct_messages;
CREATE POLICY "direct_messages_select_member"
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "direct_messages_insert_member" ON public.direct_messages;
CREATE POLICY "direct_messages_insert_member"
  ON public.direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "direct_messages_update_member" ON public.direct_messages;
CREATE POLICY "direct_messages_update_member"
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );
