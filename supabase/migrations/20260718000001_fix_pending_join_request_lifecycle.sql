-- Pending join requests must not receive chat membership or welcome messages until
-- status becomes active. Defense-in-depth on provisioning RPCs + revoke stray access.

CREATE OR REPLACE FUNCTION public.provision_club_member_chats(
  p_club_id uuid,
  p_user_id uuid,
  p_post_join_message boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_general_id uuid;
  v_exec_id uuid;
  v_name text;
BEGIN
  IF NOT public.is_active_club_member(p_club_id, p_user_id) THEN
    RETURN;
  END IF;

  PERFORM public.ensure_club_default_conversations(p_club_id);

  v_general_id := public.get_club_group_conversation(p_club_id, 'General');
  PERFORM public.add_conversation_member_if_missing(v_general_id, p_user_id);

  IF public.is_club_chat_executive(p_club_id, p_user_id) THEN
    v_exec_id := public.get_club_group_conversation(p_club_id, 'Executive Team');
    PERFORM public.add_conversation_member_if_missing(v_exec_id, p_user_id);
  END IF;

  IF p_post_join_message THEN
    SELECT COALESCE(NULLIF(btrim(full_name), ''), 'A member')
    INTO v_name
    FROM public.profiles
    WHERE id = p_user_id;

    PERFORM public.post_conversation_system_message(
      v_general_id,
      v_name || ' just joined the club!',
      now()
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_club_member_chats_for_user(
  p_club_id uuid,
  p_user_id uuid,
  p_post_join_message boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_club_member(p_club_id, p_user_id) THEN
    RAISE EXCEPTION 'Not an active club member';
  END IF;

  IF p_user_id = auth.uid() THEN
    PERFORM public.provision_club_member_chats(
      p_club_id,
      p_user_id,
      p_post_join_message
    );
    RETURN;
  END IF;

  IF NOT (
    public.is_club_president(p_club_id, auth.uid())
    OR public.is_club_executive(p_club_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to provision chats for this member';
  END IF;

  PERFORM public.provision_club_member_chats(
    p_club_id,
    p_user_id,
    p_post_join_message
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_revoke_pending_member_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    DELETE FROM public.conversation_members AS cm
    USING public.conversations AS c
    WHERE c.id = cm.conversation_id
      AND c.club_id = NEW.club_id
      AND cm.user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_club_member_revoke_pending_chats ON public.club_members;
CREATE TRIGGER on_club_member_revoke_pending_chats
  AFTER INSERT OR UPDATE OF status ON public.club_members
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.trg_revoke_pending_member_chats();
