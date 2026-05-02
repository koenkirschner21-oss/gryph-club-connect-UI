-- ============================================================================
-- P0.1 - Fix Notification Injection Vulnerability (RLS tightening)
--
-- IMPORTANT: Postgres combines multiple permissive INSERT policies with OR.
-- Older permissive INSERT policies must be dropped and replaced/restricted
-- together, otherwise an attacker could still INSERT for other users via a
-- previously-permissive policy.
-- ============================================================================

-- Drop legacy / overly-permissive notification INSERT policies
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;

-- Prefer replacing the existing tightened policy wholesale (idempotent-ish)
DROP POLICY IF EXISTS "notifications_insert_own_or_system" ON public.notifications;

CREATE POLICY "Users can only create their own notifications"
  ON public.notifications
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert_own"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_club_id uuid DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Note: notifications table columns are user_id/type/message/read/club_id/reference_id
  -- `p_title` is accepted for forward compatibility only (stored in message prefix).
  INSERT INTO public.notifications (
    user_id,
    type,
    message,
    club_id,
    reference_id
  )
  VALUES (
    p_user_id,
    p_type,
    CASE
      WHEN p_title IS NOT NULL AND btrim(p_title) <> ''
        THEN '[' || btrim(p_title) || '] ' || COALESCE(p_message, '')
      ELSE COALESCE(p_message, '')
    END,
    p_club_id,
    p_reference_id
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- SECURITY: do NOT grant this to authenticated (would re-open cross-user inserts).
ALTER FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) TO service_role;
