export const EVENT_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "weekly_meeting", label: "Weekly Meeting" },
  { value: "team_social", label: "Team Social" },
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "public_event", label: "Public Event" },
  { value: "fundraiser", label: "Fundraiser" },
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number]["value"];

export const DEFAULT_EVENT_CATEGORY: EventCategory = "general";

export function normalizeEventCategory(
  value: string | null | undefined,
): EventCategory {
  const match = EVENT_CATEGORIES.find((c) => c.value === value);
  return match?.value ?? DEFAULT_EVENT_CATEGORY;
}

export function eventCategoryLabel(value: string): string {
  return (
    EVENT_CATEGORIES.find((c) => c.value === value)?.label ?? "General"
  );
}
