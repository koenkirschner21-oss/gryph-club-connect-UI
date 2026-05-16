-- Fix channels RLS policies
DROP POLICY IF EXISTS "channels_insert_privileged" ON public.channels;
DROP POLICY IF EXISTS "channels_select_tenant" ON public.channels;
DROP POLICY IF EXISTS "channels_update_privileged" ON public.channels;
DROP POLICY IF EXISTS "channels_delete_privileged" ON public.channels;

CREATE POLICY "channels_insert_privileged"
  ON public.channels
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

CREATE POLICY "channels_select_tenant"
  ON public.channels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = channels.club_id
        AND (
          c.created_by = auth.uid()
          OR c.is_public = true
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = c.id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
    )
  );

CREATE POLICY "channels_update_privileged"
  ON public.channels
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = channels.club_id
        AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "channels_delete_privileged"
  ON public.channels
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = channels.club_id
        AND c.created_by = auth.uid()
    )
  );

-- Fix clubs INSERT policy
DROP POLICY IF EXISTS "clubs_insert_authenticated" ON public.clubs;
DROP POLICY IF EXISTS "clubs_insert_authenticated_creator" ON public.clubs;
CREATE POLICY "clubs_insert_authenticated"
  ON public.clubs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Fix user_clubs RLS
DROP POLICY IF EXISTS "users_manage_own_user_clubs" ON public.user_clubs;
CREATE POLICY "users_manage_own_user_clubs"
  ON public.user_clubs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix ensure_default_channels trigger to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION ensure_default_channels_for_new_club()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.channels (club_id, name, description, is_announcement_only, created_by)
  VALUES
    (NEW.id, 'general', 'General discussion', false, NEW.created_by),
    (NEW.id, 'announcements', 'Club announcements', true, NEW.created_by)
  ON CONFLICT (club_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;
