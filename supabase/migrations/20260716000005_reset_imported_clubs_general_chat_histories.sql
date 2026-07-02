-- Batch 5: Reset General chat message history for four imported clubs returning to unclaimed state.
-- Companion to Batch 1 (20260716000001). Preserves conversation records, membership, permissions,
-- chat type, and structure. Does not rename chats or seed starter messages.
--
-- Accounting Students' Association — removed:
--   "Hi Welcome!" (Koen Kirschner, 2026-06-12)
--   "👋 Koen Kirschner just joined the club! Welcome!" (2026-06-13)
--
-- Achieve Connect Empower — removed (all flagged dev/join):
--   "👋 Koen Kirschner just joined the club! Welcome!" (2026-06-12)
--
-- Albanian Students Club — removed (all flagged dev/join):
--   "👋 Koen Kirschner just joined the club! Welcome!" (2026-06-15)
--
-- Anime Club Genshiken — removed (all flagged dev/join):
--   "👋 Koen Kirschner just joined the club! Welcome!" (2026-06-16)
--
-- No polls or other messages were present in any of the four General chats.

DO $$
DECLARE
  reset_names constant text[] := ARRAY[
    'Accounting Students'' Association',
    'Achieve Connect Empower',
    'Albanian Students Club',
    'Anime Club Genshiken'
  ];
  general_chat_name constant text := 'General';
  v_general_ids uuid[];
  v_deleted_polls integer := 0;
  v_deleted_messages integer := 0;
BEGIN
  SELECT array_agg(conv.id ORDER BY c.name)
  INTO v_general_ids
  FROM public.clubs AS c
  JOIN public.conversations AS conv
    ON conv.club_id = c.id
   AND conv.type = 'group'
   AND lower(trim(conv.name)) = lower(general_chat_name)
  WHERE c.name = ANY (reset_names);

  IF v_general_ids IS NULL OR cardinality(v_general_ids) = 0 THEN
    RAISE NOTICE 'No General chats found for imported clubs; skipping message reset.';
    RETURN;
  END IF;

  IF cardinality(v_general_ids) <> cardinality(reset_names) THEN
    RAISE EXCEPTION
      'Expected % General chats for imported clubs, found %.',
      cardinality(reset_names),
      cardinality(v_general_ids);
  END IF;

  DELETE FROM public.chat_polls AS cp
  WHERE cp.conversation_id = ANY (v_general_ids);
  GET DIAGNOSTICS v_deleted_polls = ROW_COUNT;

  DELETE FROM public.direct_messages AS dm
  WHERE dm.conversation_id = ANY (v_general_ids);
  GET DIAGNOSTICS v_deleted_messages = ROW_COUNT;

  UPDATE public.conversations AS conv
  SET updated_at = now()
  WHERE conv.id = ANY (v_general_ids);

  RAISE NOTICE
    'Reset General chat histories for % imported clubs: deleted % polls, % messages (no starters seeded).',
    cardinality(v_general_ids),
    v_deleted_polls,
    v_deleted_messages;
END;
$$;
