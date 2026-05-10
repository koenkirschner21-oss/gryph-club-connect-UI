-- =============================================================================
-- Production hardening — trigger + RLS readability (additive migration)
-- - Creator membership MUST NOT depend on auth.uid() inside SECURITY DEFINER
--   (can be NULL or wrong role in DB context). Use ONLY NEW.created_by.
-- - UPSERT guarantees idempotent owner row on every INSERT.
-- club_members SELECT: split into two permissive policies so "own rows" never
-- depend on the peer EXISTS predicate (easier audit + avoids edge recursion).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_creator_owner_membership()
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

-- -----------------------------------------------------------------------------
-- club_members: own rows + peer roster (multiple permissive FOR SELECT policies OR)

DROP POLICY IF EXISTS "club_members_select_scoped" ON public.club_members;

DROP POLICY IF EXISTS "club_members_select_own_rows" ON public.club_members;
CREATE POLICY "club_members_select_own_rows"
  ON public.club_members
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "club_members_select_club_peers" ON public.club_members;
CREATE POLICY "club_members_select_club_peers"
  ON public.club_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );
