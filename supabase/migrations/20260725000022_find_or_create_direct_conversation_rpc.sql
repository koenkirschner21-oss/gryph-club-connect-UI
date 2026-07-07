-- Atomic find-or-create for 1:1 direct conversations, preventing duplicate DM
-- threads under concurrent creation (two users starting a DM simultaneously).
--
-- The client previously did insert + client-side dedup-and-retry, which has a
-- race window: both sides can pass the "does one exist?" check and each create a
-- separate thread. This RPC serializes concurrent creates for the same club +
-- unordered user pair via a transaction-scoped advisory lock, then re-checks for
-- an existing thread inside the lock before creating.
--
-- This does NOT retroactively merge any pre-existing duplicate DMs; it only
-- prevents new duplicates. If historical duplicates exist they should be audited
-- and merged separately (same caution as the default-chat dedup work).

CREATE OR REPLACE FUNCTION public.find_or_create_direct_conversation(
  p_other_user_id uuid,
  p_club_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_lock_key bigint;
  v_low uuid;
  v_high uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = v_user THEN
    RAISE EXCEPTION 'invalid_other_user';
  END IF;

  IF p_club_id IS NULL THEN
    RAISE EXCEPTION 'club_id_required';
  END IF;

  -- Both participants must be active members of the club (matches RLS).
  IF NOT public.is_active_club_member(p_club_id, v_user) THEN
    RAISE EXCEPTION 'not_active_club_member';
  END IF;

  IF NOT public.is_active_club_member(p_club_id, p_other_user_id) THEN
    RAISE EXCEPTION 'other_not_active_club_member';
  END IF;

  -- Serialize concurrent creates for this club + unordered user pair.
  IF v_user < p_other_user_id THEN
    v_low := v_user;
    v_high := p_other_user_id;
  ELSE
    v_low := p_other_user_id;
    v_high := v_user;
  END IF;

  v_lock_key := hashtextextended(
    p_club_id::text || ':' || v_low::text || ':' || v_high::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Re-check for an existing 1:1 DM inside the lock.
  SELECT c.id
  INTO v_id
  FROM public.conversations AS c
  WHERE c.club_id = p_club_id
    AND c.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM public.conversation_members AS m
      WHERE m.conversation_id = c.id AND m.user_id = v_user
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_members AS m
      WHERE m.conversation_id = c.id AND m.user_id = p_other_user_id
    )
    AND (
      SELECT count(*) FROM public.conversation_members AS m
      WHERE m.conversation_id = c.id
    ) = 2
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.conversations (club_id, type, created_by)
  VALUES (p_club_id, 'direct', v_user)
  RETURNING id INTO v_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES
    (v_id, v_user),
    (v_id, p_other_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_direct_conversation(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
