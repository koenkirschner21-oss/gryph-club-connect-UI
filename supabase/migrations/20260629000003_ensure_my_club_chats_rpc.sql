-- Callable chat provisioning for the current member (self-heal) and exec join approval.

CREATE OR REPLACE FUNCTION public.ensure_my_club_chats(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_club_member(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not an active club member';
  END IF;

  PERFORM public.provision_club_member_chats(p_club_id, auth.uid(), false);
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

GRANT EXECUTE ON FUNCTION public.ensure_my_club_chats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_club_member_chats_for_user(uuid, uuid, boolean) TO authenticated;
