-- =============================================================================
-- Fix notifications INSERT policy (injection hardening)
-- =============================================================================
-- Replace permissive INSERT policy with scoped rule:
-- - authenticated users may only insert notifications for themselves
-- - system generated notifications should use service role paths (bypass RLS)
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own_or_system" ON public.notifications;

CREATE POLICY "notifications_insert_own_or_system"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );
