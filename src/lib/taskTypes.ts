export type TaskType = "general" | "event" | "hiring" | "setup" | "meeting";

export type TaskTypeFilter = "all" | TaskType;

export const TASK_TYPE_FILTER_CHIPS: { id: TaskTypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "general", label: "General" },
  { id: "event", label: "Event Tasks" },
  { id: "hiring", label: "Hiring Tasks" },
  { id: "setup", label: "Setup Tasks" },
  { id: "meeting", label: "Meeting Tasks" },
];

export const TASK_TYPE_FORM_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "event", label: "Event Task" },
  { value: "hiring", label: "Hiring Task" },
  { value: "setup", label: "Setup Task" },
  { value: "meeting", label: "Meeting Task" },
];

export const TASK_TYPE_BADGE_LABELS: Record<TaskType, string> = {
  general: "General",
  event: "Event Task",
  hiring: "Hiring Task",
  setup: "Setup Task",
  meeting: "Meeting Task",
};

export const EVENT_PLANNING_TASK_TITLES = [
  "Book room/venue",
  "Create event poster/graphic",
  "Post event announcement",
  "Confirm supplies/equipment",
  "Assign volunteer roles",
  "Send event reminder",
  "Review RSVP list",
] as const;

export function normalizeTaskType(value: string | null | undefined): TaskType {
  if (
    value === "event" ||
    value === "hiring" ||
    value === "setup" ||
    value === "meeting"
  ) {
    return value;
  }
  return "general";
}
