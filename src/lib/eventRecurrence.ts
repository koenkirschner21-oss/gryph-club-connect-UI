export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";

export interface EventRecurringMeta {
  isRecurring: boolean;
  frequency: RecurrenceFrequency | null;
  recurrenceEndDate: string | null;
  parentEventId?: string | null;
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Next occurrence on or after today for a recurring series. */
export function computeNextOccurrenceDate(
  startDate: string,
  frequency: RecurrenceFrequency,
  recurrenceEndDate: string | null,
  referenceDate: Date = new Date(),
): string | null {
  const start = startDate.trim();
  if (!start) return null;

  const todayYmd = formatDateYmd(referenceDate);
  if (start >= todayYmd) return start;

  const interval =
    frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
  const base = new Date(`${start}T12:00:00`);
  const end = recurrenceEndDate?.trim()
    ? new Date(recurrenceEndDate)
    : null;

  for (let i = 1; i < 500; i += 1) {
    const next = new Date(base);
    next.setDate(next.getDate() + interval * i);
    if (end && next > end) return null;
    const ymd = formatDateYmd(next);
    if (ymd >= todayYmd) return ymd;
  }

  return null;
}

export type EventOccurrence<T extends { id: string; date: string }> = T & {
  occurrenceDate: string;
};

/** Upcoming instances including the next date for recurring parent events. */
export function getUpcomingEventOccurrences<T extends { id: string; date: string }>(
  events: T[],
  recurringById: Record<string, EventRecurringMeta>,
  referenceDate: Date = new Date(),
): EventOccurrence<T>[] {
  const todayYmd = formatDateYmd(referenceDate);
  const occurrences: EventOccurrence<T>[] = [];

  for (const event of events) {
    const meta = recurringById[event.id];
    if (meta?.isRecurring && meta.frequency) {
      const next = computeNextOccurrenceDate(
        event.date,
        meta.frequency,
        meta.recurrenceEndDate,
        referenceDate,
      );
      if (next) occurrences.push({ ...event, occurrenceDate: next });
    } else if (event.date >= todayYmd) {
      occurrences.push({ ...event, occurrenceDate: event.date });
    }
  }

  return occurrences.sort(
    (a, b) =>
      new Date(a.occurrenceDate).getTime() -
      new Date(b.occurrenceDate).getTime(),
  );
}
