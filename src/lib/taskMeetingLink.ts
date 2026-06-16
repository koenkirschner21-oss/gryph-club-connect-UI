import type { Task } from "../types";

export const LINKED_MEETING_CANCELLED_LABEL = "⚠️ Linked meeting was cancelled";
export const LINKED_MEETING_CANCELLED_COLOR = "#FFC429";

export function hasLinkedMeetingCancelled(
  task: Pick<Task, "linkedMeetingId" | "linkedMeetingStatus">,
): boolean {
  return Boolean(task.linkedMeetingId && task.linkedMeetingStatus === "cancelled");
}
