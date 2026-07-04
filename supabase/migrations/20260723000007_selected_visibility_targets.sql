-- Add a selected visibility tier for announcements, events, and documents.
-- The fixed tiers keep their existing behavior; selected content is visible only
-- to active members whose access level or user id is explicitly targeted.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility_roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS visibility_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility_roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS visibility_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.club_documents
  ADD COLUMN IF NOT EXISTS visibility_roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS visibility_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_posts_visibility_roles
  ON public.posts USING gin (visibility_roles);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_user_ids
  ON public.posts USING gin (visibility_user_ids);
CREATE INDEX IF NOT EXISTS idx_events_visibility_roles
  ON public.events USING gin (visibility_roles);
CREATE INDEX IF NOT EXISTS idx_events_visibility_user_ids
  ON public.events USING gin (visibility_user_ids);
CREATE INDEX IF NOT EXISTS idx_club_documents_visibility_roles
  ON public.club_documents USING gin (visibility_roles);
CREATE INDEX IF NOT EXISTS idx_club_documents_visibility_user_ids
  ON public.club_documents USING gin (visibility_user_ids);

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only', 'selected'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE public.events ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only', 'featured', 'selected'));

ALTER TABLE public.club_documents DROP CONSTRAINT IF EXISTS club_documents_visibility_check;
ALTER TABLE public.club_documents ADD CONSTRAINT club_documents_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only', 'selected'));

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_selected_visibility_targets_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_selected_visibility_targets_check
  CHECK (
    visibility <> 'selected'
    OR cardinality(visibility_roles) > 0
    OR cardinality(visibility_user_ids) > 0
  );

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_selected_visibility_targets_check;
ALTER TABLE public.events ADD CONSTRAINT events_selected_visibility_targets_check
  CHECK (
    visibility <> 'selected'
    OR cardinality(visibility_roles) > 0
    OR cardinality(visibility_user_ids) > 0
  );

ALTER TABLE public.club_documents DROP CONSTRAINT IF EXISTS club_documents_selected_visibility_targets_check;
ALTER TABLE public.club_documents ADD CONSTRAINT club_documents_selected_visibility_targets_check
  CHECK (
    visibility <> 'selected'
    OR cardinality(visibility_roles) > 0
    OR cardinality(visibility_user_ids) > 0
  );

CREATE OR REPLACE FUNCTION public.club_member_selected_visibility_role(
  p_role text,
  p_access_level text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_access_level IN ('president', 'managerial_executive', 'executive', 'member')
      THEN p_access_level
    WHEN p_role IN ('owner', 'admin') THEN 'president'
    WHEN p_role IN ('executive', 'exec') THEN 'executive'
    ELSE 'member'
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_selected_visibility(
  p_club_id uuid,
  p_visibility_roles text[],
  p_visibility_user_ids uuid[],
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
        cm.user_id = ANY(COALESCE(p_visibility_user_ids, '{}'::uuid[]))
        OR public.club_member_selected_visibility_role(cm.role, cm.access_level)
          = ANY(COALESCE(p_visibility_roles, '{}'::text[]))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.club_member_selected_visibility_role(text, text)
  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_view_selected_visibility(uuid, text[], uuid[], uuid)
  TO authenticated;

DROP POLICY IF EXISTS "Club members can view posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_scoped" ON public.posts;
DROP POLICY IF EXISTS "posts_select_tenant" ON public.posts;

CREATE POLICY "posts_select_tenant"
  ON public.posts
  FOR SELECT
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
      AND public.club_member_is_executive_or_above(club_id, auth.uid())
    )
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'members_only') = 'selected'
      AND public.can_view_selected_visibility(
        club_id,
        visibility_roles,
        visibility_user_ids,
        auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "events_select_scoped" ON public.events;
DROP POLICY IF EXISTS "events_select_tenant" ON public.events;
DROP POLICY IF EXISTS "events_select_visibility" ON public.events;

CREATE POLICY "events_select_visibility"
  ON public.events
  FOR SELECT
  USING (
    COALESCE(visibility, 'public') IN ('public', 'featured')
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'public') = 'members_only'
      AND public.is_active_club_member(club_id, auth.uid())
    )
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'public') = 'executives_only'
      AND public.club_member_is_executive_or_above(club_id, auth.uid())
    )
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'public') = 'selected'
      AND public.can_view_selected_visibility(
        club_id,
        visibility_roles,
        visibility_user_ids,
        auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Club members can view documents" ON public.club_documents;
DROP POLICY IF EXISTS "club_documents_select_visibility" ON public.club_documents;

CREATE POLICY "club_documents_select_visibility"
  ON public.club_documents
  FOR SELECT
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
      AND public.club_member_is_executive_or_above(club_id, auth.uid())
    )
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'members_only') = 'selected'
      AND public.can_view_selected_visibility(
        club_id,
        visibility_roles,
        visibility_user_ids,
        auth.uid()
      )
    )
  );
