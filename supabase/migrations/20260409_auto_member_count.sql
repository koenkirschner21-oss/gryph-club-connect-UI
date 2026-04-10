-- =============================================================================
-- MIGRATION: Auto-maintain clubs.member_count via triggers
-- =============================================================================
-- Problem: clubs.member_count is DEFAULT 0 and never updated. Every club shows
-- "0 members" on public-facing pages. ClubAnalyticsPage worked around this with
-- a live COUNT(*), but that's not scalable for the Explore page.
--
-- Solution: Triggers on club_members that increment on INSERT (when active) and
-- decrement on DELETE (when active). Status changes (pending→active) also count.
--
-- This migration is idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- =============================================================================

-- Trigger function: update member_count when club_members rows change
CREATE OR REPLACE FUNCTION public.update_club_member_count()
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
    -- Handle status change: pending → active (increment) or active → pending/removed (decrement)
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

-- Attach triggers for INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trg_member_count_insert ON public.club_members;
CREATE TRIGGER trg_member_count_insert
  AFTER INSERT ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_club_member_count();

DROP TRIGGER IF EXISTS trg_member_count_update ON public.club_members;
CREATE TRIGGER trg_member_count_update
  AFTER UPDATE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_club_member_count();

DROP TRIGGER IF EXISTS trg_member_count_delete ON public.club_members;
CREATE TRIGGER trg_member_count_delete
  AFTER DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_club_member_count();

-- Backfill: set member_count to the current COUNT(*) of active members
-- for all existing clubs (so the count is correct immediately after migration).
UPDATE public.clubs
SET member_count = sub.cnt
FROM (
  SELECT club_id, COUNT(*) AS cnt
  FROM public.club_members
  WHERE status = 'active'
  GROUP BY club_id
) sub
WHERE clubs.id = sub.club_id;

-- Also reset to 0 for clubs with no active members
UPDATE public.clubs
SET member_count = 0
WHERE id NOT IN (
  SELECT DISTINCT club_id
  FROM public.club_members
  WHERE status = 'active'
);
