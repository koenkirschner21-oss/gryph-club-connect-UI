-- reviewer_ids must reference active club members only.

CREATE OR REPLACE FUNCTION public.validate_hiring_listing_reviewer_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_reviewer_id uuid;
BEGIN
  IF NEW.reviewer_ids IS NULL THEN
    NEW.reviewer_ids := '{}'::uuid[];
    RETURN NEW;
  END IF;

  NEW.reviewer_ids := ARRAY(
    SELECT DISTINCT reviewer_id
    FROM unnest(NEW.reviewer_ids) AS reviewer_id
    WHERE reviewer_id IS NOT NULL
  );

  FOREACH v_reviewer_id IN ARRAY NEW.reviewer_ids
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.club_members AS cm
      WHERE cm.club_id = NEW.club_id
        AND cm.user_id = v_reviewer_id
        AND cm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'hiring_listing_reviewer_not_active_member';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hiring_listings_validate_reviewer_ids ON public.hiring_listings;

CREATE TRIGGER hiring_listings_validate_reviewer_ids
  BEFORE INSERT OR UPDATE OF reviewer_ids, club_id
  ON public.hiring_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_hiring_listing_reviewer_ids();
