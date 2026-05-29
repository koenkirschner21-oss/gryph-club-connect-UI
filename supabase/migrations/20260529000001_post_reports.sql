-- =============================================================================
-- Post reports (announcement moderation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'unreviewed'
    CHECK (status IN ('unreviewed', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON public.post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON public.post_reports(status);
CREATE INDEX IF NOT EXISTS idx_post_reports_created_at ON public.post_reports(created_at DESC);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_reports_insert_own" ON public.post_reports;
CREATE POLICY "post_reports_insert_own"
  ON public.post_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid());

DROP POLICY IF EXISTS "post_reports_select_own" ON public.post_reports;
CREATE POLICY "post_reports_select_own"
  ON public.post_reports
  FOR SELECT
  TO authenticated
  USING (reported_by = auth.uid());

DROP POLICY IF EXISTS "post_reports_select_admins" ON public.post_reports;
CREATE POLICY "post_reports_select_admins"
  ON public.post_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "post_reports_update_admins" ON public.post_reports;
CREATE POLICY "post_reports_update_admins"
  ON public.post_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );

-- Platform admins may remove reported posts during moderation
DROP POLICY IF EXISTS "posts_delete_platform_admins" ON public.posts;
CREATE POLICY "posts_delete_platform_admins"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );
