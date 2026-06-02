import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronDown,
  Clock,
  LayoutGrid,
  List,
  MapPin,
  X,
} from "lucide-react";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import {
  EVENT_CATEGORIES,
  eventCategoryLabel,
  normalizeEventCategory,
} from "../lib/eventCategories";
import { useIsMobile } from "../hooks/useWindowWidth";
import Spinner from "../components/ui/Spinner";

type TimeFilter = "week" | "month" | "all" | "custom";
type ViewMode = "grid" | "grouped";

const EVENTS_VIEW_MODE_KEY = "events_view_mode";

interface PublicEventRow {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  clubId: string;
  clubName: string;
  clubCategory: string;
  clubLogoUrl: string | null;
  eventCategory: string;
  hasRsvp: boolean;
}

type PublicEventDisplay = PublicEventRow & {
  start_time: string;
  end_time?: string;
};

const CLUB_AVATAR_BACKGROUNDS = [
  "#1a0505",
  "#1a1500",
  "#0a0a1a",
  "#0a1a0a",
  "#1a0a1a",
] as const;

const CLUB_AVATAR_BORDERS: Record<(typeof CLUB_AVATAR_BACKGROUNDS)[number], string> =
  {
    "#1a0505": "#2a1515",
    "#1a1500": "#2a2510",
    "#0a0a1a": "#1a1a2a",
    "#0a1a0a": "#1a2a1a",
    "#1a0a1a": "#2a1a2a",
  };

function getClubAvatarColors(clubName: string): { bg: string; border: string } {
  const bgIndex = clubName.charCodeAt(0) % CLUB_AVATAR_BACKGROUNDS.length;
  const bg = CLUB_AVATAR_BACKGROUNDS[bgIndex];
  return { bg, border: CLUB_AVATAR_BORDERS[bg] };
}

function readViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(EVENTS_VIEW_MODE_KEY);
    if (stored === "grid" || stored === "grouped") return stored;
  } catch {
    /* localStorage unavailable */
  }
  return "grid";
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

function buildEventStartTime(date: string, time: string): string | null {
  const dateOnly = date?.trim();
  if (!dateOnly) return null;

  const noon = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(noon.getTime())) return null;

  const timeTrim = time?.trim();
  if (!timeTrim || timeTrim === "TBD") {
    return noon.toISOString();
  }

  const combined = new Date(`${dateOnly}T${timeTrim}`);
  if (!Number.isNaN(combined.getTime())) {
    return combined.toISOString();
  }

  const parsedTime = new Date(timeTrim);
  if (!Number.isNaN(parsedTime.getTime())) {
    return parsedTime.toISOString();
  }

  return noon.toISOString();
}

const formatTime = (timeStr: string) => {
  if (!timeStr) return "Time TBD";
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return "Time TBD";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

function formatEventDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthDay(dateStr: string): { month: string; day: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function formatTimeLocationLine(event: PublicEventDisplay): string {
  const timePart = formatTime(event.start_time);
  const endPart = event.end_time ? formatTime(event.end_time) : null;
  const timeLabel =
    endPart && endPart !== "Time TBD" && timePart !== "Time TBD"
      ? `${timePart} – ${endPart}`
      : timePart;

  const location = event.location?.trim();
  const locationLabel =
    location && location !== "TBD" ? location : null;

  return locationLabel ? `${timeLabel} · ${locationLabel}` : timeLabel;
}

function groupDateLabel(groupKey: string): string {
  const d = new Date(groupKey);
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = startOfDay(d);

  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";

  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

const fieldStyle: CSSProperties = {
  backgroundColor: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "0 14px",
  color: "#ffffff",
  fontSize: "14px",
  height: "44px",
  boxSizing: "border-box",
  outline: "none",
  width: "100%",
};

const selectStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  color: "#cccccc",
  borderRadius: "8px",
  padding: "10px 36px 10px 16px",
  fontSize: "13px",
  appearance: "none",
  cursor: "pointer",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#555555",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "6px",
  display: "block",
};

const eventGridStyle = (isMobile: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
  gap: "16px",
});

function StyledSelect({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...selectStyle,
          borderColor: focused ? "#E51937" : "#2a2a2a",
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "#555555",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        background: "#1a1a1a",
        border: "1px solid #242424",
        borderRadius: "8px",
        padding: "4px",
      }}
    >
      {(
        [
          { mode: "grid" as const, icon: LayoutGrid, label: "Grid view" },
          { mode: "grouped" as const, icon: List, label: "Grouped view" },
        ] as const
      ).map(({ mode, icon: Icon, label }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(mode)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: active ? "#E51937" : "transparent",
              color: active ? "#ffffff" : "#555555",
            }}
          >
            <Icon size={16} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function ClubAvatar({
  clubName,
  logoUrl,
  size,
}: {
  clubName: string;
  logoUrl: string | null;
  size: number;
}) {
  const { bg, border } = getClubAvatarColors(clubName);
  const initials = clubName.charAt(0).toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "8px",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "8px",
        background: bg,
        border: `1px solid ${border}`,
        fontSize: size >= 40 ? "14px" : "12px",
        fontWeight: 700,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function EventDetailModal({
  event,
  user,
  onClose,
  onSignUp,
}: {
  event: PublicEventDisplay;
  user: { id: string } | null;
  onClose: () => void;
  onSignUp: (eventId: string) => void;
}) {
  const location = event.location?.trim();
  const locationLabel =
    location && location !== "TBD" ? location : "Location TBD";
  const description = event.description?.trim();

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111111",
          border: "1px solid #242424",
          borderRadius: "16px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#555555",
            padding: "4px",
            display: "flex",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#555555";
          }}
        >
          <X size={20} aria-hidden />
        </button>

        <div style={{ padding: "28px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ClubAvatar
              clubName={event.clubName}
              logoUrl={event.clubLogoUrl}
              size={44}
            />
            <span style={{ fontSize: "13px", color: "#777777" }}>
              {event.clubName}
            </span>
          </div>

          <h2
            id="event-modal-title"
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#ffffff",
              marginTop: "12px",
              marginBottom: 0,
            }}
          >
            {event.title}
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#1a1a1a",
                border: "1px solid #242424",
                color: "#cccccc",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
              }}
            >
              <Calendar size={12} aria-hidden />
              {formatEventDateLong(event.date)}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#1a1a1a",
                border: "1px solid #242424",
                color: "#cccccc",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
              }}
            >
              <Clock size={12} aria-hidden />
              {formatTime(event.start_time)}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#1a1a1a",
                border: "1px solid #242424",
                color: "#cccccc",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
              }}
            >
              <MapPin size={12} aria-hidden />
              {locationLabel}
            </span>
          </div>
        </div>

        <div
          style={{
            height: "1px",
            background: "#1e1e1e",
            margin: "20px 0",
          }}
        />

        <div style={{ padding: "0 28px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#555555",
              letterSpacing: "0.08em",
              marginBottom: "10px",
              marginTop: 0,
            }}
          >
            ABOUT THIS EVENT
          </p>
          <p
            style={{
              fontSize: "14px",
              color: description ? "#cccccc" : "#444444",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {description || "No description provided."}
          </p>
        </div>

        <div
          style={{
            padding: "24px 28px 28px",
            borderTop: "1px solid #1e1e1e",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => onSignUp(event.id)}
            style={{
              width: "100%",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "14px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {user ? "Sign Up for this Event" : "Sign In to RSVP"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicEventCard({
  event,
  onViewDetails,
  onSignUp,
}: {
  event: PublicEventDisplay;
  onViewDetails: (event: PublicEventDisplay) => void;
  onSignUp: (eventId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { month, day } = formatMonthDay(event.date);
  const descriptionPreview = event.description?.trim();

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#1a1a1a",
        border: `1px solid ${hovered ? "#333333" : "#242424"}`,
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.15s ease",
        transform: hovered ? "translateY(-2px)" : undefined,
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.3)" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div
          style={{
            background: "#E51937",
            borderRadius: "8px",
            width: "52px",
            minWidth: "52px",
            height: "60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.8)",
              textTransform: "uppercase",
            }}
          >
            {month}
          </span>
          <span
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            {day}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minWidth: 0,
            flex: 1,
          }}
        >
          <ClubAvatar
            clubName={event.clubName}
            logoUrl={event.clubLogoUrl}
            size={40}
          />
          <span
            style={{
              fontSize: "13px",
              color: "#ffffff",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.clubName}
          </span>
        </div>
      </div>

      <h2
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "#ffffff",
          marginTop: "10px",
          marginBottom: 0,
        }}
      >
        {event.title}
      </h2>

      <p
        style={{
          fontSize: "12px",
          color: "#555555",
          marginTop: "4px",
          marginBottom: 0,
        }}
      >
        {formatTimeLocationLine(event)}
      </p>

      {descriptionPreview ? (
        <p
          style={{
            fontSize: "12px",
            color: "#777777",
            marginTop: "8px",
            marginBottom: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.6,
          }}
        >
          {descriptionPreview}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button
          type="button"
          onClick={() => onViewDetails(event)}
          style={{
            background: "transparent",
            border: "1px solid #333333",
            color: "#cccccc",
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          View Details
        </button>
        <button
          type="button"
          onClick={() => onSignUp(event.id)}
          style={{
            background: "#E51937",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Sign Up
        </button>
      </div>
    </article>
  );
}

function EventCardsGrid({
  events,
  isMobile,
  onViewDetails,
  onSignUp,
}: {
  events: PublicEventDisplay[];
  isMobile: boolean;
  onViewDetails: (event: PublicEventDisplay) => void;
  onSignUp: (eventId: string) => void;
}) {
  return (
    <div style={eventGridStyle(isMobile)}>
      {events.map((ev) => (
        <PublicEventCard
          key={ev.id}
          event={ev}
          onViewDetails={onViewDetails}
          onSignUp={onSignUp}
        />
      ))}
    </div>
  );
}

export default function PublicEventsPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const isMobile = useIsMobile();

  const [events, setEvents] = useState<PublicEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<PublicEventDisplay | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [clubCategoryFilter, setClubCategoryFilter] = useState("all");
  const [eventCategoryFilter, setEventCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());

  useEffect(() => {
    try {
      localStorage.setItem(EVENTS_VIEW_MODE_KEY, viewMode);
    } catch {
      /* localStorage unavailable */
    }
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const todayStr = toDateKey(new Date());

      const { error: categoryProbeError } = await supabase
        .from("events")
        .select("category")
        .limit(1);
      const hasEventCategoryColumn = !categoryProbeError;

      const { data, error } = hasEventCategoryColumn
        ? await supabase
            .from("events")
            .select(`
            id,
            club_id,
            title,
            description,
            date,
            time,
            location,
            visibility,
            category,
            clubs:club_id (
              name,
              logo_url,
              slug,
              category
            )
          `)
            .in("visibility", ["public", "featured"])
            .gte("date", todayStr)
            .order("date", { ascending: true })
        : await supabase
            .from("events")
            .select(`
            id,
            club_id,
            title,
            description,
            date,
            time,
            location,
            visibility,
            clubs:club_id (
              name,
              logo_url,
              slug,
              category
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
        const record = row as Record<string, unknown>;
        const clubRaw = record.clubs as unknown;
        const club = (
          Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
        ) as Record<string, unknown>;

        return {
          id: record.id as string,
          title: (record.title as string) ?? "",
          description: ((record.description as string) ?? "").trim(),
          date: (record.date as string) ?? "",
          time: (record.time as string) ?? "",
          location: (record.location as string) ?? "",
          clubId: record.club_id as string,
          clubName: (club.name as string) ?? "Club",
          clubCategory: ((club.category as string) ?? "").trim(),
          clubLogoUrl: (club.logo_url as string) ?? null,
          eventCategory: normalizeEventCategory(
            hasEventCategoryColumn
              ? (record.category as string | undefined)
              : undefined,
          ),
          hasRsvp: rsvpSet.has(record.id as string),
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

  const eventsWithStartTime = useMemo((): PublicEventDisplay[] => {
    const result: PublicEventDisplay[] = [];

    for (const ev of events) {
      const start_time = buildEventStartTime(ev.date, ev.time);
      if (!start_time) continue;
      if (Number.isNaN(new Date(start_time).getTime())) continue;
      result.push({ ...ev, start_time });
    }

    return result;
  }, [events]);

  const clubCategories = useMemo(() => {
    const set = new Set<string>();
    for (const ev of eventsWithStartTime) {
      if (ev.clubCategory) set.add(ev.clubCategory);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [eventsWithStartTime]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    timeFilter !== "all" ||
    clubCategoryFilter !== "all" ||
    eventCategoryFilter !== "all";

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = endOfWeek(today);
    const monthEnd = endOfMonth(today);
    const q = search.trim().toLowerCase();

    return eventsWithStartTime.filter((ev) => {
      const eventDate = new Date(ev.start_time);
      if (Number.isNaN(eventDate.getTime())) return false;

      if (timeFilter === "week") {
        if (eventDate < today || eventDate > weekEnd) return false;
      } else if (timeFilter === "month") {
        if (eventDate < today || eventDate > monthEnd) return false;
      } else if (timeFilter === "custom") {
        if (customDateFrom && ev.date < customDateFrom) return false;
        if (customDateTo && ev.date > customDateTo) return false;
      }

      if (
        clubCategoryFilter !== "all" &&
        ev.clubCategory !== clubCategoryFilter
      ) {
        return false;
      }

      if (
        eventCategoryFilter !== "all" &&
        ev.eventCategory !== eventCategoryFilter
      ) {
        return false;
      }

      if (!q) return true;
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.clubName.toLowerCase().includes(q) ||
        ev.clubCategory.toLowerCase().includes(q) ||
        eventCategoryLabel(ev.eventCategory).toLowerCase().includes(q)
      );
    });
  }, [
    eventsWithStartTime,
    search,
    timeFilter,
    customDateFrom,
    customDateTo,
    clubCategoryFilter,
    eventCategoryFilter,
  ]);

  const groupedEvents = useMemo(() => {
    return filtered.reduce(
      (groups, event) => {
        const date = new Date(event.start_time);
        const key = date.toDateString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(event);
        return groups;
      },
      {} as Record<string, PublicEventDisplay[]>,
    );
  }, [filtered]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedEvents).sort(
      (a, b) =>
        new Date(groupedEvents[a][0].start_time).getTime() -
        new Date(groupedEvents[b][0].start_time).getTime(),
    );
  }, [groupedEvents]);

  function clearFilters() {
    setSearch("");
    setTimeFilter("all");
    setCustomDateFrom("");
    setCustomDateTo("");
    setClubCategoryFilter("all");
    setEventCategoryFilter("all");
  }

  function handleSignUp(eventId: string) {
    const target = `/events/${eventId}/rsvp`;
    if (user) {
      navigate(target);
      return;
    }
    navigate(`/login?redirect=${encodeURIComponent(target)}`);
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
          Campus <span style={{ color: "#E51937" }}>Events</span>
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#555555",
            marginTop: "12px",
            marginBottom: 0,
          }}
        >
          Upcoming events open to all students — filter by club, event type, or
          date
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
            placeholder="Search by event, club, or category…"
            aria-label="Search events"
            style={{
              ...fieldStyle,
              height: "52px",
              padding: "0 20px",
              fontSize: "15px",
            }}
          />
        </div>
      </header>

      <div
        style={{
          padding: `0 ${horizontalPad} 20px`,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          maxWidth: isMobile ? undefined : "900px",
        }}
      >
        <div>
          <label htmlFor="club-category-filter" style={labelStyle}>
            Club type
          </label>
          <StyledSelect
            id="club-category-filter"
            value={clubCategoryFilter}
            onChange={setClubCategoryFilter}
          >
            <option value="all">All club types</option>
            {clubCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div>
          <label htmlFor="event-category-filter" style={labelStyle}>
            Event type
          </label>
          <StyledSelect
            id="event-category-filter"
            value={eventCategoryFilter}
            onChange={setEventCategoryFilter}
          >
            <option value="all">All event types</option>
            {EVENT_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </StyledSelect>
        </div>
        {hasActiveFilters ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={clearFilters}
              style={{
                ...selectStyle,
                height: "44px",
                background: "transparent",
                color: "#E51937",
                fontWeight: 600,
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          padding: `0 ${horizontalPad} 16px`,
          alignItems: "center",
        }}
      >
        {(
          [
            { value: "week" as const, label: "This week" },
            { value: "month" as const, label: "This month" },
            { value: "all" as const, label: "All upcoming" },
            { value: "custom" as const, label: "Custom dates" },
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

      {timeFilter === "custom" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 220px))",
            gap: "12px",
            padding: `0 ${horizontalPad} 24px`,
          }}
        >
          <div>
            <label htmlFor="events-from-date" style={labelStyle}>
              From
            </label>
            <input
              id="events-from-date"
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div>
            <label htmlFor="events-to-date" style={labelStyle}>
              To
            </label>
            <input
              id="events-to-date"
              type="date"
              value={customDateTo}
              min={customDateFrom || undefined}
              onChange={(e) => setCustomDateTo(e.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>
      ) : (
        <div style={{ paddingBottom: "12px" }} />
      )}

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
            {events.length === 0
              ? "No upcoming public events right now. Check back soon."
              : "No events match your filters. Try adjusting club type, event type, or dates."}
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "20px",
                flexWrap: "wrap",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  color: "#555555",
                  margin: 0,
                }}
              >
                {filtered.length} upcoming event
                {filtered.length === 1 ? "" : "s"}
              </p>
              <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            </div>

            {viewMode === "grid" ? (
              <EventCardsGrid
                events={filtered}
                isMobile={isMobile}
                onViewDetails={setSelectedEvent}
                onSignUp={handleSignUp}
              />
            ) : (
              <div>
                {sortedGroupKeys.map((groupKey, index) => (
                  <section key={groupKey}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "16px",
                        marginTop: index === 0 ? 0 : "24px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#ffffff",
                        }}
                      >
                        {groupDateLabel(groupKey)}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: "1px",
                          background: "#1e1e1e",
                        }}
                      />
                    </div>
                    <EventCardsGrid
                      events={groupedEvents[groupKey]}
                      isMobile={isMobile}
                      onViewDetails={setSelectedEvent}
                      onSignUp={handleSignUp}
                    />
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedEvent ? (
        <EventDetailModal
          event={selectedEvent}
          user={user}
          onClose={() => setSelectedEvent(null)}
          onSignUp={(eventId) => {
            setSelectedEvent(null);
            handleSignUp(eventId);
          }}
        />
      ) : null}
    </div>
  );
}
