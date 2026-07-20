/**
 * Shared "My Tasks" definition for the main dashboard:
 * - assigned_to = current user
 * - status is not 'done', 'cancelled', or 'pending_review'
 *
 * Submitted-for-review tasks leave the assignee's active / overdue / due-soon
 * queues but remain visible to the reviewer under delegated / review scopes.
 *
 * Used by: TASKS stat card, overdue/due-soon banners, Overview "My Tasks",
 * and Tasks tab default ("Assigned to Me") view.
 *
 * Tasks the user created but assigned to others belong in the separate
 * "Tasks I Assigned" (delegated) scope — never under "My Tasks".
 */
export const DASHBOARD_MY_TASKS_EXCLUDED_STATUSES = [
  "done",
  "cancelled",
  "pending_review",
] as const;
