import type { TaskStatus } from "../types";

export interface TaskStatusMenuItem {
  label: string;
  status: TaskStatus;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Completed",
  cancelled: "Cancelled",
  pending_review: "Submitted for Review",
};

export interface TaskStatusMenuOptions {
  /** When true, completion action is labeled Submit for Review (still status `done` → resolver). */
  submitForReview?: boolean;
}

/** Status transitions available from list/detail menus and modals. */
export function getTaskStatusMenuItems(
  current: TaskStatus,
  options?: TaskStatusMenuOptions,
): TaskStatusMenuItem[] {
  if (current === "cancelled") return [];

  const items: TaskStatusMenuItem[] = [];
  const completeLabel = options?.submitForReview
    ? "Submit for Review"
    : "Mark Complete";

  if (current === "todo") {
    items.push({ label: "Start Task", status: "in_progress" });
    items.push({ label: completeLabel, status: "done" });
  }

  if (current === "in_progress") {
    items.push({ label: "Move to To Do", status: "todo" });
    items.push({ label: completeLabel, status: "done" });
  }

  if (current === "pending_review") {
    return [];
  }

  if (current === "done") {
    items.push({ label: "Reopen to In Progress", status: "in_progress" });
    items.push({ label: "Move to To Do", status: "todo" });
  }

  return items;
}
