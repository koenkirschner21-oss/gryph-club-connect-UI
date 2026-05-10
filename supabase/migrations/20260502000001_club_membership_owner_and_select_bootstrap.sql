-- =============================================================================
-- ISSUE 1 (app / RLS correctness, no weakening):
-- - club_members SELECT was self-referential without an explicit own-row bypass;
--   users can fail to see their own memberships → empty dashboards / “no clubs”.
-- - Extend role with `owner`; ensure creator ALWAYS has membership (trigger +
--   backfill). Grant owner same privilege paths as admin/exec where applicable.
--
-- SECURITY: tighter delete (only owner|admin kicks members), read path unchanged
-- for tenant isolation (same-club visibility only beyond own rows).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles: creator is `owner`
-- -----------------------------------------------------------------------------
ALTER TABLE public.club_members DROP CONSTRAINT IF EXISTS club_members_role_check;

ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('owner', 'admin', 'exec', 'member'));

-- -----------------------------------------------------------------------------
-- club_members: SELECT — always see own row; otherwise same-club active members
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "club_members_select_scoped" ON public.club_members;

CREATE POLICY "club_members_select_scoped"
  ON public.club_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- clubs UPDATE / DELETE (from base schema naming)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Club admins can update clubs" ON public.clubs;

CREATE POLICY "Club admins can update clubs"
  ON public.clubs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = clubs.id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Club admins can delete clubs" ON public.clubs;

CREATE POLICY "Club admins can delete clubs"
  ON public.clubs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = clubs.id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- club_members DELETE / UPDATE
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can leave clubs or admins can remove" ON public.club_members;

CREATE POLICY "Users can leave clubs or admins can remove"
  ON public.club_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update club members" ON public.club_members;

CREATE POLICY "Admins can update club members"
  ON public.club_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members AS cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

-- -----------------------------------------------------------------------------
-- posts (admin/exec write paths → include owner)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and execs can create posts" ON public.posts;

CREATE POLICY "Admins and execs can create posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = posts.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins and execs can delete posts" ON public.posts;

CREATE POLICY "Admins and execs can delete posts"
  ON public.posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = posts.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

-- -----------------------------------------------------------------------------
-- events (keep P0.3 INSERT shape; include owner)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and execs can create events" ON public.events;

CREATE POLICY "Admins and execs can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins and execs can update events" ON public.events;

CREATE POLICY "Admins and execs can update events"
  ON public.events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins and execs can delete events" ON public.events;

CREATE POLICY "Admins and execs can delete events"
  ON public.events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and execs can create tasks" ON public.tasks;

CREATE POLICY "Admins and execs can create tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins/execs can update tasks" ON public.tasks;

CREATE POLICY "Admins/execs can update tasks"
  ON public.tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Admins and execs can delete tasks" ON public.tasks;

CREATE POLICY "Admins and execs can delete tasks"
  ON public.tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('owner', 'admin', 'exec')
    )
  );

-- -----------------------------------------------------------------------------
-- channels + messages INSERT (announcement breakout → owner qualifies)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "channels_insert_admin" ON public.channels;

CREATE POLICY "channels_insert_admin"
  ON public.channels
  FOR INSERT
  WITH CHECK (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "channels_update_admin" ON public.channels;

CREATE POLICY "channels_update_admin"
  ON public.channels
  FOR UPDATE
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "channels_delete_admin" ON public.channels;

CREATE POLICY "channels_delete_admin"
  ON public.channels
  FOR DELETE
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'exec')
    )
  );

DROP POLICY IF EXISTS "Members can send messages by channel permissions" ON public.messages;

CREATE POLICY "Members can send messages by channel permissions"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND channel_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.channels AS ch
      WHERE ch.id = messages.channel_id
        AND ch.club_id = messages.club_id
        AND (
          ch.is_announcement_only = false
          OR EXISTS (
            SELECT 1
            FROM public.club_members AS cm
            WHERE cm.club_id = messages.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
              AND cm.role IN ('owner', 'admin', 'exec')
          )
        )
    )
  );

-- -----------------------------------------------------------------------------
-- Trigger: new club rows always get creator membership row (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_creator_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Row column only — never auth.uid() (SECURITY DEFINER + missing JWT ⇒ silent skip).
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.club_members (club_id, user_id, role, status)
    VALUES (NEW.id, NEW.created_by, 'owner', 'active')
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET
      role = 'owner',
      status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

-- Name prefix `aaa_` so this runs before `create_default_channels_for_new_club`
-- (PostgreSQL runs multiple AFTER triggers alphabetically). Channels INSERT RLS
-- requires an active club_members row for the invoker.
DROP TRIGGER IF EXISTS trg_clubs_ensure_creator_membership ON public.clubs;
DROP TRIGGER IF EXISTS aaa_ensure_creator_owner_membership ON public.clubs;

CREATE TRIGGER aaa_ensure_creator_owner_membership
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_creator_owner_membership();

-- -----------------------------------------------------------------------------
-- Data backfill — missing creator row OR normalize creator → owner
-- -----------------------------------------------------------------------------
INSERT INTO public.club_members (club_id, user_id, role, status)
SELECT c.id,
  c.created_by,
  'owner',
  'active'
FROM public.clubs AS c
WHERE c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = c.id
      AND cm.user_id = c.created_by
  );

UPDATE public.club_members AS cm
SET role = 'owner'
FROM public.clubs AS c
WHERE c.id = cm.club_id
  AND cm.user_id = c.created_by
  AND c.created_by IS NOT NULL
  AND cm.role IS DISTINCT FROM 'owner';
