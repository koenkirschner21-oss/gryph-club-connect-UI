-- Atomic platform-admin club claim approval: president membership, club status,
-- request approval, and sibling open-request closure in one transaction.

CREATE OR REPLACE FUNCTION public.approve_club_claim_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_request public.club_claim_requests%ROWTYPE;
  v_club public.clubs%ROWTYPE;
  v_title text;
  v_membership_ok boolean;
  v_siblings_closed integer := 0;
  v_now timestamptz := now();
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_admins AS pa
    WHERE pa.user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT *
  INTO v_request
  FROM public.club_claim_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_request_not_found';
  END IF;

  IF v_request.status = 'approved' THEN
    SELECT *
    INTO v_club
    FROM public.clubs
    WHERE id = v_request.club_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'club_not_found';
    END IF;

    RETURN jsonb_build_object(
      'outcome', 'already_approved',
      'claim_request_id', v_request.id,
      'club_id', v_request.club_id,
      'submitted_by', v_request.submitted_by,
      'claim_status', v_club.claim_status,
      'role_in_club', v_request.role_in_club,
      'sibling_requests_closed', 0
    );
  END IF;

  IF v_request.status NOT IN ('pending', 'more_info') THEN
    RAISE EXCEPTION 'claim_request_not_approvable';
  END IF;

  SELECT *
  INTO v_club
  FROM public.clubs
  WHERE id = v_request.club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'club_not_found';
  END IF;

  IF v_request.submitted_by IS NULL THEN
    RAISE EXCEPTION 'claim_submitter_required';
  END IF;

  v_title := COALESCE(NULLIF(btrim(v_request.role_in_club), ''), 'President');

  v_membership_ok := public.ensure_president_membership(
    v_request.club_id,
    v_request.submitted_by,
    v_title
  );

  IF NOT v_membership_ok THEN
    RAISE EXCEPTION 'president_membership_failed';
  END IF;

  UPDATE public.clubs
  SET claim_status = 'claimed'
  WHERE id = v_request.club_id;

  UPDATE public.club_claim_requests
  SET
    status = 'approved',
    reviewed_by = v_admin_id,
    reviewed_at = v_now
  WHERE id = v_request.id;

  WITH closed AS (
    UPDATE public.club_claim_requests
    SET
      status = 'rejected',
      reviewed_by = v_admin_id,
      reviewed_at = v_now,
      review_note = COALESCE(
        NULLIF(btrim(review_note), ''),
        'Closed automatically because another claim request was approved.'
      )
    WHERE club_id = v_request.club_id
      AND id <> v_request.id
      AND status IN ('pending', 'more_info')
    RETURNING id
  )
  SELECT count(*)::integer
  INTO v_siblings_closed
  FROM closed;

  RETURN jsonb_build_object(
    'outcome', 'approved',
    'claim_request_id', v_request.id,
    'club_id', v_request.club_id,
    'submitted_by', v_request.submitted_by,
    'claim_status', 'claimed',
    'role_in_club', v_request.role_in_club,
    'sibling_requests_closed', v_siblings_closed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_club_claim_request(uuid) TO authenticated;
