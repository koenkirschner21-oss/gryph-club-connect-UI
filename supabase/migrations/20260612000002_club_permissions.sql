ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS custom_permissions jsonb DEFAULT NULL;
