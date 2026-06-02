import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { MoreHorizontal, Repeat } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import { supabase } from "../../lib/supabaseClient";
import type { ClubEvent, MemberRole, RsvpStatus } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";
import {
  DEFAULT_EVENT_CATEGORY,
  EVENT_CATEGORIES,
  eventCategoryLabel,
  normalizeEventCategory,
  type EventCategory,
} from "../../lib/eventCategories";

type EventVisibility = "public" | "members_only" | "featured";

function categoryBadgeStyle(category: string, featured = false): CSSProperties {
  const base: CSSProperties = {
    background: "#111111",
    border: "1px solid #222222",
    color: "#747676",
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    display: "inline-block",
    flexShrink: 0,
  };

  if (featured) {
    return {
      ...base,
      background: "#1a0a0a",
      borderColor: "#E51937",
      color: "#E51937",
    };
  }

  switch (category) {
    case "weekly_meeting":
      return { ...base, background: "#0a0a1a", borderColor: "#1a1a3a", color: "#6b7cff" };
    case "team_social":
      return { ...base, background: "#0a1a0a", borderColor: "#1a3a1a", color: "#4ade80" };
    case "conference":
    case "workshop":
      return { ...base, background: "#1a1500", borderColor: "#3a2f00", color: "#FFC429" };
    case "public_event":
      return base;
    default:
      return base;
  }
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

function EventCategoryBadge({
  category,
  featured = false,
}: {
  category: string;
  featured?: boolean;
}) {
  const label = featured ? "Featured" : eventCategoryLabel(category);
  return (
    <span style={categoryBadgeStyle(category, featured)}>
      {label}
    </span>
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
        background: "#1a1a2a",
        border: "1px solid #6b7cff",
        color: "#6b7cff",
        borderRadius: "20px",
        padding: "2px 10px",
        fontSize: "11px",
        flexShrink: 0,
      }}
    >
      <Repeat size={11} aria-hidden />
      Recurring
    </span>
  );
}

const VISIBILITY_OPTIONS: {
  value: EventVisibility;
  label: string;
  description: string;
  Icon: () => ReactNode;
}[] = [
  {
    value: "members_only",
    label: "Members Only",
    description: "Only visible to club members",
    Icon: LockIcon,
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone can attend, not shown on campus feed",
    Icon: GlobeIcon,
  },
  {
    value: "featured",
    label: "Featured on Campus",
    description: "Promoted on the home page for all students",
    Icon: StarIcon,
  },
];

function GlobeIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

const visibilityCardBase: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: "12px 16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
};

function visibilityCardSelected(base: CSSProperties): CSSProperties {
  return {
    ...base,
    border: "1px solid #E51937",
    background: "#1f0a0a",
  };
}

function VisibilitySelector({
  value,
  onChange,
}: {
  value: EventVisibility;
  onChange: (value: EventVisibility) => void;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#ffffff",
          marginBottom: 10,
        }}
      >
        Who can see this event?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {VISIBILITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={
              value === option.value
                ? visibilityCardSelected(visibilityCardBase)
                : visibilityCardBase
            }
          >
            <option.Icon />
            <span style={{ textAlign: "left" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                {option.label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#555555",
                  marginTop: 2,
                }}
              >
                {option.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Not Going" },
];

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
      className="flex shrink-0 flex-col items-center justify-center"
      style={{
        width: "52px",
        height: "52px",
        backgroundColor: muted ? "#333333" : "#E51937",
        borderRadius: "8px" }}
    >
      <span
        style={{
          fontSize: "9px",
          textTransform: "uppercase",
          color: "#ffffff",
          lineHeight: 1.1 }}
      >
        {monthLabel}
      </span>
      <span
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.1 }}
      >
        {dayLabel}
      </span>
    </div>
  );
}

function rsvpButtonStyle(value: RsvpStatus, active: boolean): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer" };
  if (!active) {
    return {
      ...base,
      backgroundColor: "#111111",
      color: "#444444",
      border: "1px solid #222222" };
  }
  if (value === "going") {
    return {
      ...base,
      backgroundColor: "#1a0505",
      color: "#E51937",
      border: "1px solid #E51937" };
  }
  if (value === "maybe") {
    return {
      ...base,
      backgroundColor: "#2a1f00",
      color: "#FFC429",
      border: "1px solid #FFC429" };
  }
  return {
    ...base,
    backgroundColor: "#1a1a1a",
    color: "#747676",
    border: "1px solid #555555" };
}

const eventCardStyle: CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "10px",
  padding: "20px",
  borderLeft: "3px solid #E51937" };

const sectionHeadingStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "15px",
  color: "#ffffff",
  marginBottom: "12px",
};

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

function EventCard({
  event,
  category,
  clubLogoUrl,
  clubAbbreviation,
  isRecurring,
  isPrivileged,
  past = false,
  myStatus,
  counts,
  copiedEventId,
  onRsvp,
  onStartEdit,
  onDelete,
  onCopyRsvpLink,
  onAddToCalendar,
  showViewAttendees,
  onToggleAttendees,
  attendeesList,
  onOpenResponses,
  hasFormResponses,
}: {
  event: ClubEvent;
  category: string;
  clubLogoUrl?: string;
  clubAbbreviation?: string;
  isRecurring: boolean;
  isPrivileged: boolean;
  past?: boolean;
  myStatus?: RsvpStatus;
  counts: { going: number; maybe: number; not_going: number };
  copiedEventId: string | null;
  onRsvp: (eventId: string, status: RsvpStatus) => void;
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
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timeLabel = formatEventTime(event.time);
  const locationLabel = cleanEventLocation(event.location);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      style={{
        ...eventCardStyle,
        ...(past ? { borderLeft: "3px solid #333333", opacity: 0.6 } : null),
      }}
    >
      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
        <EventDateBlock date={event.date} muted={past} />
        {clubLogoUrl ? (
          <img
            src={clubLogoUrl}
            alt=""
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              background: "#2a2a2a",
              color: "#888888",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {deriveInitialsFromAbbreviation(clubAbbreviation)}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
              {event.title}
            </h3>
            <EventCategoryBadge
              category={category}
              featured={event.visibility === "featured"}
            />
            {isRecurring ? <EventRecurringBadge /> : null}
          </div>

          {timeLabel || locationLabel ? (
            <p style={{ fontSize: "12px", color: "#555555", margin: "4px 0 0" }}>
              {[timeLabel, locationLabel].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          {event.description ? (
            <p
              style={{
                fontSize: "13px",
                color: "#777777",
                margin: "6px 0 0",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {event.description}
            </p>
          ) : null}

          <p style={{ fontSize: "12px", color: "#555555", margin: "8px 0 0" }}>
            {counts.going} going · {counts.maybe} maybe · {counts.not_going} not going
          </p>

          {!past ? (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
              {RSVP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onRsvp(event.id, opt.value)}
                  style={rsvpButtonStyle(opt.value, myStatus === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {attendeesList && isPrivileged ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-3">
              {attendeesList.length === 0 ? (
                <p className="text-xs text-muted">No RSVPs yet.</p>
              ) : (
                attendeesList.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    {a.avatarUrl ? (
                      <img
                        src={a.avatarUrl}
                        alt=""
                        className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(a.fullName ?? "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {a.fullName ?? "Unknown"}
                      </p>
                      {a.program ? <p className="truncate text-xs text-muted">{a.program}</p> : null}
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.status === "going"
                          ? "bg-green-500/10 text-green-400"
                          : a.status === "maybe"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-red-500/10 text-red-400"
                      }`}
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

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
          {isPrivileged && hovered ? (
            <div style={{ position: "relative" }}>
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
          {showViewAttendees && isPrivileged ? (
            <button
              type="button"
              onClick={() => onToggleAttendees(event.id)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "#E51937",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {attendeesList ? "Hide Attendees" : "View Attendees"}
            </button>
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

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
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
  const { events, loading, createEvent, updateEvent, deleteEvent, refresh } =
    useClubEvents(clubId);

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";
  const [clubBrand, setClubBrand] = useState<{
    logoUrl?: string;
    abbreviation?: string;
  }>({});

  useEffect(() => {
    const previewRole = localStorage.getItem("previewRole");
    if (previewRole) {
      setUserRole(previewRole as MemberRole);
      return;
    }
    const fetchRole = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (data?.role) {
        setUserRole(normalizeUserRole(data.role));
      }
    };
    fetchRole();
  }, [clubId, user?.id]);

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

  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { myRsvps, counts, attendees, setRsvp, removeRsvp, loadAttendees } =
    useEventRsvps(eventIds);
  const [expandedAttendees, setExpandedAttendees] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state for create / edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<EventVisibility>("public");
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
        console.error("Failed to clear form questions:", deleteError.message);
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
      visibility: EventVisibility;
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
    if (current.visibility === "members_only") {
      setVisibility("members_only");
    } else if (current.visibility === "featured") {
      setVisibility("featured");
    } else {
      setVisibility("public");
    }
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
    setSaving(true);
    setFeedback(null);

    const fields = {
      title: title.trim(),
      description: description.trim(),
      date,
      time: time || "TBD",
      location: location.trim() || "TBD",
      visibility,
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
      if (ok && categoryColumnReady) {
        const { data, error } = await supabase
          .from("events")
          .select("id")
          .eq("club_id", clubId!)
          .eq("title", fields.title)
          .eq("date", fields.date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data?.id) {
          ok = false;
        } else {
          savedEventId = data.id as string;
          ok = await saveEventCategory(savedEventId, category);
        }
      } else if (ok) {
        const { data } = await supabase
          .from("events")
          .select("id")
          .eq("club_id", clubId!)
          .eq("title", fields.title)
          .eq("date", fields.date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        savedEventId = (data?.id as string) ?? null;
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
      const questionsSaved = await saveEventQuestions(
        savedEventId,
        formQuestions,
      );
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
    const ok = await deleteEvent(eventId);
    if (ok) {
      setFeedback({ type: "success", text: "Event deleted." });
    } else {
      setFeedback({ type: "error", text: "Failed to delete event." });
    }
  }

  async function handleRsvp(eventId: string, status: RsvpStatus) {
    if (myRsvps[eventId] === status) {
      await removeRsvp(eventId);
      return;
    }

    if (status === "going") {
      const questions = eventQuestionsMap[eventId] ?? [];
      if (questions.length > 0) {
        const event = events.find((e) => e.id === eventId) ?? null;
        setRsvpModalEvent(event);
        setRsvpAnswers({});
        return;
      }
    }

    await setRsvp(eventId, status);
  }

  async function submitRsvpWithForm() {
    if (!rsvpModalEvent || !user?.id) return;

    const questions = eventQuestionsMap[rsvpModalEvent.id] ?? [];
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

    const ok = await setRsvp(rsvpModalEvent.id, "going");
    setRsvpSubmitting(false);

    if (ok) {
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
  const upcomingEvents = events
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastEvents = events
    .filter((e) => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading events…" />
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
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff" }}
          >
            Events
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#555555" }}
          >
            {upcomingEvents.length} upcoming event
            {upcomingEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isPrivileged && (
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

      {/* Feedback message */}
      {feedback && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Create / edit form — admin/exec only */}
      {showForm && isPrivileged && (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 font-semibold text-white">
            {editingId ? "Edit Event" : "Create New Event"}
          </h3>
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
            />
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
            <div className="flex justify-end gap-3 pt-2">
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || !date || saving}
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

      {/* Upcoming Events */}
      <h2 style={sectionHeadingStyle}>Upcoming</h2>
      {upcomingEvents.length === 0 ? (
        <div className="mb-8 py-12 text-center">
          <p style={{ fontSize: "14px", color: "#555555" }}>
            No upcoming events.
            {isPrivileged ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="cursor-pointer border-none bg-transparent p-0 underline-offset-2 hover:underline"
                  style={{ color: "#E51937", fontSize: "14px" }}
                >
                  Create your first event
                </button>
              </>
            ) : (
              " Check back soon!"
            )}
          </p>
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {upcomingEvents.map((event) => {
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
                isPrivileged={isPrivileged}
                myStatus={myStatus}
                counts={c}
                copiedEventId={copiedEventId}
                onRsvp={handleRsvp}
                onStartEdit={startEdit}
                onDelete={handleDelete}
                onCopyRsvpLink={copyRsvpLink}
                onAddToCalendar={downloadEventIcs}
                showViewAttendees={isPrivileged}
                onToggleAttendees={toggleAttendees}
                attendeesList={expandedAttendees === event.id ? attendees[event.id] : undefined}
                onOpenResponses={openResponsesModal}
                hasFormResponses={(eventQuestionsMap[event.id]?.length ?? 0) > 0}
              />
            );
          })}
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <>
          <h2 style={{ ...sectionHeadingStyle, color: "#555555" }}>Past Events</h2>
          <div className="space-y-3">
            {pastEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                category={getEventCategory(event.id)}
                clubLogoUrl={clubBrand.logoUrl}
                clubAbbreviation={clubBrand.abbreviation}
                isRecurring={isEventRecurring(event.id)}
                isPrivileged={isPrivileged}
                past
                counts={counts[event.id] ?? { going: 0, maybe: 0, not_going: 0 }}
                copiedEventId={copiedEventId}
                onRsvp={handleRsvp}
                onStartEdit={startEdit}
                onDelete={handleDelete}
                onCopyRsvpLink={copyRsvpLink}
                onAddToCalendar={downloadEventIcs}
                showViewAttendees={false}
                onToggleAttendees={toggleAttendees}
                onOpenResponses={openResponsesModal}
                hasFormResponses={false}
              />
            ))}
          </div>
        </>
      )}

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
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 4px",
              }}
            >
              {rsvpModalEvent.title}
            </h2>
            <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 20px" }}>
              RSVP to this event
            </p>

            {(eventQuestionsMap[rsvpModalEvent.id] ?? []).map((q) => (
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
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "8px",
              }}
            >
              <button
                type="button"
                disabled={rsvpSubmitting}
                onClick={() => setRsvpModalEvent(null)}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "10px 24px",
                  fontSize: "13px",
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
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "10px 24px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {rsvpSubmitting ? "Submitting…" : "Confirm RSVP"}
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
    </div>
  );
}
