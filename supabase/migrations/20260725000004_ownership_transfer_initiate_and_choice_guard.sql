-- Secure ownership transfer initiation (president-only via RPC) and guard former-owner
-- role choice against re-application.

ALTER TABLE public.ownership_transfers
  ADD COLUMN IF NOT EXISTS former_owner_choice_at timestamptz,
  ADD COLUMN IF NOT EXISTS former_owner_choice text;

ALTER TABLE public.ownership_transfers
  DROP CONSTRAINT IF EXISTS ownership_transfers_former_owner_choice_check;

ALTER TABLE public.ownership_transfers
  ADD CONSTRAINT ownership_transfers_former_owner_choice_check
  CHECK (
    former_owner_choice IS NULL
    OR former_owner_choice IN (
      'stay_co_president',
      'executive',
      'member',
      'leave'
    )
  );

CREATE OR REPLACE FUNCTION public.initiate_ownership_transfer(
  p_club_id uuid,
  p_to_user_id uuid,
  p_new_role text,
  p_optional_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_role text := lower(btrim(COALESCE(p_new_role, '')));
  v_transfer public.ownership_transfers%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_club_id IS NULL THEN
    RAISE EXCEPTION 'club_id_required';
  END IF;

  IF p_to_user_id IS NULL THEN
    RAISE EXCEPTION 'recipient_required';
  END IF;

  IF p_to_user_id = v_user_id THEN
    RAISE EXCEPTION 'cannot_transfer_to_self';
  END IF;

  IF v_new_role NOT IN ('owner', 'co_president') THEN
    RAISE EXCEPTION 'invalid_new_role';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = v_user_id
      AND cm.status = 'active'
      AND cm.role = 'owner'
      AND cm.access_level = 'president'
  ) THEN
    RAISE EXCEPTION 'not_club_president';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_to_user_id
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'recipient_not_active_member';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ownership_transfers AS ot
    WHERE ot.club_id = p_club_id
      AND ot.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'pending_transfer_exists';
  END IF;

  INSERT INTO public.ownership_transfers (
    club_id,
    from_user_id,
    to_user_id,
    new_role,
    optional_message,
    status
  )
  VALUES (
    p_club_id,
    v_user_id,
    p_to_user_id,
    v_new_role,
    NULLIF(btrim(COALESCE(p_optional_message, '')), ''),
    'pending'
  )
  RETURNING *
  INTO v_transfer;

  RETURN jsonb_build_object(
    'id', v_transfer.id,
    'club_id', v_transfer.club_id,
    'from_user_id', v_transfer.from_user_id,
    'to_user_id', v_transfer.to_user_id,
    'new_role', v_transfer.new_role,
    'optional_message', v_transfer.optional_message,
    'status', v_transfer.status,
    'created_at', v_transfer.created_at,
    'expires_at', v_transfer.expires_at,
    'responded_at', v_transfer.responded_at,
    'former_owner_choice_at', v_transfer.former_owner_choice_at,
    'former_owner_choice', v_transfer.former_owner_choice
  );
END;
$$;

DROP POLICY IF EXISTS "Club owners can manage transfers" ON public.ownership_transfers;

CREATE POLICY "ownership_transfers_select_participants"
  ON public.ownership_transfers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "ownership_transfers_cancel_outgoing"
  ON public.ownership_transfers
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = from_user_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = from_user_id
    AND status = 'canceled'
  );

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

  IF v_transfer.former_owner_choice_at IS NOT NULL THEN
    RAISE EXCEPTION 'former_owner_choice_already_applied';
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

  UPDATE public.ownership_transfers
  SET
    former_owner_choice_at = now(),
    former_owner_choice = v_choice
  WHERE id = v_transfer.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_ownership_transfer(uuid, uuid, text, text) TO authenticated;
