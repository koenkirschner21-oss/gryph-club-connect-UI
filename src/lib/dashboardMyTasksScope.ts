/**
 * Shared "My Tasks" definition for the main dashboard:
 * - assigned_to = current user
 * - status is not 'done'
 * - status is not 'cancelled'
 *
 * Used by: TASKS stat card, overdue/due-soon banners, Overview "My Tasks",
 * and Tasks tab default ("Assigned to Me") view.
 *
 * Tasks the user created but assigned to others belong in the separate
 * "Tasks I Assigned" (delegated) scope — never under "My Tasks".
 */
export const DASHBOARD_MY_TASKS_EXCLUDED_STATUSES = ["done", "cancelled"] as const;
