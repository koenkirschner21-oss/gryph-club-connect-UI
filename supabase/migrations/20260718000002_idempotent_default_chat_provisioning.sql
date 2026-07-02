-- C1: Idempotent default chat provisioning, merge existing duplicates, enforce uniqueness.

CREATE OR REPLACE FUNCTION public.merge_duplicate_club_group_chat(
  p_keep_id uuid,
  p_remove_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_keep_id = p_remove_id THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = p_keep_id) THEN
    RAISE EXCEPTION 'Survivor conversation % not found', p_keep_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = p_remove_id) THEN
    RETURN;
  END IF;

  UPDATE public.direct_messages
  SET conversation_id = p_keep_id
  WHERE conversation_id = p_remove_id;

  UPDATE public.chat_polls
  SET conversation_id = p_keep_id
  WHERE conversation_id = p_remove_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, joined_at)
  SELECT p_keep_id, cm.user_id, cm.joined_at
  FROM public.conversation_members AS cm
  WHERE cm.conversation_id = p_remove_id
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  DELETE FROM public.conversation_members
  WHERE conversation_id = p_remove_id;

  DELETE FROM public.conversations
  WHERE id = p_remove_id;
END;
$$;

-- Merge confirmed duplicate default chats (prod audit 2026-07-18).
DO $$
BEGIN
  -- Guelph Plant & Garden Club — General (keep e81e7cb8, 3 messages)
  PERFORM public.merge_duplicate_club_group_chat(
    'e81e7cb8-0e35-4327-909f-26168d835fa8'::uuid,
    '81a5de9d-0e04-400b-81f9-fac83f2a5db1'::uuid
  );
  -- Guelph Plant & Garden Club — Executive Team
  PERFORM public.merge_duplicate_club_group_chat(
    'fd71470c-0217-471b-8c37-f59ab7060379'::uuid,
    '87290531-2f1c-4e2c-acb0-8fa4880b5d34'::uuid
  );
  -- Guelph Thrift & Style Club — General (keep 26f1c8ba, 3 messages)
  PERFORM public.merge_duplicate_club_group_chat(
    '26f1c8ba-b52e-49ac-b5c0-1b9f8e180666'::uuid,
    '5952dff3-d2db-4aee-bee6-88771480e50f'::uuid
  );
  -- Guelph Thrift & Style Club — Executive Team
  PERFORM public.merge_duplicate_club_group_chat(
    '9b396985-94c8-4184-aa78-a2f937eee65c'::uuid,
    'c8ff1ec2-6e0b-44e9-a66e-c46a701c6b9f'::uuid
  );
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_club_default_group_name_unique
  ON public.conversations (club_id, (lower(trim(name))))
  WHERE type = 'group'
    AND lower(trim(name)) IN ('general', 'executive team');

CREATE OR REPLACE FUNCTION public.get_club_group_conversation(
  p_club_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_trimmed text := trim(p_name);
  v_lock_key bigint;
BEGIN
  v_lock_key := hashtextextended(p_club_id::text || ':' || lower(v_trimmed), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT c.id
  INTO v_id
  FROM public.conversations AS c
  WHERE c.club_id = p_club_id
    AND c.type = 'group'
    AND lower(trim(c.name)) = lower(v_trimmed)
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_actor := public.club_chat_provisioning_actor(p_club_id);

  BEGIN
    INSERT INTO public.conversations (club_id, type, name, created_by)
    VALUES (p_club_id, 'group', v_trimmed, v_actor)
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  IF v_id IS NULL THEN
    SELECT c.id
    INTO v_id
    FROM public.conversations AS c
    WHERE c.club_id = p_club_id
      AND c.type = 'group'
      AND lower(trim(c.name)) = lower(v_trimmed)
    ORDER BY c.created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

-- Redundant with on_club_member_sync_chats (creator INSERT provisions defaults).
DROP TRIGGER IF EXISTS on_club_created_provision_chats ON public.clubs;
