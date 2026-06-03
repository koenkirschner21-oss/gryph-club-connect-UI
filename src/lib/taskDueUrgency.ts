import type { CSSProperties } from "react";

export type TaskDueUrgency = "overdue" | "due_today" | "due_soon";

export function formatTaskDate(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseTaskDueDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(due.getTime())) return null;
  return due;
}

export function getTaskDueUrgency(
  dueDate: string | undefined,
  status?: string,
): TaskDueUrgency | null {
  if (!dueDate?.trim()) return null;
  if (status === "done") return null;

  const due = parseTaskDueDate(dueDate);
  if (!due) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  const diffMs = dueDay.getTime() - today.getTime();
  if (diffMs < 0) return "overdue";
  if (diffMs === 0) return "due_today";

  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  if (diffMs <= threeDaysMs) return "due_soon";

  return null;
}

export function taskDueDateColor(urgency: TaskDueUrgency | null): string {
  if (urgency === "overdue") return "#E51937";
  if (urgency === "due_today" || urgency === "due_soon") return "#FFC429";
  return "#555555";
}

export function taskDueBadgeConfig(
  urgency: TaskDueUrgency | null,
): { label: string; style: CSSProperties } | null {
  if (urgency === "overdue") {
    return {
      label: "OVERDUE",
      style: {
        background: "#1a0505",
        border: "1px solid #E51937",
        color: "#E51937",
        borderRadius: "4px",
        padding: "1px 6px",
        fontSize: "9px",
        fontWeight: 700,
        flexShrink: 0,
      },
    };
  }
  if (urgency === "due_today") {
    return {
      label: "DUE TODAY",
      style: {
        background: "#1a1500",
        border: "1px solid #FFC429",
        color: "#FFC429",
        borderRadius: "4px",
        padding: "1px 6px",
        fontSize: "9px",
        fontWeight: 700,
        flexShrink: 0,
      },
    };
  }
  return null;
}

export function taskDueLeftBorder(
  urgency: TaskDueUrgency | null,
  statusBorder: string,
): string {
  if (urgency === "overdue") return "#E51937";
  return statusBorder;
}
