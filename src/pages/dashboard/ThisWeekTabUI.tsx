import { useState, type CSSProperties } from "react";
import { CheckCircle, Clock, MapPin, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import type { Visibility } from "../../types";
import { normalizeVisibility } from "../../lib/contentVisibility";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";

export type WeekCalendarDay = {
  dateKey: string;
  label: string;
  dayNum: number;
};

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
  dayMeta: Map<string, { hasEvents: boolean; hasTasks: boolean; itemCount: number }>;
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
    padding: "8px 12px",
    color: hovered ? "#ffffff" : "#777777",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: 1,
    flexShrink: 0,
    transition: "color 0.15s ease",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        marginBottom: "24px",
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
          display: "flex",
          gap: "8px",
          flex: 1,
          overflowX: "auto",
          minWidth: 0,
        }}
      >
        {weekDays.map((day) => {
          const meta = dayMeta.get(day.dateKey);
          const isToday = day.dateKey === todayKey;
          const isSelected = selectedDayKey === day.dateKey;
          const hasDot = meta?.hasEvents || meta?.hasTasks;
          const isHovered = hoveredDay === day.dateKey;

          let background = isHovered ? "#1a1a1a" : "transparent";
          let border = "2px solid transparent";

          if (isToday) {
            background = "rgba(229, 25, 55, 0.08)";
            border = `2px solid ${ACCENT_RED}`;
          }
          if (isSelected) {
            background = "rgba(229, 25, 55, 0.12)";
            border = `2px solid ${ACCENT_RED}`;
          }

          return (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => onDayClick(day.dateKey)}
              onMouseEnter={() => setHoveredDay(day.dateKey)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                padding: "12px 8px",
                minWidth: "80px",
                textAlign: "center",
                cursor: "pointer",
                background,
                border,
                borderRadius: "8px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#555555",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  lineHeight: 1.2,
                }}
              >
                {day.label.slice(0, 3)}
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.2,
                  marginTop: "4px",
                }}
              >
                {day.dayNum}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  minHeight: "10px",
                  marginTop: "6px",
                }}
              >
                {hasDot ? (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      background: ACCENT_RED,
                      borderRadius: "50%",
                    }}
                  />
                ) : null}
              </div>
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
  );
}

export function TasksWeekEmptyState() {
  const sparkles = [
    { top: "8px", left: "12px", fontSize: "10px" },
    { top: "4px", right: "16px", fontSize: "12px" },
    { bottom: "10px", left: "20px", fontSize: "9px" },
    { bottom: "6px", right: "10px", fontSize: "11px" },
  ];

  return (
    <div
      style={{
        paddingTop: "32px",
        paddingBottom: "32px",
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
      <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>No tasks due this week.</p>
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

function WeekEventClubLogo({
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
      to={`/app/clubs/${event.clubId}/events`}
      className="block"
      style={{ textDecoration: "none", cursor: "pointer" }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
          background: "#1a1a1a",
          border: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderRadius: "10px",
          padding: "16px 20px",
          marginBottom: "10px",
          transition: "border-color 0.15s ease, transform 0.15s ease",
          transform: hovered ? "translateY(-1px)" : undefined,
        }}
      >
        <EventDateBlock date={event.dateKey} />
        <WeekEventClubLogo name={event.clubName} logoUrl={logoUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: "0 0 4px",
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
              margin: "0 0 6px",
              fontSize: "12px",
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
                color: "#555555",
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
                color: "#555555",
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
            fontSize: "11px",
            color: "#777777",
            border: "1px solid #333333",
            borderRadius: "12px",
            padding: "4px 10px",
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

export function WeekAchievementCard({
  displayName,
  completedCount,
  totalCount,
}: {
  displayName: string;
  completedCount: number;
  totalCount: number;
}) {
  const percent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div
      style={{
        marginTop: "24px",
        background: "linear-gradient(135deg, #1a1200 0%, #141414 100%)",
        border: "1px solid #3a2a00",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "rgba(255, 196, 41, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Trophy size={32} color={GOLD} aria-hidden />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
          Keep it up, {displayName}!
        </p>
        <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#999999" }}>
          You&apos;ve completed {completedCount} task{completedCount === 1 ? "" : "s"} this month.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              flex: 1,
              height: "6px",
              background: "#2a2a2a",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${percent}%`,
                background: GOLD,
                borderRadius: "3px",
              }}
            />
          </div>
          <span style={{ fontSize: "12px", color: GOLD, flexShrink: 0 }}>{percent}%</span>
        </div>
      </div>
    </div>
  );
}
