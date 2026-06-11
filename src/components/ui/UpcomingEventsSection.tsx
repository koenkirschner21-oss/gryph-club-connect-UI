import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { normalizeVisibility } from "../../lib/contentVisibility";
import type { Visibility } from "../../types";

type ViewMode = "list" | "calendar";

type CampusEvent = {
  id: string;
  clubId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  visibility: Visibility;
  clubName: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekStartSunday(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function formatListDateHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatMonthDay(dateStr: string): { month: string; day: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString("en-US", opts)} – ${weekEnd.toLocaleDateString("en-US", opts)}`;
}

function formatEventTime(time: string): string {
  if (!time || time === "TBD") return "Time TBD";
  return time;
}

const toggleBtn = (active: boolean): CSSProperties => ({
  background: active ? "#E51937" : "#1a1a1a",
  color: active ? "#ffffff" : "#777777",
  border: active ? "none" : "1px solid #333333",
  borderRadius: 6,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});

export default function UpcomingEventsSection() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStartSunday(new Date()));

  const todayKey = toDateKey(new Date());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const today = startOfDay(new Date());
      const thirtyDaysFromNow = addDays(today, 30);
      const todayStr = toDateKey(today);
      const endDate = toDateKey(thirtyDaysFromNow);

      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          club_id,
          title,
          description,
          date,
          time,
          location,
          created_at,
          visibility,
          clubs:club_id (
            name
          )
        `)
        .gte("date", todayStr)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load campus events:", error.message);
        setEvents([]);
        setLoading(false);
        return;
      }

      const filtered: CampusEvent[] = (data ?? [])
        .map((row) => {
          const clubRaw = row.clubs as unknown;
          const club = (
            Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
          ) as Record<string, unknown>;
          const rawVisibility = row.visibility as string;
          const visibility = normalizeVisibility(rawVisibility, "public");

          return {
            id: row.id as string,
            clubId: row.club_id as string,
            title: (row.title as string) ?? "",
            date: (row.date as string) ?? "",
            time: (row.time as string) ?? "",
            location: (row.location as string) ?? "",
            visibility,
            clubName: (club.name as string) ?? "Club",
          } satisfies CampusEvent;
        })
        .filter((ev) => ev.visibility === "public");

      setEvents(filtered);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const eventsByDate = useMemo(() => {
    const groups = new Map<string, CampusEvent[]>();
    for (const ev of events) {
      const list = groups.get(ev.date) ?? [];
      list.push(ev);
      groups.set(ev.date, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const eventsByWeekDay = useMemo(() => {
    const map = new Map<string, CampusEvent[]>();
    for (const day of weekDays) {
      map.set(toDateKey(day), []);
    }
    for (const ev of events) {
      const key = ev.date;
      if (map.has(key)) {
        map.get(key)!.push(ev);
      }
    }
    return map;
  }, [events, weekDays]);

  return (
    <section>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h2
            style={{
              fontWeight: 700,
              fontSize: 22,
              color: "#ffffff",
              margin: 0,
            }}
          >
            Upcoming Events Across Campus
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#555555",
              marginTop: 8,
              marginBottom: 0,
            }}
          >
            Discover what&apos;s happening week by week
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={toggleBtn(viewMode === "list")}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
          <button
            type="button"
            style={toggleBtn(viewMode === "calendar")}
            onClick={() => setViewMode("calendar")}
          >
            Calendar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "#1a1a1a",
                borderRadius: 10,
                height: 72,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p style={{ textAlign: "center", color: "#555555", margin: "32px 0" }}>
          No featured campus events right now. Check back soon.
        </p>
      ) : viewMode === "list" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {eventsByDate.map(([dateKey, dayEvents]) => (
            <div key={dateKey}>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#555555",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: "0 0 12px",
                }}
              >
                {formatListDateHeader(dateKey)}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  color: "#ccc",
                  borderRadius: 6,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                }}
                aria-label="Previous week"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  color: "#ccc",
                  borderRadius: 6,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                }}
                aria-label="Next week"
              >
                ›
              </button>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>
              {formatWeekLabel(weekStart)}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {weekDays.map((day) => {
              const key = toDateKey(day);
              const isToday = key === todayKey;
              const dayEvents = eventsByWeekDay.get(key) ?? [];
              const dayLabel = day
                .toLocaleDateString("en-US", { weekday: "short" })
                .toUpperCase()
                .slice(0, 3);

              return (
                <div key={key}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#555555",
                      textTransform: "uppercase",
                      marginBottom: 6,
                      textAlign: "center",
                    }}
                  >
                    {dayLabel}
                  </div>
                  <div
                    style={{
                      background: "#1a1a1a",
                      border: `1px solid ${isToday ? "#E51937" : "#242424"}`,
                      borderRadius: 8,
                      minHeight: 80,
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: isToday ? "#E51937" : "#777",
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.map((ev) => (
                      <span
                        key={ev.id}
                        title={ev.title}
                        style={{
                          background: "#E51937",
                          color: "#ffffff",
                          fontSize: 10,
                          borderRadius: 4,
                          padding: "2px 6px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {ev.title}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function EventCard({ event }: { event: CampusEvent }) {
  const { month, day } = formatMonthDay(event.date);

  return (
    <Link
      to={`/events/${event.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
    <article
      style={{
        background: "#1a1a1a",
        border: "1px solid #242424",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        transition: "border-color 0.15s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#333333";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#242424";
      }}
    >
      <div
        style={{
          background: "#E51937",
          borderRadius: 6,
          width: 40,
          height: 40,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: "#ffffff",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {month}
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {day}
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              color: "#E51937",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {event.clubName}
          </span>
          <span
            style={{
              background: "#2a1500",
              color: "#FFC429",
              border: "1px solid #3a2500",
              borderRadius: "20px",
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            Featured
          </span>
        </div>
        <h4
          style={{
            fontSize: 14,
            color: "#ffffff",
            fontWeight: 500,
            margin: "0 0 4px",
          }}
        >
          {event.title}
        </h4>
        <p style={{ fontSize: 12, color: "#555555", margin: 0 }}>
          {formatEventTime(event.time)}
          {(() => {
            const location = event.location?.trim();
            if (!location || location === "TBD") return null;
            return ` · ${location}`;
          })()}
        </p>
      </div>
    </article>
    </Link>
  );
}
