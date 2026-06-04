-- PostgREST embed: hiring_applications.applicant_id -> profiles(id)
-- Keeps existing auth.users FK; adds supplemental profile FK (see add_profile_fk_aliases).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hiring_applications_applicant_fk'
  ) THEN
    ALTER TABLE public.hiring_applications
      ADD CONSTRAINT hiring_applications_applicant_fk
      FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
