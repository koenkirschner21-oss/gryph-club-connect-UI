-- =============================================================================
-- ENHANCED NOTIFICATIONS + USER INTERESTS — Supabase SQL
-- =============================================================================
-- Run this in the Supabase SQL Editor.
-- Adds reference_id column to notifications and creates user_interests table.
-- =============================================================================

-- 1. Add reference_id to notifications (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN reference_id uuid;
  END IF;
END $$;

-- 2. Create user_interests table for onboarding
CREATE TABLE IF NOT EXISTS public.user_interests (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

-- 3. Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON public.user_interests(user_id);

-- 4. Enable Row Level Security
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for user_interests

-- Users can view their own interests
DROP POLICY IF EXISTS "Users can view own interests" ON public.user_interests;
CREATE POLICY "Users can view own interests"
  ON public.user_interests FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own interests
DROP POLICY IF EXISTS "Users can insert own interests" ON public.user_interests;
CREATE POLICY "Users can insert own interests"
  ON public.user_interests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own interests
DROP POLICY IF EXISTS "Users can delete own interests" ON public.user_interests;
CREATE POLICY "Users can delete own interests"
  ON public.user_interests FOR DELETE
  USING (user_id = auth.uid());
