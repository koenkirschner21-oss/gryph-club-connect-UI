-- =============================================================================
-- Add explicit profile foreign keys for stable PostgREST joins
-- =============================================================================
-- These supplemental FKs allow explicit !constraint embeds to public.profiles.
-- Existing auth.users FKs are kept in place.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_author_profile_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_author_profile_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_author_profile_fkey'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_author_profile_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assigned_profile_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_assigned_profile_fkey
      FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_creator_profile_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_creator_profile_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'club_members_user_profile_fkey'
  ) THEN
    ALTER TABLE public.club_members
      ADD CONSTRAINT club_members_user_profile_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_rsvps_user_profile_fkey'
  ) THEN
    ALTER TABLE public.event_rsvps
      ADD CONSTRAINT event_rsvps_user_profile_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
