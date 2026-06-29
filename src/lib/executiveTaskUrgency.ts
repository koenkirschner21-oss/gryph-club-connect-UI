import type { CSSProperties } from "react";
import type { TaskStatus } from "../types";

export type ExecutiveTaskUrgency =
  | "overdue"
  | "due_today"
  | "due_this_week"
  | "upcoming";

function parseTaskDueDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  return Number.isNaN(due.getTime()) ? null : due;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 7);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function getExecutiveTaskUrgency(
  dueDate: string | undefined,
  status?: TaskStatus,
): ExecutiveTaskUrgency | null {
  if (!dueDate?.trim()) return null;
  if (
    status === "done" ||
    status === "cancelled" ||
    status === "pending_review"
  ) {
    return null;
  }

  const due = parseTaskDueDate(dueDate);
  if (!due) return null;

  const today = startOfDay(new Date());
  const dueDay = startOfDay(due);
  const weekEnd = endOfWeek(new Date());

  const diffMs = dueDay.getTime() - today.getTime();
  if (diffMs < 0) return "overdue";
  if (diffMs === 0) return "due_today";
  if (dueDay.getTime() <= weekEnd.getTime()) return "due_this_week";
  return "upcoming";
}

export function executiveTaskUrgencyLabel(
  urgency: ExecutiveTaskUrgency | null,
): string | null {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "due_today") return "Due today";
  if (urgency === "due_this_week") return "Due this week";
  if (urgency === "upcoming") return "Upcoming";
  return null;
}

export function executiveTaskUrgencyBadgeStyle(
  urgency: ExecutiveTaskUrgency | null,
): CSSProperties | null {
  if (!urgency) return null;

  if (urgency === "overdue") {
    return {
      background: "#1a0505",
      border: "1px solid #E51937",
      color: "#E51937",
      borderRadius: "4px",
      padding: "1px 6px",
      fontSize: "9px",
      fontWeight: 700,
      flexShrink: 0,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    };
  }

  if (urgency === "due_today") {
    return {
      background: "#1a1500",
      border: "1px solid #FFC429",
      color: "#FFC429",
      borderRadius: "4px",
      padding: "1px 6px",
      fontSize: "9px",
      fontWeight: 700,
      flexShrink: 0,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    };
  }

  return {
    background: "#1a1a1a",
    border: "1px solid #444444",
    color: "#888888",
    borderRadius: "4px",
    padding: "1px 6px",
    fontSize: "9px",
    fontWeight: 700,
    flexShrink: 0,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
}

export function formatTaskDueWeekday(dateStr: string): string {
  const due = parseTaskDueDate(dateStr);
  if (!due) return formatTaskDueFallback(dateStr);
  return `Due ${due.toLocaleDateString("en-US", { weekday: "long" })}`;
}

function formatTaskDueFallback(dateStr: string): string {
  const due = parseTaskDueDate(dateStr);
  if (!due) return dateStr;
  return `Due ${due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}
