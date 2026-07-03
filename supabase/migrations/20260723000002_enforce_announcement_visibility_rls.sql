-- Enforce announcement visibility tiers at the RLS layer.
-- Client-side filtering remains defense-in-depth only.

CREATE OR REPLACE FUNCTION public.club_member_is_executive_or_above(
  p_club_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
      AND (
        cm.role IN ('owner', 'admin', 'executive', 'exec')
        OR cm.access_level IN ('president', 'managerial_executive', 'executive')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.club_member_is_executive_or_above(uuid, uuid)
  TO authenticated, anon;

DROP POLICY IF EXISTS "Club members can view posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_scoped" ON public.posts;
DROP POLICY IF EXISTS "posts_select_tenant" ON public.posts;

CREATE POLICY "posts_select_tenant"
  ON public.posts
  FOR SELECT
  TO authenticated, anon
  USING (
    COALESCE(visibility, 'members_only') = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'members_only') = 'members_only'
      AND public.is_active_club_member(club_id, auth.uid())
    )
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'members_only') = 'executives_only'
      AND (
        public.club_member_is_executive_or_above(club_id, auth.uid())
        OR public.club_has_permission(club_id, 'post_announcements', auth.uid())
        OR public.club_has_permission(club_id, 'manage_announcements', auth.uid())
      )
    )
  );
