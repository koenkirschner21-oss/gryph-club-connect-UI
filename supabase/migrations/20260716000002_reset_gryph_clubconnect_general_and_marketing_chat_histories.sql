-- Batch 2: Reset message history for Gryph ClubConnect General and Marketing Team chats.
-- Preserves conversation records, membership, permissions, chat type, and pinned status.
-- Scope: Gryph ClubConnect club only; General + Marketing Team group chats only.
--
-- General chat — messages removed (2026-05-24 production snapshot):
--   Named: poll "When should the team social be"; "Hope this sends" (image); "Me to mate";
--   legacy join lines for Adam Semel and Maya Stark (emoji + [gryph-system:member_joined]).
--   Additional May/June 2026 dev/test: "Hi" (2026-05-26); polls "What day works best for team social"
--   and "[gryph-poll:other] What day is better for the team social at Chucks?".
--   Remaining pre-July casual thread ("Hey team", etc.) and later join lines also cleared so each
--   chat ends with exactly one starter message.
--
-- Marketing Team chat — all messages flagged dev/test and removed:
--   "What's up execs"; screenshot tests "Lets goo" / "lets see if it looks better";
--   repeated "Hi"/"hi" pings; "Let's see if this still works?".

DO $$
DECLARE
  target_club_name constant text := 'Gryph ClubConnect';
  general_chat_name constant text := 'General';
  marketing_chat_name constant text := 'Marketing Team';
  general_starter constant text :=
    'Welcome to the Gryph ClubConnect testing hub! Use this chat for general testing questions, updates, and feedback during the user test.';
  marketing_starter constant text :=
    'Marketing team chat is ready for testing. Use this space to test team communication, polls, files, and quick updates.';
  v_club_id uuid;
  v_general_id uuid;
  v_marketing_id uuid;
  v_actor uuid;
  v_deleted_polls integer := 0;
  v_deleted_messages integer := 0;
  v_now timestamptz := now();
BEGIN
  SELECT c.id
  INTO v_club_id
  FROM public.clubs AS c
  WHERE lower(trim(c.name)) = lower(target_club_name)
  LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE NOTICE 'Club "%" not found; skipping chat history reset.', target_club_name;
    RETURN;
  END IF;

  SELECT c.id
  INTO v_general_id
  FROM public.conversations AS c
  WHERE c.club_id = v_club_id
    AND c.type = 'group'
    AND lower(trim(c.name)) = lower(general_chat_name)
  LIMIT 1;

  SELECT c.id
  INTO v_marketing_id
  FROM public.conversations AS c
  WHERE c.club_id = v_club_id
    AND c.type = 'group'
    AND lower(trim(c.name)) = lower(marketing_chat_name)
  LIMIT 1;

  IF v_general_id IS NULL OR v_marketing_id IS NULL THEN
    RAISE EXCEPTION
      'Expected Gryph ClubConnect group chats not found (general=%, marketing=%).',
      v_general_id,
      v_marketing_id;
  END IF;

  v_actor := public.club_chat_provisioning_actor(v_club_id);

  DELETE FROM public.chat_polls AS cp
  WHERE cp.conversation_id IN (v_general_id, v_marketing_id);
  GET DIAGNOSTICS v_deleted_polls = ROW_COUNT;

  DELETE FROM public.direct_messages AS dm
  WHERE dm.conversation_id IN (v_general_id, v_marketing_id);
  GET DIAGNOSTICS v_deleted_messages = ROW_COUNT;

  INSERT INTO public.direct_messages (conversation_id, sender_id, content, created_at)
  VALUES
    (v_general_id, v_actor, general_starter, v_now),
    (v_marketing_id, v_actor, marketing_starter, v_now);

  UPDATE public.conversations AS c
  SET updated_at = v_now
  WHERE c.id IN (v_general_id, v_marketing_id);

  RAISE NOTICE
    'Reset Gryph ClubConnect chats: deleted % polls, % messages; seeded General + Marketing Team starters.',
    v_deleted_polls,
    v_deleted_messages;
END;
$$;
