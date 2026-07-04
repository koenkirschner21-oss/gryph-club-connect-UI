import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  LayoutGrid,
  List,
  MapPin,
  X,
} from "lucide-react";
import { useAuthContext } from "../context/useAuthContext";
import { useEventRsvps } from "../hooks/useEventRsvps";
import { supabase } from "../lib/supabaseClient";
import {
  EVENT_CATEGORIES,
  eventCategoryLabel,
  normalizeEventCategory,
} from "../lib/eventCategories";
import { useIsMobile } from "../hooks/useWindowWidth";
import Spinner from "../components/ui/Spinner";
import { clubCategoryFilterOptions } from "../lib/clubCategories";
import { eventRequiresRsvpQuestionnaire } from "../lib/eventRsvpActions";
import type { RsvpStatus } from "../types";

type TimeFilter = "week" | "month" | "all" | "custom";
type ViewMode = "grid" | "grouped";
type EventsPageView = "home" | "week" | "month";

const EVENTS_VIEW_MODE_KEY = "events_view_mode";

interface PublicEventRow {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  clubId: string;
  clubSlug: string;
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

function rollingWeekEnd(from: Date): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatWeekRangeLabel(): string {
  const now = new Date();
  const weekEnd = rollingWeekEnd(now);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${now.toLocaleDateString("en-US", opts)} – ${weekEnd.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function formatMonthLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

const smallPillStyle = (active: boolean) => ({
  background: active ? "#E51937" : "transparent",
  border: active ? "none" : "1px solid #333333",
  color: active ? "#ffffff" : "#777777",
  borderRadius: "6px",
  padding: "6px 16px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
});

const fieldStyle: CSSProperties = {
  backgroundColor: "#111111",
  border: "1px solid #242424",
  borderRadius: "8px",
  padding: "0 14px",
  color: "#ffffff",
  fontSize: "14px",
  height: "44px",
  boxSizing: "border-box",
  outline: "none",
  width: "100%",
};

const selectStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #242424",
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
  letterSpacing: "0.05em",
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

const EVENT_CARD_DESC_FONT_SIZE = 12;
const EVENT_CARD_DESC_LINE_HEIGHT = 1.6;
const EVENT_CARD_DESC_MAX_LINES = 2;

function computeEventCardDescriptionPreview(
  description: string,
  widthPx: number,
  fontFamily: string,
): { preview: string | null } {
  if (!description || widthPx <= 0) return { preview: null };

  const measurer = document.createElement("p");
  measurer.style.cssText = [
    "position:absolute",
    "top:0",
    "left:0",
    "visibility:hidden",
    "pointer-events:none",
    "margin:0",
    "padding:0",
    "border:0",
    `width:${Math.floor(widthPx)}px`,
    `font-family:${fontFamily}`,
    `font-size:${EVENT_CARD_DESC_FONT_SIZE}px`,
    `line-height:${EVENT_CARD_DESC_LINE_HEIGHT}`,
    "white-space:normal",
    "word-break:break-word",
  ].join(";");
  document.body.appendChild(measurer);

  const maxHeight =
    EVENT_CARD_DESC_FONT_SIZE * EVENT_CARD_DESC_LINE_HEIGHT * EVENT_CARD_DESC_MAX_LINES;

  const fits = (text: string) => {
    measurer.textContent = text;
    return measurer.scrollHeight <= maxHeight + 1;
  };

  try {
    if (!fits(description)) {
      let low = 0;
      let high = description.length;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const slice = description.slice(0, mid).trimEnd();
        const candidate = `${slice}…`;
        if (fits(candidate)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best > 0) {
        let trimmed = description.slice(0, best).trimEnd();
        const lastSpace = trimmed.lastIndexOf(" ");
        if (lastSpace > trimmed.length * 0.55) {
          trimmed = trimmed.slice(0, lastSpace);
        }
        return { preview: `${trimmed}…` };
      }
    }

    return { preview: null };
  } finally {
    document.body.removeChild(measurer);
  }
}

const PAGE_BG = "#0f0f0f";

function PublicEventSignUpButton({
  status,
  hovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  status?: RsvpStatus;
  hovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const baseStyle: CSSProperties = {
    borderRadius: "6px",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  if (status === "going") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: "#FFC429",
          color: "#000000",
          border: "none",
          borderRadius: "20px",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        Going
        <Check size={14} aria-hidden />
      </button>
    );
  }

  if (status === "maybe") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: "transparent",
          border: "1px solid #FFC429",
          color: "#FFC429",
          borderRadius: "20px",
        }}
      >
        Registered
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        ...baseStyle,
        background: hovered ? "#E51937" : "transparent",
        color: hovered ? "#ffffff" : "#E51937",
        border: "1px solid #E51937",
      }}
    >
      Sign Up
    </button>
  );
}

function EventDetailModal({
  event,
  user,
  myRsvpStatus,
  onClose,
  onSignUp,
}: {
  event: PublicEventDisplay;
  user: { id: string } | null;
  myRsvpStatus?: RsvpStatus;
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
              background:
                myRsvpStatus === "going"
                  ? "#FFC429"
                  : myRsvpStatus === "maybe"
                    ? "transparent"
                    : "#E51937",
              color:
                myRsvpStatus === "going"
                  ? "#000000"
                  : myRsvpStatus === "maybe"
                    ? "#FFC429"
                    : "#ffffff",
              border:
                myRsvpStatus === "maybe" ? "1px solid #FFC429" : "none",
              borderRadius:
                myRsvpStatus === "going" || myRsvpStatus === "maybe"
                  ? "999px"
                  : "8px",
              padding: "14px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {!user
              ? "Sign In to Sign Up"
              : myRsvpStatus === "going"
                ? "Going ✓"
                : myRsvpStatus === "maybe"
                  ? "Registered"
                  : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicEventCard({
  event,
  myRsvpStatus,
  onViewDetails,
  onSignUp,
}: {
  event: PublicEventDisplay;
  myRsvpStatus?: RsvpStatus;
  onViewDetails: (event: PublicEventDisplay) => void;
  onSignUp: (eventId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [signUpHovered, setSignUpHovered] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const [descriptionPreview, setDescriptionPreview] = useState<string | null>(null);
  const { month, day } = formatMonthDay(event.date);
  const description = event.description?.trim();

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !description) {
      setDescriptionPreview(null);
      return;
    }

    const updatePreview = () => {
      const width = card.clientWidth - 32;
      if (width <= 0) return;

      const fontFamily = window.getComputedStyle(card).fontFamily;
      const { preview } = computeEventCardDescriptionPreview(
        description,
        width,
        fontFamily,
      );
      setDescriptionPreview(preview);
    };

    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(card);
    return () => observer.disconnect();
  }, [description]);

  return (
    <article
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#1a1a1a",
        border: `1px solid ${hovered ? "#333333" : "#242424"}`,
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.15s ease",
        minWidth: 0,
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
            height: "56px",
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              minWidth: 0,
              minHeight: "56px",
            }}
          >
            <ClubAvatar
              clubName={event.clubName}
              logoUrl={event.clubLogoUrl}
              size={40}
            />
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: 0,
                lineHeight: 1.25,
                minWidth: 0,
              }}
            >
              {event.title}
            </h2>
          </div>
        </div>
      </div>

      <p
        style={{
          fontSize: "12px",
          color: "#555555",
          textAlign: "left",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          margin: "8px 0 0",
        }}
      >
        {formatTimeLocationLine(event)}
      </p>

      <p
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#888888",
          marginTop: "4px",
          marginBottom: 0,
          textAlign: "left",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.clubName}
      </p>

      {description ? (
        <div style={{ marginTop: "8px", minWidth: 0 }}>
          <p
            style={{
              fontSize: `${EVENT_CARD_DESC_FONT_SIZE}px`,
              color: "#777777",
              margin: 0,
              lineHeight: EVENT_CARD_DESC_LINE_HEIGHT,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: EVENT_CARD_DESC_MAX_LINES,
              WebkitBoxOrient: "vertical",
            }}
          >
            {descriptionPreview ?? description}
          </p>
        </div>
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
        <PublicEventSignUpButton
          status={myRsvpStatus}
          hovered={signUpHovered}
          onClick={() => onSignUp(event.id)}
          onMouseEnter={() => setSignUpHovered(true)}
          onMouseLeave={() => setSignUpHovered(false)}
        />
      </div>
    </article>
  );
}

function EventCardsGrid({
  events,
  isMobile,
  myRsvps,
  onViewDetails,
  onSignUp,
}: {
  events: PublicEventDisplay[];
  isMobile: boolean;
  myRsvps: Record<string, RsvpStatus>;
  onViewDetails: (event: PublicEventDisplay) => void;
  onSignUp: (eventId: string) => void;
}) {
  return (
    <div style={eventGridStyle(isMobile)}>
      {events.map((ev) => (
        <PublicEventCard
          key={ev.id}
          event={ev}
          myRsvpStatus={myRsvps[ev.id]}
          onViewDetails={onViewDetails}
          onSignUp={onSignUp}
        />
      ))}
    </div>
  );
}

export default function PublicEventsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clubSlugFilter = searchParams.get("club")?.trim() ?? "";
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
  const [pageView, setPageView] = useState<EventsPageView>("home");

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
            .in("visibility", ["public"])
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
            .in("visibility", ["public"])
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
          clubSlug: (club.slug as string) ?? "",
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

  const eventIds = useMemo(() => events.map((event) => event.id), [events]);
  const { myRsvps, setRsvp } = useEventRsvps(eventIds);

  const clubCategories = useMemo(
    () => clubCategoryFilterOptions(eventsWithStartTime.map((ev) => ev.clubCategory)),
    [eventsWithStartTime],
  );

  const hasActiveFilters =
    search.trim().length > 0 ||
    pageView !== "home" ||
    timeFilter === "custom" ||
    clubCategoryFilter !== "all" ||
    eventCategoryFilter !== "all" ||
    clubSlugFilter !== "";

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = rollingWeekEnd(today);
    const monthEnd = endOfMonth(today);
    const q = search.trim().toLowerCase();

    return eventsWithStartTime.filter((ev) => {
      const eventDate = new Date(ev.start_time);
      if (Number.isNaN(eventDate.getTime())) return false;

      if (clubSlugFilter && ev.clubSlug !== clubSlugFilter) {
        return false;
      }

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
    clubSlugFilter,
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

  function openWeekView() {
    setPageView("week");
    setTimeFilter("week");
    setViewMode("grouped");
  }

  function openMonthView() {
    setPageView("month");
    setTimeFilter("month");
    setViewMode("grouped");
  }

  function goToEventsHome() {
    setPageView("home");
    setTimeFilter("all");
  }

  function clearFilters() {
    setSearch("");
    setTimeFilter("all");
    setCustomDateFrom("");
    setCustomDateTo("");
    setClubCategoryFilter("all");
    setEventCategoryFilter("all");
    setPageView("home");
  }

  async function handleSignUp(eventId: string) {
    const target = `/events/${eventId}/rsvp`;

    if (!user) {
      navigate(`/signup?redirect=${encodeURIComponent(target)}`);
      return;
    }

    if (myRsvps[eventId]) {
      navigate(target);
      return;
    }

    const needsQuestionnaire = await eventRequiresRsvpQuestionnaire(eventId, true);
    if (needsQuestionnaire) {
      navigate(target);
      return;
    }

    const ok = await setRsvp(eventId, "going");
    if (!ok) {
      navigate(target);
    }
  }

  const horizontalPad = isMobile ? "16px" : "48px";

  return (
    <div style={{ background: PAGE_BG, minHeight: "100vh" }}>
      <header
        id="events-page-top"
        style={{
          padding: isMobile ? "28px 16px 12px" : "40px 48px 12px",
          backgroundColor: PAGE_BG,
        }}
      >
        <h1
          style={{
            fontSize: isMobile ? "32px" : "52px",
            fontWeight: 800,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.05,
          }}
        >
          Campus <span style={{ color: "#E51937" }}>Events</span>
        </h1>
        <div
          style={{
            marginTop: "12px",
            width: "100%",
            maxWidth: "720px",
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
              width: "100%",
              height: "52px",
              padding: "0 20px",
              fontSize: "15px",
            }}
          />
        </div>
      </header>

      <div style={{ padding: `0 ${horizontalPad} 48px`, backgroundColor: PAGE_BG }}>
        {pageView !== "home" ? (
          <div style={{ marginBottom: "16px" }}>
            <button
              type="button"
              onClick={goToEventsHome}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "none",
                color: "#777777",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                padding: 0,
                marginBottom: "12px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#777777";
              }}
            >
              <ChevronLeft size={16} aria-hidden />
              All events
            </button>
            <h2
              style={{
                fontSize: isMobile ? "24px" : "32px",
                fontWeight: 800,
                color: "#ffffff",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {pageView === "week"
                ? "What's happening this week"
                : "What's happening this month"}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#555555",
                marginTop: "6px",
                marginBottom: 0,
              }}
            >
              {pageView === "week"
                ? formatWeekRangeLabel()
                : formatMonthLabel()}
            </p>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <button
            type="button"
            onClick={openWeekView}
            style={smallPillStyle(pageView === "week" || timeFilter === "week")}
          >
            This Week
          </button>
          <button
            type="button"
            onClick={openMonthView}
            style={smallPillStyle(pageView === "month" || timeFilter === "month")}
          >
            This Month
          </button>
          {pageView === "home" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  goToEventsHome();
                  setTimeFilter("all");
                }}
                style={smallPillStyle(timeFilter === "all" && pageView === "home")}
              >
                All Upcoming
              </button>
              <button
                type="button"
                onClick={() => {
                  setPageView("home");
                  setTimeFilter("custom");
                }}
                style={smallPillStyle(timeFilter === "custom")}
              >
                Custom Dates
              </button>
            </>
          ) : null}
          <div style={{ marginLeft: isMobile ? undefined : "auto" }}>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: "12px",
            marginBottom: timeFilter === "custom" && pageView === "home" ? "10px" : "16px",
          }}
        >
          <div style={{ minWidth: isMobile ? "100%" : "180px", flex: isMobile ? undefined : "0 1 200px" }}>
            <label htmlFor="club-category-filter" style={{ ...labelStyle, marginBottom: "4px" }}>
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
          <div style={{ minWidth: isMobile ? "100%" : "180px", flex: isMobile ? undefined : "0 1 200px" }}>
            <label htmlFor="event-category-filter" style={{ ...labelStyle, marginBottom: "4px" }}>
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
            <button
              type="button"
              onClick={clearFilters}
              style={{
                ...smallPillStyle(false),
                color: "#E51937",
                border: "1px solid #E51937",
                background: "transparent",
                fontWeight: 600,
                marginBottom: isMobile ? undefined : "2px",
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {timeFilter === "custom" && pageView === "home" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 220px))",
              gap: "12px",
              marginBottom: "16px",
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
        ) : null}
        {loading ? (
          <Spinner label="Loading events…" />
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#555555",
              margin: "48px 0",
              fontSize: "15px",
            }}
          >
            <p style={{ margin: "0 0 12px" }}>
              {events.length === 0
                ? "No upcoming public events right now. Check back soon."
                : pageView === "week"
                  ? "Nothing scheduled this week yet."
                  : pageView === "month"
                    ? "Nothing scheduled this month yet."
                    : "No events match your filters. Try adjusting club type, event type, or dates."}
            </p>
            {pageView !== "home" && events.length > 0 ? (
              <button
                type="button"
                onClick={goToEventsHome}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#cccccc",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Browse all upcoming events
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "12px" }}>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  margin: "0 0 4px",
                  color: "#ffffff",
                }}
              >
                {filtered.length} upcoming event{filtered.length === 1 ? "" : "s"}
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "#555555",
                  margin: 0,
                }}
              >
                Browse upcoming events at the University of Guelph.
              </p>
            </div>

            {viewMode === "grid" ? (
              <EventCardsGrid
                events={filtered}
                isMobile={isMobile}
                myRsvps={myRsvps}
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
                        marginTop: index === 0 ? 0 : "28px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#ffffff",
                          whiteSpace: "nowrap",
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
                      myRsvps={myRsvps}
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
          myRsvpStatus={myRsvps[selectedEvent.id]}
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
