-- =============================================================================
-- Platform admin and moderation foundation
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins_select_self" ON public.platform_admins;
CREATE POLICY "platform_admins_select_self"
  ON public.platform_admins
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "platform_admins_select_admins" ON public.platform_admins;
CREATE POLICY "platform_admins_select_admins"
  ON public.platform_admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_audit_log_insert_admins" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_insert_admins"
  ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_audit_log_select_admins" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_select_admins"
  ON public.admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own"
  ON public.reports
  FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own"
  ON public.reports
  FOR SELECT
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_select_admins" ON public.reports;
CREATE POLICY "reports_select_admins"
  ON public.reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_update_admins" ON public.reports;
CREATE POLICY "reports_update_admins"
  ON public.reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );
