import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Megaphone, Calendar } from "../../components/icons/WorkspaceIcons";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useClubPosts } from "../../hooks/useClubPosts";
import { useClubTasks } from "../../hooks/useClubTasks";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import { useIsMobile } from "../../hooks/useWindowWidth";
import {
  getUpcomingEventOccurrences,
  type EventRecurringMeta,
} from "../../lib/eventRecurrence";
import { filterByVisibility } from "../../lib/contentVisibility";
import { isPrivilegedClubRole } from "../../lib/clubRoles";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import {
  accessLevelFromMember,
  formatNameWithRoleTitle,
} from "../../lib/memberRoleTitle";
import { formatTaskDate, getTaskDueUrgency } from "../../lib/taskDueUrgency";
import { supabase } from "../../lib/supabaseClient";
import type {
  AccessLevel,
  ClubEvent,
  MemberRole,
  Post,
  RsvpStatus,
  Task,
  TaskStatus,
} from "../../types";
import Spinner from "../../components/ui/Spinner";
import SetupChecklist from "../../components/club/SetupChecklist";
import ClubCommandCenter from "./ClubCommandCenter";

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

const sectionHeadingRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: "28px",
  marginBottom: "16px",
  paddingBottom: "12px",
  borderBottom: `1px solid ${CARD_BORDER}`,
};

const sectionBlockHeader: CSSProperties = {
  ...sectionHeadingRow,
  marginTop: 0,
};

const dashboardColumnStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  minWidth: 0,
  flex: 1,
};

const dashboardSectionBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
};

const dashboardSectionBlockFixed: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
};

const dashboardListStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const EVENT_DATE_BLOCK_SIZE = 44;

const sectionHeading: CSSProperties = {
  fontWeight: 600,
  fontSize: "16px",
  color: "#ffffff",
  margin: 0,
};

const viewAllLink: CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#E51937",
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
};

function isHiddenLocation(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const upper = trimmed.toUpperCase();
  return upper === "TBD" || upper === "LOCATION TBD";
}

const quickActionButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "#E51937",
  backgroundColor: "#E51937",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "9px 18px",
  fontSize: "13px",
  fontWeight: 600,
  textDecoration: "none",
};

const quickActionOutlineButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "transparent",
  backgroundColor: "transparent",
  border: "1px solid #2a2a2a",
  color: "#777777",
  borderRadius: "8px",
  padding: "9px 18px",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
};

function formatEventTime12h(timeStr: string): string {
  const t = timeStr.trim();
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

function firstSentencePreview(text: string): string {
  const stripped = text.replace(/\s+/g, " ").trim();
  if (!stripped) return "";
  const match = stripped.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? stripped.slice(0, 140)).trim();
}

function formatEventDateShort(dateStr: string): string {
  const trimmed = dateStr.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CLUB_LOGO_SIZE = 32;

function deriveAbbreviation(name: string, maxLen = 3): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

interface DeduplicatedEvent extends ClubEvent {
  occurrenceDate: string;
  moreDatesCount: number;
  showRecurringBadge: boolean;
}

function deduplicateUpcomingEventsByTitle(
  events: (ClubEvent & { occurrenceDate: string })[],
  limit = 3,
): (ClubEvent & { occurrenceDate: string })[] {
  const seen = new Set<string>();
  const result: (ClubEvent & { occurrenceDate: string })[] = [];

  for (const event of events) {
    const key = event.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
    if (result.length >= limit) break;
  }

  return result;
}

function isPostPinned(post: Post): boolean {
  const extended = post as Post & { isPinned?: boolean; is_pinned?: boolean };
  return Boolean(extended.isPinned ?? extended.is_pinned);
}

function deduplicateMonthlyEvents(
  events: (ClubEvent & { occurrenceDate: string })[],
  eventRecurring: Record<string, EventRecurringMeta>,
): DeduplicatedEvent[] {
  const grouped = new Map<string, (ClubEvent & { occurrenceDate: string })[]>();

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

function ClubLogoMark({
  name,
  abbreviation,
  logoUrl,
  circular = false,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  circular?: boolean;
}) {
  const abbr = abbreviation?.trim() || deriveAbbreviation(name);
  const radius = circular ? "50%" : "6px";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${CLUB_LOGO_SIZE}px`,
          height: `${CLUB_LOGO_SIZE}px`,
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${CLUB_LOGO_SIZE}px`,
        height: `${CLUB_LOGO_SIZE}px`,
        borderRadius: radius,
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: "11px",
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

function normalizeUserRole(role: MemberRole | string | null | undefined): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function ClubStatCard({
  label,
  value,
  sublabel,
  to,
  borderAccentColor = "#E51937",
  valueFontSize = "30px",
  valueColor = "#ffffff",
  valueFontStyle,
  valueHint,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  to?: string;
  borderAccentColor?: string;
  valueFontSize?: string;
  valueColor?: string;
  valueFontStyle?: CSSProperties["fontStyle"];
  valueHint?: string;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  const card = (
    <div
      className="flex h-full min-h-[120px] flex-col justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: CARD_BG,
        borderTop: `2px solid ${borderAccentColor}`,
        borderRight: `1px solid ${CARD_BORDER}`,
        borderBottom: `1px solid ${CARD_BORDER}`,
        borderLeft: `1px solid ${CARD_BORDER}`,
        borderRadius: "12px",
        padding: "18px 20px",
        flex: 1,
        cursor: to ? "pointer" : undefined,
        transform: hovered && to ? "translateY(-1px)" : undefined,
        transition: "all 0.15s ease",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "#555555",
          margin: 0,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: valueFontSize,
          fontWeight: valueFontStyle === "italic" ? 400 : 800,
          color: valueColor,
          fontStyle: valueFontStyle,
          lineHeight: 1.15,
          margin: "8px 0 0",
        }}
      >
        {value}
      </p>
      {valueHint ? (
        <p
          style={{
            fontSize: "13px",
            color: "#E51937",
            margin: "4px 0 0",
          }}
        >
          {valueHint}
        </p>
      ) : null}
      {sublabel ? (
        <p
          style={{
            fontSize: "13px",
            color: "#444444",
            margin: "4px 0 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sublabel}
        </p>
      ) : null}
    </div>
  );

  if (to) {
    return (
      <div
        role="link"
        tabIndex={0}
        className="block h-full cursor-pointer no-underline"
        onClick={() => navigate(to)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(to);
          }
        }}
      >
        {card}
      </div>
    );
  }

  return card;
}

function NextMeetingStatCard({
  display,
  to,
}: {
  display: {
    scheduled: boolean;
    dateLine: string;
    weekdayTimeLine: string;
    locationLine: string;
  };
  to: string;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="link"
      tabIndex={0}
      className="block h-full cursor-pointer no-underline"
      onClick={() => navigate(to)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(to);
        }
      }}
    >
      <div
        className="flex h-full min-h-[120px] flex-col justify-center"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: CARD_BG,
          borderTop: "2px solid #333333",
          borderRight: `1px solid ${CARD_BORDER}`,
          borderBottom: `1px solid ${CARD_BORDER}`,
          borderLeft: `1px solid ${CARD_BORDER}`,
          borderRadius: "12px",
          padding: "18px 20px",
          flex: 1,
          transform: hovered ? "translateY(-1px)" : undefined,
          transition: "all 0.15s ease",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "#777777",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Next Meeting
        </p>
        <p
          style={{
            fontSize: display.scheduled ? "26px" : "14px",
            fontWeight: display.scheduled ? 800 : 400,
            color: display.scheduled ? "#ffffff" : "#555555",
            lineHeight: 1.15,
            margin: "8px 0 0",
          }}
        >
          {display.dateLine}
        </p>
        {display.weekdayTimeLine ? (
          <p
            style={{
              fontSize: "13px",
              color: "#999999",
              margin: "6px 0 0",
            }}
          >
            {display.weekdayTimeLine}
          </p>
        ) : null}
        {display.locationLine ? (
          <p
            style={{
              fontSize: "13px",
              color: "#777777",
              margin: "4px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {display.locationLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const detailModalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
};

const detailModalPanel: CSSProperties = {
  position: "relative",
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "28px",
  maxWidth: "520px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
};

function RoleIndicatorPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        marginTop: "8px",
        fontSize: "11px",
        fontWeight: 600,
        color,
        border: `1px solid ${color}`,
        borderRadius: "20px",
        padding: "3px 10px",
      }}
    >
      {label}
    </span>
  );
}

function MemberAnnouncementCard({
  post,
  onReadMore,
}: {
  post: Post;
  onReadMore: () => void;
}) {
  const preview = firstSentencePreview(post.content);

  return (
    <article
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        padding: "14px 16px",
      }}
    >
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 8px",
        }}
      >
        {post.title}
      </h3>
      {preview ? (
        <p
          style={{
            fontSize: "13px",
            color: "#aaaaaa",
            margin: "0 0 10px",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onReadMore}
        style={{
          ...viewAllLink,
          padding: 0,
        }}
      >
        Read more →
      </button>
    </article>
  );
}

function DashboardItemModal({
  onClose,
  children,
  footerLink,
}: {
  onClose: () => void;
  children: ReactNode;
  footerLink?: { label: string; to: string };
}) {
  const navigate = useNavigate();
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={detailModalOverlay}
      onClick={onClose}
    >
      <div style={detailModalPanel} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            border: "none",
            color: "#777777",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={18} aria-hidden />
        </button>
        {children}
        {footerLink ? (
          <button
            type="button"
            onClick={() => navigate(footerLink.to)}
            style={{
              marginTop: "24px",
              width: "100%",
              background: "transparent",
              border: "1px solid #333333",
              color: "#E51937",
              borderRadius: "6px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {footerLink.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function clubHomeTaskStatusLabel(status: TaskStatus): string {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "To Do";
}

function clubHomeTaskStatusPillStyle(status: TaskStatus): CSSProperties {
  if (status === "in_progress") {
    return {
      background: "#2a1f00",
      border: "1px solid #FFC429",
      color: "#FFC429",
      borderRadius: "20px",
      padding: "3px 10px",
      fontSize: "11px",
      fontWeight: 500,
      flexShrink: 0,
    };
  }
  if (status === "done") {
    return {
      background: "#1a0a0a",
      border: "1px solid #E51937",
      color: "#E51937",
      borderRadius: "20px",
      padding: "3px 10px",
      fontSize: "11px",
      fontWeight: 500,
      flexShrink: 0,
    };
  }
  return {
    background: "#222222",
    border: "1px solid #444444",
    color: "#888888",
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    flexShrink: 0,
  };
}

function clubHomeTaskLeftBorder(
  status: TaskStatus,
  urgency: ReturnType<typeof getTaskDueUrgency>,
): string {
  if (urgency === "overdue") return "#E51937";
  if (status === "in_progress") return "#FFC429";
  return "#2a2a2a";
}

function NeedsAttentionTaskRow({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const urgency = getTaskDueUrgency(task.dueDate, task.status);
  const dueLabel = task.dueDate ? formatTaskDate(task.dueDate) : null;
  const leftBorder = clubHomeTaskLeftBorder(task.status, urgency);
  const metaParts = [task.assigneeName, dueLabel].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: CARD_BG,
        borderTop: `1px solid ${CARD_BORDER}`,
        borderRight: `1px solid ${CARD_BORDER}`,
        borderBottom: `1px solid ${CARD_BORDER}`,
        borderLeft: `3px solid ${leftBorder}`,
        borderRadius: "8px",
        padding: "14px 16px",
        cursor: "pointer",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </p>
        {metaParts.length > 0 ? (
          <p
            style={{
              fontSize: "12px",
              color: "#777777",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {metaParts.join(" · ")}
          </p>
        ) : null}
      </div>
      <span style={clubHomeTaskStatusPillStyle(task.status)}>
        {clubHomeTaskStatusLabel(task.status)}
      </span>
    </div>
  );
}

function EventDateBadge({ date }: { date: string }) {
  const parsedDate = new Date(`${date}T12:00:00`);
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
        width: `${EVENT_DATE_BLOCK_SIZE}px`,
        height: `${EVENT_DATE_BLOCK_SIZE}px`,
        backgroundColor: "#E51937",
        borderRadius: "8px",
      }}
    >
      <span
        style={{
          fontSize: "9px",
          color: "#fff",
          lineHeight: 1,
          letterSpacing: "0.08em",
        }}
      >
        {monthLabel}
      </span>
      <span style={{ fontSize: "18px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>
        {dayLabel}
      </span>
    </div>
  );
}

function UpcomingEventRow({
  title,
  date,
  time,
  location,
  clubName,
  clubAbbreviation,
  clubLogoUrl,
  onOpen,
}: {
  title: string;
  date: string;
  time?: string;
  location?: string;
  clubName: string;
  clubAbbreviation?: string;
  clubLogoUrl?: string;
  onOpen: () => void;
}) {
  const timeLabel =
    time && time.trim() !== "" && time.toUpperCase() !== "TBD"
      ? formatEventTime12h(time)
      : null;
  const locationLabel =
    location && !isHiddenLocation(location) ? location.trim() : null;
  const metaParts = [timeLabel, locationLabel].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        padding: "14px 16px",
        cursor: "pointer",
      }}
    >
      <EventDateBadge date={date} />
      <ClubLogoMark
        name={clubName}
        abbreviation={clubAbbreviation}
        logoUrl={clubLogoUrl}
        circular
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </p>
        {metaParts.length > 0 ? (
          <p
            style={{
              fontSize: "12px",
              color: "#777777",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {metaParts.join(" · ")}
          </p>
        ) : null}
      </div>
      <span
        style={{
          flexShrink: 0,
          color: "#E51937",
          fontSize: "13px",
          fontWeight: 500,
        }}
      >
        View Event →
      </span>
    </div>
  );
}

function NextEventCard({
  event,
  eventsPath,
  rsvpStatus,
}: {
  event: { title: string; date: string; time?: string; location?: string };
  eventsPath: string;
  rsvpStatus?: RsvpStatus | null;
}) {
  const timeLabel =
    event.time && event.time.trim() !== "" && event.time.toUpperCase() !== "TBD"
      ? formatEventTime12h(event.time)
      : null;
  const locationLabel =
    event.location && !isHiddenLocation(event.location)
      ? event.location.trim()
      : null;

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <EventDateBadge date={event.date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {event.title}
        </p>
        {locationLabel ? (
          <p
            style={{
              fontSize: "12px",
              color: "#777777",
              margin: "0 0 2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {locationLabel}
          </p>
        ) : null}
        {timeLabel ? (
          <p
            style={{
              fontSize: "12px",
              color: "#777777",
              margin: 0,
            }}
          >
            {timeLabel}
          </p>
        ) : null}
      </div>
      {rsvpStatus === "going" ? (
        <span
          style={{
            flexShrink: 0,
            background: "#2a2200",
            border: "1px solid #FFC429",
            color: "#FFC429",
            borderRadius: "20px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          Going ✓
        </span>
      ) : (
        <Link
          to={eventsPath}
          style={{
            ...viewAllLink,
            flexShrink: 0,
          }}
        >
          View Event →
        </Link>
      )}
    </div>
  );
}

function ClubAnnouncementPreviewCard({
  post,
  clubName,
  announcementsPath,
  authorRoleTitle,
  isPinned = false,
}: {
  post: Post;
  clubName: string;
  announcementsPath: string;
  authorRoleTitle?: string;
  isPinned?: boolean;
}) {
  const preview = firstSentencePreview(post.content);
  const authorLine = post.authorName
    ? formatNameWithRoleTitle(post.authorName, authorRoleTitle)
    : "";

  return (
    <article
      style={{
        background: CARD_BG,
        borderTop: `1px solid ${CARD_BORDER}`,
        borderRight: `1px solid ${CARD_BORDER}`,
        borderBottom: `1px solid ${CARD_BORDER}`,
        borderLeft: isPinned ? "3px solid #E51937" : `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        padding: "14px 16px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          color: "#E51937",
          fontWeight: 400,
          margin: "0 0 6px",
        }}
      >
        {clubName}
      </p>
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 4px",
        }}
      >
        {post.title}
      </h3>
      <p
        style={{
          fontSize: "12px",
          color: "#777777",
          margin: "0 0 8px",
        }}
      >
        {formatRelativeTime(post.createdAt)}
        {authorLine ? ` · ${authorLine}` : ""}
      </p>
      {preview ? (
        <p
          style={{
            fontSize: "13px",
            color: "#aaaaaa",
            margin: "0 0 8px",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </p>
      ) : null}
      <Link to={announcementsPath} style={viewAllLink}>
        Read more →
      </Link>
    </article>
  );
}

export default function ClubHomePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { getClubById, getUserRole, userRoles, updateClub } = useClubContext();
  const club = getClubById(clubId ?? "");

  const clubBasePath = clubId ? `/app/clubs/${clubId}` : "";
  const eventsPath = `${clubBasePath}/events`;
  const announcementsPath = `${clubBasePath}/announcements`;
  const tasksPath = `${clubBasePath}/tasks`;

  const contextRole = clubId
    ? getUserRole(clubId) ?? userRoles[clubId] ?? null
    : null;

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [userRoleTitle, setUserRoleTitle] = useState<string | null>(null);
  const [userAccessLevel, setUserAccessLevel] = useState<AccessLevel>("member");
  const [profileFullName, setProfileFullName] = useState<string | null>(null);
  const [newEventHovered, setNewEventHovered] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Post | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<
    (ClubEvent & { occurrenceDate: string }) | null
  >(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [authorRoleTitleById, setAuthorRoleTitleById] = useState<
    Record<string, string>
  >({});
  const [recurringColumnReady, setRecurringColumnReady] = useState(false);
  const [eventRecurring, setEventRecurring] = useState<
    Record<string, EventRecurringMeta>
  >({});
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [openTasksPreview, setOpenTasksPreview] = useState<
    Pick<Task, "id" | "title" | "status" | "dueDate">[]
  >([]);
  const [openTasksPreviewLoading, setOpenTasksPreviewLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setProfileFullName(null);
      return;
    }

    let cancelled = false;

    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load profile name:", error.message);
          setProfileFullName(null);
          return;
        }
        const name = (data?.full_name as string | null)?.trim();
        setProfileFullName(name || null);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const previewRole = localStorage.getItem("previewRole");
    if (previewRole) {
      setUserRole(previewRole as MemberRole);
      setUserRoleTitle(null);
      setUserAccessLevel(
        previewRole === "owner"
          ? "president"
          : previewRole === "executive"
            ? "executive"
            : "member",
      );
      return;
    }

    const fetchMembership = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role, title, access_level")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (!data?.role) return;

      const role = normalizeUserRole(data.role as MemberRole);
      setUserRole(role);
      setUserRoleTitle((data.title as string | null)?.trim() || null);
      setUserAccessLevel(
        accessLevelFromMember({
          role,
          accessLevel: data.access_level as AccessLevel | null | undefined,
        }),
      );
    };

    if (contextRole) {
      setUserRole(normalizeUserRole(contextRole as MemberRole));
    }
    void fetchMembership();
  }, [clubId, user?.id, contextRole]);

  const { events, loading: eventsLoading } = useClubEvents(clubId);
  const { posts, loading: postsLoading } = useClubPosts(clubId);
  const { tasks, loading: tasksLoading } = useClubTasks(clubId);

  useEffect(() => {
    if (!clubId || posts.length === 0) {
      setAuthorRoleTitleById({});
      return;
    }

    let cancelled = false;
    const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));

    void supabase
      .from("club_members")
      .select("user_id, title")
      .eq("club_id", clubId)
      .in("user_id", authorIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load author role titles:", error.message);
          setAuthorRoleTitleById({});
          return;
        }
        const map: Record<string, string> = {};
        for (const row of data ?? []) {
          const title = (row.title as string | null)?.trim();
          if (title) map[row.user_id as string] = title;
        }
        setAuthorRoleTitleById(map);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, posts]);

  useEffect(() => {
    let cancelled = false;

    async function checkRecurringColumn() {
      const { error } = await supabase.from("events").select("is_recurring").limit(1);
      if (cancelled) return;
      setRecurringColumnReady(!error);
    }

    void checkRecurringColumn();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!eventsLoading && recurringColumnReady) {
      void loadEventRecurring();
    }
  }, [eventsLoading, events, recurringColumnReady, loadEventRecurring]);

  const upcomingOccurrences = useMemo(
    () => getUpcomingEventOccurrences(events, eventRecurring),
    [events, eventRecurring],
  );

  const eventsThisMonth = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const startYmd = startOfMonth.toISOString().slice(0, 10);
    const endYmd = endOfMonth.toISOString().slice(0, 10);

    return upcomingOccurrences.filter(
      (e) => e.occurrenceDate >= startYmd && e.occurrenceDate <= endYmd,
    );
  }, [upcomingOccurrences]);

  const deduplicatedEventsThisMonth = useMemo(
    () => deduplicateMonthlyEvents(eventsThisMonth, eventRecurring),
    [eventsThisMonth, eventRecurring],
  );

  useEffect(() => {
    if (!clubId) {
      setOpenTaskCount(0);
      return;
    }

    let cancelled = false;

    async function loadOpenTaskCount() {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .neq("status", "done");

      if (cancelled) return;
      if (error) {
        console.error("Failed to load open task count:", error.message);
        setOpenTaskCount(0);
        return;
      }
      setOpenTaskCount(count ?? 0);
    }

    void loadOpenTaskCount();
    return () => {
      cancelled = true;
    };
  }, [clubId, tasks.length]);

  useEffect(() => {
    if (!clubId) {
      setOpenTasksPreview([]);
      setOpenTasksPreviewLoading(false);
      return;
    }

    let cancelled = false;

    async function loadOpenTasksPreview() {
      setOpenTasksPreviewLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date")
        .eq("club_id", clubId)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);

      if (cancelled) return;
      if (error) {
        console.error("Failed to load open tasks preview:", error.message);
        setOpenTasksPreview([]);
      } else {
        setOpenTasksPreview(
          (data ?? []).map((row) => ({
            id: row.id as string,
            title: (row.title as string) ?? "",
            status: (row.status as TaskStatus) ?? "todo",
            dueDate: (row.due_date as string) ?? undefined,
          })),
        );
      }
      setOpenTasksPreviewLoading(false);
    }

    void loadOpenTasksPreview();
    return () => {
      cancelled = true;
    };
  }, [clubId, tasks.length]);

  const nextEvent = upcomingOccurrences[0];

  const nextMeetingDisplay = useMemo(() => {
    const scheduleText = club?.meetingSchedule?.trim() ?? "";
    const recurringOccurrences = upcomingOccurrences.filter((e) => {
      const meta = eventRecurring[e.id];
      return meta?.isRecurring && meta.frequency;
    });
    const weeklyFirst = recurringOccurrences.find((e) => {
      const meta = eventRecurring[e.id];
      return meta?.frequency === "weekly";
    });
    const nextRecurring = weeklyFirst ?? recurringOccurrences[0];

    if (nextRecurring) {
      const d = new Date(`${nextRecurring.occurrenceDate}T12:00:00`);
      const value = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
      const timeLabel =
        nextRecurring.time &&
        nextRecurring.time.trim() !== "" &&
        nextRecurring.time.toUpperCase() !== "TBD"
          ? formatEventTime12h(nextRecurring.time)
          : "";
      const locationLabel =
        nextRecurring.location && !isHiddenLocation(nextRecurring.location)
          ? nextRecurring.location.trim()
          : "";
      const weekdayTimeLine = [weekday, timeLabel].filter(Boolean).join(" · ");
      return {
        scheduled: true,
        dateLine: value,
        weekdayTimeLine,
        locationLine: locationLabel,
      };
    }

    if (scheduleText) {
      return {
        scheduled: true,
        dateLine: scheduleText,
        weekdayTimeLine: "",
        locationLine:
          club?.location && !isHiddenLocation(club.location)
            ? club.location.trim()
            : "",
      };
    }

    return {
      scheduled: false,
      dateLine: "No meetings scheduled",
      weekdayTimeLine: "",
      locationLine: "",
    };
  }, [club, upcomingOccurrences, eventRecurring]);

  const executiveTasks = useMemo(() => {
    return tasks.filter((t) => t.assignedTo === user?.id || t.createdBy === user?.id);
  }, [tasks, userRole, user?.id]);

  const memberTasks = useMemo(
    () => tasks.filter((t) => t.assignedTo === user?.id),
    [tasks, user?.id],
  );

  const tasksForRole =
    userRole === "owner" ? tasks : userRole === "executive" ? executiveTasks : memberTasks;
  const attentionTasks = useMemo(
    () =>
      tasksForRole
        .filter((task) => task.status === "todo" || task.status === "in_progress")
        .slice(0, 4),
    [tasksForRole],
  );
  const isPrivileged = isPrivilegedClubRole(userRole);
  const isPresidentCommandCenter =
    userRole === "owner" || userAccessLevel === "president";
  const visibilityContext = useMemo(
    () => ({ isMember: true, isPrivileged }),
    [isPrivileged],
  );

  const previewPosts = posts.slice(0, 2);
  const previewUpcomingEvents = useMemo(
    () => deduplicateUpcomingEventsByTitle(upcomingOccurrences, 3),
    [upcomingOccurrences],
  );
  const memberUpcomingEvents = useMemo(() => {
    const visible = filterByVisibility(upcomingOccurrences, visibilityContext);
    return deduplicateUpcomingEventsByTitle(visible, 3);
  }, [upcomingOccurrences, visibilityContext]);
  const memberAnnouncements = useMemo(
    () => filterByVisibility(posts, visibilityContext).slice(0, 3),
    [posts, visibilityContext],
  );

  const rolePillLabel = !isPrivileged
    ? "Member"
    : userAccessLevel === "president" || userRole === "owner"
      ? userRoleTitle || "President"
      : userRoleTitle || "Executive";
  const rolePillColor = !isPrivileged
    ? "#555555"
    : userAccessLevel === "president" || userRole === "owner"
      ? "#E51937"
      : "#FFC429";
  const rsvpEventIds = useMemo(() => {
    const ids = new Set(previewUpcomingEvents.map((event) => event.id));
    if (nextEvent?.id) ids.add(nextEvent.id);
    return Array.from(ids);
  }, [previewUpcomingEvents, nextEvent]);
  const { counts: eventRsvpCounts, myRsvps } = useEventRsvps(rsvpEventIds);

  if (!club) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p
            className="text-lg font-semibold"
            style={{ color: "#ffffff" }}
          >
            Club not found
          </p>
          <p className="mt-1 text-sm" style={{ color: "#555555" }}>
            This club may have been removed or you don&apos;t have access.
          </p>
        </div>
      </div>
    );
  }

  const showSetupChecklist =
    club.claimStatus === "claimed" && !club.setupCompleted;

  async function handlePublishClub() {
    if (!clubId) return;
    const success = await updateClub(clubId, {
      claimStatus: "active",
      isPublished: true,
      setupCompleted: true,
    });
    if (!success) {
      throw new Error("Publish failed");
    }
  }

  const isMobile = useIsMobile();
  const userMeta = user?.user_metadata as Record<string, unknown> | undefined;
  const fullNameSource =
    profileFullName ||
    (typeof userMeta?.full_name === "string" ? userMeta.full_name.trim() : "") ||
    (typeof userMeta?.display_name === "string"
      ? userMeta.display_name.trim()
      : "");
  const firstName = fullNameSource
    ? fullNameSource.split(/\s+/)[0]
    : user?.email?.split("@")[0] || "there";

  return (
    <div
      style={{
        backgroundColor: "#0f0f0f",
        padding: isMobile ? "16px" : "24px",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {showSetupChecklist ? (
        <SetupChecklist
          club={club}
          hasAnnouncement={posts.length > 0}
          hasEvent={events.length > 0}
          contentLoading={postsLoading || eventsLoading}
          onPublish={handlePublishClub}
        />
      ) : null}

      {isPresidentCommandCenter ? (
        <ClubCommandCenter
          club={club}
          clubId={clubId!}
          tasks={tasks}
          tasksLoading={tasksLoading}
          posts={posts}
          postsLoading={postsLoading}
          upcomingOccurrences={upcomingOccurrences}
          eventsLoading={eventsLoading}
          eventRsvpCounts={eventRsvpCounts}
          isMobile={isMobile}
          onOpenEvent={setSelectedEvent}
          onOpenTask={setSelectedTask}
        />
      ) : (
        <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "24px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Welcome back, {firstName}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#777777",
              marginTop: "4px",
              marginBottom: 0,
            }}
          >
            Here&apos;s what&apos;s happening in {club.name}.
          </p>
          <RoleIndicatorPill label={rolePillLabel} color={rolePillColor} />
        </div>

        {isPrivileged ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <button
              type="button"
              onClick={() => navigate(`${announcementsPath}?create=true`)}
              style={{
                ...quickActionButton,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Megaphone size={16} strokeWidth={2} aria-hidden />
              New Announcement
            </button>
            <button
              type="button"
              onClick={() => navigate(`${eventsPath}?create=true`)}
              onMouseEnter={() => setNewEventHovered(true)}
              onMouseLeave={() => setNewEventHovered(false)}
              style={{
                ...quickActionOutlineButton,
                cursor: "pointer",
                fontFamily: "inherit",
                borderColor: newEventHovered ? "#555555" : "#2a2a2a",
                color: newEventHovered ? "#cccccc" : "#777777",
              }}
            >
              <Calendar size={16} strokeWidth={2} aria-hidden />
              New Event
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={`grid items-stretch gap-4 ${
          isMobile
            ? "grid-cols-2"
            : isPrivileged
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {isPrivileged ? (
          <ClubStatCard
            label="Open Tasks"
            value={openTaskCount}
            sublabel="Incomplete tasks"
            borderAccentColor="#E51937"
            to={tasksPath}
          />
        ) : null}
        <ClubStatCard
          label="Events This Month"
          value={eventsLoading ? "…" : deduplicatedEventsThisMonth.length}
          sublabel="Club events this month"
          borderAccentColor="#FFC429"
          to={eventsPath}
        />
        <NextMeetingStatCard display={nextMeetingDisplay} to={eventsPath} />
      </div>

      {!isPrivileged ? (
        <div style={{ ...dashboardColumnStack, marginTop: "28px" }}>
          <div style={dashboardSectionBlockFixed}>
            <div style={sectionBlockHeader}>
              <h2 style={sectionHeading}>Upcoming Events</h2>
            </div>
            {eventsLoading ? (
              <div className="flex justify-center py-6">
                <Spinner label="Loading events…" />
              </div>
            ) : memberUpcomingEvents.length === 0 ? (
              <div
                style={{
                  backgroundColor: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "8px",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "14px", color: "#777777", margin: 0 }}>
                  No upcoming events scheduled.
                </p>
              </div>
            ) : (
              <div style={dashboardListStack}>
                {memberUpcomingEvents.map((event) => (
                  <UpcomingEventRow
                    key={`${event.id}-${event.occurrenceDate}`}
                    title={event.title}
                    date={event.occurrenceDate}
                    time={event.time}
                    location={event.location}
                    clubName={club.name}
                    clubAbbreviation={club.abbreviation}
                    clubLogoUrl={club.logoUrl}
                    onOpen={() => setSelectedEvent(event)}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={dashboardSectionBlockFixed}>
            <div style={sectionBlockHeader}>
              <h2 style={sectionHeading}>Recent Announcements</h2>
            </div>
            {postsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner label="Loading announcements…" />
              </div>
            ) : memberAnnouncements.length === 0 ? (
              <div
                style={{
                  backgroundColor: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "12px",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "14px", color: "#777777", margin: 0 }}>
                  No announcements yet. Check back soon!
                </p>
              </div>
            ) : (
              <div style={dashboardListStack}>
                {memberAnnouncements.map((post) => (
                  <MemberAnnouncementCard
                    key={post.id}
                    post={post}
                    onReadMore={() => setSelectedAnnouncement(post)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
      <div
        data-open-preview-count={openTasksPreview.length}
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "3fr 2fr",
          gap: "28px",
          marginTop: "28px",
          alignItems: "start",
        }}
      >
        <div style={dashboardColumnStack}>
          <div style={dashboardSectionBlockFixed}>
            <div style={sectionBlockHeader}>
              <h2 style={sectionHeading}>Tasks</h2>
              <Link to={tasksPath} style={viewAllLink}>
                View All →
              </Link>
            </div>
            {tasksLoading || openTasksPreviewLoading ? (
              <div className="flex justify-center py-6">
                <Spinner label="Loading tasks…" />
              </div>
            ) : attentionTasks.length === 0 ? (
              <div
                style={{
                  backgroundColor: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "12px",
                  padding: "24px 20px",
                }}
              >
                <p style={{ fontSize: "14px", color: "#777777", margin: 0 }}>
                  {isPrivileged
                    ? "No open tasks in this club."
                    : "No open tasks assigned to you."}
                </p>
              </div>
            ) : (
              <div style={dashboardListStack}>
                {attentionTasks.map((task) => (
                  <NeedsAttentionTaskRow
                    key={task.id}
                    task={task}
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={dashboardSectionBlock}>
            <div style={sectionBlockHeader}>
              <h2 style={sectionHeading}>Upcoming Events</h2>
              <Link to={eventsPath} style={viewAllLink}>
                View All →
              </Link>
            </div>
            {previewUpcomingEvents.length === 0 ? (
              <div
                className="text-center"
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "8px",
                  padding: "32px 24px",
                  minHeight: "120px",
                }}
              >
                <p style={{ fontSize: "14px", color: "#777777", margin: 0 }}>
                  No upcoming events scheduled.
                </p>
                <Link to={eventsPath} className="mt-3 inline-block" style={viewAllLink}>
                  View Events Page →
                </Link>
              </div>
            ) : (
              <div style={dashboardListStack}>
                {previewUpcomingEvents.map((event) => (
                  <UpcomingEventRow
                    key={`${event.id}-${event.occurrenceDate}`}
                    title={event.title}
                    date={event.occurrenceDate}
                    time={event.time}
                    location={event.location}
                    clubName={club.name}
                    clubAbbreviation={club.abbreviation}
                    clubLogoUrl={club.logoUrl}
                    onOpen={() => setSelectedEvent(event)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={dashboardColumnStack}>
          <div style={dashboardSectionBlockFixed}>
            <div style={sectionBlockHeader}>
              <h2 style={sectionHeading}>Next Event</h2>
            </div>
            {nextEvent ? (
              <NextEventCard
                event={{
                  title: nextEvent.title,
                  date: nextEvent.occurrenceDate,
                  time: nextEvent.time,
                  location: nextEvent.location,
                }}
                eventsPath={eventsPath}
                rsvpStatus={myRsvps[nextEvent.id]}
              />
            ) : (
              <div
                style={{
                  backgroundColor: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "8px",
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "14px", color: "#777777", margin: 0 }}>
                  No upcoming events scheduled.
                </p>
              </div>
            )}
          </div>

          <div style={dashboardSectionBlock}>
            <div style={sectionBlockHeader}>
              <h2 style={sectionHeading}>Recent Updates</h2>
              <Link to={announcementsPath} style={viewAllLink}>
                View All →
              </Link>
            </div>
            {postsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner label="Loading announcements…" />
              </div>
            ) : posts.length === 0 ? (
              <div
                className="text-center"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "12px",
                  padding: "32px 24px",
                  minHeight: "120px",
                }}
              >
                <p style={{ fontSize: "14px", color: "#777777", margin: 0 }}>
                  No announcements yet. Check back soon!
                </p>
              </div>
            ) : (
              <div style={{ ...dashboardListStack, flex: 1 }}>
                {previewPosts.map((post) => (
                  <ClubAnnouncementPreviewCard
                    key={post.id}
                    post={post}
                    clubName={club.name}
                    announcementsPath={announcementsPath}
                    authorRoleTitle={authorRoleTitleById[post.authorId]}
                    isPinned={isPostPinned(post)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
        </>
      )}

      {selectedAnnouncement ? (
        <DashboardItemModal
          onClose={() => setSelectedAnnouncement(null)}
          footerLink={
            isPrivileged
              ? {
                  label: "View All Announcements →",
                  to: announcementsPath,
                }
              : undefined
          }
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 12px",
              paddingRight: "28px",
            }}
          >
            {selectedAnnouncement.title}
          </h2>
          <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 16px" }}>
            {isPrivileged
              ? `${formatNameWithRoleTitle(
                  selectedAnnouncement.authorName ?? "Unknown",
                  authorRoleTitleById[selectedAnnouncement.authorId],
                )} · `
              : ""}
            {new Date(selectedAnnouncement.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "#cccccc",
              lineHeight: 1.6,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {selectedAnnouncement.content}
          </p>
        </DashboardItemModal>
      ) : null}

      {selectedEvent ? (
        <DashboardItemModal
          onClose={() => setSelectedEvent(null)}
          footerLink={
            isPrivileged
              ? { label: "View All Events →", to: eventsPath }
              : undefined
          }
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 16px",
              paddingRight: "28px",
            }}
          >
            {selectedEvent.title}
          </h2>
          <p style={{ fontSize: "13px", color: "#888888", margin: "0 0 8px" }}>
            <span style={{ color: "#555555" }}>Date: </span>
            {formatEventDateShort(selectedEvent.occurrenceDate)}
          </p>
          {selectedEvent.time &&
          selectedEvent.time.trim() !== "" &&
          selectedEvent.time.toUpperCase() !== "TBD" ? (
            <p style={{ fontSize: "13px", color: "#888888", margin: "0 0 8px" }}>
              <span style={{ color: "#555555" }}>Time: </span>
              {formatEventTime12h(selectedEvent.time)}
            </p>
          ) : null}
          {selectedEvent.location && !isHiddenLocation(selectedEvent.location) ? (
            <p style={{ fontSize: "13px", color: "#888888", margin: "0 0 8px" }}>
              <span style={{ color: "#555555" }}>Location: </span>
              {selectedEvent.location.trim()}
            </p>
          ) : null}
          {selectedEvent.description?.trim() ? (
            <p
              style={{
                fontSize: "14px",
                color: "#cccccc",
                lineHeight: 1.6,
                margin: "12px 0 0",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedEvent.description}
            </p>
          ) : null}
          {(eventRsvpCounts[selectedEvent.id]?.going ?? 0) > 0 ? (
            <p style={{ fontSize: "13px", color: "#888888", margin: "16px 0 0" }}>
              <span style={{ color: "#555555" }}>RSVPs: </span>
              {eventRsvpCounts[selectedEvent.id]?.going} going
            </p>
          ) : null}
        </DashboardItemModal>
      ) : null}

      {selectedTask && isPrivileged ? (
        <DashboardItemModal
          onClose={() => setSelectedTask(null)}
          footerLink={{ label: "View All Tasks →", to: tasksPath }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 16px",
              paddingRight: "28px",
            }}
          >
            {selectedTask.title}
          </h2>
          {selectedTask.description?.trim() ? (
            <p
              style={{
                fontSize: "14px",
                color: "#cccccc",
                lineHeight: 1.6,
                margin: "0 0 12px",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedTask.description}
            </p>
          ) : null}
          {selectedTask.assigneeName ? (
            <p style={{ fontSize: "13px", color: "#888888", margin: "0 0 8px" }}>
              <span style={{ color: "#555555" }}>Assignee: </span>
              {selectedTask.assigneeName}
            </p>
          ) : null}
          {selectedTask.dueDate ? (
            <p style={{ fontSize: "13px", color: "#888888", margin: "0 0 8px" }}>
              <span style={{ color: "#555555" }}>Due: </span>
              {new Date(selectedTask.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}
          <p style={{ fontSize: "13px", color: "#888888", margin: 0 }}>
            <span style={{ color: "#555555" }}>Status: </span>
            {selectedTask.status === "in_progress"
              ? "In progress"
              : selectedTask.status === "done"
                ? "Done"
                : "To do"}
          </p>
        </DashboardItemModal>
      ) : null}
    </div>
  );
}
