import { useState, type CSSProperties } from "react";
import { CheckCircle, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import type { Visibility } from "../../types";
import { normalizeVisibility } from "../../lib/contentVisibility";
import { getClubEventPath } from "../../lib/deepLinks";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const SECONDARY = "#999999";
const MUTED = "#888888";

export type PlannerDayMeta = {
  hasEvents: boolean;
  hasTasks: boolean;
  itemCount: number;
  taskTitles?: string[];
  eventTitles?: string[];
};

function dayPreviewLines(meta?: PlannerDayMeta): string[] {
  if (!meta || meta.itemCount === 0) return [];
  const lines: string[] = [];
  const tasks = meta.taskTitles ?? [];
  const events = meta.eventTitles ?? [];
  if (tasks.length > 0) {
    const shown = tasks.slice(0, 2).join(", ");
    lines.push(
      `Task${tasks.length === 1 ? "" : "s"}: ${shown}${tasks.length > 2 ? "…" : ""}`,
    );
  }
  if (events.length > 0) {
    const shown = events.slice(0, 2).join(", ");
    lines.push(
      `Event${events.length === 1 ? "" : "s"}: ${shown}${events.length > 2 ? "…" : ""}`,
    );
  }
  if (lines.length === 0) {
    lines.push(`${meta.itemCount} item${meta.itemCount === 1 ? "" : "s"}`);
  }
  return lines;
}

function DayMarkerDots({
  hasTasks,
  hasEvents,
}: {
  hasTasks?: boolean;
  hasEvents?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "3px",
        minHeight: "8px",
        marginTop: "3px",
      }}
    >
      {hasTasks ? (
        <span
          style={{
            width: "6px",
            height: "6px",
            background: GOLD,
            borderRadius: "50%",
          }}
          aria-hidden
        />
      ) : null}
      {hasEvents ? (
        <span
          style={{
            width: "6px",
            height: "6px",
            background: ACCENT_RED,
            borderRadius: "50%",
          }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

function dayCellSurface(
  isToday: boolean,
  isSelected: boolean,
  isHovered: boolean,
): { background: string; border: string } {
  if (isSelected) {
    return {
      background: isToday ? "rgba(255, 196, 41, 0.14)" : "rgba(255, 196, 41, 0.12)",
      border: `2px solid ${GOLD}`,
    };
  }
  if (isToday) {
    return {
      background: "rgba(229, 25, 55, 0.08)",
      border: `2px solid ${ACCENT_RED}`,
    };
  }
  return {
    background: isHovered ? "#1a1a1a" : "transparent",
    border: "2px solid transparent",
  };
}

export function CalendarMarkerLegend() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        marginBottom: "14px",
        flexWrap: "wrap",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: SECONDARY }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: GOLD }} aria-hidden />
        Task
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: SECONDARY }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: ACCENT_RED }} aria-hidden />
        Event
      </span>
    </div>
  );
}

export type WeekCalendarDay = {
  dateKey: string;
  label: string;
  dayNum: number;
};

export type MonthCalendarDay = {
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
};

export type CalendarViewMode = "month" | "week";

const CALENDAR_WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function MonthWeekToggle({
  value,
  onChange,
}: {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}) {
  const pillBase: CSSProperties = {
    padding: "6px 14px",
    fontSize: "13px",
    fontWeight: 500,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.15s ease, color 0.15s ease",
  };

  return (
    <div
      style={{
        display: "inline-flex",
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "8px",
        padding: "3px",
        marginBottom: "12px",
      }}
    >
      {(["month", "week"] as const).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            style={{
              ...pillBase,
              background: active ? "rgba(255, 196, 41, 0.15)" : "transparent",
              color: active ? GOLD : MUTED,
            }}
          >
            {mode === "month" ? "Month" : "Week"}
          </button>
        );
      })}
    </div>
  );
}

export function MonthCalendarGrid({
  monthLabel,
  monthDays,
  todayKey,
  selectedDayKey,
  dayMeta,
  onPrevMonth,
  onNextMonth,
  onDayClick,
}: {
  monthLabel: string;
  monthDays: MonthCalendarDay[];
  todayKey: string;
  selectedDayKey: string | null;
  dayMeta: Map<string, PlannerDayMeta>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (dateKey: string) => void;
}) {
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const arrowStyle = (hovered: boolean): CSSProperties => ({
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    padding: "6px 10px",
    color: hovered ? "#ffffff" : MUTED,
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: 1,
    flexShrink: 0,
    transition: "color 0.15s ease",
  });

  const previewLines = hoveredDay ? dayPreviewLines(dayMeta.get(hoveredDay)) : [];

  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
          gap: "8px",
        }}
      >
        <button
          type="button"
          aria-label="Previous month"
          onClick={onPrevMonth}
          onMouseEnter={() => setPrevHovered(true)}
          onMouseLeave={() => setPrevHovered(false)}
          style={arrowStyle(prevHovered)}
        >
          ‹
        </button>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            flex: 1,
          }}
        >
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={onNextMonth}
          onMouseEnter={() => setNextHovered(true)}
          onMouseLeave={() => setNextHovered(false)}
          style={arrowStyle(nextHovered)}
        >
          ›
        </button>
      </div>

      <CalendarMarkerLegend />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "2px",
          marginBottom: "2px",
        }}
      >
        {CALENDAR_WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: MUTED,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "2px 0",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "2px",
          position: "relative",
        }}
      >
        {monthDays.map((day) => {
          const meta = dayMeta.get(day.dateKey);
          const isToday = day.dateKey === todayKey;
          const isSelected = selectedDayKey === day.dateKey;
          const isHovered = hoveredDay === day.dateKey;
          const { background, border } = dayCellSurface(isToday, isSelected, isHovered);
          const preview = dayPreviewLines(meta);

          return (
            <button
              key={day.dateKey}
              type="button"
              title={preview.length > 0 ? preview.join(" · ") : undefined}
              onClick={() => onDayClick(day.dateKey)}
              onMouseEnter={() => setHoveredDay(day.dateKey)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                padding: "6px 2px 4px",
                width: "100%",
                textAlign: "center",
                cursor: "pointer",
                background,
                border,
                borderRadius: "8px",
                minWidth: 0,
                minHeight: "46px",
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: isSelected || isToday ? 700 : 500,
                  color: day.inCurrentMonth ? "#ffffff" : "#555555",
                  lineHeight: 1.2,
                }}
              >
                {day.dayNum}
              </div>
              {isToday ? (
                <div
                  style={{
                    fontSize: "8px",
                    fontWeight: 700,
                    color: isSelected ? GOLD : ACCENT_RED,
                    letterSpacing: "0.04em",
                    marginTop: "1px",
                    lineHeight: 1.1,
                  }}
                >
                  Today
                </div>
              ) : null}
              <DayMarkerDots hasTasks={meta?.hasTasks} hasEvents={meta?.hasEvents} />
            </button>
          );
        })}
      </div>

      {previewLines.length > 0 ? (
        <div
          style={{
            marginTop: "8px",
            padding: "8px 12px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            fontSize: "12px",
            color: SECONDARY,
            lineHeight: 1.45,
          }}
        >
          {previewLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WeekCalendarStrip({
  weekDays,
  todayKey,
  selectedDayKey,
  dayMeta,
  onPrevWeek,
  onNextWeek,
  onDayClick,
}: {
  weekDays: WeekCalendarDay[];
  todayKey: string;
  selectedDayKey: string | null;
  dayMeta: Map<string, PlannerDayMeta>;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onDayClick: (dateKey: string) => void;
}) {
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const arrowStyle = (hovered: boolean): CSSProperties => ({
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    padding: "6px 10px",
    color: hovered ? "#ffffff" : MUTED,
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: 1,
    flexShrink: 0,
    transition: "color 0.15s ease",
  });

  const previewLines = hoveredDay ? dayPreviewLines(dayMeta.get(hoveredDay)) : [];

  return (
    <div style={{ marginBottom: "16px" }}>
      <CalendarMarkerLegend />
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          width: "100%",
          gap: "6px",
        }}
      >
        <button
          type="button"
          aria-label="Previous week"
          onClick={onPrevWeek}
          onMouseEnter={() => setPrevHovered(true)}
          onMouseLeave={() => setPrevHovered(false)}
          style={arrowStyle(prevHovered)}
        >
          ‹
        </button>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: "2px",
            minWidth: 0,
          }}
        >
          {weekDays.map((day) => {
            const meta = dayMeta.get(day.dateKey);
            const isToday = day.dateKey === todayKey;
            const isSelected = selectedDayKey === day.dateKey;
            const isHovered = hoveredDay === day.dateKey;
            const { background, border } = dayCellSurface(isToday, isSelected, isHovered);
            const preview = dayPreviewLines(meta);

            return (
              <button
                key={day.dateKey}
                type="button"
                title={preview.length > 0 ? preview.join(" · ") : undefined}
                onClick={() => onDayClick(day.dateKey)}
                onMouseEnter={() => setHoveredDay(day.dateKey)}
                onMouseLeave={() => setHoveredDay(null)}
                style={{
                  padding: "8px 2px 6px",
                  width: "100%",
                  textAlign: "center",
                  cursor: "pointer",
                  background,
                  border,
                  borderRadius: "8px",
                  minWidth: 0,
                  minHeight: "72px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    lineHeight: 1.2,
                  }}
                >
                  {day.label.slice(0, 3)}
                </div>
                {isToday ? (
                  <div
                    style={{
                      fontSize: "8px",
                      fontWeight: 700,
                      color: isSelected ? GOLD : ACCENT_RED,
                      letterSpacing: "0.04em",
                      marginTop: "2px",
                      lineHeight: 1.1,
                    }}
                  >
                    Today
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: "17px",
                    fontWeight: isSelected || isToday ? 700 : 600,
                    color: "#ffffff",
                    lineHeight: 1.2,
                    marginTop: isToday ? "2px" : "4px",
                  }}
                >
                  {day.dayNum}
                </div>
                <DayMarkerDots hasTasks={meta?.hasTasks} hasEvents={meta?.hasEvents} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Next week"
          onClick={onNextWeek}
          onMouseEnter={() => setNextHovered(true)}
          onMouseLeave={() => setNextHovered(false)}
          style={arrowStyle(nextHovered)}
        >
          ›
        </button>
      </div>

      {previewLines.length > 0 ? (
        <div
          style={{
            marginTop: "8px",
            padding: "8px 12px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            fontSize: "12px",
            color: SECONDARY,
            lineHeight: 1.45,
          }}
        >
          {previewLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TasksWeekEmptyState({
  onViewAllTasks,
  message = "No tasks due this week.",
}: {
  onViewAllTasks?: () => void;
  message?: string;
}) {
  const sparkles = [
    { top: "8px", left: "12px", fontSize: "10px" },
    { top: "4px", right: "16px", fontSize: "12px" },
    { bottom: "10px", left: "20px", fontSize: "9px" },
    { bottom: "6px", right: "10px", fontSize: "11px" },
  ];

  return (
    <div
      style={{
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
        padding: "32px 24px",
        textAlign: "center",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "64px",
          height: "64px",
          margin: "0 auto 16px",
        }}
      >
        {sparkles.map((sparkle, index) => (
          <span
            key={index}
            aria-hidden
            style={{
              position: "absolute",
              color: GOLD,
              ...sparkle,
            }}
          >
            ✦
          </span>
        ))}
        <div
          style={{
            width: "64px",
            height: "64px",
            border: "2px dashed #333333",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle size={28} color={GOLD} aria-hidden />
        </div>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
        You&apos;re all caught up!
      </p>
      <p style={{ margin: 0, fontSize: "13px", color: "#888888" }}>{message}</p>
      {onViewAllTasks ? (
        <button
          type="button"
          onClick={onViewAllTasks}
          style={{
            marginTop: "16px",
            color: "#E51937",
            fontSize: "13px",
            fontWeight: 500,
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          View All Tasks →
        </button>
      ) : null}
    </div>
  );
}

function eventVisibilityLabel(visibility?: Visibility | string | null): string {
  const level = normalizeVisibility(visibility, "public");
  if (level === "members_only") return "Members Only";
  if (level === "executives_only") return "Executives Only";
  return "Open to all students";
}

function formatWeekEventTime(timeStr: string): string | null {
  const t = timeStr.trim();
  if (!t || t.toUpperCase() === "TBD") return null;

  const ampmMatch = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    return `${parseInt(ampmMatch[1], 10)}:${ampmMatch[2]} ${ampmMatch[3].toUpperCase()}`;
  }

  const m24 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    let hour = parseInt(m24[1], 10);
    const minute = m24[2];
    const period = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${period}`;
  }

  return t;
}

function parseEventDate(dateStr: string): { month: string; day: string } | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function EventDateBlock({ date }: { date: string }) {
  const parsed = parseEventDate(date);
  return (
    <div
      style={{
        backgroundColor: ACCENT_RED,
        borderRadius: "8px",
        width: "48px",
        height: "48px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {parsed ? (
        <>
          <span style={{ fontSize: "9px", color: "#ffffff", letterSpacing: "0.08em" }}>
            {parsed.month}
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>
            {parsed.day}
          </span>
        </>
      ) : (
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#ffffff" }}>TBD</span>
      )}
    </div>
  );
}

export function WeekClubLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string;
}) {
  const abbr = name
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

export function ThisWeekEventCard({
  event,
  logoUrl,
}: {
  event: {
    id: string;
    clubId: string;
    title: string;
    clubName: string;
    dateKey: string;
    time: string;
    location: string;
    visibility?: Visibility | string | null;
  };
  logoUrl?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const timeLabel = formatWeekEventTime(event.time);
  const locationLabel = event.location?.trim();
  const showLocation = Boolean(locationLabel && locationLabel.toUpperCase() !== "TBD");

  return (
    <Link
      to={getClubEventPath(event.clubId, event.id)}
      className="block"
      style={{ textDecoration: "none", cursor: "pointer" }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          background: "#1a1a1a",
          border: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderRadius: "10px",
          padding: "12px 14px",
          marginBottom: "8px",
          transition: "border-color 0.15s ease, transform 0.15s ease",
          transform: hovered ? "translateY(-1px)" : undefined,
        }}
      >
        <EventDateBlock date={event.dateKey} />
        <WeekClubLogo name={event.clubName} logoUrl={logoUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: "0 0 2px",
              fontSize: "14px",
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
              margin: "0 0 4px",
              fontSize: "12px",
              color: SECONDARY,
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
                margin: "0 0 2px",
                fontSize: "12px",
                color: MUTED,
                display: "flex",
                alignItems: "center",
                gap: "4px",
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
                color: MUTED,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <MapPin size={12} aria-hidden />
              {locationLabel}
            </p>
          ) : null}
        </div>
        <span
          style={{
            flexShrink: 0,
            alignSelf: "flex-start",
            fontSize: "11px",
            color: SECONDARY,
            border: "1px solid #333333",
            borderRadius: "12px",
            padding: "3px 8px",
            background: "transparent",
            whiteSpace: "nowrap",
          }}
        >
          {eventVisibilityLabel(event.visibility)}
        </span>
      </div>
    </Link>
  );
}
