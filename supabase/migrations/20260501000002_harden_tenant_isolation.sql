-- =============================================================================
-- P0.2 - Multi-Tenant Isolation (prevent cross-club data leakage)
--
-- NOTE: This codebase already shipped a prior hardening migration:
--   supabase/migrations/20260420_harden_select_rls_scoping.sql
-- which scopes SELECT on:
--   public.club_members, public.events, public.event_rsvps, public.profiles
--
-- The remaining high-risk "USING (true)" read policy in base schema is:
--   public.posts ("Anyone can view posts")
--
-- This migration:
-- - Re-applies the intent of P0.2 in an idempotent way (DROP IF EXISTS)
-- - Drops possible alternates mentioned in the sprint brief (if present)
-- - Replaces public.posts SELECT with active membership scoping
--
-- public.messages + public.tasks are already membership-scoped in existing
-- migrations (see 20260406_create_base_tables.sql and 20260408_create_tasks_table.sql).
-- =============================================================================

-- =============================================================================
-- CLUB_MEMBERS
-- =============================================================================
DROP POLICY IF EXISTS "Club members are viewable by club members" ON public.club_members;
DROP POLICY IF EXISTS "Enable read access for club members" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_policy" ON public.club_members;
DROP POLICY IF EXISTS "Club members visible to same club members" ON public.club_members;

DROP POLICY IF EXISTS "Anyone can view club members" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_scoped" ON public.club_members;

CREATE POLICY "club_members_select_scoped"
  ON public.club_members
  FOR SELECT
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- =============================================================================
-- EVENTS
-- =============================================================================
DROP POLICY IF EXISTS "Events are viewable by club members" ON public.events;
DROP POLICY IF EXISTS "Enable read access for events" ON public.events;
DROP POLICY IF EXISTS "events_select_policy" ON public.events;
DROP POLICY IF EXISTS "Events visible to club members only" ON public.events;

DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "events_select_scoped" ON public.events;

CREATE POLICY "events_select_scoped"
  ON public.events
  FOR SELECT
  USING (
    club_id IN (
      SELECT club_members.club_id
      FROM public.club_members
      WHERE club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- =============================================================================
-- EVENT_RSVPS
-- =============================================================================
DROP POLICY IF EXISTS "Event RSVPs are viewable by club members" ON public.event_rsvps;
DROP POLICY IF EXISTS "Enable read access for RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_select_policy" ON public.event_rsvps;
DROP POLICY IF EXISTS "RSVPs visible to same club members" ON public.event_rsvps;

DROP POLICY IF EXISTS "Anyone can view RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_select_scoped" ON public.event_rsvps;

CREATE POLICY "event_rsvps_select_scoped"
  ON public.event_rsvps
  FOR SELECT
  USING (
    event_id IN (
      SELECT events.id
      FROM public.events
      WHERE events.club_id IN (
        SELECT club_members.club_id
        FROM public.club_members
        WHERE club_members.user_id = auth.uid()
          AND club_members.status = 'active'
      )
    )
  );

-- =============================================================================
-- PROFILES
-- =============================================================================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles visible to users in shared clubs" ON public.profiles;

DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;

CREATE POLICY "profiles_select_scoped"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT club_members.user_id
      FROM public.club_members
      WHERE club_members.club_id IN (
        SELECT cm.club_id
        FROM public.club_members AS cm
        WHERE cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
        AND club_members.status = 'active'
    )
  );

-- =============================================================================
-- MESSAGES (already membership-scoped; keep naming aligned + idempotent replace)
-- =============================================================================
DROP POLICY IF EXISTS "Messages are viewable by club members" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "Messages visible to club members only" ON public.messages;

DROP POLICY IF EXISTS "Club members can view messages" ON public.messages;

CREATE POLICY "Club members can view messages"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- =============================================================================
-- TASKS (already membership-scoped; keep naming aligned + idempotent replace)
-- =============================================================================
DROP POLICY IF EXISTS "Tasks are viewable by club members" ON public.tasks;
DROP POLICY IF EXISTS "Enable read access for tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "Tasks visible to club members only" ON public.tasks;

DROP POLICY IF EXISTS "Club members can view tasks" ON public.tasks;

CREATE POLICY "Club members can view tasks"
  ON public.tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- =============================================================================
-- POSTS (actual cross-tenant leak fix vs base schema)
-- =============================================================================
DROP POLICY IF EXISTS "Posts are viewable by club members" ON public.posts;
DROP POLICY IF EXISTS "Enable read access for posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;
DROP POLICY IF EXISTS "Posts visible to club members only" ON public.posts;

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "posts_select_scoped" ON public.posts;

CREATE POLICY "posts_select_scoped"
  ON public.posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = posts.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );
