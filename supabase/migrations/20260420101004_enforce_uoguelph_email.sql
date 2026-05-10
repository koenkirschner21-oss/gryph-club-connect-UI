-- =============================================================================
-- Enforce @uoguelph.ca emails at auth insert time
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.check_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email !~* '@uoguelph\.ca$' THEN
    RAISE EXCEPTION 'Only @uoguelph.ca email addresses are permitted.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_email_domain ON auth.users;

CREATE TRIGGER enforce_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.check_email_domain();
