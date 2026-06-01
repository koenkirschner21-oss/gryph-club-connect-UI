import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useWindowWidth";
import Spinner from "../components/ui/Spinner";

type TimeFilter = "week" | "month" | "all";

interface PublicEventRow {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  clubId: string;
  clubName: string;
  clubLogoUrl: string | null;
  hasRsvp: boolean;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (6 - day));
  return x;
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatMonthDay(dateStr: string): { month: string; day: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function formatEventTime(time: string): string {
  if (!time || time === "TBD") return "Time TBD";
  return time;
}

const pillStyle = (active: boolean) => ({
  background: active ? "#E51937" : "#1a1a1a",
  border: active ? "none" : "1px solid #2a2a2a",
  color: active ? "#ffffff" : "#777777",
  borderRadius: "6px",
  padding: "7px 18px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
});

export default function PublicEventsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [events, setEvents] = useState<PublicEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const todayStr = toDateKey(new Date());

      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          club_id,
          title,
          date,
          time,
          location,
          visibility,
          clubs:club_id (
            name,
            logo_url,
            slug
          )
        `)
        .in("visibility", ["public", "featured"])
        .gte("date", todayStr)
        .order("date", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load public events:", error.message);
        setEvents([]);
        setLoading(false);
        return;
      }

      const eventIds = (data ?? []).map((r) => r.id as string);
      const rsvpSet = new Set<string>();

      if (eventIds.length > 0) {
        const { data: formRows } = await supabase
          .from("event_form_questions")
          .select("event_id")
          .in("event_id", eventIds);

        for (const row of formRows ?? []) {
          rsvpSet.add(row.event_id as string);
        }
      }

      const rows: PublicEventRow[] = (data ?? []).map((row) => {
        const clubRaw = row.clubs as unknown;
        const club = (
          Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
        ) as Record<string, unknown>;

        return {
          id: row.id as string,
          title: (row.title as string) ?? "",
          date: (row.date as string) ?? "",
          time: (row.time as string) ?? "",
          location: (row.location as string) ?? "",
          clubId: row.club_id as string,
          clubName: (club.name as string) ?? "Club",
          clubLogoUrl: (club.logo_url as string) ?? null,
          hasRsvp: rsvpSet.has(row.id as string),
        };
      });

      setEvents(rows);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = endOfWeek(today);
    const monthEnd = endOfMonth(today);
    const q = search.trim().toLowerCase();

    return events.filter((ev) => {
      const eventDate = new Date(`${ev.date}T12:00:00`);
      if (timeFilter === "week") {
        if (eventDate < today || eventDate > weekEnd) return false;
      } else if (timeFilter === "month") {
        if (eventDate < today || eventDate > monthEnd) return false;
      }

      if (!q) return true;
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.clubName.toLowerCase().includes(q)
      );
    });
  }, [events, search, timeFilter]);

  function handleRsvpClick(eventId: string) {
    const target = `/events/${eventId}/rsvp`;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }
    navigate(target);
  }

  const horizontalPad = isMobile ? "16px" : "48px";

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh" }}>
      <header
        style={{
          padding: isMobile ? "40px 16px 24px" : "60px 48px 32px",
        }}
      >
        <h1
          style={{
            fontSize: isMobile ? "28px" : "36px",
            fontWeight: 800,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          Upcoming <span style={{ color: "#E51937" }}>Events</span>
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#555555",
            marginTop: "12px",
            marginBottom: 0,
          }}
        >
          See what&apos;s happening across University of Guelph clubs
        </p>
        <div
          style={{
            marginTop: "24px",
            maxWidth: isMobile ? "100%" : "500px",
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event or club name…"
            aria-label="Search events"
            style={{
              backgroundColor: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "10px",
              padding: "0 20px",
              color: "#ffffff",
              fontSize: "15px",
              width: "100%",
              height: "52px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          padding: `0 ${horizontalPad} 28px`,
        }}
      >
        {(
          [
            { value: "week" as const, label: "This Week" },
            { value: "month" as const, label: "This Month" },
            { value: "all" as const, label: "All Upcoming" },
          ] as const
        ).map((pill) => (
          <button
            key={pill.value}
            type="button"
            onClick={() => setTimeFilter(pill.value)}
            style={pillStyle(timeFilter === pill.value)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div style={{ padding: `0 ${horizontalPad} 60px` }}>
        {loading ? (
          <Spinner label="Loading events…" />
        ) : filtered.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#555555",
              margin: "48px 0",
              fontSize: "15px",
            }}
          >
            No upcoming public events right now. Check back soon.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "16px",
            }}
          >
            {filtered.map((ev) => {
              const { month, day } = formatMonthDay(ev.date);
              const location = ev.location?.trim();
              const locationLabel =
                location && location !== "TBD" ? location : null;

              return (
                <article
                  key={ev.id}
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #242424",
                    borderRadius: "12px",
                    padding: "20px",
                    display: "grid",
                    gridTemplateRows: "auto auto",
                    gap: "16px",
                  }}
                >
                  <Link
                    to={`/events/${ev.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "16px",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        background: "#E51937",
                        borderRadius: "8px",
                        width: "52px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "8px 0",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          color: "rgba(255,255,255,0.8)",
                        }}
                      >
                        {month}
                      </span>
                      <span
                        style={{
                          fontSize: "22px",
                          fontWeight: 800,
                          color: "#ffffff",
                          lineHeight: 1.1,
                        }}
                      >
                        {day}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {ev.clubLogoUrl ? (
                          <img
                            src={ev.clubLogoUrl}
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
                              fontSize: "11px",
                              color: "#777",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                            }}
                          >
                            {ev.clubName.charAt(0)}
                          </div>
                        )}
                        <span style={{ fontSize: "12px", color: "#777777" }}>
                          {ev.clubName}
                        </span>
                      </div>
                      <h2
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#ffffff",
                          margin: "6px 0 0",
                        }}
                      >
                        {ev.title}
                      </h2>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#555555",
                          margin: "4px 0 0",
                        }}
                      >
                        {formatEventTime(ev.time)}
                        {locationLabel ? ` · ${locationLabel}` : ""}
                      </p>
                    </div>
                  </Link>
                  {ev.hasRsvp ? (
                    <button
                      type="button"
                      onClick={() => handleRsvpClick(ev.id)}
                      style={{
                        justifySelf: "start",
                        background: "#E51937",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 16px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      RSVP
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
