-- Delete test user koen@uoguelph.ca only (user_id acd8e22e-6783-40a3-8da7-29a7caf0abff).
-- Exact email match (case-insensitive). Does not touch kkirschn@uoguelph.ca or any other account.
-- Pre-delete audit (2026-07-02): 0 club_members, 0 messages, 0 tasks, 0 RSVPs, 0 applications;
-- 1 hiring_listings row (VP of Marketing) has created_by set — null before auth delete.

DO $$
DECLARE
  target_email constant text := 'koen@uoguelph.ca';
  v_user_id uuid;
  v_profile_email text;
  v_sole_owner_club text;
  v_deleted_club_members integer := 0;
  v_deleted_conversation_members integer := 0;
  v_deleted_direct_messages integer := 0;
  v_deleted_message_reactions integer := 0;
  v_deleted_notifications integer := 0;
  v_deleted_inbox integer := 0;
  v_deleted_event_rsvps integer := 0;
  v_deleted_event_form_responses integer := 0;
  v_deleted_hiring_applications integer := 0;
  v_deleted_job_applications integer := 0;
  v_deleted_user_interests integer := 0;
  v_deleted_saved_roles integer := 0;
  v_deleted_task_comments integer := 0;
  v_deleted_meeting_prep integer := 0;
  v_deleted_identities integer := 0;
  v_deleted_auth_users integer := 0;
  v_nulled_conversations integer := 0;
  v_nulled_events integer := 0;
  v_nulled_meetings integer := 0;
  v_nulled_clubs_created_by integer := 0;
  v_nulled_hiring_listings integer := 0;
  v_nulled_club_positions integer := 0;
BEGIN
  SELECT u.id
  INTO v_user_id
  FROM auth.users AS u
  WHERE lower(trim(u.email)) = lower(target_email);

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User % not found; nothing to delete.', target_email;
    RETURN;
  END IF;

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
      'Refusing to delete % — sole active owner of club "%".',
      target_email,
      v_sole_owner_club;
  END IF;

  DELETE FROM public.club_members WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_club_members = ROW_COUNT;

  DELETE FROM public.conversation_members WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_conversation_members = ROW_COUNT;

  DELETE FROM public.direct_messages WHERE sender_id = v_user_id;
  GET DIAGNOSTICS v_deleted_direct_messages = ROW_COUNT;

  DELETE FROM public.message_reactions WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_message_reactions = ROW_COUNT;

  DELETE FROM public.notifications WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_notifications = ROW_COUNT;

  DELETE FROM public.inbox_messages
  WHERE recipient_id = v_user_id OR sender_id = v_user_id;
  GET DIAGNOSTICS v_deleted_inbox = ROW_COUNT;

  DELETE FROM public.event_rsvps WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_event_rsvps = ROW_COUNT;

  DELETE FROM public.event_form_responses WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_event_form_responses = ROW_COUNT;

  DELETE FROM public.hiring_applications WHERE applicant_id = v_user_id;
  GET DIAGNOSTICS v_deleted_hiring_applications = ROW_COUNT;

  DELETE FROM public.job_applications WHERE applicant_id = v_user_id;
  GET DIAGNOSTICS v_deleted_job_applications = ROW_COUNT;

  DELETE FROM public.user_interests WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_user_interests = ROW_COUNT;

  DELETE FROM public.saved_roles WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_saved_roles = ROW_COUNT;

  DELETE FROM public.task_comments WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_task_comments = ROW_COUNT;

  DELETE FROM public.meeting_prep_items WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_meeting_prep = ROW_COUNT;

  UPDATE public.conversations SET created_by = NULL WHERE created_by = v_user_id;
  GET DIAGNOSTICS v_nulled_conversations = ROW_COUNT;

  UPDATE public.events SET created_by = NULL WHERE created_by = v_user_id;
  GET DIAGNOSTICS v_nulled_events = ROW_COUNT;

  UPDATE public.club_meetings SET created_by = NULL WHERE created_by = v_user_id;
  GET DIAGNOSTICS v_nulled_meetings = ROW_COUNT;

  UPDATE public.clubs SET created_by = NULL WHERE created_by = v_user_id;
  GET DIAGNOSTICS v_nulled_clubs_created_by = ROW_COUNT;

  UPDATE public.hiring_listings SET created_by = NULL WHERE created_by = v_user_id;
  GET DIAGNOSTICS v_nulled_hiring_listings = ROW_COUNT;

  UPDATE public.club_positions SET created_by = NULL WHERE created_by = v_user_id;
  GET DIAGNOSTICS v_nulled_club_positions = ROW_COUNT;

  UPDATE public.club_documents SET uploaded_by = NULL WHERE uploaded_by = v_user_id;
  UPDATE public.club_resource_links SET added_by = NULL WHERE added_by = v_user_id;
  UPDATE public.chat_polls SET created_by = NULL WHERE created_by = v_user_id;
  UPDATE public.meeting_proposals SET created_by = NULL WHERE created_by = v_user_id;
  UPDATE public.club_requests SET submitted_by = NULL WHERE submitted_by = v_user_id;
  UPDATE public.club_requests SET reviewed_by = NULL WHERE reviewed_by = v_user_id;
  UPDATE public.club_claim_requests SET submitted_by = NULL WHERE submitted_by = v_user_id;
  UPDATE public.club_claim_requests SET reviewed_by = NULL WHERE reviewed_by = v_user_id;
  UPDATE public.club_invites SET invited_by = NULL WHERE invited_by = v_user_id;
  UPDATE public.executive_invites SET invited_by = NULL WHERE invited_by = v_user_id;
  UPDATE public.executive_invites SET invited_user_id = NULL WHERE invited_user_id = v_user_id;
  UPDATE public.inbox_messages SET sender_id = NULL WHERE sender_id = v_user_id;
  UPDATE public.club_members SET reports_to = NULL WHERE reports_to = v_user_id;
  UPDATE public.ownership_transfers SET from_user_id = NULL WHERE from_user_id = v_user_id;
  UPDATE public.ownership_transfers SET to_user_id = NULL WHERE to_user_id = v_user_id;
  UPDATE public.event_reviews SET created_by = NULL WHERE created_by = v_user_id;

  UPDATE public.meeting_action_items SET assignee_id = NULL WHERE assignee_id = v_user_id;
  UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = v_user_id;

  DELETE FROM auth.identities WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_identities = ROW_COUNT;

  DELETE FROM auth.users
  WHERE id = v_user_id
    AND lower(trim(email)) = lower(target_email);
  GET DIAGNOSTICS v_deleted_auth_users = ROW_COUNT;

  IF v_deleted_auth_users <> 1 THEN
    RAISE EXCEPTION 'auth.users delete failed for % (deleted %).', target_email, v_deleted_auth_users;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Profile row still exists after auth delete for %.', target_email;
  END IF;

  RAISE NOTICE
    'Deleted % (%): club_members=%, conversation_members=%, direct_messages=%, message_reactions=%, notifications=%, inbox_messages=%, event_rsvps=%, event_form_responses=%, hiring_applications=%, job_applications=%, user_interests=%, saved_roles=%, task_comments=%, meeting_prep_items=%, identities=%, auth_users=%, nulled conversations=%, events=%, meetings=%, clubs.created_by=%, hiring_listings.created_by=%, club_positions.created_by=%.',
    target_email,
    v_user_id,
    v_deleted_club_members,
    v_deleted_conversation_members,
    v_deleted_direct_messages,
    v_deleted_message_reactions,
    v_deleted_notifications,
    v_deleted_inbox,
    v_deleted_event_rsvps,
    v_deleted_event_form_responses,
    v_deleted_hiring_applications,
    v_deleted_job_applications,
    v_deleted_user_interests,
    v_deleted_saved_roles,
    v_deleted_task_comments,
    v_deleted_meeting_prep,
    v_deleted_identities,
    v_deleted_auth_users,
    v_nulled_conversations,
    v_nulled_events,
    v_nulled_meetings,
    v_nulled_clubs_created_by,
    v_nulled_hiring_listings,
    v_nulled_club_positions;
END;
$$;
