import { useMemo, useRef, useState, useEffect } from "react";
import { Clock, MapPin, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardEvent } from "../../hooks/useDashboardEvents";
import type { EventRsvp, RsvpStatus } from "../../types";

export type DeduplicatedDashboardEvent = DashboardEvent & {
  moreDatesCount: number;
};

export type EventsByDateGroup = {
  date: string;
  events: DeduplicatedDashboardEvent[];
};

function parseEventDay(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isToday(dateStr: string): boolean {
  const eventDay = parseEventDay(dateStr);
  if (!eventDay) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(eventDay);
  compare.setHours(0, 0, 0, 0);
  return compare.getTime() === today.getTime();
}

function isTomorrow(dateStr: string): boolean {
  const eventDay = parseEventDay(dateStr);
  if (!eventDay) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const compare = new Date(eventDay);
  compare.setHours(0, 0, 0, 0);
  return compare.getTime() === tomorrow.getTime();
}

function timelineDotColor(dateStr: string): string {
  if (isToday(dateStr)) return "#E51937";
  if (isTomorrow(dateStr)) return "#FFC429";
  return "#555555";
}

export function formatEventsTimelineGroupLabel(dateStr: string): string {
  const eventDay = parseEventDay(dateStr);
  if (!eventDay) return dateStr.toUpperCase();

  if (isToday(dateStr)) return "TODAY";
  if (isTomorrow(dateStr)) return "TOMORROW";

  return eventDay
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function formatEventsMonthHeader(dateStr: string): string {
  const eventDay = parseEventDay(dateStr);
  if (!eventDay) return dateStr;
  return eventDay.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function eventsMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function formatTimelineDateBox(dateStr: string): {
  weekday: string;
  day: string;
  month: string;
} | null {
  const eventDay = parseEventDay(dateStr);
  if (!eventDay) return null;

  return {
    weekday: eventDay
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase()
      .slice(0, 3),
    day: String(eventDay.getDate()),
    month: eventDay
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase()
      .slice(0, 3),
  };
}

function formatEventTime12h(timeStr: string): string | null {
  const t = timeStr.trim();
  if (!t || t.toUpperCase() === "TBD") return null;

  const ampmMatch = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2];
    if (hour >= 1 && hour <= 12) {
      return `${hour}:${minute} ${ampmMatch[3].toUpperCase()}`;
    }
  }

  const m24 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    let hour = parseInt(m24[1], 10);
    const minute = m24[2];
    if (hour <= 23) {
      const period = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${minute} ${period}`;
    }
  }

  return t;
}

function hasEventLocation(location: string | null | undefined): boolean {
  const trimmed = location?.trim();
  return !!trimmed && trimmed.toUpperCase() !== "TBD";
}

type EventStatusDisplay = "going" | "maybe" | "not_going" | "rsvp" | "open";

function resolveEventStatusDisplay(rsvpStatus?: RsvpStatus | string): EventStatusDisplay {
  if (rsvpStatus === "going") return "going";
  if (rsvpStatus === "maybe") return "maybe";
  if (rsvpStatus === "not_going") return "not_going";
  if (!rsvpStatus) return "rsvp";
  return "open";
}

function EventStatusButton({ display }: { display: EventStatusDisplay }) {
  const base = {
    flexShrink: 0,
    borderRadius: "6px",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
  };

  if (display === "going") {
    return (
      <span
        style={{
          ...base,
          background: "#FFC429",
          color: "#0f0f0f",
          border: "none",
        }}
      >
        Going
      </span>
    );
  }

  if (display === "maybe") {
    return (
      <span
        style={{
          ...base,
          background: "transparent",
          border: "1px solid #FFC429",
          color: "#FFC429",
        }}
      >
        Maybe
      </span>
    );
  }

  if (display === "not_going") {
    return (
      <span
        style={{
          ...base,
          background: "transparent",
          border: "1px solid #555555",
          color: "#777777",
          fontWeight: 500,
        }}
      >
        Not Going
      </span>
    );
  }

  if (display === "rsvp") {
    return (
      <span
        style={{
          ...base,
          background: "transparent",
          border: "1px solid #E51937",
          color: "#E51937",
          fontWeight: 600,
        }}
      >
        RSVP
      </span>
    );
  }

  return (
    <span
      style={{
        ...base,
        background: "transparent",
        border: "1px solid #555555",
        color: "#999999",
        fontWeight: 500,
      }}
    >
      Open
    </span>
  );
}

function EventClubLogo({
  name,
  abbreviation,
  logoUrl,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
}) {
  const abbr =
    abbreviation?.trim() ||
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          border: "1px solid #2a2a2a",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "8px",
        border: "1px solid #2a2a2a",
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
      {abbr}
    </div>
  );
}

function EventAttendeeAvatarStack({ attendees }: { attendees: EventRsvp[] }) {
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

function TimelineDateBox({ dateStr }: { dateStr: string }) {
  const parsed = formatTimelineDateBox(dateStr);

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "8px",
        padding: "8px",
        textAlign: "center",
        width: "64px",
        boxSizing: "border-box",
      }}
    >
      {parsed ? (
        <>
          <div style={{ fontSize: "10px", color: "#777777", letterSpacing: "0.05em" }}>
            {parsed.weekday}
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              margin: "2px 0",
            }}
          >
            {parsed.day}
          </div>
          <div style={{ fontSize: "11px", color: "#777777" }}>{parsed.month}</div>
        </>
      ) : (
        <div style={{ fontSize: "10px", color: "#777777" }}>TBD</div>
      )}
    </div>
  );
}

function EventRsvpMenu({
  eventId,
  currentStatus,
  onSetRsvp,
  onRemoveRsvp,
}: {
  eventId: string;
  currentStatus?: RsvpStatus | string;
  onSetRsvp: (eventId: string, status: RsvpStatus) => Promise<boolean>;
  onRemoveRsvp: (eventId: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleAction(
    action: () => Promise<boolean>,
  ): Promise<void> {
    setBusy(true);
    await action();
    setBusy(false);
    setOpen(false);
  }

  const itemStyle = {
    display: "block",
    width: "100%",
    textAlign: "left" as const,
    background: "transparent",
    border: "none",
    color: "#cccccc",
    fontSize: "13px",
    padding: "8px 12px",
    cursor: busy ? "wait" : "pointer",
  };

  return (
    <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Event RSVP actions"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: "transparent",
          border: "none",
          color: "#555555",
          cursor: busy ? "wait" : "pointer",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MoreVertical size={18} aria-hidden />
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: "4px",
            minWidth: "160px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "4px 0",
            zIndex: 20,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {(["going", "maybe", "not_going"] as RsvpStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              disabled={busy || currentStatus === status}
              onClick={() =>
                void handleAction(() => onSetRsvp(eventId, status))
              }
              style={{
                ...itemStyle,
                color: currentStatus === status ? "#FFC429" : "#cccccc",
                fontWeight: currentStatus === status ? 600 : 400,
              }}
            >
              {status === "going"
                ? "Going"
                : status === "maybe"
                  ? "Maybe"
                  : "Not Going"}
            </button>
          ))}
          {currentStatus ? (
            <>
              <div style={{ height: "1px", background: "#2a2a2a", margin: "4px 0" }} />
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAction(() => onRemoveRsvp(eventId))}
                style={{ ...itemStyle, color: "#E51937" }}
              >
                Cancel RSVP
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EventsTabEventRow({
  event,
  rsvpStatus,
  logoUrl,
  attendees,
  onSetRsvp,
  onRemoveRsvp,
}: {
  event: DeduplicatedDashboardEvent;
  rsvpStatus?: RsvpStatus | string;
  logoUrl?: string;
  attendees?: EventRsvp[];
  onSetRsvp?: (eventId: string, status: RsvpStatus) => Promise<boolean>;
  onRemoveRsvp?: (eventId: string) => Promise<boolean>;
}) {
  const timeLabel = event.time ? formatEventTime12h(event.time) : null;
  const showLocation = hasEventLocation(event.location);
  const statusDisplay = resolveEventStatusDisplay(rsvpStatus);
  const attendeeList = attendees ?? [];

  return (
    <div
      style={{
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "8px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}
    >
      <Link
        to={`/events/${event.id}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flex: 1,
          minWidth: 0,
          textDecoration: "none",
        }}
      >
        <EventClubLogo
          name={event.clubName}
          abbreviation={event.clubAbbreviation}
          logoUrl={logoUrl}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "#ffffff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </p>
          <p
            style={{
              margin: "4px 0 8px",
              fontSize: "13px",
              color: "#777777",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.clubName}
          </p>
          {timeLabel ? (
            <p
              style={{
                margin: "0 0 4px",
                fontSize: "12px",
                color: "#777777",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Clock size={12} aria-hidden />
              {timeLabel}
            </p>
          ) : null}
          {showLocation ? (
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#777777",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <MapPin size={12} aria-hidden />
              {event.location.trim()}
            </p>
          ) : null}
        </div>
      </Link>

      {attendeeList.length > 0 ? (
        <EventAttendeeAvatarStack attendees={attendeeList} />
      ) : null}

      <EventStatusButton display={statusDisplay} />

      {onSetRsvp && onRemoveRsvp ? (
        <EventRsvpMenu
          eventId={event.id}
          currentStatus={rsvpStatus}
          onSetRsvp={onSetRsvp}
          onRemoveRsvp={onRemoveRsvp}
        />
      ) : (
        <button
          type="button"
          aria-label="Event actions"
          style={{
            background: "transparent",
            border: "none",
            color: "#555555",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MoreVertical size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function EventsTabHeader({
  eventCount,
  clubCount,
}: {
  eventCount: number;
  clubCount: number;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>
        Events this week
      </h2>
      <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#777777" }}>
        {eventCount} event{eventCount === 1 ? "" : "s"} · {clubCount} club
        {clubCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function EventsTabTimeline({
  groups,
  myRsvps,
  clubLogos,
  eventAttendees,
  onSetRsvp,
  onRemoveRsvp,
}: {
  groups: EventsByDateGroup[];
  myRsvps: Record<string, RsvpStatus | string>;
  clubLogos: Record<string, string>;
  eventAttendees?: Record<string, EventRsvp[]>;
  onSetRsvp?: (eventId: string, status: RsvpStatus) => Promise<boolean>;
  onRemoveRsvp?: (eventId: string) => Promise<boolean>;
}) {
  const spansMultipleMonths = useMemo(() => {
    const monthKeys = new Set(groups.map((group) => eventsMonthKey(group.date)));
    return monthKeys.size > 1;
  }, [groups]);

  return (
    <div>
      {groups.map((group, groupIndex) => {
        const isLast = groupIndex === groups.length - 1;
        const previousMonth =
          groupIndex > 0 ? eventsMonthKey(groups[groupIndex - 1].date) : null;
        const currentMonth = eventsMonthKey(group.date);
        const showMonthHeader =
          spansMultipleMonths && currentMonth !== previousMonth;

        return (
          <div key={group.date}>
            {showMonthHeader ? (
              <p
                style={{
                  margin: groupIndex === 0 ? "0 0 14px" : "20px 0 14px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#aaaaaa",
                }}
              >
                {formatEventsMonthHeader(group.date)}
              </p>
            ) : null}
            <div
              style={{
                display: "flex",
                gap: "16px",
                marginBottom: isLast ? 0 : "4px",
              }}
            >
            <div
              style={{
                width: "70px",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: timelineDotColor(group.date),
                  marginBottom: "8px",
                  flexShrink: 0,
                }}
              />
              <TimelineDateBox dateStr={group.date} />
              {!isLast ? (
                <div
                  style={{
                    flex: 1,
                    width: 0,
                    borderLeft: "1px dashed #2a2a2a",
                    marginTop: "8px",
                    minHeight: "24px",
                  }}
                />
              ) : null}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : "16px" }}>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#555555",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {formatEventsTimelineGroupLabel(group.date)}
              </p>

              {group.events.map((event) => (
                <EventsTabEventRow
                  key={`${event.id}-${event.date}`}
                  event={event}
                  rsvpStatus={myRsvps[event.id]}
                  logoUrl={event.clubId ? clubLogos[event.clubId] : undefined}
                  attendees={eventAttendees?.[event.id]}
                  onSetRsvp={onSetRsvp}
                  onRemoveRsvp={onRemoveRsvp}
                />
              ))}
            </div>
          </div>
          </div>
        );
      })}
    </div>
  );
}

export function useEventsTabSummary(events: DeduplicatedDashboardEvent[]) {
  return useMemo(() => {
    const clubCount = new Set(events.map((event) => event.clubId)).size;
    return { eventCount: events.length, clubCount };
  }, [events]);
}
