-- =============================================================================
-- LAYER: RLS + trigger alignment (tenant model + single creator trigger)
-- Single creator trigger; NEW.created_by only; UPSERT idempotent.
-- One SELECT policy expression for club_members (own row OR shared club peers).
-- clubs: tenant + minimal join/discovery branch for authenticated users.
-- Remaining tenant tables use active-membership club_id scope.
-- =============================================================================

-- ─── clubs: ONE creator-membership trigger (replace legacy names/functions) ──
DROP TRIGGER IF EXISTS zzz_ensure_creator_membership_fallback ON public.clubs;
DROP TRIGGER IF EXISTS trg_clubs_ensure_creator_membership ON public.clubs;
DROP TRIGGER IF EXISTS aaa_ensure_creator_owner_membership ON public.clubs;

DROP FUNCTION IF EXISTS public.ensure_creator_owner_membership();
DROP FUNCTION IF EXISTS public.ensure_creator_row_if_missing_after_club_insert();

CREATE OR REPLACE FUNCTION public.ensure_creator_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.club_members (club_id, user_id, role, status)
    VALUES (NEW.id, NEW.created_by, 'owner', 'active')
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET
      role = 'owner',
      status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

-- Runs before default channels seed (alphabetical AFTER trigger order).
CREATE TRIGGER aaa_ensure_creator_membership
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_creator_membership();

-- ═══════════════════════════════════════════════════════════════════════════
-- SHARED PREDICATES (copied inline per-table; avoid DO/recursive helpers)
--
-- Active membership set for current auth user:
--   club_id IN (
--     SELECT cm.club_id FROM public.club_members cm
--     WHERE cm.user_id = auth.uid() AND cm.status = 'active'
--   )
--
-- Privileged (owner/admin/exec) in a club_id:
--   EXISTS (
--     SELECT 1 FROM public.club_members cm
--     WHERE cm.club_id = <club_id_expr>
--       AND cm.user_id = auth.uid()
--       AND cm.status = 'active'
--       AND cm.role IN ('owner', 'admin', 'exec')
--   )
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── clubs ───
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
DROP POLICY IF EXISTS "clubs_select_tenant" ON public.clubs;
DROP POLICY IF EXISTS "clubs_select_scoped" ON public.clubs;

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;
DROP POLICY IF EXISTS "clubs_insert_authenticated_creator" ON public.clubs;

DROP POLICY IF EXISTS "Club admins can update clubs" ON public.clubs;
DROP POLICY IF EXISTS "clubs_update_privileged" ON public.clubs;

DROP POLICY IF EXISTS "Club admins can delete clubs" ON public.clubs;
DROP POLICY IF EXISTS "clubs_delete_owner_admin" ON public.clubs;

CREATE POLICY "clubs_select_tenant"
  ON public.clubs FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      id IN (
        SELECT cm.club_id
        FROM public.club_members AS cm
        WHERE cm.user_id = auth.uid()
          AND cm.status IN ('active', 'pending')
      )
      OR (is_public IS NOT DISTINCT FROM true)
      OR (
        join_code IS NOT NULL
        AND trim(join_code) <> ''
      )
    )
  );

CREATE POLICY "clubs_insert_authenticated_creator"
  ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

CREATE POLICY "clubs_update_privileged"
  ON public.clubs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = clubs.id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

CREATE POLICY "clubs_delete_owner_admin"
  ON public.clubs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = clubs.id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin')
    )
  );

-- ─── club_members (single SELECT model) ───
DROP POLICY IF EXISTS "Anyone can view club members" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_scoped" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_own_rows" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_club_peers" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_single" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_tenant" ON public.club_members;

DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
DROP POLICY IF EXISTS "club_members_insert_self_join" ON public.club_members;

DROP POLICY IF EXISTS "Users can leave clubs or admins can remove" ON public.club_members;
DROP POLICY IF EXISTS "club_members_delete_leave_or_manage" ON public.club_members;

DROP POLICY IF EXISTS "Admins can update club members" ON public.club_members;
DROP POLICY IF EXISTS "club_members_update_privileged" ON public.club_members;

CREATE POLICY "club_members_select_tenant"
  ON public.club_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "club_members_insert_self_join"
  ON public.club_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "club_members_delete_leave_or_manage"
  ON public.club_members FOR DELETE TO authenticated
  USING (
    club_members.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "club_members_update_privileged"
  ON public.club_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

-- ─── user_clubs (bookmark rows; scope saved clubs to visible tenant clubs) ───
DROP POLICY IF EXISTS "Users can view own saved clubs" ON public.user_clubs;
DROP POLICY IF EXISTS "user_clubs_select_own" ON public.user_clubs;

DROP POLICY IF EXISTS "Users can save clubs" ON public.user_clubs;
DROP POLICY IF EXISTS "user_clubs_insert_own" ON public.user_clubs;

DROP POLICY IF EXISTS "Users can unsave clubs" ON public.user_clubs;
DROP POLICY IF EXISTS "user_clubs_delete_own" ON public.user_clubs;

CREATE POLICY "user_clubs_select_own"
  ON public.user_clubs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_clubs_insert_own"
  ON public.user_clubs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "user_clubs_delete_own"
  ON public.user_clubs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── profiles (no club_id column; mutual active membership visibility) ───
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_tenant" ON public.profiles;

CREATE POLICY "profiles_select_tenant"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_members AS cm_self
      INNER JOIN public.club_members AS cm_peer
        ON cm_self.club_id = cm_peer.club_id
      WHERE cm_self.user_id = auth.uid()
        AND cm_self.status = 'active'
        AND cm_peer.user_id = profiles.id
        AND cm_peer.status = 'active'
    )
  );

-- ─── posts ───
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_scoped" ON public.posts;
DROP POLICY IF EXISTS "posts_select_tenant" ON public.posts;

DROP POLICY IF EXISTS "Admins and execs can create posts" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_privileged" ON public.posts;

DROP POLICY IF EXISTS "Admins and execs can delete posts" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_privileged" ON public.posts;

CREATE POLICY "posts_select_tenant"
  ON public.posts FOR SELECT TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "posts_insert_privileged"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = posts.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

CREATE POLICY "posts_delete_privileged"
  ON public.posts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = posts.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

-- ─── events ───
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "events_select_scoped" ON public.events;
DROP POLICY IF EXISTS "events_select_tenant" ON public.events;

DROP POLICY IF EXISTS "Admins and execs can create events" ON public.events;
DROP POLICY IF EXISTS "events_insert_privileged" ON public.events;

DROP POLICY IF EXISTS "Admins and execs can update events" ON public.events;
DROP POLICY IF EXISTS "events_update_privileged" ON public.events;

DROP POLICY IF EXISTS "Admins and execs can delete events" ON public.events;
DROP POLICY IF EXISTS "events_delete_privileged" ON public.events;

CREATE POLICY "events_select_tenant"
  ON public.events FOR SELECT TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "events_insert_privileged"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = events.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

CREATE POLICY "events_update_privileged"
  ON public.events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = events.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

CREATE POLICY "events_delete_privileged"
  ON public.events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = events.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

-- ─── event_rsvps ───
DROP POLICY IF EXISTS "Anyone can view RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_select_scoped" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_select_tenant" ON public.event_rsvps;

DROP POLICY IF EXISTS "Users can RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_insert_active_member" ON public.event_rsvps;

DROP POLICY IF EXISTS "Users can update own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_update_own" ON public.event_rsvps;

DROP POLICY IF EXISTS "Users can remove own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_delete_own" ON public.event_rsvps;

CREATE POLICY "event_rsvps_select_tenant"
  ON public.event_rsvps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events AS ev
      WHERE ev.id = event_rsvps.event_id
        AND ev.club_id IN (
          SELECT cm.club_id
          FROM public.club_members AS cm
          WHERE cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    )
  );

CREATE POLICY "event_rsvps_insert_active_member"
  ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events AS ev
      WHERE ev.id = event_rsvps.event_id
        AND ev.club_id IN (
          SELECT cm.club_id
          FROM public.club_members AS cm
          WHERE cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    )
  );

CREATE POLICY "event_rsvps_update_own"
  ON public.event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "event_rsvps_delete_own"
  ON public.event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── tasks ───
DROP POLICY IF EXISTS "Club members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_tenant" ON public.tasks;

DROP POLICY IF EXISTS "Admins and execs can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_privileged" ON public.tasks;

DROP POLICY IF EXISTS "Admins/execs can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_privileged" ON public.tasks;

DROP POLICY IF EXISTS "Assigned users can update task status" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_assigned_status" ON public.tasks;

DROP POLICY IF EXISTS "Admins and execs can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_privileged" ON public.tasks;

CREATE POLICY "tasks_select_tenant"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "tasks_insert_privileged"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = tasks.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

CREATE POLICY "tasks_update_privileged"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = tasks.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

CREATE POLICY "tasks_update_assigned_status"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    tasks.assigned_to = auth.uid()
    AND club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "tasks_delete_privileged"
  ON public.tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = tasks.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

-- ─── channels ───
DROP POLICY IF EXISTS "channels_select" ON public.channels;
DROP POLICY IF EXISTS "channels_select_scoped" ON public.channels;
DROP POLICY IF EXISTS "channels_select_tenant" ON public.channels;

DROP POLICY IF EXISTS "channels_insert_admin" ON public.channels;
DROP POLICY IF EXISTS "channels_insert_privileged" ON public.channels;

DROP POLICY IF EXISTS "channels_update_admin" ON public.channels;
DROP POLICY IF EXISTS "channels_update_privileged" ON public.channels;

DROP POLICY IF EXISTS "channels_delete_admin" ON public.channels;
DROP POLICY IF EXISTS "channels_delete_privileged" ON public.channels;

CREATE POLICY "channels_select_tenant"
  ON public.channels FOR SELECT TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "channels_insert_privileged"
  ON public.channels FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = channels.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "channels_update_privileged"
  ON public.channels FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = channels.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

CREATE POLICY "channels_delete_privileged"
  ON public.channels FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = channels.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

-- ─── messages ───
DROP POLICY IF EXISTS "Club members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Active members can send non-announcement messages" ON public.messages;
DROP POLICY IF EXISTS "Admins and execs can send announcements" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages by channel permissions" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_channel_policy" ON public.messages;

DROP POLICY IF EXISTS "Club members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Messages are viewable by club members" ON public.messages;
DROP POLICY IF EXISTS "messages_select_scoped" ON public.messages;
DROP POLICY IF EXISTS "messages_select_tenant" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "Messages visible to club members only" ON public.messages;

CREATE POLICY "messages_select_tenant"
  ON public.messages FOR SELECT TO authenticated
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "messages_insert_channel_policy"
  ON public.messages FOR INSERT TO authenticated
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
          OR EXISTS (
            SELECT 1 FROM public.club_members AS cm
            WHERE cm.club_id = messages.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
              AND cm.role IN ('owner', 'admin', 'exec')
          )
        )
    )
  );

-- ─── notifications ───
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_tenant" ON public.notifications;

CREATE POLICY "notifications_select_tenant"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      club_id IS NULL
      OR club_id IN (
        SELECT cm.club_id
        FROM public.club_members AS cm
        WHERE cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
    )
  );
