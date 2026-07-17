-- Critical remote repair: hiring apply/offer RPCs (missing on linked DB),
-- RSVP form-response uniqueness + own-row DELETE/UPDATE, claimable directory restore.
-- Idempotent: safe if older 20260725_* migrations are applied later (CREATE OR REPLACE / IF EXISTS).

-- ═══════════════════════════════════════════════════════════════════════════
-- A. Hiring applications unique + apply RPC
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_group record;
  v_keep_id uuid;
  v_removed_count integer;
BEGIN
  FOR v_group IN
    SELECT listing_id, applicant_id, count(*)::integer AS row_count
    FROM public.hiring_applications
    GROUP BY listing_id, applicant_id
    HAVING count(*) > 1
  LOOP
    WITH ranked AS (
      SELECT
        ha.id,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE COALESCE(ha.sub_status, 'submitted')
              WHEN 'offer_accepted' THEN 100
              WHEN 'offer_sent' THEN 90
              WHEN 'interview_completed' THEN 80
              WHEN 'interview_scheduled' THEN 75
              WHEN 'interview_invite_sent' THEN 70
              WHEN 'reviewed' THEN 60
              WHEN 'notes_added' THEN 55
              WHEN 'viewed' THEN 50
              WHEN 'submitted' THEN 40
              WHEN 'offer_declined' THEN 30
              WHEN 'rejected' THEN 20
              WHEN 'withdrawn' THEN 10
              ELSE 0
            END DESC,
            ha.created_at DESC
        ) AS rank
      FROM public.hiring_applications AS ha
      WHERE ha.listing_id = v_group.listing_id
        AND ha.applicant_id = v_group.applicant_id
    )
    DELETE FROM public.hiring_applications AS ha
    WHERE ha.id IN (SELECT r.id FROM ranked AS r WHERE r.rank > 1);

    GET DIAGNOSTICS v_removed_count = ROW_COUNT;
    RAISE NOTICE 'hiring_applications_deduped listing=% applicant=% removed=%',
      v_group.listing_id, v_group.applicant_id, v_removed_count;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hiring_applications_listing_applicant_unique
  ON public.hiring_applications (listing_id, applicant_id);

CREATE OR REPLACE FUNCTION public.apply_to_hiring_listing(
  p_listing_id uuid,
  p_answers jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_listing public.hiring_listings%ROWTYPE;
  v_application_id uuid;
  v_answers jsonb := COALESCE(p_answers, '[]'::jsonb);
  v_question jsonb;
  v_question_id text;
  v_required boolean;
  v_upload_fields jsonb;
  v_slot text;
  v_setting text;
  v_found boolean;
  v_answer_text text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id_required';
  END IF;

  IF jsonb_typeof(v_answers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;

  SELECT *
  INTO v_listing
  FROM public.hiring_listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found';
  END IF;

  IF v_listing.is_open IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'listing_closed';
  END IF;

  IF v_listing.deadline IS NOT NULL AND v_listing.deadline < CURRENT_DATE THEN
    RAISE EXCEPTION 'listing_deadline_passed';
  END IF;

  -- Validate required listing questions (default why-question when none configured).
  IF v_listing.questions IS NULL
     OR jsonb_typeof(v_listing.questions) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_listing.questions) = 0
  THEN
    v_found := false;
    FOR v_question IN
      SELECT value FROM jsonb_array_elements(v_answers)
    LOOP
      IF COALESCE(v_question->>'question_id', '') = 'default-why'
         AND NULLIF(btrim(COALESCE(v_question->>'answer', '')), '') IS NOT NULL
      THEN
        v_found := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT v_found THEN
      RAISE EXCEPTION 'missing_required_answers';
    END IF;
  ELSE
    FOR v_question IN
      SELECT value FROM jsonb_array_elements(v_listing.questions)
    LOOP
      v_question_id := COALESCE(v_question->>'id', '');
      IF v_question_id = '' THEN
        CONTINUE;
      END IF;
      v_required := COALESCE((v_question->>'required')::boolean, true);
      IF NOT v_required THEN
        CONTINUE;
      END IF;

      SELECT NULLIF(btrim(COALESCE(a->>'answer', '')), '')
      INTO v_answer_text
      FROM jsonb_array_elements(v_answers) AS a
      WHERE COALESCE(a->>'question_id', '') = v_question_id
      LIMIT 1;

      IF v_answer_text IS NULL THEN
        RAISE EXCEPTION 'missing_required_answers';
      END IF;
    END LOOP;
  END IF;

  -- Validate required upload slots (resume / portfolio / other).
  v_upload_fields := COALESCE(v_listing.upload_fields, '{}'::jsonb);
  FOREACH v_slot IN ARRAY ARRAY['resume', 'portfolio', 'other']
  LOOP
    v_setting := COALESCE(v_upload_fields->>v_slot, 'not_included');
    IF v_setting IS DISTINCT FROM 'required' THEN
      CONTINUE;
    END IF;

    v_found := false;
    FOR v_question IN
      SELECT value FROM jsonb_array_elements(v_answers)
    LOOP
      IF COALESCE(v_question->>'question_id', '') = ('upload_' || v_slot)
         AND NULLIF(btrim(COALESCE(v_question->>'answer', '')), '') IS NOT NULL
      THEN
        v_found := true;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_found THEN
      RAISE EXCEPTION 'missing_required_upload';
    END IF;
  END LOOP;

  INSERT INTO public.hiring_applications (
    listing_id,
    applicant_id,
    answers,
    status,
    sub_status
  )
  VALUES (
    p_listing_id,
    v_user_id,
    v_answers,
    'pending',
    'submitted'
  )
  ON CONFLICT (listing_id, applicant_id) DO NOTHING
  RETURNING id INTO v_application_id;

  IF v_application_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'created',
      'application_id', v_application_id
    );
  END IF;

  SELECT ha.id
  INTO v_application_id
  FROM public.hiring_applications AS ha
  WHERE ha.listing_id = p_listing_id
    AND ha.applicant_id = v_user_id;

  RETURN jsonb_build_object(
    'outcome', 'already_applied',
    'application_id', v_application_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_hiring_listing(uuid, jsonb) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- B. Offer accept / decline RPCs
-- ═══════════════════════════════════════════════════════════════════════════

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
      'offer_accepted',
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

-- ═══════════════════════════════════════════════════════════════════════════
-- C. RSVP form responses: uniqueness includes event_id; own DELETE/UPDATE
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop legacy unique(user_id, question_id) which blocks cancel + re-signup.
ALTER TABLE public.event_form_responses
  DROP CONSTRAINT IF EXISTS event_form_responses_user_id_question_id_key;

DROP INDEX IF EXISTS event_form_responses_user_id_question_id_key;

-- Deduplicate before new unique index (keep newest answer per event/user/question).
DELETE FROM public.event_form_responses AS efr
USING public.event_form_responses AS newer
WHERE efr.event_id = newer.event_id
  AND efr.user_id = newer.user_id
  AND efr.question_id = newer.question_id
  AND efr.ctid < newer.ctid;

ALTER TABLE public.event_form_responses
  DROP CONSTRAINT IF EXISTS event_form_responses_event_id_user_id_question_id_key;

ALTER TABLE public.event_form_responses
  ADD CONSTRAINT event_form_responses_event_id_user_id_question_id_key
  UNIQUE (event_id, user_id, question_id);

DROP POLICY IF EXISTS "event_form_responses_delete_own" ON public.event_form_responses;
CREATE POLICY "event_form_responses_delete_own"
  ON public.event_form_responses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_form_responses_update_own" ON public.event_form_responses;
CREATE POLICY "event_form_responses_update_own"
  ON public.event_form_responses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- D. Restore claimable test clubs that should be unclaimed (no active owners)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.clubs AS c
SET
  claim_status = 'unclaimed',
  is_published = false,
  setup_completed = false
WHERE c.name = ANY (
  ARRAY[
    'Accounting Students'' Association',
    'Achieve Connect Empower',
    'Albanian Students Club',
    'Anime Club Genshiken',
    'Guelph Film and Photography Club',
    'Guelph Film & Photography Club'
  ]
)
AND NOT EXISTS (
  SELECT 1
  FROM public.club_members AS cm
  WHERE cm.club_id = c.id
    AND cm.role = 'owner'
    AND cm.status = 'active'
);

-- Align alternate Film club naming used in older imports.
UPDATE public.clubs
SET name = 'Guelph Film & Photography Club'
WHERE name = 'Guelph Film and Photography Club'
  AND NOT EXISTS (
    SELECT 1 FROM public.clubs WHERE name = 'Guelph Film & Photography Club'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- E. Reload PostgREST schema cache so RPCs are visible immediately
-- ═══════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
