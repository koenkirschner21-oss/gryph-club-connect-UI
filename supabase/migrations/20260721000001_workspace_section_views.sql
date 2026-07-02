-- Per-user, per-club, per-section last-viewed tracking for workspace badges.

CREATE TABLE IF NOT EXISTS public.workspace_section_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (
    section IN ('announcements', 'tasks', 'events', 'meetings')
  ),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, club_id, section)
);

CREATE INDEX IF NOT EXISTS idx_workspace_section_views_user_club
  ON public.workspace_section_views(user_id, club_id);

ALTER TABLE public.workspace_section_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_section_views_select_own" ON public.workspace_section_views;
CREATE POLICY "workspace_section_views_select_own"
  ON public.workspace_section_views
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "workspace_section_views_insert_own" ON public.workspace_section_views;
CREATE POLICY "workspace_section_views_insert_own"
  ON public.workspace_section_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "workspace_section_views_update_own" ON public.workspace_section_views;
CREATE POLICY "workspace_section_views_update_own"
  ON public.workspace_section_views
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.upsert_workspace_section_view(
  p_club_id uuid,
  p_section text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_viewed_at timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_club_id IS NULL THEN
    RAISE EXCEPTION 'club_id is required';
  END IF;

  IF p_section IS NULL OR btrim(p_section) = '' THEN
    RAISE EXCEPTION 'section is required';
  END IF;

  IF p_section NOT IN ('announcements', 'tasks', 'events', 'meetings') THEN
    RAISE EXCEPTION 'Invalid workspace section: %', p_section;
  END IF;

  INSERT INTO public.workspace_section_views (
    user_id,
    club_id,
    section,
    last_viewed_at
  )
  VALUES (
    v_user_id,
    p_club_id,
    p_section,
    v_viewed_at
  )
  ON CONFLICT (user_id, club_id, section)
  DO UPDATE SET last_viewed_at = EXCLUDED.last_viewed_at;

  RETURN v_viewed_at;
END;
$$;

ALTER FUNCTION public.upsert_workspace_section_view(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.upsert_workspace_section_view(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_workspace_section_view(uuid, text) TO authenticated;
