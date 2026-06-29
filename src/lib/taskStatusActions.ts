import type { TaskStatus } from "../types";

export interface TaskStatusMenuItem {
  label: string;
  status: TaskStatus;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
  pending_review: "Pending Review",
};

/** Status transitions available from list/detail menus and modals. */
export function getTaskStatusMenuItems(current: TaskStatus): TaskStatusMenuItem[] {
  if (current === "cancelled") return [];

  const items: TaskStatusMenuItem[] = [];

  if (current === "todo") {
    items.push({ label: "Mark In Progress", status: "in_progress" });
    items.push({ label: "Mark Complete", status: "done" });
  }

  if (current === "in_progress") {
    items.push({ label: "Move to To Do", status: "todo" });
    items.push({ label: "Mark Complete", status: "done" });
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
