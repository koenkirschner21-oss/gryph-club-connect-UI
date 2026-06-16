import {
  hasLinkedMeetingCancelled,
  LINKED_MEETING_CANCELLED_COLOR,
  LINKED_MEETING_CANCELLED_LABEL,
} from "../../lib/taskMeetingLink";
import type { Task } from "../../types";

export default function LinkedMeetingCancelledLabel({
  task,
  show,
}: {
  task?: Pick<Task, "linkedMeetingId" | "linkedMeetingStatus">;
  show?: boolean;
}) {
  const visible = show ?? (task ? hasLinkedMeetingCancelled(task) : false);
  if (!visible) return null;

  return (
    <p
      style={{
        margin: "2px 0 0",
        fontSize: "11px",
        color: LINKED_MEETING_CANCELLED_COLOR,
        lineHeight: 1.3,
      }}
    >
      {LINKED_MEETING_CANCELLED_LABEL}
    </p>
  );
}
