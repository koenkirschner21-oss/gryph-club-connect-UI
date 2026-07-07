-- Scope chat_polls and message_reactions RLS to conversation members only.
-- Removes leftover `USING (true)` policies that exposed cross-club data:
--   * chat_polls UPDATE `USING (true)` allowed any authenticated user to update
--     any poll row (vote manipulation across clubs via direct API).
--   * message_reactions SELECT `USING (true)` allowed any authenticated user to
--     read every reaction row across all clubs (who reacted to what, on which
--     message).
-- Active conversation members retain normal ability to vote/view polls and
-- react/view reactions — this is a scoping fix, not a feature removal.

-- ─── chat_polls ───
-- SELECT is already scoped by chat_polls_select_member (20260718000003, cutoff).
-- Retire the legacy permissive policies and scope INSERT/UPDATE to membership.
DROP POLICY IF EXISTS "Members can view polls" ON public.chat_polls;
DROP POLICY IF EXISTS "Members can create polls" ON public.chat_polls;
DROP POLICY IF EXISTS "Members can vote on polls" ON public.chat_polls;

DROP POLICY IF EXISTS "chat_polls_insert_member" ON public.chat_polls;
CREATE POLICY "chat_polls_insert_member"
  ON public.chat_polls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "chat_polls_update_member" ON public.chat_polls;
CREATE POLICY "chat_polls_update_member"
  ON public.chat_polls
  FOR UPDATE
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()))
  WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()));

-- ─── message_reactions ───
-- Scope SELECT/INSERT/DELETE to members of the parent message's conversation.
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.message_reactions;

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
        AND public.is_conversation_member(dm.conversation_id, auth.uid())
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
        AND public.is_conversation_member(dm.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_reactions_delete_own" ON public.message_reactions;
CREATE POLICY "message_reactions_delete_own"
  ON public.message_reactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
