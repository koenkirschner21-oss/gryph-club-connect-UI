CREATE TABLE IF NOT EXISTS public.executive_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id),
  invited_email text NOT NULL,
  invited_user_id uuid REFERENCES auth.users(id),
  access_level text NOT NULL CHECK (access_level IN ('president', 'managerial_executive', 'executive', 'member')),
  role_title text,
  optional_message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'canceled')),
  token text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS idx_executive_invites_club_status
  ON public.executive_invites(club_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_executive_invites_token
  ON public.executive_invites(token);

ALTER TABLE public.executive_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club owners can manage invites" ON public.executive_invites;
CREATE POLICY "Club owners can manage invites"
  ON public.executive_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = executive_invites.club_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'executive')
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = executive_invites.club_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'executive')
      AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Invited users can view their invites" ON public.executive_invites;
CREATE POLICY "Invited users can view their invites"
  ON public.executive_invites
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = invited_user_id
    OR lower(invited_email) = lower((
      SELECT email FROM public.profiles WHERE id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Invited users can respond to invites" ON public.executive_invites;
CREATE POLICY "Invited users can respond to invites"
  ON public.executive_invites
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND (
      auth.uid() = invited_user_id
      OR lower(invited_email) = lower((
        SELECT email FROM public.profiles WHERE id = auth.uid()
      ))
    )
  )
  WITH CHECK (
    status IN ('accepted', 'declined')
    AND (
      auth.uid() = invited_user_id
      OR lower(invited_email) = lower((
        SELECT email FROM public.profiles WHERE id = auth.uid()
      ))
    )
  );

CREATE OR REPLACE FUNCTION public.accept_executive_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.executive_invites%ROWTYPE;
  v_user_id uuid;
  v_email text;
  v_member_role text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_invite
  FROM public.executive_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'invite_not_pending';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    UPDATE public.executive_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF v_invite.invited_user_id IS NOT NULL AND v_invite.invited_user_id <> v_user_id THEN
    RAISE EXCEPTION 'invite_wrong_user';
  END IF;

  IF v_email IS NULL OR lower(trim(v_email)) <> lower(trim(v_invite.invited_email)) THEN
    RAISE EXCEPTION 'invite_wrong_user';
  END IF;

  v_member_role := CASE
    WHEN v_invite.access_level = 'president' THEN 'owner'
    WHEN v_invite.access_level IN ('managerial_executive', 'executive') THEN 'executive'
    ELSE 'member'
  END;

  INSERT INTO public.club_members (club_id, user_id, role, access_level, title, status)
  VALUES (
    v_invite.club_id,
    v_user_id,
    v_member_role,
    v_invite.access_level,
    NULLIF(trim(v_invite.role_title), ''),
    'active'
  )
  ON CONFLICT (club_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    access_level = EXCLUDED.access_level,
    title = EXCLUDED.title,
    status = 'active';

  UPDATE public.executive_invites
  SET
    status = 'accepted',
    invited_user_id = v_user_id
  WHERE id = v_invite.id;

  RETURN v_invite.club_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_executive_invite(text) TO authenticated;
