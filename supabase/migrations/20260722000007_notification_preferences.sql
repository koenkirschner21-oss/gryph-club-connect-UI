-- User notification opt-out preferences (JSONB), saved from Settings UI.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.notification_preferences IS
  'Per-user notification category toggles (opt-out). Missing keys default to enabled.';
