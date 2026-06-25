-- Align creator trigger membership with President access_level (matches claim/approval upsert).
CREATE OR REPLACE FUNCTION public.ensure_creator_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.club_members (club_id, user_id, role, access_level, status, title)
    VALUES (NEW.id, NEW.created_by, 'owner', 'president', 'active', 'President')
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET
      role = 'owner',
      access_level = 'president',
      status = 'active',
      title = COALESCE(NULLIF(club_members.title, ''), EXCLUDED.title);
  END IF;
  RETURN NEW;
END;
$$;
