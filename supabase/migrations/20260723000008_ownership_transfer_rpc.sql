-- Route ownership transfer accept/decline/former-owner role choice through verified
-- SECURITY DEFINER RPCs so club_members role changes work under self-update lockdown.

CREATE OR REPLACE FUNCTION public.accept_ownership_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.ownership_transfers%ROWTYPE;
  v_title text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_transfer_id IS NULL THEN
    RAISE EXCEPTION 'transfer_id_required';
  END IF;

  SELECT *
  INTO v_transfer
  FROM public.ownership_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer_not_found';
  END IF;

  IF v_transfer.to_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'transfer_wrong_recipient';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer_not_pending';
  END IF;

  IF v_transfer.expires_at IS NOT NULL AND v_transfer.expires_at < now() THEN
    UPDATE public.ownership_transfers
    SET
      status = 'expired',
      responded_at = now()
    WHERE id = v_transfer.id;

    RAISE EXCEPTION 'transfer_expired';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = v_transfer.club_id
      AND cm.user_id = v_transfer.to_user_id
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'recipient_not_active_member';
  END IF;

  v_title := CASE
    WHEN v_transfer.new_role = 'co_president' THEN 'Co-President'
    ELSE 'President'
  END;

  UPDATE public.club_members
  SET
    role = 'owner',
    access_level = 'president',
    title = v_title
  WHERE club_id = v_transfer.club_id
    AND user_id = v_transfer.to_user_id;

  UPDATE public.ownership_transfers
  SET
    status = 'accepted',
    responded_at = now()
  WHERE id = v_transfer.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_ownership_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.ownership_transfers%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_transfer_id IS NULL THEN
    RAISE EXCEPTION 'transfer_id_required';
  END IF;

  SELECT *
  INTO v_transfer
  FROM public.ownership_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer_not_found';
  END IF;

  IF v_transfer.to_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'transfer_wrong_recipient';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer_not_pending';
  END IF;

  IF v_transfer.expires_at IS NOT NULL AND v_transfer.expires_at < now() THEN
    UPDATE public.ownership_transfers
    SET
      status = 'expired',
      responded_at = now()
    WHERE id = v_transfer.id;

    RAISE EXCEPTION 'transfer_expired';
  END IF;

  UPDATE public.ownership_transfers
  SET
    status = 'declined',
    responded_at = now()
  WHERE id = v_transfer.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_former_owner_role_choice(
  p_transfer_id uuid,
  p_choice text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer public.ownership_transfers%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_choice text := lower(btrim(COALESCE(p_choice, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_transfer_id IS NULL THEN
    RAISE EXCEPTION 'transfer_id_required';
  END IF;

  SELECT *
  INTO v_transfer
  FROM public.ownership_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer_not_found';
  END IF;

  IF v_transfer.from_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'transfer_wrong_user';
  END IF;

  IF v_transfer.status <> 'accepted' THEN
    RAISE EXCEPTION 'transfer_not_accepted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = v_transfer.club_id
      AND cm.user_id = v_user_id
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'former_owner_not_active_member';
  END IF;

  CASE v_choice
    WHEN 'stay_co_president' THEN
      UPDATE public.club_members
      SET
        role = 'owner',
        access_level = 'president',
        title = 'Co-President'
      WHERE club_id = v_transfer.club_id
        AND user_id = v_user_id;
    WHEN 'executive' THEN
      UPDATE public.club_members
      SET
        role = 'executive',
        access_level = 'executive',
        title = NULL
      WHERE club_id = v_transfer.club_id
        AND user_id = v_user_id;
    WHEN 'member' THEN
      UPDATE public.club_members
      SET
        role = 'member',
        access_level = 'member',
        title = NULL
      WHERE club_id = v_transfer.club_id
        AND user_id = v_user_id;
    WHEN 'leave' THEN
      DELETE FROM public.club_members
      WHERE club_id = v_transfer.club_id
        AND user_id = v_user_id;
    ELSE
      RAISE EXCEPTION 'invalid_choice';
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_ownership_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_ownership_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_former_owner_role_choice(uuid, text) TO authenticated;
