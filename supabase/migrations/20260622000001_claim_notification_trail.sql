-- Claim notification trail: review notes + trusted inbox inserts.

ALTER TABLE public.club_claim_requests
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE OR REPLACE FUNCTION public.send_inbox_messages(p_messages jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_messages IS NULL OR jsonb_typeof(p_messages) <> 'array' THEN
    RAISE EXCEPTION 'Invalid inbox payload';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_messages) AS value
  LOOP
    IF item->>'recipient_id' IS NULL OR btrim(item->>'recipient_id') = '' THEN
      RAISE EXCEPTION 'Each inbox message requires recipient_id';
    END IF;

    INSERT INTO public.inbox_messages (
      recipient_id,
      sender_id,
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
      (item->>'recipient_id')::uuid,
      NULLIF(item->>'sender_id', '')::uuid,
      COALESCE(NULLIF(btrim(item->>'type'), ''), 'system_message'),
      COALESCE(item->>'title', ''),
      COALESCE(item->>'message', ''),
      COALESCE((item->>'action_required')::boolean, false),
      NULLIF(item->>'action_type', ''),
      COALESCE(item->'action_data', '{}'::jsonb),
      NULLIF(item->>'club_id', '')::uuid,
      NULLIF(item->>'reference_id', '')::uuid,
      NULLIF(item->>'reference_type', ''),
      false
    );
  END LOOP;
END;
$$;

ALTER FUNCTION public.send_inbox_messages(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.send_inbox_messages(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_inbox_messages(jsonb) TO authenticated;

-- Ensure bell notifications RPC exists (idempotent for projects missing prior migration).
CREATE OR REPLACE FUNCTION public.send_app_notifications(p_notifications jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_notifications IS NULL OR jsonb_typeof(p_notifications) <> 'array' THEN
    RAISE EXCEPTION 'Invalid notifications payload';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_notifications) AS value
  LOOP
    IF item->>'user_id' IS NULL OR btrim(item->>'user_id') = '' THEN
      RAISE EXCEPTION 'Each notification requires user_id';
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
      (item->>'user_id')::uuid,
      COALESCE(NULLIF(btrim(item->>'type'), ''), 'club_update'),
      COALESCE(item->>'message', ''),
      NULLIF(item->>'club_id', '')::uuid,
      NULLIF(item->>'reference_id', '')::uuid,
      false
    );
  END LOOP;
END;
$$;

ALTER FUNCTION public.send_app_notifications(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.send_app_notifications(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_app_notifications(jsonb) TO authenticated;
