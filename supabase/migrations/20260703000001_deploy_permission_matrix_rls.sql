-- AUDIT-3: Defensive deploy of 20260628000001 (permission-matrix RLS).
-- Fixes club_has_permission argument order in policies (club_id, permission_key, user_id).
-- Extends tasks/events privileged policies to use the permission matrix.

-- Granular permission matrix: custom_permissions helpers, hiring reviewer_ids, RLS enforcement.
-- Tasks/events RLS from 20260626000001 is intentionally unchanged.

-- ─── hiring_listings: per-position reviewer assignment ───
ALTER TABLE public.hiring_listings
  ADD COLUMN IF NOT EXISTS reviewer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.hiring_listings.reviewer_ids IS
  'Active member user IDs designated as reviewers for this listing (plus President/Co-President).';

CREATE INDEX IF NOT EXISTS idx_hiring_listings_reviewer_ids
  ON public.hiring_listings USING gin (reviewer_ids);

-- ─── permission role resolution ───
CREATE OR REPLACE FUNCTION public.club_member_permission_role(
  p_club_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(cm.access_level, ''),
    CASE
      WHEN cm.role IN ('owner', 'admin') THEN 'president'
      WHEN cm.role IN ('executive', 'exec') THEN 'executive'
      ELSE 'member'
    END
  )
  FROM public.club_members AS cm
  WHERE cm.club_id = p_club_id
    AND cm.user_id = p_user_id
    AND cm.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_club_president(
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
        cm.role = 'owner'
        OR cm.access_level = 'president'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.club_default_permission_flag(
  p_permission_key text,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_role = 'president' THEN
    RETURN true;
  END IF;

  IF p_role = 'member' THEN
    RETURN false;
  END IF;

  CASE p_permission_key
    WHEN 'manage_members', 'approve_members', 'invite_members' THEN
      RETURN p_role IN ('president', 'managerial_executive');
    WHEN 'manage_hiring', 'view_analytics', 'manage_documents',
         'edit_club_settings', 'manage_club_settings' THEN
      RETURN p_role = 'managerial_executive';
    WHEN 'manage_tasks', 'assign_tasks',
         'manage_events', 'create_events',
         'manage_meetings',
         'manage_announcements', 'post_announcements' THEN
      RETURN p_role IN ('managerial_executive', 'executive');
    WHEN 'manage_roles', 'delete_club' THEN
      RETURN false;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.club_resolve_permission_flag(
  p_custom jsonb,
  p_permission_key text,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_bool boolean;
BEGIN
  IF p_custom IS NOT NULL AND p_custom ? p_permission_key THEN
    v_bool := (p_custom -> p_permission_key ->> p_role)::boolean;
    IF v_bool IS NOT NULL THEN
      RETURN v_bool;
    END IF;
  END IF;

  CASE p_permission_key
    WHEN 'manage_members' THEN
      RETURN COALESCE(
        (p_custom -> 'manage_members' ->> p_role)::boolean,
        (p_custom -> 'approve_members' ->> p_role)::boolean
          AND (p_custom -> 'invite_members' ->> p_role)::boolean
      );
    WHEN 'approve_members' THEN
      RETURN COALESCE(
        (p_custom -> 'approve_members' ->> p_role)::boolean,
        (p_custom -> 'manage_members' ->> p_role)::boolean
      );
    WHEN 'invite_members' THEN
      RETURN COALESCE(
        (p_custom -> 'invite_members' ->> p_role)::boolean,
        (p_custom -> 'manage_members' ->> p_role)::boolean
      );
    WHEN 'manage_club_settings' THEN
      RETURN COALESCE(
        (p_custom -> 'manage_club_settings' ->> p_role)::boolean,
        (p_custom -> 'edit_club_settings' ->> p_role)::boolean
      );
    WHEN 'edit_club_settings' THEN
      RETURN COALESCE(
        (p_custom -> 'edit_club_settings' ->> p_role)::boolean,
        (p_custom -> 'manage_club_settings' ->> p_role)::boolean
      );
    WHEN 'manage_tasks' THEN
      RETURN COALESCE(
        (p_custom -> 'manage_tasks' ->> p_role)::boolean,
        (p_custom -> 'assign_tasks' ->> p_role)::boolean
      );
    WHEN 'assign_tasks' THEN
      RETURN COALESCE(
        (p_custom -> 'assign_tasks' ->> p_role)::boolean,
        (p_custom -> 'manage_tasks' ->> p_role)::boolean
      );
    WHEN 'manage_events' THEN
      RETURN COALESCE(
        (p_custom -> 'manage_events' ->> p_role)::boolean,
        (p_custom -> 'create_events' ->> p_role)::boolean
      );
    WHEN 'create_events' THEN
      RETURN COALESCE(
        (p_custom -> 'create_events' ->> p_role)::boolean,
        (p_custom -> 'manage_events' ->> p_role)::boolean
      );
    WHEN 'manage_announcements' THEN
      RETURN COALESCE(
        (p_custom -> 'manage_announcements' ->> p_role)::boolean,
        (p_custom -> 'post_announcements' ->> p_role)::boolean
      );
    WHEN 'post_announcements' THEN
      RETURN COALESCE(
        (p_custom -> 'post_announcements' ->> p_role)::boolean,
        (p_custom -> 'manage_announcements' ->> p_role)::boolean
      );
    WHEN 'manage_roles' THEN
      RETURN COALESCE(
        (p_custom -> 'manage_roles' ->> p_role)::boolean,
        (p_custom -> 'manage_club_settings' ->> p_role)::boolean
      );
    WHEN 'delete_club' THEN
      RETURN COALESCE(
        (p_custom -> 'delete_club' ->> p_role)::boolean,
        (p_custom -> 'manage_club_settings' ->> p_role)::boolean
      );
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.club_has_permission(
  p_club_id uuid,
  p_permission_key text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_custom jsonb;
  v_flag boolean;
BEGIN
  v_role := public.club_member_permission_role(p_club_id, p_user_id);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'president' THEN
    RETURN true;
  END IF;

  IF v_role = 'member' THEN
    RETURN false;
  END IF;

  SELECT c.custom_permissions
  INTO v_custom
  FROM public.clubs AS c
  WHERE c.id = p_club_id;

  v_flag := public.club_resolve_permission_flag(v_custom, p_permission_key, v_role);
  IF v_flag IS NOT NULL THEN
    RETURN v_flag;
  END IF;

  RETURN public.club_default_permission_flag(p_permission_key, v_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_review_hiring_listing(
  p_listing_id uuid,
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
    FROM public.hiring_listings AS hl
    WHERE hl.id = p_listing_id
      AND (
        public.is_club_president(hl.club_id, p_user_id)
        OR public.club_has_permission(hl.club_id, 'manage_hiring', p_user_id)
        OR p_user_id = ANY(COALESCE(hl.reviewer_ids, '{}'::uuid[]))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_review_hiring_application(
  p_application_id uuid,
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
    FROM public.hiring_applications AS ha
    WHERE ha.id = p_application_id
      AND public.can_review_hiring_listing(ha.listing_id, p_user_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.club_member_permission_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_president(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_default_permission_flag(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_resolve_permission_flag(jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_has_permission(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_hiring_listing(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_hiring_application(uuid, uuid) TO authenticated;

-- ─── club_members ───
DROP POLICY IF EXISTS "club_members_select_tenant" ON public.club_members;
CREATE POLICY "club_members_select_tenant"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "club_members_update_privileged" ON public.club_members;
DROP POLICY IF EXISTS "Admins and execs can update members" ON public.club_members;
CREATE POLICY "club_members_update_privileged"
  ON public.club_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.club_has_permission(club_id, 'manage_members', auth.uid())
    OR public.club_has_permission(club_id, 'approve_members', auth.uid())
    OR public.club_has_permission(club_id, 'manage_roles', auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.club_has_permission(club_id, 'manage_members', auth.uid())
    OR public.club_has_permission(club_id, 'approve_members', auth.uid())
    OR public.club_has_permission(club_id, 'manage_roles', auth.uid())
  );

DROP POLICY IF EXISTS "club_members_delete_leave_or_manage" ON public.club_members;
DROP POLICY IF EXISTS "Admins and execs can delete members" ON public.club_members;
CREATE POLICY "club_members_delete_leave_or_manage"
  ON public.club_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.club_has_permission(club_id, 'manage_members', auth.uid())
    OR public.club_has_permission(club_id, 'approve_members', auth.uid())
  );

-- ─── clubs (settings / join code) ───
DROP POLICY IF EXISTS "clubs_update_privileged" ON public.clubs;
CREATE POLICY "clubs_update_privileged"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.club_has_permission(id, 'manage_club_settings', auth.uid())
    OR public.club_has_permission(id, 'edit_club_settings', auth.uid())
    OR public.club_has_permission(id, 'manage_members', auth.uid())
    OR public.club_has_permission(id, 'manage_roles', auth.uid())
  );

DROP POLICY IF EXISTS "clubs_delete_owner_admin" ON public.clubs;
CREATE POLICY "clubs_delete_owner_admin"
  ON public.clubs
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.club_has_permission(id, 'delete_club', auth.uid())
  );

-- ─── club_invites ───
DROP POLICY IF EXISTS "Presidents can create invites" ON public.club_invites;
DROP POLICY IF EXISTS "club_invites_insert_manage_members" ON public.club_invites;
CREATE POLICY "club_invites_insert_manage_members"
  ON public.club_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = invited_by
    AND (
      public.club_has_permission(club_id, 'manage_members', auth.uid())
      OR public.club_has_permission(club_id, 'invite_members', auth.uid())
    )
  );

DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.club_invites;
CREATE POLICY "Anyone can view invite by token"
  ON public.club_invites
  FOR SELECT
  USING (status = 'pending');

DROP POLICY IF EXISTS "club_invites_select_managers" ON public.club_invites;
CREATE POLICY "club_invites_select_managers"
  ON public.club_invites
  FOR SELECT
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_members', auth.uid())
    OR public.club_has_permission(club_id, 'invite_members', auth.uid())
  );

-- ─── hiring_listings ───
DROP POLICY IF EXISTS "Anyone can view open listings" ON public.hiring_listings;
DROP POLICY IF EXISTS "hiring_listings_select_open" ON public.hiring_listings;
CREATE POLICY "hiring_listings_select_open"
  ON public.hiring_listings
  FOR SELECT
  USING (is_open = true);

DROP POLICY IF EXISTS "hiring_listings_select_club_reviewers" ON public.hiring_listings;
CREATE POLICY "hiring_listings_select_club_reviewers"
  ON public.hiring_listings
  FOR SELECT
  TO authenticated
  USING (
    public.can_review_hiring_listing(id, auth.uid())
  );

DROP POLICY IF EXISTS "Execs can create listings" ON public.hiring_listings;
DROP POLICY IF EXISTS "hiring_listings_insert_manage_hiring" ON public.hiring_listings;
CREATE POLICY "hiring_listings_insert_manage_hiring"
  ON public.hiring_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.club_has_permission(club_id, 'manage_hiring', auth.uid())
  );

DROP POLICY IF EXISTS "hiring_listings_update_manage_hiring" ON public.hiring_listings;
CREATE POLICY "hiring_listings_update_manage_hiring"
  ON public.hiring_listings
  FOR UPDATE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_hiring', auth.uid())
  )
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_hiring', auth.uid())
  );

DROP POLICY IF EXISTS "hiring_listings_delete_manage_hiring" ON public.hiring_listings;
CREATE POLICY "hiring_listings_delete_manage_hiring"
  ON public.hiring_listings
  FOR DELETE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_hiring', auth.uid())
  );

-- ─── hiring_applications ───
DROP POLICY IF EXISTS "Executives can view club hiring applications" ON public.hiring_applications;
DROP POLICY IF EXISTS "hiring_applications_select_reviewers" ON public.hiring_applications;
CREATE POLICY "hiring_applications_select_reviewers"
  ON public.hiring_applications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = applicant_id
    OR public.can_review_hiring_application(id, auth.uid())
  );

DROP POLICY IF EXISTS "Executives can update club hiring applications" ON public.hiring_applications;
DROP POLICY IF EXISTS "hiring_applications_update_reviewers" ON public.hiring_applications;
CREATE POLICY "hiring_applications_update_reviewers"
  ON public.hiring_applications
  FOR UPDATE
  TO authenticated
  USING (
    public.can_review_hiring_application(id, auth.uid())
  )
  WITH CHECK (
    public.can_review_hiring_application(id, auth.uid())
  );

-- ─── application_notes ───
DROP POLICY IF EXISTS "Privileged club members can manage notes" ON public.application_notes;
DROP POLICY IF EXISTS "application_notes_reviewer_access" ON public.application_notes;
CREATE POLICY "application_notes_reviewer_access"
  ON public.application_notes
  FOR ALL
  TO authenticated
  USING (
    public.can_review_hiring_application(application_id, auth.uid())
  )
  WITH CHECK (
    public.can_review_hiring_application(application_id, auth.uid())
  );

-- ─── club_documents ───
DROP POLICY IF EXISTS "Executives and presidents can upload documents" ON public.club_documents;
DROP POLICY IF EXISTS "club_documents_insert_manage" ON public.club_documents;
CREATE POLICY "club_documents_insert_manage"
  ON public.club_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_documents', auth.uid())
  );

DROP POLICY IF EXISTS "Executives and presidents can delete documents" ON public.club_documents;
DROP POLICY IF EXISTS "club_documents_delete_manage" ON public.club_documents;
CREATE POLICY "club_documents_delete_manage"
  ON public.club_documents
  FOR DELETE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_documents', auth.uid())
  );

DROP POLICY IF EXISTS "Club members can update their club documents" ON public.club_documents;
DROP POLICY IF EXISTS "club_documents_update_manage" ON public.club_documents;
CREATE POLICY "club_documents_update_manage"
  ON public.club_documents
  FOR UPDATE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_documents', auth.uid())
  );

-- ─── club_meetings ───
DROP POLICY IF EXISTS "Privileged members can manage meetings" ON public.club_meetings;
DROP POLICY IF EXISTS "club_meetings_manage_permission" ON public.club_meetings;
CREATE POLICY "club_meetings_manage_permission"
  ON public.club_meetings
  FOR ALL
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_meetings', auth.uid())
  )
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_meetings', auth.uid())
  );

DROP POLICY IF EXISTS "Privileged members can manage action items" ON public.meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_manage_permission" ON public.meeting_action_items;
CREATE POLICY "meeting_action_items_manage_permission"
  ON public.meeting_action_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_meetings AS cm
      WHERE cm.id = meeting_action_items.meeting_id
        AND public.club_has_permission(cm.club_id, 'manage_meetings', auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.club_meetings AS cm
      WHERE cm.id = meeting_action_items.meeting_id
        AND public.club_has_permission(cm.club_id, 'manage_meetings', auth.uid())
    )
  );

-- ─── posts (announcements) ───
DROP POLICY IF EXISTS "posts_insert_privileged" ON public.posts;
CREATE POLICY "posts_insert_privileged"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_announcements', auth.uid())
    OR public.club_has_permission(club_id, 'post_announcements', auth.uid())
  );

DROP POLICY IF EXISTS "posts_delete_privileged" ON public.posts;
CREATE POLICY "posts_delete_privileged"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_announcements', auth.uid())
    OR public.club_has_permission(club_id, 'post_announcements', auth.uid())
  );

DROP POLICY IF EXISTS "posts_update_privileged" ON public.posts;
CREATE POLICY "posts_update_privileged"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_announcements', auth.uid())
    OR public.club_has_permission(club_id, 'post_announcements', auth.uid())
  );

-- ─── messages (announcement channel) ───
DROP POLICY IF EXISTS "messages_insert_channel_policy" ON public.messages;
CREATE POLICY "messages_insert_channel_policy"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND channel_id IS NOT NULL
    AND club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.channels AS ch
      WHERE ch.id = messages.channel_id
        AND ch.club_id = messages.club_id
        AND (
          ch.is_announcement_only = false
          OR public.club_has_permission(messages.club_id, 'manage_announcements', auth.uid())
          OR public.club_has_permission(messages.club_id, 'post_announcements', auth.uid())
        )
    )
  );


-- ─── tasks (permission matrix) ───
DROP POLICY IF EXISTS "tasks_insert_privileged" ON public.tasks;
CREATE POLICY "tasks_insert_privileged"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_tasks', auth.uid())
    OR public.club_has_permission(club_id, 'assign_tasks', auth.uid())
  );

DROP POLICY IF EXISTS "tasks_update_privileged" ON public.tasks;
CREATE POLICY "tasks_update_privileged"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_tasks', auth.uid())
    OR public.club_has_permission(club_id, 'assign_tasks', auth.uid())
  );

DROP POLICY IF EXISTS "tasks_delete_privileged" ON public.tasks;
CREATE POLICY "tasks_delete_privileged"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_tasks', auth.uid())
    OR public.club_has_permission(club_id, 'assign_tasks', auth.uid())
  );

-- ─── events (permission matrix) ───
DROP POLICY IF EXISTS "events_insert_privileged" ON public.events;
CREATE POLICY "events_insert_privileged"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND (
      public.club_has_permission(club_id, 'manage_events', auth.uid())
      OR public.club_has_permission(club_id, 'create_events', auth.uid())
    )
  );

DROP POLICY IF EXISTS "events_update_privileged" ON public.events;
CREATE POLICY "events_update_privileged"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_events', auth.uid())
    OR public.club_has_permission(club_id, 'create_events', auth.uid())
  );

DROP POLICY IF EXISTS "events_delete_privileged" ON public.events;
CREATE POLICY "events_delete_privileged"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_events', auth.uid())
    OR public.club_has_permission(club_id, 'create_events', auth.uid())
  );

DROP POLICY IF EXISTS "Executives can view club hiring listings" ON public.hiring_listings;
DROP POLICY IF EXISTS "Executives can delete club hiring listings" ON public.hiring_listings;
DROP POLICY IF EXISTS "Execs can update their listings" ON public.hiring_listings;
DROP POLICY IF EXISTS "Execs can create listings" ON public.hiring_listings;
DROP POLICY IF EXISTS "Admins and execs can insert posts" ON public.posts;

-- ─── storage: hiring application files visible to applicant + reviewers only ───
DROP POLICY IF EXISTS "club_documents_storage_select" ON storage.objects;
CREATE POLICY "club_documents_storage_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND (
      (
        (storage.foldername(name))[2] IS DISTINCT FROM 'hiring-applications'
        AND EXISTS (
          SELECT 1
          FROM public.club_members AS cm
          WHERE cm.club_id = ((storage.foldername(name))[1])::uuid
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      )
      OR (
        (storage.foldername(name))[2] = 'hiring-applications'
        AND (
          (storage.foldername(name))[3] = auth.uid()::text
          OR public.can_review_hiring_listing(
            ((storage.foldername(name))[4])::uuid,
            auth.uid()
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "club_documents_storage_insert" ON storage.objects;
CREATE POLICY "club_documents_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'club-documents'
    AND (
      (
        (storage.foldername(name))[2] IS DISTINCT FROM 'hiring-applications'
        AND EXISTS (
          SELECT 1
          FROM public.club_members AS cm
          WHERE cm.user_id = auth.uid()
            AND cm.status = 'active'
            AND cm.club_id = ((storage.foldername(name))[1])::uuid
            AND public.club_has_permission(cm.club_id, 'manage_documents', auth.uid())
        )
      )
      OR (
        (storage.foldername(name))[2] = 'hiring-applications'
        AND (storage.foldername(name))[3] = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "club_documents_storage_delete" ON storage.objects;
CREATE POLICY "club_documents_storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND EXISTS (
      SELECT 1
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.club_id = ((storage.foldername(name))[1])::uuid
        AND public.club_has_permission(cm.club_id, 'manage_documents', auth.uid())
    )
  );
