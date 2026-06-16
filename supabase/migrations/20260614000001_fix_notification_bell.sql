-- Fix notification bell: readable rows, trusted inserts, realtime delivery.

-- Users must see every notification addressed to them (not only club-member rows).
DROP POLICY IF EXISTS "notifications_select_tenant" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Trusted cross-user inserts from authenticated app sessions (replaces edge function dependency).
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

-- Ensure realtime INSERT/UPDATE events reach the bell.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
