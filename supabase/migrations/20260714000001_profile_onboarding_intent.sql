ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_intent text
  CHECK (onboarding_intent IS NULL OR onboarding_intent IN ('discover', 'manage', 'both'));

COMMENT ON COLUMN public.profiles.onboarding_intent IS
  'User-selected onboarding path; mirrors gryph_onboarding_intent in localStorage when set.';
