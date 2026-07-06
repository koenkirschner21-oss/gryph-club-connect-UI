-- Applicant offer accept/decline with atomic club membership conversion on accept.

CREATE OR REPLACE FUNCTION public.hiring_access_level_to_member_role(p_access_level text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_access_level = 'president' THEN 'owner'
    WHEN p_access_level IN ('managerial_executive', 'executive') THEN 'executive'
    ELSE 'member'
  END;
$$;

CREATE OR REPLACE FUNCTION public.hiring_listing_manager_user_ids(
  p_club_id uuid,
  p_listing_id uuid
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT recipient_id),
    '{}'::uuid[]
  )
  FROM (
    SELECT cm.user_id AS recipient_id
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.status = 'active'
      AND (
        cm.role = 'owner'
        OR cm.access_level = 'president'
      )

    UNION

    SELECT unnest(COALESCE(hl.reviewer_ids, '{}'::uuid[])) AS recipient_id
    FROM public.hiring_listings AS hl
    WHERE hl.id = p_listing_id

    UNION

    SELECT cm.user_id AS recipient_id
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.status = 'active'
      AND public.club_has_permission(p_club_id, 'manage_hiring', cm.user_id)
  ) AS recipients
  WHERE recipient_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.accept_hiring_offer(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_application public.hiring_applications%ROWTYPE;
  v_listing public.hiring_listings%ROWTYPE;
  v_club public.clubs%ROWTYPE;
  v_member_role text;
  v_access_level text;
  v_role_title text;
  v_applicant_name text;
  v_manager_ids uuid[];
  v_manager_id uuid;
  v_membership_count integer;
  v_review_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_application_id IS NULL THEN
    RAISE EXCEPTION 'application_id_required';
  END IF;

  SELECT *
  INTO v_application
  FROM public.hiring_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  IF v_application.applicant_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'not_applicant';
  END IF;

  IF v_application.sub_status IS DISTINCT FROM 'offer_sent' THEN
    RAISE EXCEPTION 'offer_not_pending';
  END IF;

  SELECT *
  INTO v_listing
  FROM public.hiring_listings
  WHERE id = v_application.listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found';
  END IF;

  SELECT *
  INTO v_club
  FROM public.clubs
  WHERE id = v_listing.club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'club_not_found';
  END IF;

  v_access_level := NULLIF(btrim(v_application.offered_access_level), '');
  IF v_access_level IS NULL THEN
    RAISE EXCEPTION 'offer_missing_access_level';
  END IF;

  IF v_access_level NOT IN ('president', 'managerial_executive', 'executive', 'member') THEN
    RAISE EXCEPTION 'offer_invalid_access_level';
  END IF;

  v_role_title := NULLIF(btrim(v_application.offered_role_title), '');
  v_member_role := public.hiring_access_level_to_member_role(v_access_level);

  UPDATE public.hiring_applications
  SET
    sub_status = 'offer_accepted',
    status = 'accepted'
  WHERE id = v_application.id;

  INSERT INTO public.club_members (
    club_id,
    user_id,
    role,
    access_level,
    title,
    status
  )
  VALUES (
    v_club.id,
    v_user_id,
    v_member_role,
    v_access_level,
    v_role_title,
    'active'
  )
  ON CONFLICT (club_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    access_level = EXCLUDED.access_level,
    title = COALESCE(EXCLUDED.title, club_members.title),
    status = 'active';

  SELECT count(*)::integer
  INTO v_membership_count
  FROM public.club_members AS cm
  WHERE cm.club_id = v_club.id
    AND cm.user_id = v_user_id;

  IF v_membership_count <> 1 THEN
    RAISE EXCEPTION 'membership_row_count_invalid';
  END IF;

  IF v_application.position_handling = 'close_after_accept' THEN
    UPDATE public.hiring_listings
    SET is_open = false
    WHERE id = v_listing.id;
  END IF;

  PERFORM public.provision_club_member_chats(v_club.id, v_user_id, true);

  UPDATE public.inbox_messages
  SET
    action_completed = true,
    read = true
  WHERE recipient_id = v_user_id
    AND action_type = 'offer_response'
    AND reference_id = v_application.id
    AND reference_type = 'hiring_application'
    AND action_completed IS DISTINCT FROM true;

  SELECT NULLIF(btrim(p.full_name), '')
  INTO v_applicant_name
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  v_applicant_name := COALESCE(v_applicant_name, 'An applicant');
  v_review_path := format(
    '/app/clubs/%s/recruiting?listing=%s&application=%s',
    v_club.id,
    v_listing.id,
    v_application.id
  );

  INSERT INTO public.notifications (
    user_id,
    type,
    message,
    club_id,
    reference_id,
    read
  )
  VALUES (
    v_user_id,
    'club_update',
    format(
      'You accepted the offer for %s at %s.',
      COALESCE(v_role_title, v_listing.title),
      v_club.name
    ),
    v_club.id,
    v_application.id,
    false
  );

  INSERT INTO public.inbox_messages (
    recipient_id,
    type,
    title,
    message,
    action_required,
    club_id,
    reference_id,
    reference_type,
    read
  )
  VALUES (
    v_user_id,
    'offer_accepted',
    format('Offer accepted — %s', COALESCE(v_role_title, v_listing.title)),
    format(
      'You are now a member of %s with the %s role.',
      v_club.name,
      COALESCE(v_role_title, v_listing.title)
    ),
    false,
    v_club.id,
    v_application.id,
    'hiring_application',
    false
  );

  v_manager_ids := public.hiring_listing_manager_user_ids(v_club.id, v_listing.id);

  FOREACH v_manager_id IN ARRAY v_manager_ids
  LOOP
    IF v_manager_id = v_user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (
      user_id,
      type,
      message,
      club_id,
      reference_id,
      read
    )
    VALUES (
      v_manager_id,
      'club_update',
      format(
        '%s accepted the offer for %s.',
        v_applicant_name,
        COALESCE(v_role_title, v_listing.title)
      ),
      v_club.id,
      v_application.id,
      false
    );

    INSERT INTO public.inbox_messages (
      recipient_id,
      type,
      title,
      message,
      action_required,
      action_type,
      action_data,
      club_id,
      reference_id,
      reference_type,
      read
    )
    VALUES (
      v_manager_id,
      'application_update',
      format('Offer accepted — %s', COALESCE(v_role_title, v_listing.title)),
      format(
        '%s accepted the offer for %s.',
        v_applicant_name,
        COALESCE(v_role_title, v_listing.title)
      ),
      true,
      'review_hiring_application',
      jsonb_build_object(
        'path', v_review_path,
        'listingId', v_listing.id,
        'applicationId', v_application.id
      ),
      v_club.id,
      v_application.id,
      'hiring_application',
      false
    );
  END LOOP;

  RETURN jsonb_build_object(
    'outcome', 'accepted',
    'application_id', v_application.id,
    'listing_id', v_listing.id,
    'club_id', v_club.id,
    'access_level', v_access_level,
    'role_title', v_role_title,
    'member_role', v_member_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_hiring_offer(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_application public.hiring_applications%ROWTYPE;
  v_listing public.hiring_listings%ROWTYPE;
  v_club public.clubs%ROWTYPE;
  v_applicant_name text;
  v_manager_ids uuid[];
  v_manager_id uuid;
  v_role_title text;
  v_review_path text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_application_id IS NULL THEN
    RAISE EXCEPTION 'application_id_required';
  END IF;

  SELECT *
  INTO v_application
  FROM public.hiring_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  IF v_application.applicant_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'not_applicant';
  END IF;

  IF v_application.sub_status IS DISTINCT FROM 'offer_sent' THEN
    RAISE EXCEPTION 'offer_not_pending';
  END IF;

  SELECT *
  INTO v_listing
  FROM public.hiring_listings
  WHERE id = v_application.listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found';
  END IF;

  SELECT *
  INTO v_club
  FROM public.clubs
  WHERE id = v_listing.club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'club_not_found';
  END IF;

  UPDATE public.hiring_applications
  SET sub_status = 'offer_declined'
  WHERE id = v_application.id;

  UPDATE public.inbox_messages
  SET
    action_completed = true,
    read = true
  WHERE recipient_id = v_user_id
    AND action_type = 'offer_response'
    AND reference_id = v_application.id
    AND reference_type = 'hiring_application'
    AND action_completed IS DISTINCT FROM true;

  SELECT NULLIF(btrim(p.full_name), '')
  INTO v_applicant_name
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  v_applicant_name := COALESCE(v_applicant_name, 'An applicant');
  v_role_title := COALESCE(NULLIF(btrim(v_application.offered_role_title), ''), v_listing.title);
  v_review_path := format(
    '/app/clubs/%s/recruiting?listing=%s&application=%s',
    v_club.id,
    v_listing.id,
    v_application.id
  );

  v_manager_ids := public.hiring_listing_manager_user_ids(v_club.id, v_listing.id);

  FOREACH v_manager_id IN ARRAY v_manager_ids
  LOOP
    IF v_manager_id = v_user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (
      user_id,
      type,
      message,
      club_id,
      reference_id,
      read
    )
    VALUES (
      v_manager_id,
      'club_update',
      format(
        '%s declined the offer for %s.',
        v_applicant_name,
        v_role_title
      ),
      v_club.id,
      v_application.id,
      false
    );

    INSERT INTO public.inbox_messages (
      recipient_id,
      type,
      title,
      message,
      action_required,
      action_type,
      action_data,
      club_id,
      reference_id,
      reference_type,
      read
    )
    VALUES (
      v_manager_id,
      'offer_declined',
      format('Offer declined — %s', v_role_title),
      format(
        '%s declined the offer for %s.',
        v_applicant_name,
        v_role_title
      ),
      true,
      'review_hiring_application',
      jsonb_build_object(
        'path', v_review_path,
        'listingId', v_listing.id,
        'applicationId', v_application.id
      ),
      v_club.id,
      v_application.id,
      'hiring_application',
      false
    );
  END LOOP;

  RETURN jsonb_build_object(
    'outcome', 'declined',
    'application_id', v_application.id,
    'listing_id', v_listing.id,
    'club_id', v_club.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hiring_access_level_to_member_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_listing_manager_user_ids(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_hiring_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_hiring_offer(uuid) TO authenticated;
