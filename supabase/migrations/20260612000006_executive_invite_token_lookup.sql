CREATE OR REPLACE FUNCTION public.get_executive_invite_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.executive_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.executive_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_invite.id,
    'club_id', v_invite.club_id,
    'invited_by', v_invite.invited_by,
    'invited_email', v_invite.invited_email,
    'invited_user_id', v_invite.invited_user_id,
    'access_level', v_invite.access_level,
    'role_title', v_invite.role_title,
    'optional_message', v_invite.optional_message,
    'status', v_invite.status,
    'token', v_invite.token,
    'created_at', v_invite.created_at,
    'expires_at', v_invite.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_executive_invite_by_token(text) TO anon, authenticated;
