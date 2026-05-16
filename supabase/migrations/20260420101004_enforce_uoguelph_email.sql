-- =============================================================================
-- Enforce @uoguelph.ca emails on public.profiles (no auth schema functions/triggers)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_uoguelph_ca_email(email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT email IS NOT NULL
     AND btrim(email) <> ''
     AND btrim(email) ~* '^[^@]+@uoguelph\.ca$'
$$;

COMMENT ON FUNCTION public.is_uoguelph_ca_email(text) IS
  'True when email is a single @uoguelph.ca address (used by profiles email CHECK).';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND c.relkind IN ('r', 'p')
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_email_uoguelph_ca;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_uoguelph_ca
      CHECK (public.is_uoguelph_ca_email(email));
  END IF;
END $$;
