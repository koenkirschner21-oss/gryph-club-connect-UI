-- Reset Group D tester: Cameron Berdin (cameronberdin@gmail.com) only.
-- Does NOT touch Gryphon Lego Builders Club / Gryph ClubConnect entities or other testers.

DO $$
DECLARE
  target_email constant text := 'cameronberdin@gmail.com';
  target_full_name constant text := 'Cameron Berdin';
  target_password constant text := 'GryphTest2026!';
  lego_club_id constant uuid := 'afcde36d-91ca-45a0-ac8a-0dc287c4b5b5';
  connect_club_id constant uuid := '91ac4dec-c0e8-4947-b399-5336f5422405';

  v_user_id uuid;
  v_profile_email text;
  v_sole_owner_club text;
  v_new_user_id uuid;
  v_deleted_auth_users integer := 0;
  v_used_fallback boolean := false;
BEGIN
  SELECT u.id
  INTO v_user_id
  FROM auth.users AS u
  WHERE lower(trim(u.email)) = lower(target_email);

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User % not found; skipping cleanup and proceeding to create fresh account.', target_email;
    v_new_user_id := gen_random_uuid();
  ELSE
    IF (
      SELECT count(*)
      FROM auth.users AS u
      WHERE lower(trim(u.email)) = lower(target_email)
    ) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one auth.users row for %.', target_email;
    END IF;

    SELECT p.email
    INTO v_profile_email
    FROM public.profiles AS p
    WHERE p.id = v_user_id;

    IF v_profile_email IS NOT NULL
       AND lower(trim(v_profile_email)) <> lower(target_email) THEN
      RAISE EXCEPTION 'Profile email mismatch for user %.', v_user_id;
    END IF;

    SELECT c.name
    INTO v_sole_owner_club
    FROM public.club_members AS cm
    JOIN public.clubs AS c ON c.id = cm.club_id
    WHERE cm.user_id = v_user_id
      AND cm.role = 'owner'
      AND cm.status = 'active'
      AND (
        SELECT count(*)
        FROM public.club_members AS cm2
        WHERE cm2.club_id = cm.club_id
          AND cm2.role = 'owner'
          AND cm2.status = 'active'
      ) = 1
    LIMIT 1;

    IF v_sole_owner_club IS NOT NULL THEN
      RAISE EXCEPTION
        'Refusing to reset % — sole active owner of club "%".',
        target_email,
        v_sole_owner_club;
    END IF;

    -- Step 3: remove all club memberships
    DELETE FROM public.club_members WHERE user_id = v_user_id;

    -- Step 4: user-tied records (participation only; keep shared parent rows)
    UPDATE public.tasks
    SET assigned_to = NULL
    WHERE assigned_to = v_user_id;

    DELETE FROM public.meeting_action_items WHERE assignee_id = v_user_id;
    DELETE FROM public.meeting_prep_items WHERE user_id = v_user_id;
    DELETE FROM public.event_rsvps WHERE user_id = v_user_id;
    DELETE FROM public.event_form_responses WHERE user_id = v_user_id;
    DELETE FROM public.club_join_applications WHERE applicant_id = v_user_id;
    DELETE FROM public.club_join_votes
    WHERE applicant_id = v_user_id OR voter_id = v_user_id;
    DELETE FROM public.hiring_applications WHERE applicant_id = v_user_id;
    DELETE FROM public.position_applications WHERE applicant_id = v_user_id;
    DELETE FROM public.job_applications WHERE applicant_id = v_user_id;
    DELETE FROM public.application_notes WHERE author_id = v_user_id;
    DELETE FROM public.notifications WHERE user_id = v_user_id;
    DELETE FROM public.inbox_messages
    WHERE recipient_id = v_user_id OR sender_id = v_user_id;
    DELETE FROM public.saved_roles WHERE user_id = v_user_id;
    DELETE FROM public.user_interests WHERE user_id = v_user_id;
    DELETE FROM public.user_clubs WHERE user_id = v_user_id;
    DELETE FROM public.post_reactions WHERE user_id = v_user_id;
    DELETE FROM public.post_views WHERE user_id = v_user_id;
    DELETE FROM public.task_comments WHERE user_id = v_user_id;
    DELETE FROM public.workspace_section_views WHERE user_id = v_user_id;

    -- Step 5: chat messages authored by Cameron only
    DELETE FROM public.direct_messages WHERE sender_id = v_user_id;
    DELETE FROM public.message_reactions WHERE user_id = v_user_id;
    DELETE FROM public.conversation_members WHERE user_id = v_user_id;

    DELETE FROM public.ownership_transfers
    WHERE from_user_id = v_user_id OR to_user_id = v_user_id;

    DELETE FROM public.executive_invites
    WHERE invited_user_id = v_user_id OR invited_by = v_user_id;

    UPDATE public.club_members SET reports_to = NULL WHERE reports_to = v_user_id;
    UPDATE public.conversations SET created_by = NULL WHERE created_by = v_user_id;
    UPDATE public.events SET created_by = NULL WHERE created_by = v_user_id;
    UPDATE public.club_meetings SET created_by = NULL WHERE created_by = v_user_id;
    UPDATE public.hiring_listings SET created_by = NULL WHERE created_by = v_user_id;
    UPDATE public.club_positions SET created_by = NULL WHERE created_by = v_user_id;

    -- Step 6: attempt full auth delete
    DELETE FROM auth.identities WHERE user_id = v_user_id;

    DELETE FROM auth.users
    WHERE id = v_user_id
      AND lower(trim(email)) = lower(target_email);
    GET DIAGNOSTICS v_deleted_auth_users = ROW_COUNT;

    IF v_deleted_auth_users = 1 THEN
      v_new_user_id := gen_random_uuid();
    ELSE
      v_used_fallback := true;
      v_new_user_id := v_user_id;

      UPDATE auth.users
      SET
        encrypted_password = crypt(target_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
      WHERE id = v_user_id
        AND lower(trim(email)) = lower(target_email);
    END IF;
  END IF;

  IF v_user_id IS NULL OR v_deleted_auth_users = 1 THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_sso_user,
      is_anonymous
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_new_user_id,
      'authenticated',
      'authenticated',
      target_email,
      crypt(target_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', target_full_name),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false,
      false
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_new_user_id,
      jsonb_build_object(
        'sub', v_new_user_id::text,
        'email', target_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_new_user_id::text,
      now(),
      now(),
      now()
    );
  END IF;

  INSERT INTO public.profiles (id, email, full_name, onboarding_completed, created_at, updated_at)
  VALUES (v_new_user_id, target_email, target_full_name, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  -- Step 7: exactly two club memberships
  DELETE FROM public.club_members WHERE user_id = v_new_user_id;

  INSERT INTO public.club_members (club_id, user_id, role, access_level, status, title)
  VALUES
    (lego_club_id, v_new_user_id, 'owner', 'president', 'active', 'President'),
    (connect_club_id, v_new_user_id, 'member', 'member', 'active', NULL);

  RAISE NOTICE
    'Reset complete for % (user_id=%). auth_deleted=% fallback_password_reset=%.',
    target_email,
    v_new_user_id,
    (v_deleted_auth_users = 1),
    v_used_fallback;
END;
$$;
