-- =============================================================================
-- BASE TABLES — Supabase SQL for Gryph Club Connect
-- =============================================================================
-- Creates all base tables referenced by the frontend: profiles, clubs,
-- club_members, user_clubs, posts, events, messages, event_rsvps, notifications.
--
-- IMPORTANT: Tables are created FIRST, then RLS policies are added.  This
-- avoids "relation does not exist" errors when a policy on one table
-- (e.g. clubs) references another table (e.g. club_members) that hasn't
-- been created yet.
--
-- Every statement is idempotent (CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS + CREATE POLICY, etc.) so this file can be re-run
-- safely against any environment.
-- =============================================================================

-- ###########################################################################
--  PHASE 1 — CREATE ALL TABLES + INDEXES
-- ###########################################################################

-- =========================================================
-- 1. profiles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  email       text,
  university  text,
  program     text,
  avatar_url  text,
  updated_at  timestamptz DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 2. clubs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.clubs (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name               text NOT NULL,
  slug               text UNIQUE,
  description        text DEFAULT '',
  short_description  text,
  long_description   text,
  category           text DEFAULT '',
  member_count       integer DEFAULT 0,
  meeting_schedule   text DEFAULT '',
  meeting_location   text,
  location           text DEFAULT '',
  image_url          text,
  logo_url           text,
  banner_url         text,
  brand_color        text DEFAULT '#C20430',
  tags               text[] DEFAULT '{}',
  contact_email      text DEFAULT '',
  is_public          boolean DEFAULT true,
  is_featured        boolean DEFAULT false,
  is_verified        boolean DEFAULT false,
  abbreviation       text,
  join_code          text UNIQUE,
  social_links       jsonb,
  requires_approval  boolean DEFAULT false,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clubs_slug ON public.clubs(slug);
CREATE INDEX IF NOT EXISTS idx_clubs_category ON public.clubs(category);
CREATE INDEX IF NOT EXISTS idx_clubs_join_code ON public.clubs(join_code);

-- =========================================================
-- 3. club_members
-- =========================================================
CREATE TABLE IF NOT EXISTS public.club_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'exec', 'member')),
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'pending')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON public.club_members(user_id);

-- =========================================================
-- 4. user_clubs (saved/bookmarked clubs)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_clubs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'saved'
                CHECK (type IN ('saved')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, club_id, type)
);

CREATE INDEX IF NOT EXISTS idx_user_clubs_user_id ON public.user_clubs(user_id);

-- =========================================================
-- 5. posts (announcements)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_club_id ON public.posts(club_id);

-- =========================================================
-- 6. events
-- =========================================================
CREATE TABLE IF NOT EXISTS public.events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text DEFAULT '',
  date        date NOT NULL,
  time        text DEFAULT 'TBD',
  location    text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_club_id ON public.events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);

-- =========================================================
-- 7. messages (club chat)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel     text NOT NULL DEFAULT 'general',
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_club_id ON public.messages(club_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(club_id, channel);

-- =========================================================
-- 8. event_rsvps
-- =========================================================
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL
                CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON public.event_rsvps(event_id);

-- =========================================================
-- 9. notifications
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'club_update',
  message       text NOT NULL DEFAULT '',
  read          boolean NOT NULL DEFAULT false,
  club_id       uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  reference_id  uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE read = false;

-- ###########################################################################
--  PHASE 2 — ENABLE RLS ON ALL TABLES
-- ###########################################################################

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_clubs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ###########################################################################
--  PHASE 3 — CREATE ALL RLS POLICIES
--  (All tables exist at this point, so cross-table references are safe.)
-- ###########################################################################

-- ----- profiles -----
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
CREATE POLICY "Users can view any profile"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ----- clubs (references club_members — now safe) -----
DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
CREATE POLICY "Anyone can view clubs"
  ON public.clubs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;
CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Club admins can update clubs" ON public.clubs;
CREATE POLICY "Club admins can update clubs"
  ON public.clubs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = clubs.id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Club admins can delete clubs" ON public.clubs;
CREATE POLICY "Club admins can delete clubs"
  ON public.clubs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = clubs.id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role = 'admin'
    )
  );

-- ----- club_members -----
DROP POLICY IF EXISTS "Anyone can view club members" ON public.club_members;
CREATE POLICY "Anyone can view club members"
  ON public.club_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
CREATE POLICY "Users can join clubs"
  ON public.club_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can leave clubs or admins can remove" ON public.club_members;
CREATE POLICY "Users can leave clubs or admins can remove"
  ON public.club_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update club members" ON public.club_members;
CREATE POLICY "Admins can update club members"
  ON public.club_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'exec')
    )
  );

-- ----- user_clubs -----
DROP POLICY IF EXISTS "Users can view own saved clubs" ON public.user_clubs;
CREATE POLICY "Users can view own saved clubs"
  ON public.user_clubs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can save clubs" ON public.user_clubs;
CREATE POLICY "Users can save clubs"
  ON public.user_clubs FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can unsave clubs" ON public.user_clubs;
CREATE POLICY "Users can unsave clubs"
  ON public.user_clubs FOR DELETE
  USING (user_id = auth.uid());

-- ----- posts (references club_members) -----
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts"
  ON public.posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins and execs can create posts" ON public.posts;
CREATE POLICY "Admins and execs can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = posts.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins and execs can delete posts" ON public.posts;
CREATE POLICY "Admins and execs can delete posts"
  ON public.posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = posts.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

-- ----- events (references club_members) -----
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
CREATE POLICY "Anyone can view events"
  ON public.events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins and execs can create events" ON public.events;
CREATE POLICY "Admins and execs can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins and execs can update events" ON public.events;
CREATE POLICY "Admins and execs can update events"
  ON public.events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins and execs can delete events" ON public.events;
CREATE POLICY "Admins and execs can delete events"
  ON public.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

-- ----- messages (references club_members) -----
DROP POLICY IF EXISTS "Club members can view messages" ON public.messages;
CREATE POLICY "Club members can view messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Club members can send messages" ON public.messages;
CREATE POLICY "Club members can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- ----- event_rsvps -----
DROP POLICY IF EXISTS "Anyone can view RSVPs" ON public.event_rsvps;
CREATE POLICY "Anyone can view RSVPs"
  ON public.event_rsvps FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can RSVP" ON public.event_rsvps;
CREATE POLICY "Users can RSVP"
  ON public.event_rsvps FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own RSVP" ON public.event_rsvps;
CREATE POLICY "Users can update own RSVP"
  ON public.event_rsvps FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove own RSVP" ON public.event_rsvps;
CREATE POLICY "Users can remove own RSVP"
  ON public.event_rsvps FOR DELETE
  USING (user_id = auth.uid());

-- ----- notifications -----
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ###########################################################################
--  PHASE 4 — TRIGGERS & FUNCTIONS
-- ###########################################################################

-- Auto-create a profile row for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate a join_code automatically when a club is created (if not supplied).
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
  attempts  int := 0;
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    LOOP
      candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE join_code = candidate);
      attempts := attempts + 1;
      IF attempts > 20 THEN
        RAISE EXCEPTION 'Could not generate a unique join code after 20 attempts';
      END IF;
    END LOOP;
    NEW.join_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_join_code ON public.clubs;
CREATE TRIGGER set_join_code
  BEFORE INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.generate_join_code();
