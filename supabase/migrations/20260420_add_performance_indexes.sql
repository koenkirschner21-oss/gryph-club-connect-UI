-- =============================================================================
-- Production performance indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_club_status_due
  ON public.tasks(club_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_events_club_date
  ON public.events(club_id, date);

CREATE INDEX IF NOT EXISTS idx_club_members_club_status_role
  ON public.club_members(club_id, status, role);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_club_channel_created
  ON public.messages(club_id, channel_id, created_at ASC);
