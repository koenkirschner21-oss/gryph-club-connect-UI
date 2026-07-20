export type PendingActionCategory =
  | "tasks"
  | "meetings"
  | "hiring"
  | "join_requests"
  | "events"
  | "announcements";

export type PendingActionUrgency = "overdue" | "needs_review" | "due_soon" | "other";

export type PendingActionItem = {
  id: string;
  label: string;
  category: PendingActionCategory;
  urgency: PendingActionUrgency;
  /** ISO date or sortable date string used for secondary ordering */
  sortDate?: string | null;
  actionLabel: string;
  onAction: () => void;
};

export const PENDING_CATEGORY_LABELS: Record<PendingActionCategory, string> = {
  tasks: "Tasks",
  meetings: "Meetings",
  hiring: "Hiring",
  join_requests: "Join Requests",
  events: "Events",
  announcements: "Announcements",
};

export const PENDING_URGENCY_LABELS: Record<PendingActionUrgency, string> = {
  overdue: "Overdue",
  needs_review: "Needs review",
  due_soon: "Due soon",
  other: "Other",
};

function urgencyRank(urgency: PendingActionUrgency): number {
  if (urgency === "overdue") return 0;
  if (urgency === "needs_review") return 1;
  if (urgency === "due_soon") return 2;
  return 3;
}

/** Primary sort: overdue → needs review → due soon → other, then by date. */
export function sortPendingActions(items: PendingActionItem[]): PendingActionItem[] {
  return [...items].sort((left, right) => {
    const urgencyDiff = urgencyRank(left.urgency) - urgencyRank(right.urgency);
    if (urgencyDiff !== 0) return urgencyDiff;
    const leftDate = left.sortDate?.trim() || "9999-12-31";
    const rightDate = right.sortDate?.trim() || "9999-12-31";
    return leftDate.localeCompare(rightDate);
  });
}

export type PendingSortMode = "urgency" | "newest" | "oldest" | "label";

export function applyPendingSort(
  items: PendingActionItem[],
  mode: PendingSortMode,
): PendingActionItem[] {
  if (mode === "urgency") return sortPendingActions(items);
  if (mode === "label") {
    return [...items].sort((a, b) => a.label.localeCompare(b.label));
  }
  return [...items].sort((a, b) => {
    const left = a.sortDate?.trim() || "";
    const right = b.sortDate?.trim() || "";
    if (!left && !right) return a.label.localeCompare(b.label);
    if (!left) return 1;
    if (!right) return -1;
    return mode === "newest" ? right.localeCompare(left) : left.localeCompare(right);
  });
}
