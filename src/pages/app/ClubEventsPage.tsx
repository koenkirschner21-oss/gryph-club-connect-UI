import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  type CSSProperties,
} from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  MapPin,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useClubTasks } from "../../hooks/useClubTasks";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import { supabase } from "../../lib/supabaseClient";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import type { ClubEvent, RsvpStatus, Visibility } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";
import VisibilitySelector from "../../components/club/VisibilitySelector";
import VisibilityBadge from "../../components/club/VisibilityBadge";
import SelectedVisibilityPicker from "../../components/club/SelectedVisibilityPicker";
import TemplatePickerModal from "../../components/club/TemplatePickerModal";
import CompletedEventCard from "../../components/club/CompletedEventCard";
import EventMemberFeedbackModal from "../../components/club/EventMemberFeedbackModal";
import EventReviewModal from "../../components/club/EventReviewModal";
import { isExecutiveAccessLevel } from "../../lib/clubPermissions";
import { filterByVisibility, normalizeVisibility } from "../../lib/contentVisibility";
import { summarizeFeedbackRows, type EventReviewStatus } from "../../lib/eventReview";
import {
  fetchEventRsvpRecipientUserIds,
  notifyEventCancelled,
  notifyEventSignupPendingReview,
  resolveStudentDisplayName,
} from "../../lib/notifications";
import {
  filterRsvpQuestionsForLoggedInUser,
  formatGoingCount,
  getEventRsvpAccess,
  type RsvpAccessResult,
} from "../../lib/eventRsvpUtils";
import {
  DEFAULT_EVENT_CATEGORY,
  EVENT_CATEGORIES,
  eventCategoryLabel,
  normalizeEventCategory,
  type EventCategory,
} from "../../lib/eventCategories";
import EventPlanningTasksSection from "../../components/club/EventPlanningTasksSection";
import { EventManageView } from "./events/EventManageView";
import { getPublicEventDetailPath } from "../../lib/eventNavigation";
import { useClubMembers } from "../../hooks/useClubMembers";
import {
  EMPTY_SELECTED_VISIBILITY,
  hasSelectedVisibilityTargets,
  selectedVisibilityPayload,
} from "../../lib/selectedVisibility";

type EventFilter = "all" | "going_to" | "needs_response";

const templateOutlineButtonClass =
  "rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-[#cccccc] transition-colors hover:border-[#555555] hover:text-white";

const EVENT_FILTER_OPTIONS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "going_to", label: "Going To" },
  { value: "needs_response", label: "Needs Response" },
];

function categoryBadgeStyle(): CSSProperties {
  return {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    color: "#777777",
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    display: "inline-block",
    flexShrink: 0,
  };
}

function isEventPublic(event: ClubEvent): boolean {
  return normalizeVisibility(event.visibility, "public") === "public";
}

function matchesEventFilter(
  event: ClubEvent,
  filter: EventFilter,
  myRsvps: Record<string, RsvpStatus>,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "going_to": {
      const status = myRsvps[event.id];
      return status === "going" || status === "maybe";
    }
    case "needs_response":
      return !myRsvps[event.id];
    default:
      return true;
  }
}

type EventListItem =
  | { kind: "event"; event: ClubEvent }
  | { kind: "compact"; event: ClubEvent }
  | { kind: "expand"; title: string; remaining: number; expanded: boolean };

function buildUpcomingDisplayList(
  events: ClubEvent[],
  showAllRecurring: Record<string, boolean>,
): EventListItem[] {
  const titleCounts = new Map<string, number>();
  for (const event of events) {
    titleCounts.set(event.title, (titleCounts.get(event.title) ?? 0) + 1);
  }

  const titleIndex = new Map<string, number>();
  const expandBarInserted = new Set<string>();
  const result: EventListItem[] = [];

  for (const event of events) {
    const total = titleCounts.get(event.title) ?? 1;
    const index = titleIndex.get(event.title) ?? 0;
    const expanded = showAllRecurring[event.title] ?? false;

    if (total > 1) {
      if (!expanded) {
        if (index === 0) {
          result.push({ kind: "event", event });
        } else if (!expandBarInserted.has(event.title)) {
          expandBarInserted.add(event.title);
          result.push({
            kind: "expand",
            title: event.title,
            remaining: total - 1,
            expanded: false,
          });
        }
        titleIndex.set(event.title, index + 1);
        continue;
      }

      if (index === 0) {
        result.push({ kind: "event", event });
      } else {
        result.push({ kind: "compact", event });
      }
      const nextIndex = index + 1;
      titleIndex.set(event.title, nextIndex);
      if (nextIndex === total) {
        result.push({
          kind: "expand",
          title: event.title,
          remaining: total - 1,
          expanded: true,
        });
      }
      continue;
    }

    result.push({ kind: "event", event });
    titleIndex.set(event.title, index + 1);
  }

  return result;
}

function CategorySelector({
  value,
  onChange,
}: {
  value: EventCategory;
  onChange: (value: EventCategory) => void;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: "12px",
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "10px",
        }}
      >
        Event Type
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {EVENT_CATEGORIES.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                background: selected ? "#E51937" : "#1a1a1a",
                border: selected ? "1px solid #E51937" : "1px solid #333333",
                color: selected ? "#ffffff" : "#777777",
                borderRadius: "20px",
                padding: "6px 16px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function parseEventStart(event: ClubEvent): Date {
  if (event.startAt) {
    const fromStartAt = new Date(event.startAt);
    if (!Number.isNaN(fromStartAt.getTime())) return fromStartAt;
  }

  const timeRaw = (event.time ?? "").trim();
  const timeMatch = timeRaw.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = Number.parseInt(timeMatch[1], 10);
    const minutes = Number.parseInt(timeMatch[2], 10);
    const local = new Date(event.date);
    local.setHours(hours, minutes, 0, 0);
    if (!Number.isNaN(local.getTime())) return local;
  }

  if (timeRaw && timeRaw !== "TBD") {
    const combined = new Date(`${event.date} ${timeRaw}`);
    if (!Number.isNaN(combined.getTime())) return combined;
  }

  const fallback = new Date(`${event.date}T12:00:00`);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function parseEventEnd(event: ClubEvent, start: Date): Date {
  if (event.endAt) {
    const fromEndAt = new Date(event.endAt);
    if (!Number.isNaN(fromEndAt.getTime())) return fromEndAt;
  }
  return new Date(start.getTime() + 60 * 60 * 1000);
}

function downloadEventIcs(event: ClubEvent) {
  const start = parseEventStart(event);
  const end = parseEventEnd(event, start);
  const location =
    event.location && event.location !== "TBD" ? event.location : "";
  const description = event.description?.trim() ?? "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gryph Club Connect//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@gryphclubconnect`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  const blob = new Blob([`${lines.join("\r\n")}\r\n`], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeTitle = event.title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  anchor.href = url;
  anchor.download = `${safeTitle || "event"}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function EventCardBadges({
  event,
  category,
  isRecurring,
}: {
  event: ClubEvent;
  category: string;
  isRecurring: boolean;
}) {
  const categoryLabel = eventCategoryLabel(category);

  return (
    <>
      <VisibilityBadge visibility={event.visibility} />
      {categoryLabel ? (
        <span key="category" style={categoryBadgeStyle()}>
          {categoryLabel}
        </span>
      ) : null}
      {isRecurring ? <EventRecurringBadge key="recurring" /> : null}
    </>
  );
}

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";

const RECURRENCE_FREQUENCY_OPTIONS: {
  value: RecurrenceFrequency;
  label: string;
}[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
];

interface EventRecurringMeta {
  isRecurring: boolean;
  frequency: RecurrenceFrequency | null;
  recurrenceEndDate: string | null;
  parentEventId: string | null;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function generateRecurringInstanceDates(
  startDate: string,
  frequency: RecurrenceFrequency,
  endAtLocal: string,
): string[] {
  const interval =
    frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
  const base = new Date(`${startDate}T12:00:00`);
  const end = endAtLocal.trim() ? new Date(endAtLocal) : null;
  const dates: string[] = [];
  let i = 1;

  while (true) {
    const next = new Date(base);
    next.setDate(next.getDate() + interval * i);
    if (end && next > end) break;
    if (!end && i > 11) break;
    dates.push(formatDateYmd(next));
    i += 1;
  }

  return dates;
}

function RecurringToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        background: on ? "#E51937" : "#333333",
        padding: 2,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#ffffff",
          transform: on ? "translateX(20px)" : "translateX(0)",
          transition: "transform 0.15s ease",
        }}
      />
    </button>
  );
}

function RecurringEventFormSection({
  isRecurring,
  onRecurringChange,
  frequency,
  onFrequencyChange,
  endDate,
  onEndDateChange,
}: {
  isRecurring: boolean;
  onRecurringChange: (value: boolean) => void;
  frequency: RecurrenceFrequency;
  onFrequencyChange: (value: RecurrenceFrequency) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            color: "#888888",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: 0,
          }}
        >
          Recurring Event
        </p>
        <RecurringToggle on={isRecurring} onChange={onRecurringChange} />
      </div>

      {isRecurring ? (
        <div style={{ marginTop: "14px" }}>
          <p
            style={{
              fontSize: "12px",
              color: "#888888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 10px",
            }}
          >
            Frequency
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {RECURRENCE_FREQUENCY_OPTIONS.map((option) => {
              const selected = frequency === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onFrequencyChange(option.value)}
                  style={{
                    background: selected ? "#E51937" : "#1a1a1a",
                    border: selected ? "1px solid #E51937" : "1px solid #333333",
                    color: selected ? "#ffffff" : "#777777",
                    borderRadius: "20px",
                    padding: "6px 16px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <label
            htmlFor="recurrenceEndDate"
            style={{
              display: "block",
              fontSize: "12px",
              color: "#888888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "14px 0 8px",
            }}
          >
            Repeat until
          </label>
          <input
            id="recurrenceEndDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            style={{
              width: "100%",
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function EventRecurringBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: "transparent",
        border: "1px solid #FFC429",
        color: "#FFC429",
        borderRadius: "20px",
        padding: "3px 10px",
        fontSize: "11px",
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      <RefreshCw size={10} aria-hidden />
      Recurring
    </span>
  );
}

function EventDateBlock({ date, muted }: { date: string; muted?: boolean }) {
  const parsedDate = new Date(date);
  const monthLabel = Number.isNaN(parsedDate.getTime())
    ? "---"
    : parsedDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayLabel = Number.isNaN(parsedDate.getTime())
    ? "?"
    : String(parsedDate.getDate());

  return (
    <div
      style={{
        background: muted ? "#333333" : "#E51937",
        borderRadius: "10px",
        padding: "8px 12px",
        textAlign: "center",
        minWidth: "52px",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#ffffff",
          lineHeight: 1.1,
        }}
      >
        {monthLabel}
      </span>
      <span
        style={{
          display: "block",
          fontSize: "22px",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1,
        }}
      >
        {dayLabel}
      </span>
    </div>
  );
}

function formatAttendeeCounts(counts: {
  going: number;
  maybe: number;
  not_going: number;
}): string | null {
  return formatGoingCount(counts.going);
}

function SmartRsvpButton({
  eventId,
  status,
  onRsvp,
}: {
  eventId: string;
  status?: RsvpStatus;
  onRsvp: (eventId: string, status: RsvpStatus) => void;
}) {
  const base: CSSProperties = {
    width: "100px",
    textAlign: "center",
    padding: "6px 14px",
    fontSize: "12px",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  if (!status) {
    return (
      <button
        type="button"
        onClick={() => onRsvp(eventId, "going")}
        style={{
          ...base,
          background: "transparent",
          border: "1px solid #555555",
          color: "#999999",
          borderRadius: "6px",
        }}
      >
        RSVP
      </button>
    );
  }

  if (status === "going") {
    return (
      <button
        type="button"
        onClick={() => onRsvp(eventId, "going")}
        style={{
          ...base,
          background: "#FFC429",
          color: "#000000",
          border: "none",
          borderRadius: "20px",
          fontWeight: 600,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          Going
          <Check size={14} aria-hidden />
        </span>
      </button>
    );
  }

  if (status === "maybe") {
    return (
      <button
        type="button"
        onClick={() => onRsvp(eventId, "maybe")}
        style={{
          ...base,
          background: "transparent",
          border: "1px solid #FFC429",
          color: "#FFC429",
          borderRadius: "6px",
        }}
      >
        Maybe
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onRsvp(eventId, "not_going")}
      style={{
        ...base,
        background: "transparent",
        border: "1px solid #555555",
        color: "#555555",
        borderRadius: "6px",
      }}
    >
      Not Going
    </button>
  );
}

const eventCardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderLeft: "1px solid #2a2a2a",
  borderRadius: "14px",
  padding: "12px 14px",
  marginBottom: "12px",
};

function EventAttendeeAvatarStack({
  attendees,
}: {
  attendees: Array<{ id: string; avatarUrl?: string; status: RsvpStatus }>;
}) {
  const going = attendees.filter((a) => a.status === "going" && a.avatarUrl?.trim());
  if (going.length === 0) return null;

  const visible = going.slice(0, 3);
  const remaining = going.length - visible.length;

  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {visible.map((attendee, index) => (
          <img
            key={attendee.id}
            src={attendee.avatarUrl}
            alt=""
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #141414",
              marginLeft: index === 0 ? 0 : "-8px",
              position: "relative",
              zIndex: visible.length - index,
            }}
          />
        ))}
      </div>
      {remaining > 0 ? (
        <span
          style={{
            marginLeft: "6px",
            fontSize: "11px",
            color: "#555555",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "999px",
            padding: "2px 8px",
            flexShrink: 0,
          }}
        >
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}

const upcomingSectionHeadingStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#555555",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "16px",
  paddingBottom: "12px",
  borderBottom: "1px solid #1a1a1a",
};

const pastSectionHeadingStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "15px",
  color: "#555555",
  marginBottom: "12px",
};

const CALENDAR_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function eventCalendarDateKey(date: string): string {
  return date.slice(0, 10);
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNextEventDateLabel(date: string | undefined): string {
  if (!date) return "—";
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function EventCalendarSidebar({
  month,
  onMonthChange,
  eventDateKeys,
  selectedDay,
  onDayClick,
  stats,
  fullWidth = false,
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
  eventDateKeys: Set<string>;
  selectedDay: string | null;
  onDayClick: (dateKey: string) => void;
  stats: {
    upcoming: number;
    publicCount: number;
    goingTo: number;
    nextEventDate: string;
  };
  fullWidth?: boolean;
}) {
  const todayKey = localDateKey(new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(year, monthIndex, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: Array<{ day: number | null; dateKey: string | null }> = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ day: null, dateKey: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, dateKey });
  }

  const statRows: Array<{ label: string; value: string | number }> = [
    { label: "Upcoming events", value: stats.upcoming },
    { label: "Public events", value: stats.publicCount },
    { label: "Going to", value: stats.goingTo },
    { label: "Next event", value: stats.nextEventDate },
  ];

  return (
    <div
      style={{
        width: fullWidth ? "100%" : "280px",
        flexShrink: 0,
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "14px",
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          Event Calendar
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              onMonthChange(new Date(year, monthIndex - 1, 1))
            }
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span
            style={{
              fontSize: "12px",
              color: "#777777",
              minWidth: "108px",
              textAlign: "center",
            }}
          >
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              onMonthChange(new Date(year, monthIndex + 1, 1))
            }
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: "16px",
        }}
      >
        {CALENDAR_WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#555555",
              textAlign: "center",
              paddingBottom: "4px",
            }}
          >
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (cell.day === null || cell.dateKey === null) {
            return <div key={`empty-${index}`} />;
          }

          const hasEvents = eventDateKeys.has(cell.dateKey);
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedDay;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onDayClick(cell.dateKey!)}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: "6px",
                border: isSelected
                  ? "1px solid #E51937"
                  : "1px solid transparent",
                background: hasEvents
                  ? "rgba(229, 25, 55, 0.12)"
                  : isToday
                    ? "#1a1a1a"
                    : "transparent",
                color: isToday ? "#ffffff" : hasEvents ? "#ffffff" : "#777777",
                fontSize: "12px",
                fontWeight: isToday ? 600 : 400,
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cell.day}
              {hasEvents ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: "3px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "#E51937",
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        style={{
          borderTop: "1px solid #1a1a1a",
          paddingTop: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {statRows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "12px", color: "#555555" }}>{row.label}</span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#cccccc",
                textAlign: "right",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function fetchExistingRsvp(
  eventId: string,
  userId: string,
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("event_rsvps")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { id: data.id as string } : null;
}

function formatEventRegistrationDate(date: string, time: string): string {
  const parsed = new Date(date);
  const datePart = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const timePart = formatEventTime(time);
  return timePart ? `${datePart} · ${timePart}` : datePart;
}

async function sendEventRegistrationNotification(
  event: ClubEvent,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "club_update",
    message: `[Event Registration Confirmed] You're registered for ${event.title} on ${formatEventRegistrationDate(event.date, event.time)}. Location: ${cleanEventLocation(event.location) ?? "TBD"}`,
    club_id: event.clubId ?? null,
    reference_id: event.id,
  });
  if (error) {
    console.error("Failed to send RSVP notification:", error.message);
  }
}

function formatEventTime(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  const parsed = new Date(`1970-01-01T${raw}`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function cleanEventLocation(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  return raw;
}

function EventTimeLocationMeta({
  timeLabel,
  locationLabel,
  marginBottom = "10px",
  color = "#666666",
  fontSize = "13px",
}: {
  timeLabel: string | null;
  locationLabel: string | null;
  marginBottom?: string | number;
  color?: string;
  fontSize?: string;
}) {
  if (!timeLabel && !locationLabel) return null;

  return (
    <div
      style={{
        fontSize,
        color,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexWrap: "wrap",
        marginBottom,
      }}
    >
      {timeLabel ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Clock size={13} color="#555555" aria-hidden />
          {timeLabel}
        </span>
      ) : null}
      {timeLabel && locationLabel ? (
        <span style={{ color: "#444444" }}>·</span>
      ) : null}
      {locationLabel ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <MapPin size={13} color="#555555" aria-hidden />
          {locationLabel}
        </span>
      ) : null}
    </div>
  );
}

function CompactEventRow({
  event,
  myStatus,
  rsvpAccess,
  onRsvp,
  highlighted = false,
}: {
  event: ClubEvent;
  myStatus?: RsvpStatus;
  rsvpAccess: RsvpAccessResult;
  onRsvp: (eventId: string, status: RsvpStatus) => void;
  highlighted?: boolean;
}) {
  const timeLabel = formatEventTime(event.time);
  const locationLabel = cleanEventLocation(event.location);

  return (
    <div
      data-event-id={event.id}
      data-event-date={eventCalendarDateKey(event.date)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        background: "#0d0d0d",
        border: highlighted ? "1px solid #E51937" : "1px solid #1a1a1a",
        borderRadius: "8px",
        marginBottom: "8px",
        boxShadow: highlighted ? "0 0 0 1px rgba(229, 25, 55, 0.35)" : undefined,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <EventDateBlock date={event.date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <EventTimeLocationMeta
          timeLabel={timeLabel}
          locationLabel={locationLabel}
          marginBottom={0}
        />
      </div>
      {rsvpAccess.showRsvpButton ? (
        <SmartRsvpButton eventId={event.id} status={myStatus} onRsvp={onRsvp} />
      ) : rsvpAccess.blockedMessage ? (
        <span style={{ fontSize: "11px", color: "#777777", maxWidth: "120px", textAlign: "right" }}>
          {rsvpAccess.blockedMessage}
        </span>
      ) : null}
    </div>
  );
}

function EventCard({
  event,
  category,
  clubLogoUrl,
  clubAbbreviation,
  isRecurring,
  isPrivileged,
  rsvpAccess,
  past = false,
  myStatus,
  counts,
  copiedEventId,
  planningTaskCount = 0,
  onPlanningTasksClick,
  onAddPlanningTask,
  attendeePreview,
  onRsvp,
  onManage,
  onStartEdit,
  onDelete,
  onCopyRsvpLink,
  onAddToCalendar,
  showViewAttendees,
  onToggleAttendees,
  attendeesList,
  onOpenResponses,
  hasFormResponses,
  highlighted = false,
}: {
  event: ClubEvent;
  category: string;
  clubLogoUrl?: string;
  clubAbbreviation?: string;
  isRecurring: boolean;
  isPrivileged: boolean;
  rsvpAccess: RsvpAccessResult;
  past?: boolean;
  myStatus?: RsvpStatus;
  counts: { going: number; maybe: number; not_going: number };
  copiedEventId: string | null;
  planningTaskCount?: number;
  onPlanningTasksClick: (event: ClubEvent) => void;
  onAddPlanningTask: (event: ClubEvent) => void;
  attendeePreview?: Array<{
    id: string;
    avatarUrl?: string;
    status: RsvpStatus;
  }>;
  onRsvp: (eventId: string, status: RsvpStatus) => void;
  onManage: (event: ClubEvent) => void;
  onStartEdit: (event: ClubEvent) => void;
  onDelete: (eventId: string) => void;
  onCopyRsvpLink: (eventId: string) => void;
  onAddToCalendar: (event: ClubEvent) => void;
  showViewAttendees: boolean;
  onToggleAttendees: (eventId: string) => void;
  attendeesList?: Array<{
    id: string;
    fullName?: string;
    avatarUrl?: string;
    program?: string;
    status: RsvpStatus;
  }>;
  onOpenResponses: (event: ClubEvent) => void;
  hasFormResponses: boolean;
  highlighted?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timeLabel = formatEventTime(event.time);
  const locationLabel = cleanEventLocation(event.location);
  const attendeeCountLabel = formatAttendeeCounts(counts);
  const hasAttendeeAvatars =
    (attendeePreview?.some((a) => a.status === "going" && a.avatarUrl?.trim()) ?? false);
  const showOptionsMenu = isPrivileged;

  return (
    <div
      data-event-id={event.id}
      data-event-date={eventCalendarDateKey(event.date)}
      onMouseLeave={() => setMenuOpen(false)}
      style={{
        ...eventCardStyle,
        ...(past ? { opacity: 0.6 } : null),
        ...(highlighted
          ? {
              borderColor: "#E51937",
              boxShadow: "0 0 0 1px rgba(229, 25, 55, 0.35)",
            }
          : null),
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <EventDateBlock date={event.date} muted={past} />
            {clubLogoUrl ? (
              <img
                src={clubLogoUrl}
                alt=""
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "6px",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "6px",
                  background: "#2a2a2a",
                  color: "#888888",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {deriveInitialsFromAbbreviation(clubAbbreviation).slice(0, 2)}
              </div>
            )}
            <h3
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {event.title}
            </h3>
          </div>

          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "nowrap",
              marginTop: "8px",
              marginBottom: "8px",
              overflowX: "auto",
            }}
          >
            <EventCardBadges
              event={event}
              category={category}
              isRecurring={isRecurring}
            />
          </div>

          <EventTimeLocationMeta
            timeLabel={timeLabel}
            locationLabel={locationLabel}
            color="#777777"
          />

          {isPrivileged ? (
            planningTaskCount > 0 ? (
              <button
                type="button"
                onClick={() => onPlanningTasksClick(event)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#E51937",
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                  margin: "0 0 8px",
                }}
              >
                {planningTaskCount} planning task{planningTaskCount === 1 ? "" : "s"} →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAddPlanningTask(event)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#777777",
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                  margin: "0 0 8px",
                }}
              >
                + Add planning task
              </button>
            )
          ) : null}

          {attendeeCountLabel || hasAttendeeAvatars ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "0 0 8px",
                flexWrap: "wrap",
              }}
            >
              {hasAttendeeAvatars && attendeePreview ? (
                <EventAttendeeAvatarStack attendees={attendeePreview} />
              ) : null}
              {attendeeCountLabel ? (
                <span style={{ fontSize: "12px", color: "#444444" }}>{attendeeCountLabel}</span>
              ) : null}
            </div>
          ) : null}

          {attendeesList && isPrivileged ? (
            <div
              style={{
                marginTop: "4px",
                borderRadius: "8px",
                border: "1px solid #2a2a2a",
                background: "#111111",
                padding: "12px",
              }}
            >
              {attendeesList.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
                  No RSVPs yet.
                </p>
              ) : (
                attendeesList.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    {a.avatarUrl ? (
                      <img
                        src={a.avatarUrl}
                        alt=""
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: "#1a0505",
                          color: "#E51937",
                          fontSize: "11px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {(a.fullName ?? "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#ffffff",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.fullName ?? "Unknown"}
                      </p>
                      {a.program ? (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#555555",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.program}
                        </p>
                      ) : null}
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        borderRadius: "20px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 500,
                        background:
                          a.status === "going"
                            ? "#1a1200"
                            : a.status === "maybe"
                              ? "#1a1a1a"
                              : "#1a0505",
                        color:
                          a.status === "going"
                            ? "#FFC429"
                            : a.status === "maybe"
                              ? "#aaaaaa"
                              : "#E51937",
                        border:
                          a.status === "going"
                            ? "1px solid #FFC429"
                            : a.status === "maybe"
                              ? "1px solid #555555"
                              : "1px solid #E51937",
                      }}
                    >
                      {a.status === "not_going"
                        ? "Not Going"
                        : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div
          style={{
            width: "152px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            flexShrink: 0,
          }}
        >
          {showOptionsMenu ? (
            <div style={{ position: "relative", alignSelf: "flex-end", marginBottom: "8px" }}>
              <button
                type="button"
                aria-label="Event options"
                onClick={() => setMenuOpen((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#747676",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "2px",
                }}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen ? (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: "4px",
                    background: "#151515",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    minWidth: "170px",
                    zIndex: 20,
                    overflow: "hidden",
                  }}
                >
                  {!past ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onStartEdit(event);
                        }}
                        style={menuButtonStyle}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onCopyRsvpLink(event.id);
                        }}
                        style={menuButtonStyle}
                      >
                        {copiedEventId === event.id ? "Copied!" : "Copy RSVP Link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onAddToCalendar(event);
                        }}
                        style={menuButtonStyle}
                      >
                        Add to Calendar
                      </button>
                      {hasFormResponses ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onOpenResponses(event);
                          }}
                          style={menuButtonStyle}
                        >
                          View Responses
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(event.id);
                    }}
                    style={{ ...menuButtonStyle, color: "#E51937" }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "4px",
              width: "100%",
            }}
          >
            {isPrivileged && !past ? (
              <button
                type="button"
                onClick={() => onManage(event)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#E51937",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Manage →
              </button>
            ) : null}

            {showViewAttendees && isPrivileged ? (
              <button
                type="button"
                onClick={() => onToggleAttendees(event.id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#777777",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {attendeesList ? "Hide Attendees" : "View Attendees"}
              </button>
            ) : null}
          </div>

          {!past ? (
            <div style={{ marginTop: "12px", width: "100%", display: "flex", justifyContent: "flex-end" }}>
              {rsvpAccess.showRsvpButton ? (
                <SmartRsvpButton
                  eventId={event.id}
                  status={myStatus}
                  onRsvp={onRsvp}
                />
              ) : rsvpAccess.blockedMessage ? (
                <p
                  style={{
                    fontSize: "11px",
                    color: "#777777",
                    margin: 0,
                    textAlign: "right",
                    maxWidth: "140px",
                  }}
                >
                  {rsvpAccess.blockedMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const menuButtonStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  color: "#cccccc",
  padding: "9px 12px",
  fontSize: "12px",
  cursor: "pointer",
};

function deriveInitialsFromAbbreviation(abbreviation?: string | null): string {
  const cleaned = (abbreviation ?? "").trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 4).toUpperCase();
}

type QuestionType = "text" | "multiple_choice" | "yes_no";

interface EventFormQuestion {
  id: string;
  event_id: string;
  question: string;
  question_type: QuestionType;
  options: string[] | null;
  required: boolean;
  order_index: number;
}

interface FormQuestionDraft {
  localId: string;
  id?: string;
  question: string;
  question_type: QuestionType;
  options: string[];
  optionsText: string;
  required: boolean;
  order_index: number;
}

interface RespondentAnswers {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  answers: { question: string; answer: string }[];
}

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
};

const darkInputStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#ffffff",
  fontSize: "13px",
  boxSizing: "border-box",
};

function parseOptionsText(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v)).filter(Boolean);
  }
  return [];
}

function draftFromRow(row: Record<string, unknown>): FormQuestionDraft {
  const opts = normalizeOptions(row.options);
  return {
    localId: row.id as string,
    id: row.id as string,
    question: row.question as string,
    question_type: row.question_type as QuestionType,
    options: opts,
    optionsText: opts.join(", "),
    required: Boolean(row.required),
    order_index: (row.order_index as number) ?? 0,
  };
}

function rowFromQuestion(
  eventId: string,
  q: FormQuestionDraft,
  index: number,
): Record<string, unknown> {
  const options =
    q.question_type === "multiple_choice"
      ? parseOptionsText(q.optionsText)
      : null;
  return {
    event_id: eventId,
    question: q.question.trim(),
    question_type: q.question_type,
    options: options && options.length > 0 ? options : null,
    required: q.required,
    order_index: index,
  };
}

function DragHandleIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#555555"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="9" cy="6" r="1" fill="#555555" />
      <circle cx="15" cy="6" r="1" fill="#555555" />
      <circle cx="9" cy="12" r="1" fill="#555555" />
      <circle cx="15" cy="12" r="1" fill="#555555" />
      <circle cx="9" cy="18" r="1" fill="#555555" />
      <circle cx="15" cy="18" r="1" fill="#555555" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function PillChoice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? "#E51937" : "#1a1a1a",
        border: selected ? "1px solid #E51937" : "1px solid #333333",
        color: selected ? "#ffffff" : "#777777",
        borderRadius: "20px",
        padding: "6px 16px",
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function FormQuestionBuilder({
  questions,
  onChange,
}: {
  questions: FormQuestionDraft[];
  onChange: (questions: FormQuestionDraft[]) => void;
}) {
  const update = (localId: string, patch: Partial<FormQuestionDraft>) => {
    onChange(
      questions.map((q) => (q.localId === localId ? { ...q, ...patch } : q)),
    );
  };

  const remove = (localId: string) => {
    onChange(
      questions
        .filter((q) => q.localId !== localId)
        .map((q, i) => ({ ...q, order_index: i })),
    );
  };

  const add = () => {
    onChange([
      ...questions,
      {
        localId: crypto.randomUUID(),
        question: "",
        question_type: "text",
        options: [],
        optionsText: "",
        required: false,
        order_index: questions.length,
      },
    ]);
  };

  return (
    <div>
      <p
        style={{
          fontSize: "12px",
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "10px",
        }}
      >
        RSVP Form Questions
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {questions.map((q) => (
          <div
            key={q.localId}
            style={{
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <div style={{ paddingTop: "10px", cursor: "grab" }} title="Drag to reorder">
                <DragHandleIcon />
              </div>
              <input
                type="text"
                value={q.question}
                onChange={(e) => update(q.localId, { question: e.target.value })}
                placeholder="Question text"
                style={{ ...darkInputStyle, flex: 1 }}
              />
              <select
                value={q.question_type}
                onChange={(e) =>
                  update(q.localId, {
                    question_type: e.target.value as QuestionType,
                  })
                }
                style={{ ...darkInputStyle, width: "160px" }}
              >
                <option value="text">Text</option>
                <option value="multiple_choice">Multiple choice</option>
                <option value="yes_no">Yes / No</option>
              </select>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#888888",
                  whiteSpace: "nowrap",
                  paddingTop: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) =>
                    update(q.localId, { required: e.target.checked })
                  }
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => remove(q.localId)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                }}
                aria-label="Delete question"
              >
                <TrashIcon />
              </button>
            </div>
            {q.question_type === "multiple_choice" ? (
              <input
                type="text"
                value={q.optionsText}
                onChange={(e) =>
                  update(q.localId, { optionsText: e.target.value })
                }
                placeholder="Options (comma-separated)"
                style={{ ...darkInputStyle, width: "100%", marginTop: "10px" }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        style={{
          marginTop: "12px",
          background: "transparent",
          border: "1px solid #333333",
          color: "#cccccc",
          borderRadius: "6px",
          padding: "6px 14px",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        + Add Question
      </button>
    </div>
  );
}

export default function ClubEventsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const { getClubById, isJoined } = useClubContext();
  const club = getClubById(clubId ?? "");
  const { events, loading, createEvent, updateEvent, deleteEvent, refresh } =
    useClubEvents(clubId);
  const { tasks, createTask, updateTask, deleteTask } = useClubTasks(clubId);
  const { members } = useClubMembers(clubId);

  const memberAccess = useClubMemberAccess(clubId);
  const canManageEvents =
    memberAccess.isPresident || memberAccess.can("manage_events");
  const isExecutiveForVisibility = isExecutiveAccessLevel(
    memberAccess.accessLevel,
    memberAccess.role,
  );
  const isActiveMember = clubId ? isJoined(clubId) : false;

  const visibleEvents = useMemo(
    () =>
      filterByVisibility(events, {
        isMember: isActiveMember,
        isPrivileged: isExecutiveForVisibility,
        userId: user?.id,
        accessLevel: memberAccess.accessLevel,
        role: memberAccess.role,
      }),
    [
      events,
      isActiveMember,
      isExecutiveForVisibility,
      user?.id,
      memberAccess.accessLevel,
      memberAccess.role,
    ],
  );

  const getRsvpAccessForEvent = useCallback(
    (event: ClubEvent) =>
      getEventRsvpAccess(event.visibility, {
        isActiveMember,
        isPrivileged: isExecutiveForVisibility,
      }),
    [isActiveMember, isExecutiveForVisibility],
  );
  const [clubBrand, setClubBrand] = useState<{
    logoUrl?: string;
    abbreviation?: string;
  }>({});

  useEffect(() => {
    const fetchClubBrand = async () => {
      if (!clubId) return;
      const { data } = await supabase
        .from("clubs")
        .select("logo_url, abbreviation")
        .eq("id", clubId)
        .maybeSingle();

      setClubBrand({
        logoUrl: (data?.logo_url as string) ?? undefined,
        abbreviation: (data?.abbreviation as string) ?? undefined,
      });
    };
    void fetchClubBrand();
  }, [clubId]);

  const eventIds = useMemo(() => visibleEvents.map((e) => e.id), [visibleEvents]);
  const { myRsvps, counts, attendees, setRsvp, removeRsvp, loadAttendees } =
    useEventRsvps(eventIds);
  const [expandedAttendees, setExpandedAttendees] = useState<string | null>(null);
  const [planningQuickAddEventId, setPlanningQuickAddEventId] = useState<string | null>(
    null,
  );
  const [focusRsvpPanel, setFocusRsvpPanel] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const routerLocation = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state for create / edit
  const [editingId, setEditingId] = useState<string | null>(null);

  const planningTasksForEditingEvent = useMemo(() => {
    if (!editingId) return [];
    return tasks.filter(
      (task) =>
        task.taskType === "event" &&
        task.linkedEventId === editingId,
    );
  }, [tasks, editingId]);

  const planningTaskCountByEvent = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.taskType === "event" && task.linkedEventId) {
        counts[task.linkedEventId] = (counts[task.linkedEventId] ?? 0) + 1;
      }
    }
    return counts;
  }, [tasks]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [selectedVisibilityTargets, setSelectedVisibilityTargets] = useState(
    EMPTY_SELECTED_VISIBILITY,
  );
  const [signupRequiresApproval, setSignupRequiresApproval] = useState(false);
  const [category, setCategory] = useState<EventCategory>(DEFAULT_EVENT_CATEGORY);
  const [categoryColumnReady, setCategoryColumnReady] = useState(false);
  const [eventCategories, setEventCategories] = useState<
    Record<string, EventCategory>
  >({});
  const [recurringColumnReady, setRecurringColumnReady] = useState(false);
  const [eventRecurring, setEventRecurring] = useState<
    Record<string, EventRecurringMeta>
  >({});
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const [formQuestions, setFormQuestions] = useState<FormQuestionDraft[]>([]);
  const [eventQuestionsMap, setEventQuestionsMap] = useState<
    Record<string, EventFormQuestion[]>
  >({});
  const [rsvpModalEvent, setRsvpModalEvent] = useState<ClubEvent | null>(null);
  const [rsvpAnswers, setRsvpAnswers] = useState<Record<string, string>>({});
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [responsesModalEvent, setResponsesModalEvent] =
    useState<ClubEvent | null>(null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesByUser, setResponsesByUser] = useState<RespondentAnswers[]>(
    [],
  );
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [showAllRecurring, setShowAllRecurring] = useState<Record<string, boolean>>(
    {},
  );
  const [showPastEvents, setShowPastEvents] = useState(true);
  const [reviewEvent, setReviewEvent] = useState<ClubEvent | null>(null);
  const [feedbackEvent, setFeedbackEvent] = useState<ClubEvent | null>(null);
  const [completedEventMeta, setCompletedEventMeta] = useState<
    Record<
      string,
      {
        reviewStatus: EventReviewStatus | null;
        feedbackFormEnabled: boolean;
        feedbackScore: number | null;
      }
    >
  >({});
  const [memberFeedbackEnabled, setMemberFeedbackEnabled] = useState<
    Record<string, boolean>
  >({});
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  const loadAllEventQuestions = useCallback(async () => {
    if (eventIds.length === 0) {
      setEventQuestionsMap({});
      return;
    }
    const { data, error } = await supabase
      .from("event_form_questions")
      .select("*")
      .in("event_id", eventIds)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("Failed to load form questions:", error.message);
      return;
    }

    const map: Record<string, EventFormQuestion[]> = {};
    for (const row of data ?? []) {
      const eventId = row.event_id as string;
      if (!map[eventId]) map[eventId] = [];
      map[eventId].push({
        id: row.id as string,
        event_id: eventId,
        question: row.question as string,
        question_type: row.question_type as QuestionType,
        options: normalizeOptions(row.options),
        required: Boolean(row.required),
        order_index: (row.order_index as number) ?? 0,
      });
    }
    setEventQuestionsMap(map);
  }, [eventIds]);

  useEffect(() => {
    if (!loading) {
      void loadAllEventQuestions();
    }
  }, [loading, eventIds, loadAllEventQuestions]);

  const saveEventQuestions = useCallback(
    async (eventId: string, questions: FormQuestionDraft[]): Promise<boolean> => {
      const { error: deleteError } = await supabase
        .from("event_form_questions")
        .delete()
        .eq("event_id", eventId);

      if (deleteError) {
        console.error(
          "Failed to delete event_form_questions before save:",
          deleteError.message,
          deleteError,
        );
        return false;
      }

      const rows = questions
        .map((q, index) => rowFromQuestion(eventId, q, index))
        .filter((row) => (row.question as string).length > 0);

      if (rows.length === 0) {
        await loadAllEventQuestions();
        return true;
      }

      const { error } = await supabase.from("event_form_questions").insert(rows);
      if (error) {
        console.error("Failed to save form questions:", error.message);
        return false;
      }

      await loadAllEventQuestions();
      return true;
    },
    [loadAllEventQuestions],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkCategoryColumn() {
      const { error } = await supabase.from("events").select("category").limit(1);
      if (cancelled) return;
      if (error) {
        console.warn(
          "events.category column missing — run: ALTER TABLE events ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';",
          error.message,
        );
        setCategoryColumnReady(false);
        return;
      }
      setCategoryColumnReady(true);
    }

    void checkCategoryColumn();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkRecurringColumn() {
      const { error } = await supabase
        .from("events")
        .select("is_recurring")
        .limit(1);
      if (cancelled) return;
      if (error) {
        console.warn(
          "events recurring columns missing — run migration 20260524000012_recurring_events.sql",
          error.message,
        );
        setRecurringColumnReady(false);
        return;
      }
      setRecurringColumnReady(true);
    }

    void checkRecurringColumn();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEventCategories = useCallback(async () => {
    if (!clubId || !categoryColumnReady) return;
    const { data, error } = await supabase
      .from("events")
      .select("id, category")
      .eq("club_id", clubId);

    if (error) {
      console.error("Failed to load event categories:", error.message);
      return;
    }

    const map: Record<string, EventCategory> = {};
    (data ?? []).forEach((row) => {
      map[row.id as string] = normalizeEventCategory(row.category as string);
    });
    setEventCategories(map);
  }, [clubId, categoryColumnReady]);

  const loadEventRecurring = useCallback(async () => {
    if (!clubId || !recurringColumnReady) return;
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, is_recurring, recurrence_frequency, recurrence_end_date, parent_event_id",
      )
      .eq("club_id", clubId);

    if (error) {
      console.error("Failed to load recurring event metadata:", error.message);
      return;
    }

    const map: Record<string, EventRecurringMeta> = {};
    (data ?? []).forEach((row) => {
      const freq = row.recurrence_frequency as string | null;
      const normalizedFreq =
        freq === "weekly" || freq === "biweekly" || freq === "monthly"
          ? freq
          : null;
      map[row.id as string] = {
        isRecurring: Boolean(row.is_recurring),
        frequency: normalizedFreq,
        recurrenceEndDate: (row.recurrence_end_date as string | null) ?? null,
        parentEventId: (row.parent_event_id as string | null) ?? null,
      };
    });
    setEventRecurring(map);
  }, [clubId, recurringColumnReady]);

  useEffect(() => {
    if (!loading && categoryColumnReady) {
      void loadEventCategories();
    }
  }, [loading, events, categoryColumnReady, loadEventCategories]);

  useEffect(() => {
    if (!loading && recurringColumnReady) {
      void loadEventRecurring();
    }
  }, [loading, events, recurringColumnReady, loadEventRecurring]);

  useEffect(() => {
    const shouldOpenCreate =
      searchParams.get("openCreate") === "true" ||
      searchParams.get("create") === "true";
    if (!shouldOpenCreate || !canManageEvents || loading) return;
    const templateState = routerLocation.state as {
      contentTemplate?: { title?: string; description?: string };
    } | null;
    setFormQuestions([]);
    setEditingId(null);
    setShowForm(true);
    if (templateState?.contentTemplate?.title) {
      setTitle(templateState.contentTemplate.title);
    }
    if (templateState?.contentTemplate?.description) {
      setDescription(templateState.contentTemplate.description);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("openCreate");
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    canManageEvents,
    loading,
    routerLocation.state,
  ]);

  useEffect(() => {
    const eventId = searchParams.get("manageEvent");
    if (!eventId || loading) return;
    if (!isActiveMember) {
      const next = new URLSearchParams(searchParams);
      next.delete("manageEvent");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, isActiveMember, loading]);

  useEffect(() => {
    const eventId = searchParams.get("viewRsvps");
    if (!eventId || !canManageEvents || loading) return;

    void loadAttendees(eventId);
    setFocusRsvpPanel(true);
    const next = new URLSearchParams(searchParams);
    next.delete("viewRsvps");
    next.set("manageEvent", eventId);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canManageEvents, loading, loadAttendees]);

  useEffect(() => {
    if (searchParams.get("openTemplate") !== "true" || !canManageEvents || loading) {
      return;
    }
    setShowTemplatePicker(true);
    const next = new URLSearchParams(searchParams);
    next.delete("openTemplate");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canManageEvents, loading]);

  async function saveEventCategory(
    eventId: string,
    nextCategory: EventCategory,
  ): Promise<boolean> {
    if (!categoryColumnReady) return true;
    const { error } = await supabase
      .from("events")
      .update({ category: nextCategory })
      .eq("id", eventId);

    if (error) {
      console.error("Failed to save event category:", error.message);
      return false;
    }

    setEventCategories((prev) => ({ ...prev, [eventId]: nextCategory }));
    return true;
  }

  async function saveEventRecurringMeta(
    eventId: string,
    meta: {
      isRecurring: boolean;
      frequency: RecurrenceFrequency | null;
      recurrenceEndDate: string | null;
      parentEventId?: string | null;
    },
  ): Promise<boolean> {
    if (!recurringColumnReady) return true;

    const endIso =
      meta.isRecurring && meta.recurrenceEndDate
        ? new Date(meta.recurrenceEndDate).toISOString()
        : null;

    const { error } = await supabase
      .from("events")
      .update({
        is_recurring: meta.isRecurring,
        recurrence_frequency: meta.isRecurring ? meta.frequency : null,
        recurrence_end_date: endIso,
        parent_event_id: meta.parentEventId ?? null,
      })
      .eq("id", eventId);

    if (error) {
      console.error("Failed to save recurring event metadata:", error.message);
      return false;
    }

    setEventRecurring((prev) => ({
      ...prev,
      [eventId]: {
        isRecurring: meta.isRecurring,
        frequency: meta.frequency,
        recurrenceEndDate: endIso,
        parentEventId: meta.parentEventId ?? null,
      },
    }));
    return true;
  }

  async function createRecurringInstances(
    parentId: string,
    baseFields: {
      title: string;
      description: string;
      date: string;
      time: string;
      location: string;
      visibility: Visibility;
      visibilityRoles: NonNullable<ClubEvent["visibilityRoles"]>;
      visibilityUserIds: NonNullable<ClubEvent["visibilityUserIds"]>;
    },
    instanceDates: string[],
    recurring: {
      frequency: RecurrenceFrequency;
      recurrenceEndDate: string | null;
    },
  ): Promise<boolean> {
    if (!clubId || !user?.id || instanceDates.length === 0) return true;

    const endIso = recurring.recurrenceEndDate
      ? new Date(recurring.recurrenceEndDate).toISOString()
      : null;

    const rows = instanceDates.map((instanceDate) => ({
      club_id: clubId,
      title: baseFields.title,
      description: baseFields.description,
      date: instanceDate,
      time: baseFields.time,
      location: baseFields.location,
      visibility: baseFields.visibility,
      visibility_roles: baseFields.visibilityRoles,
      visibility_user_ids: baseFields.visibilityUserIds,
      created_by: user.id,
      is_recurring: true,
      recurrence_frequency: recurring.frequency,
      recurrence_end_date: endIso,
      parent_event_id: parentId,
      ...(categoryColumnReady ? { category } : {}),
    }));

    const { data, error } = await supabase
      .from("events")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("Failed to create recurring event instances:", error.message);
      return false;
    }

    if (categoryColumnReady) {
      const ids = (data ?? []).map((row) => row.id as string);
      setEventCategories((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          next[id] = category;
        }
        return next;
      });
    }

    setEventRecurring((prev) => {
      const next = { ...prev };
      for (const row of data ?? []) {
        const id = row.id as string;
        next[id] = {
          isRecurring: true,
          frequency: recurring.frequency,
          recurrenceEndDate: endIso,
          parentEventId: parentId,
        };
      }
      return next;
    });

    return true;
  }

  function isEventRecurring(eventId: string): boolean {
    return eventRecurring[eventId]?.isRecurring ?? false;
  }

  async function copyRsvpLink(eventId: string) {
    const url = `${window.location.origin}/events/${eventId}/rsvp`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedEventId(eventId);
    window.setTimeout(() => {
      setCopiedEventId((current) => (current === eventId ? null : current));
    }, 2000);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setDate("");
    setTime("");
    setLocation("");
    setVisibility("public");
    setSelectedVisibilityTargets(EMPTY_SELECTED_VISIBILITY);
    setSignupRequiresApproval(false);
    setCategory(DEFAULT_EVENT_CATEGORY);
    setIsRecurring(false);
    setRecurrenceFrequency("weekly");
    setRecurrenceEndDate("");
    setFormQuestions([]);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(event: ClubEvent) {
    const current = events.find((e) => e.id === event.id) ?? event;
    setEditingId(current.id);
    setTitle(current.title);
    setDescription(current.description);
    setDate(current.date);
    setTime(current.time);
    setLocation(current.location);
    setVisibility(normalizeVisibility(current.visibility, "public"));
    setSelectedVisibilityTargets(
      selectedVisibilityPayload(
        current.visibilityRoles ?? [],
        current.visibilityUserIds ?? [],
      ),
    );
    setSignupRequiresApproval(Boolean(current.signupRequiresApproval));
    setCategory(
      eventCategories[current.id] ?? DEFAULT_EVENT_CATEGORY,
    );
    const recurringMeta = eventRecurring[current.id];
    setIsRecurring(recurringMeta?.isRecurring ?? false);
    setRecurrenceFrequency(recurringMeta?.frequency ?? "weekly");
    setRecurrenceEndDate(
      toDatetimeLocalValue(recurringMeta?.recurrenceEndDate ?? null),
    );
    const existing = eventQuestionsMap[current.id] ?? [];
    setFormQuestions(
      existing.map((q) =>
        draftFromRow({
          id: q.id,
          question: q.question,
          question_type: q.question_type,
          options: q.options,
          required: q.required,
          order_index: q.order_index,
        }),
      ),
    );
    setShowForm(true);
  }

  function getEventCategory(eventId: string): EventCategory {
    return eventCategories[eventId] ?? DEFAULT_EVENT_CATEGORY;
  }

  async function handleSubmit() {
    if (!title.trim() || !date) return;
    if (
      visibility === "selected" &&
      !hasSelectedVisibilityTargets(selectedVisibilityTargets)
    ) {
      setFeedback({
        type: "error",
        text: "Choose at least one role or member for selected visibility.",
      });
      return;
    }
    setSaving(true);
    setFeedback(null);

    const newEventId = editingId ? null : crypto.randomUUID();
    const fields = {
      ...(newEventId ? { id: newEventId } : {}),
      title: title.trim(),
      description: description.trim(),
      date,
      time: time || "TBD",
      location: location.trim() || "TBD",
      visibility,
      visibilityRoles:
        visibility === "selected"
          ? selectedVisibilityTargets.visibilityRoles
          : [],
      visibilityUserIds:
        visibility === "selected"
          ? selectedVisibilityTargets.visibilityUserIds
          : [],
      signupRequiresApproval,
    };

    let ok: boolean;
    let savedEventId = editingId;

    if (editingId) {
      ok = !!(await updateEvent(editingId, fields));
      if (ok) {
        const categorySaved = await saveEventCategory(editingId, category);
        ok = categorySaved;
      }
      if (ok && recurringColumnReady) {
        const recurringSaved = await saveEventRecurringMeta(editingId, {
          isRecurring,
          frequency: isRecurring ? recurrenceFrequency : null,
          recurrenceEndDate: isRecurring ? recurrenceEndDate : null,
          parentEventId: eventRecurring[editingId]?.parentEventId ?? null,
        });
        ok = recurringSaved;
      }
    } else {
      ok = !!(await createEvent(fields));
      if (ok) {
        savedEventId = newEventId;
      }
      if (ok && categoryColumnReady) {
        ok = savedEventId ? await saveEventCategory(savedEventId, category) : false;
      }
      if (ok && savedEventId && isRecurring && recurringColumnReady) {
        const recurringSaved = await saveEventRecurringMeta(savedEventId, {
          isRecurring: true,
          frequency: recurrenceFrequency,
          recurrenceEndDate: recurrenceEndDate,
          parentEventId: null,
        });
        if (!recurringSaved) {
          ok = false;
        } else {
          const instanceDates = generateRecurringInstanceDates(
            date,
            recurrenceFrequency,
            recurrenceEndDate,
          );
          const instancesCreated = await createRecurringInstances(
            savedEventId,
            fields,
            instanceDates,
            {
              frequency: recurrenceFrequency,
              recurrenceEndDate: recurrenceEndDate,
            },
          );
          if (!instancesCreated) {
            ok = false;
          }
        }
      }

      if (ok) {
        refresh();
      }
    }

    if (ok && savedEventId) {
      const { error: preDeleteError } = await supabase
        .from("event_form_questions")
        .delete()
        .eq("event_id", savedEventId);

      if (preDeleteError) {
        console.error(
          "Failed to delete event_form_questions before save:",
          preDeleteError.message,
          preDeleteError,
        );
        ok = false;
      }

      const questionsSaved = ok
        ? await saveEventQuestions(savedEventId, formQuestions)
        : false;
      if (!questionsSaved) {
        ok = false;
      }
    }

    setSaving(false);
    if (ok) {
      setFeedback({ type: "success", text: editingId ? "Event updated." : "Event created." });
    } else {
      setFeedback({ type: "error", text: "Failed to save event." });
    }
    resetForm();
  }

  async function handleDelete(eventId: string) {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    setFeedback(null);

    const event = events.find((entry) => entry.id === eventId);
    const recipientUserIds = await fetchEventRsvpRecipientUserIds(supabase, eventId);

    const ok = await deleteEvent(eventId);
    if (ok) {
      if (event && clubId && recipientUserIds.length > 0) {
        void notifyEventCancelled(supabase, {
          clubId,
          clubName: club?.name ?? "Club",
          eventId,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time,
          recipientUserIds,
        });
      }
      setFeedback({ type: "success", text: "Event deleted." });
    } else {
      setFeedback({ type: "error", text: "Failed to delete event." });
    }
  }

  async function handleRsvp(eventId: string, status: RsvpStatus) {
    const event = events.find((entry) => entry.id === eventId);
    if (event) {
      const access = getRsvpAccessForEvent(event);
      if (!access.canRsvp) return;
    }

    if (myRsvps[eventId] === status) {
      await removeRsvp(eventId);
      return;
    }

    if (!user?.id) return;

    if (status === "going" && myRsvps[eventId]) {
      setFeedback({
        type: "error",
        text: "You're already registered for this event.",
      });
      return;
    }

    const existing = await fetchExistingRsvp(eventId, user.id);
    if (existing && status === "going") {
      setFeedback({
        type: "error",
        text: "You're already registered for this event.",
      });
      return;
    }

    if (status === "going") {
      const questions = filterRsvpQuestionsForLoggedInUser(
        eventQuestionsMap[eventId] ?? [],
      );
      if (questions.length > 0) {
        const matchedEvent = events.find((e) => e.id === eventId) ?? null;
        setRsvpModalEvent(matchedEvent);
        setRsvpAnswers({});
        return;
      }
    }

    const hadRsvp = Boolean(myRsvps[eventId]);
    const eventForSignup = events.find((entry) => entry.id === eventId);
    const signupStatus: RsvpStatus =
      status === "going" && eventForSignup?.signupRequiresApproval
        ? "pending"
        : status;

    const ok = await setRsvp(eventId, signupStatus);
    if (ok && signupStatus === "going" && !hadRsvp && !existing) {
      const event = events.find((e) => e.id === eventId);
      if (event) {
        await sendEventRegistrationNotification(event, user.id);
      }
    } else if (
      ok &&
      signupStatus === "pending" &&
      !hadRsvp &&
      !existing &&
      eventForSignup &&
      clubId
    ) {
      const member = members.find((entry) => entry.userId === user.id);
      void notifyEventSignupPendingReview(supabase, {
        clubId,
        clubName: club?.name ?? "Club",
        eventId: eventForSignup.id,
        eventTitle: eventForSignup.title,
        registrantUserId: user.id,
        registrantName: resolveStudentDisplayName(
          member?.fullName,
          user.email,
        ),
      });
    }
  }

  async function submitRsvpWithForm() {
    if (!rsvpModalEvent || !user?.id) return;

    const existing = await fetchExistingRsvp(rsvpModalEvent.id, user.id);
    if (existing || myRsvps[rsvpModalEvent.id]) {
      setFeedback({
        type: "error",
        text: "You're already registered for this event.",
      });
      return;
    }

    const questions = filterRsvpQuestionsForLoggedInUser(
      eventQuestionsMap[rsvpModalEvent.id] ?? [],
    );
    for (const q of questions) {
      if (q.required && !rsvpAnswers[q.id]?.trim()) {
        setFeedback({
          type: "error",
          text: "Please answer all required questions.",
        });
        return;
      }
    }

    setRsvpSubmitting(true);
    setFeedback(null);

    const rows = questions.map((q) => ({
      event_id: rsvpModalEvent.id,
      user_id: user.id,
      question_id: q.id,
      answer: rsvpAnswers[q.id]?.trim() ?? "",
    }));

    await supabase
      .from("event_form_responses")
      .delete()
      .eq("event_id", rsvpModalEvent.id)
      .eq("user_id", user.id);

    const { error: responseError } = await supabase
      .from("event_form_responses")
      .insert(rows);

    if (responseError) {
      console.error("Failed to save RSVP responses:", responseError.message);
      setFeedback({ type: "error", text: "Failed to save your responses." });
      setRsvpSubmitting(false);
      return;
    }

    const signupStatus: RsvpStatus = rsvpModalEvent.signupRequiresApproval
      ? "pending"
      : "going";
    const ok = await setRsvp(rsvpModalEvent.id, signupStatus);
    setRsvpSubmitting(false);

    if (ok) {
      if (signupStatus === "going") {
        await sendEventRegistrationNotification(rsvpModalEvent, user.id);
      } else if (clubId) {
        const member = members.find((entry) => entry.userId === user.id);
        void notifyEventSignupPendingReview(supabase, {
          clubId,
          clubName: club?.name ?? "Club",
          eventId: rsvpModalEvent.id,
          eventTitle: rsvpModalEvent.title,
          registrantUserId: user.id,
          registrantName: resolveStudentDisplayName(
            member?.fullName,
            user.email,
          ),
        });
      }
      setRsvpModalEvent(null);
      setRsvpAnswers({});
    } else {
      setFeedback({ type: "error", text: "Failed to confirm RSVP." });
    }
  }

  async function openResponsesModal(event: ClubEvent) {
    setResponsesModalEvent(event);
    setResponsesLoading(true);
    setResponsesByUser([]);

    const { data, error } = await supabase
      .from("event_form_responses")
      .select(
        `
        user_id,
        answer,
        question_id,
        event_form_questions (
          question,
          order_index
        )
      `,
      )
      .eq("event_id", event.id);

    if (error) {
      console.error("Failed to load responses:", error.message);
      setResponsesLoading(false);
      return;
    }

    const userIds = [
      ...new Set((data ?? []).map((r) => r.user_id as string)),
    ];
    let profileMap: Record<
      string,
      { fullName: string; avatarUrl?: string }
    > = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [
          p.id as string,
          {
            fullName: (p.full_name as string) ?? "Unknown",
            avatarUrl: (p.avatar_url as string) ?? undefined,
          },
        ]),
      );
    }

    const grouped = new Map<string, RespondentAnswers>();
    for (const row of data ?? []) {
      const userId = row.user_id as string;
      const qMeta = row.event_form_questions as
        | { question: string; order_index: number }
        | { question: string; order_index: number }[]
        | null;
      const questionMeta = Array.isArray(qMeta) ? qMeta[0] : qMeta;
      const questionText = questionMeta?.question ?? "Question";

      if (!grouped.has(userId)) {
        const profile = profileMap[userId];
        grouped.set(userId, {
          userId,
          fullName: profile?.fullName ?? "Unknown",
          avatarUrl: profile?.avatarUrl,
          answers: [],
        });
      }
      grouped.get(userId)!.answers.push({
        question: questionText,
        answer: (row.answer as string) ?? "",
      });
    }

    setResponsesByUser(Array.from(grouped.values()));
    setResponsesLoading(false);
  }

  async function toggleAttendees(eventId: string) {
    if (expandedAttendees === eventId) {
      setExpandedAttendees(null);
    } else {
      await loadAttendees(eventId);
      setExpandedAttendees(eventId);
    }
  }

  const now = new Date();
  const upcomingEvents = visibleEvents
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const filteredUpcomingEvents = useMemo(
    () =>
      upcomingEvents.filter((event) =>
        matchesEventFilter(event, eventFilter, myRsvps),
      ),
    [upcomingEvents, eventFilter, myRsvps],
  );

  const upcomingDisplayList = useMemo(
    () => buildUpcomingDisplayList(filteredUpcomingEvents, showAllRecurring),
    [filteredUpcomingEvents, showAllRecurring],
  );

  const eventFilterCounts = useMemo(
    () => ({
      all: upcomingEvents.length,
      going_to: upcomingEvents.filter((e) => {
        const status = myRsvps[e.id];
        return status === "going" || status === "maybe";
      }).length,
      needs_response: upcomingEvents.filter((e) => !myRsvps[e.id]).length,
    }),
    [upcomingEvents, myRsvps],
  );

  const pastEvents = visibleEvents
    .filter((e) => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const pastEventIds = useMemo(() => pastEvents.map((event) => event.id), [pastEvents]);

  useEffect(() => {
    if (!clubId || pastEventIds.length === 0) {
      setCompletedEventMeta({});
      setMemberFeedbackEnabled({});
      return;
    }

    let cancelled = false;

    void (async () => {
      if (canManageEvents) {
        const [{ data: reviews, error: reviewError }, { data: feedback, error: feedbackError }] =
          await Promise.all([
            supabase
              .from("event_reviews")
              .select("event_id, review_status, feedback_form_enabled")
              .in("event_id", pastEventIds),
            supabase
              .from("event_feedback_responses")
              .select("event_id, overall_rating, engagement_rating, organization_rating")
              .in("event_id", pastEventIds),
          ]);

        if (cancelled) return;

        if (reviewError) {
          console.error("Failed to load event reviews:", reviewError.message);
        }
        if (feedbackError) {
          console.error("Failed to load event feedback:", feedbackError.message);
        }

        const feedbackByEvent = new Map<string, typeof feedback>();
        for (const row of feedback ?? []) {
          const eventId = row.event_id as string;
          const bucket = feedbackByEvent.get(eventId) ?? [];
          bucket.push(row);
          feedbackByEvent.set(eventId, bucket);
        }

        const meta: typeof completedEventMeta = {};
        for (const eventId of pastEventIds) {
          const review = (reviews ?? []).find((row) => row.event_id === eventId);
          const summary = summarizeFeedbackRows(
            (feedbackByEvent.get(eventId) ?? []) as Array<{
              overall_rating: number;
              engagement_rating: number;
              organization_rating: number;
            }>,
          );
          meta[eventId] = {
            reviewStatus: (review?.review_status as EventReviewStatus | undefined) ?? null,
            feedbackFormEnabled: Boolean(review?.feedback_form_enabled),
            feedbackScore: summary.averageScore,
          };
        }
        setCompletedEventMeta(meta);
        setMemberFeedbackEnabled({});
        return;
      }

      const enabledEntries = await Promise.all(
        pastEventIds.map(async (eventId) => {
          const { data, error } = await supabase.rpc("event_feedback_form_enabled", {
            p_event_id: eventId,
          });
          if (error) {
            console.error("Failed to check feedback form:", error.message);
            return [eventId, false] as const;
          }
          return [eventId, Boolean(data)] as const;
        }),
      );

      if (cancelled) return;

      setMemberFeedbackEnabled(Object.fromEntries(enabledEntries));
      setCompletedEventMeta({});
    })();

    return () => {
      cancelled = true;
    };
  }, [canManageEvents, clubId, pastEventIds]);

  const calendarEventDateKeys = useMemo(() => {
    const keys = new Set<string>();
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    for (const event of visibleEvents) {
      const key = eventCalendarDateKey(event.date);
      const parsed = new Date(`${key}T12:00:00`);
      if (
        !Number.isNaN(parsed.getTime()) &&
        parsed.getFullYear() === year &&
        parsed.getMonth() === month
      ) {
        keys.add(key);
      }
    }
    return keys;
  }, [visibleEvents, calendarMonth]);

  const calendarSidebarStats = useMemo(
    () => ({
      upcoming: eventFilterCounts.all,
      publicCount: upcomingEvents.filter((e) => isEventPublic(e)).length,
      goingTo: eventFilterCounts.going_to,
      nextEventDate: formatNextEventDateLabel(upcomingEvents[0]?.date),
    }),
    [eventFilterCounts, upcomingEvents],
  );

  const scrollToEventInList = useCallback((eventId: string) => {
    window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-event-id="${eventId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedEventId(eventId);
      window.setTimeout(() => setHighlightedEventId(null), 2000);
    });
  }, []);

  const handleCalendarDayClick = useCallback(
    (dateKey: string) => {
      setSelectedCalendarDay(dateKey);
      if (!calendarEventDateKeys.has(dateKey)) return;

      const match = filteredUpcomingEvents.find(
        (event) => eventCalendarDateKey(event.date) === dateKey,
      );
      if (!match) return;

      const sameTitleCount = filteredUpcomingEvents.filter(
        (event) => event.title === match.title,
      ).length;
      const needsExpand =
        sameTitleCount > 1 && !(showAllRecurring[match.title] ?? false);
      const firstInGroup = filteredUpcomingEvents.find(
        (event) => event.title === match.title,
      );

      if (needsExpand && firstInGroup && firstInGroup.id !== match.id) {
        setShowAllRecurring((prev) => ({ ...prev, [match.title]: true }));
        window.setTimeout(() => scrollToEventInList(match.id), 80);
        return;
      }

      scrollToEventInList(match.id);
    },
    [
      calendarEventDateKeys,
      filteredUpcomingEvents,
      scrollToEventInList,
      showAllRecurring,
    ],
  );

  useEffect(() => {
    const idsToPrefetch = new Set<string>();
    for (const item of upcomingDisplayList) {
      if (item.kind !== "event") continue;
      const going = counts[item.event.id]?.going ?? 0;
      if (going > 0) idsToPrefetch.add(item.event.id);
    }
    for (const event of pastEvents) {
      const going = counts[event.id]?.going ?? 0;
      if (going > 0) idsToPrefetch.add(event.id);
    }
    for (const eventId of idsToPrefetch) {
      if (!attendees[eventId]) {
        void loadAttendees(eventId);
      }
    }
  }, [upcomingDisplayList, pastEvents, counts, attendees, loadAttendees]);

  function openManageEvent(event: ClubEvent) {
    const next = new URLSearchParams(searchParams);
    next.set("manageEvent", event.id);
    setSearchParams(next);
  }

  function closeManageView() {
    setPlanningQuickAddEventId(null);
    setFocusRsvpPanel(false);
    const next = new URLSearchParams(searchParams);
    next.delete("manageEvent");
    setSearchParams(next);
  }

  function handleEditFromManage(event: ClubEvent) {
    closeManageView();
    startEdit(event);
  }

  function openPlanningTasks(event: ClubEvent) {
    openManageEvent(event);
  }

  function openPlanningTaskQuickAdd(event: ClubEvent) {
    setPlanningQuickAddEventId(event.id);
    openManageEvent(event);
  }

  const manageEventId = searchParams.get("manageEvent");
  const manageEvent = manageEventId
    ? events.find((item) => item.id === manageEventId)
    : undefined;
  const planningTasksForManageEvent = useMemo(() => {
    if (!manageEventId) return [];
    return tasks.filter(
      (task) => task.taskType === "event" && task.linkedEventId === manageEventId,
    );
  }, [tasks, manageEventId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading events…" />
      </div>
    );
  }

  if (manageEventId && isActiveMember) {
    if (!manageEvent) {
      return (
        <div
          style={{
            backgroundColor: "#0f0f0f",
            padding: isMobile ? "16px" : "24px",
          }}
        >
          <p style={{ color: "#777777", margin: 0 }}>Event not found.</p>
          <button
            type="button"
            onClick={closeManageView}
            style={{
              background: "none",
              border: "none",
              color: "#E51937",
              cursor: "pointer",
              marginTop: "12px",
              padding: 0,
              fontSize: "14px",
            }}
          >
            Back to Events
          </button>
        </div>
      );
    }

    const manageCounts = counts[manageEvent.id] ?? {
      going: 0,
      maybe: 0,
      not_going: 0,
    };

    return (
      <div
        style={{
          backgroundColor: "#0f0f0f",
          padding: isMobile ? "16px" : "24px",
        }}
      >
        {feedback ? (
          <div
            style={{
              marginBottom: "16px",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              background: feedback.type === "success" ? "#0a1a0a" : "#1a0a0a",
              color: feedback.type === "success" ? "#4ade80" : "#E51937",
              border: `1px solid ${feedback.type === "success" ? "#22c55e" : "#E51937"}`,
            }}
          >
            {feedback.text}
          </div>
        ) : null}
        <EventManageView
          event={manageEvent}
          category={getEventCategory(manageEvent.id)}
          recurringMeta={eventRecurring[manageEvent.id]}
          isRecurring={isEventRecurring(manageEvent.id)}
          isPrivileged={canManageEvents}
          isMobile={isMobile}
          counts={manageCounts}
          attendeeList={attendees[manageEvent.id]}
          planningTasks={planningTasksForManageEvent}
          members={members}
          clubName={club?.name ?? "Club"}
          clubLogoUrl={clubBrand.logoUrl}
          clubAbbreviation={clubBrand.abbreviation}
          clubSlug={club?.slug}
          myRsvpStatus={myRsvps[manageEvent.id]}
          rsvpAccess={getRsvpAccessForEvent(manageEvent)}
          publicEventPath={getPublicEventDetailPath(manageEvent.id)}
          onRsvp={handleRsvp}
          createTask={createTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          onFeedback={setFeedback}
          onEdit={handleEditFromManage}
          onBack={closeManageView}
          focusRsvpPanel={focusRsvpPanel}
          onRsvpPanelFocused={() => setFocusRsvpPanel(false)}
          initialPlanningQuickAdd={planningQuickAddEventId === manageEvent.id}
          onPlanningQuickAddOpened={() => setPlanningQuickAddEventId(null)}
          loadAttendees={loadAttendees}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#0f0f0f",
        padding: isMobile ? "16px" : "24px",
      }}
    >
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: isMobile ? "12px" : undefined,
        }}
      >
        <div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "28px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Events
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#555555",
              marginTop: "4px",
              marginBottom: 0,
            }}
          >
            {upcomingEvents.length} upcoming event
            {upcomingEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManageEvents && (
          <Button
            onClick={() => {
              if (showForm) resetForm();
              else {
                setFormQuestions([]);
                setEditingId(null);
                setShowForm(true);
              }
            }}
            className="!border-0 !bg-[#E51937] !px-[18px] !py-[9px] !text-[13px] !font-medium !text-white hover:!bg-[#cc0020]"
            style={{ borderRadius: "6px" }}
          >
            {showForm ? "Cancel" : "+ New Event"}
          </Button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "nowrap",
          overflowX: "auto",
        }}
      >
        {EVENT_FILTER_OPTIONS.map((option) => {
          const active = eventFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setEventFilter(option.value)}
              style={{
                background: active ? "#E51937" : "transparent",
                color: active ? "#ffffff" : "#777777",
                border: active ? "none" : "1px solid #333333",
                borderRadius: "20px",
                padding: "6px 16px",
                fontSize: "12px",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {option.label} · {eventFilterCounts[option.value]}
            </button>
          );
        })}
      </div>

      {eventFilter === "needs_response" ? (
        <p
          style={{
            fontSize: "12px",
            color: "#777777",
            marginTop: 0,
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          You haven&apos;t answered whether you&apos;re available for these upcoming events.
        </p>
      ) : (
        <p
          style={{
            fontSize: "12px",
            color: "#555555",
            marginTop: 0,
            marginBottom: "16px",
          }}
        >
          Sorted by upcoming date
        </p>
      )}

      {feedback ? (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            border:
            feedback.type === "success"
                ? "1px solid #3a2a00"
                : "1px solid #3a1a1a",
            background: feedback.type === "success" ? "#1a1500" : "#1a0505",
            color: feedback.type === "success" ? "#FFC429" : "#E51937",
          }}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Create / edit form — admin/exec only */}
      {showForm && canManageEvents && (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-white">
            {editingId ? "Edit Event" : "Create New Event"}
          </h3>
            {!editingId ? (
              <button
                type="button"
                className={templateOutlineButtonClass}
                onClick={() => setShowTemplatePicker(true)}
              >
                Use Template
              </button>
            ) : null}
          </div>
          <div className="space-y-3">
            <FormInput
              id="eventTitle"
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Meeting"
              required
            />
            <div>
              <label
                htmlFor="eventDesc"
                className="mb-1 block text-sm font-medium text-white"
              >
                Description
              </label>
              <textarea
                id="eventDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Add details…"
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
              />
            </div>
            <CategorySelector
              key={`${editingId ?? "create"}-category`}
              value={category}
              onChange={setCategory}
            />
            <RecurringEventFormSection
              isRecurring={isRecurring}
              onRecurringChange={setIsRecurring}
              frequency={recurrenceFrequency}
              onFrequencyChange={setRecurrenceFrequency}
              endDate={recurrenceEndDate}
              onEndDateChange={setRecurrenceEndDate}
            />
            <VisibilitySelector
              key={editingId ?? "create"}
              value={visibility}
              onChange={setVisibility}
              label="Who can see this event?"
            />
            {visibility === "selected" ? (
              <SelectedVisibilityPicker
                members={members}
                targets={selectedVisibilityTargets}
                onChange={setSelectedVisibilityTargets}
                disabled={saving}
              />
            ) : null}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                fontSize: "13px",
                color: "#cccccc",
                marginBottom: "4px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={signupRequiresApproval}
                onChange={(e) => setSignupRequiresApproval(e.target.checked)}
                style={{ marginTop: "2px" }}
              />
              <span>
                Require organizer approval for sign-ups
                <span style={{ display: "block", color: "#666666", fontSize: "12px", marginTop: "4px" }}>
                  Registrants are held as pending until an executive reviews their request.
                </span>
              </span>
            </label>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? "12px" : "16px",
              }}
            >
              <div style={{ flex: 1 }}>
                <FormInput
                  id="eventDate"
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <FormInput
                  id="eventTime"
                  label="Time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <FormInput
              id="eventLocation"
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Thornbrough Building, Room 1307"
            />
            <FormQuestionBuilder
              questions={formQuestions}
              onChange={setFormQuestions}
            />
            {editingId ? (
              <EventPlanningTasksSection
                clubId={clubId ?? ""}
                eventId={editingId}
                eventTitle={title.trim() || "this event"}
                planningTasks={planningTasksForEditingEvent}
                members={members}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                onFeedback={setFeedback}
                initialQuickAddOpen={planningQuickAddEventId === editingId}
                onQuickAddOpened={() => setPlanningQuickAddEventId(null)}
              />
            ) : null}
            <div className="flex justify-end gap-3 pt-2">
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={
                  !title.trim() ||
                  !date ||
                  saving ||
                  (visibility === "selected" &&
                    !hasSelectedVisibilityTargets(selectedVisibilityTargets))
                }
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save Changes"
                    : "Add Event"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
      <div style={upcomingSectionHeadingStyle}>Upcoming</div>
      {filteredUpcomingEvents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", marginBottom: "32px" }}>
          <Calendar
            size={36}
            color="#2a2a2a"
            aria-hidden
            style={{ marginBottom: "12px" }}
          />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#333333", margin: 0 }}>
            No upcoming events
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#444444",
              marginTop: "4px",
              maxWidth: "260px",
              margin: "4px auto 0",
            }}
          >
            {upcomingEvents.length === 0 && canManageEvents
              ? "Create your first event to get started."
              : eventFilter !== "all"
                ? "Try a different filter or check back soon."
                : "Check back soon for new events."}
          </p>
          {upcomingEvents.length === 0 && canManageEvents ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "#E51937",
                fontSize: "14px",
                cursor: "pointer",
                marginTop: "12px",
              }}
            >
              Create your first event →
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ marginBottom: "32px" }}>
          {upcomingDisplayList.map((item) => {
            if (item.kind === "expand") {
              return (
                <button
                  key={`expand-${item.title}-${item.expanded ? "open" : "closed"}`}
                  type="button"
                  onClick={() =>
                    setShowAllRecurring((prev) => ({
                      ...prev,
                      [item.title]: !item.expanded,
                    }))
                  }
                  style={{
                    background: "#141414",
                    border: "none",
                    color: "#555555",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "13px",
                    width: "100%",
                    marginBottom: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  {item.expanded
                    ? `Show fewer dates for "${item.title}"`
                    : `+ Show ${item.remaining} more dates for "${item.title}"`}
                  {item.expanded ? (
                    <ChevronUp size={14} aria-hidden />
                  ) : (
                    <ChevronDown size={14} aria-hidden />
                  )}
                </button>
              );
            }

            if (item.kind === "compact") {
              const event = item.event;
              return (
                <CompactEventRow
                  key={event.id}
                  event={event}
                  myStatus={myRsvps[event.id]}
                  rsvpAccess={getRsvpAccessForEvent(event)}
                  onRsvp={handleRsvp}
                  highlighted={highlightedEventId === event.id}
                />
              );
            }

            const event = item.event;
            const c = counts[event.id] ?? { going: 0, maybe: 0, not_going: 0 };
            const myStatus = myRsvps[event.id];
            return (
              <EventCard
                key={event.id}
                event={event}
                category={getEventCategory(event.id)}
                clubLogoUrl={clubBrand.logoUrl}
                clubAbbreviation={clubBrand.abbreviation}
                isRecurring={isEventRecurring(event.id)}
                isPrivileged={canManageEvents}
                rsvpAccess={getRsvpAccessForEvent(event)}
                myStatus={myStatus}
                counts={c}
                copiedEventId={copiedEventId}
                planningTaskCount={planningTaskCountByEvent[event.id] ?? 0}
                onPlanningTasksClick={openPlanningTasks}
                onAddPlanningTask={openPlanningTaskQuickAdd}
                attendeePreview={attendees[event.id]}
                onRsvp={handleRsvp}
                onManage={openManageEvent}
                onStartEdit={startEdit}
                onDelete={handleDelete}
                onCopyRsvpLink={copyRsvpLink}
                onAddToCalendar={downloadEventIcs}
                showViewAttendees={canManageEvents}
                onToggleAttendees={toggleAttendees}
                attendeesList={
                  expandedAttendees === event.id ? attendees[event.id] : undefined
                }
                onOpenResponses={openResponsesModal}
                hasFormResponses={(eventQuestionsMap[event.id]?.length ?? 0) > 0}
                highlighted={highlightedEventId === event.id}
              />
            );
          })}
        </div>
      )}

      {pastEvents.length > 0 ? (
        <section style={{ marginTop: "8px" }}>
          <button
            type="button"
            onClick={() => setShowPastEvents((value) => !value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "transparent",
              border: "none",
              color: "#555555",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              padding: 0,
              marginBottom: showPastEvents ? "12px" : 0,
            }}
          >
            <span style={pastSectionHeadingStyle}>Completed Events</span>
            <span style={{ fontSize: "12px", color: "#444444" }}>
              ({pastEvents.length})
            </span>
            <ChevronDown
              size={16}
              style={{
                transform: showPastEvents ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
          {showPastEvents ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              {pastEvents.map((event) => {
                const eventCounts = counts[event.id] ?? {
                  going: 0,
                  maybe: 0,
                  not_going: 0,
                };
                const meta = completedEventMeta[event.id];
                const feedbackEnabled = canManageEvents
                  ? Boolean(meta?.feedbackFormEnabled)
                  : Boolean(memberFeedbackEnabled[event.id]);

                return (
                  <CompletedEventCard
                    key={event.id}
                    event={event}
                    attendanceCount={eventCounts.going}
                    feedbackScore={meta?.feedbackScore ?? null}
                    reviewStatus={meta?.reviewStatus ?? null}
                    feedbackFormEnabled={feedbackEnabled}
                    canManage={canManageEvents}
                    onReview={() => setReviewEvent(event)}
                    onFeedback={() => setFeedbackEvent(event)}
                  />
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "13px", color: "#444444" }}>
              Completed events are collapsed. Tap above to expand.
            </p>
          )}
        </section>
      ) : null}
        </div>

        <EventCalendarSidebar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          eventDateKeys={calendarEventDateKeys}
          selectedDay={selectedCalendarDay}
          onDayClick={handleCalendarDayClick}
          stats={calendarSidebarStats}
          fullWidth={isMobile}
        />
      </div>

      {rsvpModalEvent ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => !rsvpSubmitting && setRsvpModalEvent(null)}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2
              style={{
                fontWeight: 700,
                fontSize: "18px",
                color: "#ffffff",
                margin: "0 0 8px",
              }}
            >
              Sign up for {rsvpModalEvent.title}
            </h2>
            <p style={{ fontSize: "14px", color: "#777777", margin: "0 0 20px", lineHeight: 1.5 }}>
              Answer a few quick questions before confirming your spot.
            </p>

            {filterRsvpQuestionsForLoggedInUser(
              eventQuestionsMap[rsvpModalEvent.id] ?? [],
            ).map((q) => (
              <div key={q.id} style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#cccccc",
                    marginBottom: "6px",
                  }}
                >
                  {q.question}
                  {q.required ? (
                    <span style={{ color: "#E51937", marginLeft: "4px" }}>
                      *
                    </span>
                  ) : null}
                </label>
                {q.question_type === "text" ? (
                  <textarea
                    value={rsvpAnswers[q.id] ?? ""}
                    onChange={(e) =>
                      setRsvpAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                    rows={3}
                    style={{ ...darkInputStyle, width: "100%", resize: "vertical" }}
                  />
                ) : null}
                {q.question_type === "yes_no" ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <PillChoice
                      label="Yes"
                      selected={rsvpAnswers[q.id] === "Yes"}
                      onClick={() =>
                        setRsvpAnswers((prev) => ({ ...prev, [q.id]: "Yes" }))
                      }
                    />
                    <PillChoice
                      label="No"
                      selected={rsvpAnswers[q.id] === "No"}
                      onClick={() =>
                        setRsvpAnswers((prev) => ({ ...prev, [q.id]: "No" }))
                      }
                    />
                  </div>
                ) : null}
                {q.question_type === "multiple_choice" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(q.options ?? []).map((opt) => (
                      <PillChoice
                        key={opt}
                        label={opt}
                        selected={rsvpAnswers[q.id] === opt}
                        onClick={() =>
                          setRsvpAnswers((prev) => ({ ...prev, [q.id]: opt }))
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                marginTop: "20px",
              }}
            >
                    <button
                      type="button"
                disabled={rsvpSubmitting}
                onClick={() => setRsvpModalEvent(null)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
                    </button>
              <button
                type="button"
                disabled={rsvpSubmitting}
                onClick={() => void submitRsvpWithForm()}
                style={{
                  flex: 1,
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: rsvpSubmitting ? "not-allowed" : "pointer",
                  opacity: rsvpSubmitting ? 0.7 : 1,
                }}
              >
                {rsvpSubmitting ? "Submitting…" : "Confirm Sign Up"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {responsesModalEvent ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => setResponsesModalEvent(null)}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <button
              type="button"
              onClick={() => setResponsesModalEvent(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#888888",
                fontSize: "20px",
                cursor: "pointer",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h2
              style={{
                fontWeight: 700,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 32px 16px 0",
                paddingRight: "24px",
              }}
            >
              RSVP Responses — {responsesModalEvent.title}
            </h2>

            {responsesLoading ? (
              <p style={{ fontSize: "13px", color: "#555555" }}>Loading…</p>
            ) : responsesByUser.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#555555" }}>
                No responses yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {responsesByUser.map((respondent) => (
                  <div
                    key={respondent.userId}
                    style={{
                      borderTop: "1px solid #2a2a2a",
                      paddingTop: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      {respondent.avatarUrl ? (
                        <img
                          src={respondent.avatarUrl}
                                alt=""
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                              />
                            ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#242424",
                            color: "#E51937",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {respondent.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#ffffff",
                        }}
                      >
                        {respondent.fullName}
                            </span>
                          </div>
                    {respondent.answers.map((a) => (
                      <div key={`${respondent.userId}-${a.question}`} style={{ marginBottom: "8px" }}>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#888888",
                            margin: "0 0 2px",
                          }}
                        >
                          {a.question}
                        </p>
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#cccccc",
                            margin: 0,
                          }}
                        >
                          {a.answer || "—"}
                    </p>
                  </div>
                    ))}
                  </div>
            ))}
          </div>
            )}
          </div>
        </div>
      ) : null}

      {showTemplatePicker ? (
        <TemplatePickerModal
          type="event"
          clubName={club?.name ?? "your club"}
          clubCategory={club?.category}
          onClose={() => setShowTemplatePicker(false)}
          onSelect={(template) => {
            setShowTemplatePicker(false);
            setFormQuestions([]);
            setEditingId(null);
            setShowForm(true);
            if ("description" in template) {
              setTitle(template.title);
              setDescription(template.description);
            }
          }}
        />
      ) : null}

      {reviewEvent && clubId ? (
        <EventReviewModal
          event={reviewEvent}
          clubId={clubId}
          attendanceCount={counts[reviewEvent.id]?.going ?? 0}
          feedbackScore={completedEventMeta[reviewEvent.id]?.feedbackScore ?? null}
          feedbackCount={0}
          onClose={() => setReviewEvent(null)}
          onSaved={() => {
            const eventId = reviewEvent.id;
            void (async () => {
              const [{ data: review }, { data: feedback }] = await Promise.all([
                supabase
                  .from("event_reviews")
                  .select("event_id, review_status, feedback_form_enabled")
                  .eq("event_id", eventId)
                  .maybeSingle(),
                supabase
                  .from("event_feedback_responses")
                  .select("event_id, overall_rating, engagement_rating, organization_rating")
                  .eq("event_id", eventId),
              ]);
              const summary = summarizeFeedbackRows(
                (feedback ?? []) as Array<{
                  overall_rating: number;
                  engagement_rating: number;
                  organization_rating: number;
                }>,
              );
              setCompletedEventMeta((prev) => ({
                ...prev,
                [eventId]: {
                  reviewStatus:
                    (review?.review_status as EventReviewStatus | undefined) ?? null,
                  feedbackFormEnabled: Boolean(review?.feedback_form_enabled),
                  feedbackScore: summary.averageScore,
                },
              }));
            })();
          }}
        />
      ) : null}

      {feedbackEvent && clubId ? (
        <EventMemberFeedbackModal
          event={feedbackEvent}
          clubId={clubId}
          onClose={() => setFeedbackEvent(null)}
        />
      ) : null}
    </div>
  );
}
