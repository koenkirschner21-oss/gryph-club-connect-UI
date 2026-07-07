-- Critical: chat access now requires active club membership, not just an existing
-- conversation_members row. Orphaned conversation_members rows (after leave,
-- removal, or demotion without de-provisioning) no longer grant read or write.
--
-- Additive on top of the message-history cutoff (can_view_direct_message still
-- applies created_at >= joined_at for SELECT on direct_messages / chat_polls).
--
-- Club-linked conversations (club_id IS NOT NULL): require conversation_members
-- row AND is_active_club_member(club_id, user).
-- Non-club conversations (club_id IS NULL): conversation_members row only.

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
    INNER JOIN public.conversations AS c
      ON c.id = cm.conversation_id
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = p_user_id
      AND (
        c.club_id IS NULL
        OR public.is_active_club_member(c.club_id, p_user_id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
