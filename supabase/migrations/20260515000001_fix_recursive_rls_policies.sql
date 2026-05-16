-- =============================================================================
-- Fix recursive RLS policies across club_members, clubs, notifications, profiles
-- and harden update_club_member_count trigger with SECURITY DEFINER
-- Applied directly to Supabase on 2026-05-15, now captured as migration
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CLUB_MEMBERS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "club_members_select_tenant" ON public.club_members;
CREATE POLICY "club_members_select_tenant"
  ON public.club_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_members_delete_leave_or_manage" ON public.club_members;
CREATE POLICY "club_members_delete_leave_or_manage"
  ON public.club_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_members_update_privileged" ON public.club_members;
CREATE POLICY "club_members_update_privileged"
  ON public.club_members
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and execs can update members" ON public.club_members;
CREATE POLICY "Admins and execs can update members"
  ON public.club_members
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and execs can delete members" ON public.club_members;
CREATE POLICY "Admins and execs can delete members"
  ON public.club_members
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- CLUBS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "clubs_select_tenant" ON public.clubs;
CREATE POLICY "clubs_select_tenant"
  ON public.clubs
  FOR SELECT
  USING (
    is_public = true
    OR created_by = auth.uid()
    OR (join_code IS NOT NULL AND TRIM(join_code) <> '')
    OR auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "clubs_delete_owner_admin" ON public.clubs;
CREATE POLICY "clubs_delete_owner_admin"
  ON public.clubs
  FOR DELETE
  USING (
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "clubs_update_admin" ON public.clubs;
DROP POLICY IF EXISTS "clubs_update_privileged" ON public.clubs;
CREATE POLICY "clubs_update_privileged"
  ON public.clubs
  FOR UPDATE
  USING (
    created_by = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_tenant" ON public.notifications;
CREATE POLICY "notifications_select_tenant"
  ON public.notifications
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_tenant" ON public.profiles;
CREATE POLICY "profiles_select_tenant"
  ON public.profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- PROFILES TABLE — add missing updated_at column
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- -----------------------------------------------------------------------------
-- CLUB_MEMBERS TABLE — add missing created_at column
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTION — SECURITY DEFINER to bypass RLS during member_count update
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_club_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.clubs
        SET member_count = COALESCE(member_count, 0) + 1
        WHERE id = NEW.club_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' THEN
      UPDATE public.clubs
        SET member_count = GREATEST(COALESCE(member_count, 0) - 1, 0)
        WHERE id = OLD.club_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'active' AND NEW.status = 'active' THEN
      UPDATE public.clubs
        SET member_count = COALESCE(member_count, 0) + 1
        WHERE id = NEW.club_id;
    ELSIF OLD.status = 'active' AND NEW.status <> 'active' THEN
      UPDATE public.clubs
        SET member_count = GREATEST(COALESCE(member_count, 0) - 1, 0)
        WHERE id = NEW.club_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
