-- =============================================================================
-- Fix notification pipeline: triggers + RLS
-- - Triggers were created outside migrations; rewrite to use create_notification()
-- - Drop erroneous on_member_joined on user_clubs (saved clubs, not membership)
-- - Align notification types with the app (new_event, task_assigned, announcement)
-- - Notify task assignees on INSERT and when assigned_to changes on UPDATE
-- - Tighten INSERT RLS (remove permissive "any authenticated" policy)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS: notifications INSERT
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;

-- Keep restrictive + own-row permissive policies from prior migrations
DROP POLICY IF EXISTS "notifications_insert_own_or_system" ON public.notifications;

DROP POLICY IF EXISTS "Users can only create their own notifications" ON public.notifications;
CREATE POLICY "Users can only create their own notifications"
  ON public.notifications
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- create_notification: ensure definer owner and service_role grant only
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_club_id uuid DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    message,
    club_id,
    reference_id
  )
  VALUES (
    p_user_id,
    p_type,
    CASE
      WHEN p_title IS NOT NULL AND btrim(p_title) <> ''
        THEN '[' || btrim(p_title) || '] ' || COALESCE(p_message, '')
      ELSE COALESCE(p_message, '')
    END,
    p_club_id,
    p_reference_id
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

ALTER FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- Trigger functions (SECURITY DEFINER + create_notification)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  club_name text;
BEGIN
  SELECT c.name INTO club_name FROM public.clubs c WHERE c.id = NEW.club_id;

  FOR member_record IN
    SELECT cm.user_id
    FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id
      AND cm.status = 'active'
      AND cm.user_id IS DISTINCT FROM NEW.author_id
  LOOP
    PERFORM public.create_notification(
      member_record.user_id,
      'announcement',
      NULL,
      'New announcement: ' || COALESCE(NEW.title, 'Announcement')
        || ' in ' || COALESCE(club_name, 'your club'),
      NEW.club_id,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
BEGIN
  FOR member_record IN
    SELECT cm.user_id
    FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id
      AND cm.status = 'active'
      AND (
        NEW.created_by IS NULL
        OR cm.user_id IS DISTINCT FROM NEW.created_by
      )
  LOOP
    PERFORM public.create_notification(
      member_record.user_id,
      'new_event',
      NULL,
      'New event: ' || COALESCE(NEW.title, 'Event') || ' on ' || COALESCE(NEW.date::text, ''),
      NEW.club_id,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only notify when assignee actually changed
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.assigned_to,
    'task_assigned',
    NULL,
    'You were assigned a task: ' || COALESCE(NEW.title, 'Task'),
    NEW.club_id,
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  leader_record RECORD;
  joiner_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, 'A member')
    INTO joiner_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  FOR leader_record IN
    SELECT cm.user_id
    FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id
      AND cm.status = 'active'
      AND cm.role IN ('owner', 'admin', 'exec')
      AND cm.user_id IS DISTINCT FROM NEW.user_id
  LOOP
    PERFORM public.create_notification(
      leader_record.user_id,
      'join_approved',
      NULL,
      joiner_name || ' joined your club',
      NEW.club_id,
      NEW.user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_new_announcement() OWNER TO postgres;
ALTER FUNCTION public.notify_new_event() OWNER TO postgres;
ALTER FUNCTION public.notify_task_assigned() OWNER TO postgres;
ALTER FUNCTION public.notify_member_joined() OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_member_joined ON public.user_clubs;

DROP TRIGGER IF EXISTS on_new_announcement ON public.posts;
CREATE TRIGGER on_new_announcement
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_announcement();

DROP TRIGGER IF EXISTS on_new_event ON public.events;
CREATE TRIGGER on_new_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_event();

DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks;
CREATE TRIGGER on_task_assigned
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

DROP TRIGGER IF EXISTS on_task_assigned_update ON public.tasks;
CREATE TRIGGER on_task_assigned_update
  AFTER UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  WHEN (
    NEW.assigned_to IS NOT NULL
    AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
  )
  EXECUTE FUNCTION public.notify_task_assigned();

DROP TRIGGER IF EXISTS on_member_joined ON public.club_members;
CREATE TRIGGER on_member_joined
  AFTER INSERT ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_member_joined();
