-- Campus-wide event visibility: public vs members-only

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'members_only'));

COMMENT ON COLUMN public.events.visibility IS
  'public: visible on campus home; members_only: active club members only';

-- Replace tenant-only SELECT with visibility-aware policy
DROP POLICY IF EXISTS "events_select_tenant" ON public.events;

CREATE POLICY "events_select_visibility"
  ON public.events
  FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'public'
    OR (
      visibility = 'members_only'
      AND auth.uid() IS NOT NULL
      AND club_id IN (
        SELECT cm.club_id
        FROM public.club_members AS cm
        WHERE cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
    )
  );
