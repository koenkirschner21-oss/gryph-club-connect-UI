-- Claimant cancel: close request and reconcile clubs.claim_status when no open claims remain.

CREATE OR REPLACE FUNCTION public.cancel_club_claim_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.club_claim_requests%ROWTYPE;
  v_club public.clubs%ROWTYPE;
  v_open_claims_remaining integer := 0;
  v_claim_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id_required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.club_claim_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_request_not_found';
  END IF;

  IF v_request.submitted_by IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'claim_request_not_owned';
  END IF;

  SELECT *
  INTO v_club
  FROM public.clubs
  WHERE id = v_request.club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'club_not_found';
  END IF;

  IF v_request.status = 'canceled' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_canceled',
      'claim_request_id', v_request.id,
      'club_id', v_request.club_id,
      'request_status', 'canceled',
      'claim_status', v_club.claim_status,
      'open_claims_remaining', (
        SELECT count(*)::integer
        FROM public.club_claim_requests AS ccr
        WHERE ccr.club_id = v_request.club_id
          AND ccr.status IN ('pending', 'more_info')
      )
    );
  END IF;

  IF v_request.status NOT IN ('pending', 'more_info') THEN
    RAISE EXCEPTION 'claim_request_not_cancelable';
  END IF;

  UPDATE public.club_claim_requests
  SET status = 'canceled'
  WHERE id = v_request.id;

  SELECT count(*)::integer
  INTO v_open_claims_remaining
  FROM public.club_claim_requests AS ccr
  WHERE ccr.club_id = v_request.club_id
    AND ccr.status IN ('pending', 'more_info');

  v_claim_status := v_club.claim_status;

  IF v_open_claims_remaining = 0 AND v_club.claim_status = 'claim_pending' THEN
    UPDATE public.clubs
    SET claim_status = 'unclaimed'
    WHERE id = v_request.club_id;

    v_claim_status := 'unclaimed';
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'canceled',
    'claim_request_id', v_request.id,
    'club_id', v_request.club_id,
    'request_status', 'canceled',
    'claim_status', v_claim_status,
    'open_claims_remaining', v_open_claims_remaining
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_club_claim_request(uuid) TO authenticated;
