-- =============================================================================
-- Signup fix: allow non-@uoguelph.ca emails during user testing.
-- The profiles_email_uoguelph_ca CHECK caused handle_new_user to fail on Gmail
-- signups, surfacing as Auth 500 "Database error saving new user".
-- Re-add domain enforcement before production launch if required.
-- =============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_uoguelph_ca;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_format
  CHECK (
    email IS NULL
    OR (
      btrim(email) <> ''
      AND btrim(email) ~* '^[^@]+@[^@]+\.[^@]+$'
    )
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, onboarding_completed, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a minimal profiles row for new auth.users signups (no UofG domain requirement during testing).';
