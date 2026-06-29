import type { Task, TaskStatus } from "../types";

/** Delegated task: assignee is not the creator. */
export function isDelegatedTask(task: Task): boolean {
  return Boolean(
    task.assignedTo && task.createdBy && task.assignedTo !== task.createdBy,
  );
}

export function shouldSubmitTaskForReview(task: Task, userId: string): boolean {
  return (
    isDelegatedTask(task) &&
    task.assignedTo === userId &&
    task.createdBy !== userId
  );
}

/** When an assignee marks complete, delegated tasks go to pending_review. */
export function resolveTaskCompletionStatus(
  task: Task,
  userId: string,
): TaskStatus {
  return shouldSubmitTaskForReview(task, userId) ? "pending_review" : "done";
}

export function isTaskAwaitingReviewFromUser(
  task: Task,
  userId: string,
): boolean {
  return task.status === "pending_review" && task.createdBy === userId;
}

export function isOpenAssigneeTask(task: Task, userId: string): boolean {
  return (
    task.assignedTo === userId &&
    (task.status === "todo" || task.status === "in_progress")
  );
}

export function isOpenDelegatedTask(task: Task, userId: string): boolean {
  return (
    task.createdBy === userId &&
    Boolean(task.assignedTo) &&
    task.assignedTo !== userId &&
    (task.status === "todo" ||
      task.status === "in_progress" ||
      task.status === "pending_review")
  );
}
