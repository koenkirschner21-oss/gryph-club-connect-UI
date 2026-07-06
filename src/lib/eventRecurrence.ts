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

/** Upcoming instances using materialized event rows (child instances) when present. */
export function getUpcomingEventOccurrences<T extends { id: string; date: string }>(
  events: T[],
  recurringById: Record<string, EventRecurringMeta>,
  referenceDate: Date = new Date(),
): EventOccurrence<T>[] {
  const todayYmd = formatDateYmd(referenceDate);
  const parentIdsWithChildren = new Set<string>();

  for (const event of events) {
    const parentId = recurringById[event.id]?.parentEventId;
    if (parentId) parentIdsWithChildren.add(parentId);
  }

  const occurrences: EventOccurrence<T>[] = [];

  for (const event of events) {
    const meta = recurringById[event.id];
    const isChildInstance = Boolean(meta?.parentEventId);
    const isParentWithChildren = parentIdsWithChildren.has(event.id);

    // Child rows and parents with generated instances are routable by events.id.
    if (isChildInstance || isParentWithChildren) {
      if (event.date >= todayYmd) {
        occurrences.push({ ...event, occurrenceDate: event.date });
      }
      continue;
    }

    // Legacy parent-only recurring series without materialized children.
    if (meta?.isRecurring && meta.frequency) {
      const next = computeNextOccurrenceDate(
        event.date,
        meta.frequency,
        meta.recurrenceEndDate,
        referenceDate,
      );
      if (next) occurrences.push({ ...event, occurrenceDate: next });
      continue;
    }

    if (event.date >= todayYmd) {
      occurrences.push({ ...event, occurrenceDate: event.date });
    }
  }

  return occurrences.sort(
    (a, b) =>
      new Date(a.occurrenceDate).getTime() -
      new Date(b.occurrenceDate).getTime(),
  );
}

/** Collapse recurring/multi-date series to one row per event title (earliest first). */
export function deduplicateUpcomingEventsByTitle<
  T extends { title: string; occurrenceDate: string },
>(events: T[], limit = 3): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const event of events) {
    const key = event.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
    if (result.length >= limit) break;
  }

  return result;
}

export type DeduplicatedEventOccurrence<
  T extends { id: string; title: string; occurrenceDate: string },
> = T & {
  moreDatesCount: number;
  showRecurringBadge: boolean;
};

/** One card per event title for month/week views; keeps earliest occurrence. */
export function deduplicateMonthlyEventsByTitle<
  T extends { id: string; title: string; occurrenceDate: string },
>(
  events: T[],
  eventRecurring: Record<string, EventRecurringMeta>,
): DeduplicatedEventOccurrence<T>[] {
  const grouped = new Map<string, T[]>();

  for (const event of events) {
    const key = event.title.trim().toLowerCase();
    const existing = grouped.get(key) ?? [];
    existing.push(event);
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const sorted = [...group].sort((a, b) =>
        a.occurrenceDate.localeCompare(b.occurrenceDate),
      );
      const next = sorted[0];
      const moreDatesCount = sorted.length - 1;
      const meta = eventRecurring[next.id];
      return {
        ...next,
        moreDatesCount,
        showRecurringBadge: Boolean(meta?.isRecurring) || moreDatesCount > 0,
      };
    })
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
}
