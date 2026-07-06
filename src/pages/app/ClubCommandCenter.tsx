import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  BarChart2,
  Calendar,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  Megaphone,
  UserPlus,
} from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import {
  isOpenAssigneeTask,
  isOpenDelegatedTask,
  isTaskAwaitingReviewFromUser,
} from "../../lib/taskCompletion";
import { getClubInitials } from "../../lib/clubUtils";
import { formatAccessLevelWithMemberTitle } from "../../lib/memberRoleTitle";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import { useClubMembers } from "../../hooks/useClubMembers";
import {
  computeClubSetupProgress,
  resolveClubSetupSettingsPath,
  shouldShowProfileSetupBanner,
} from "../../lib/clubProfileCompletion";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { formatTaskDate } from "../../lib/taskDueUrgency";
import {
  executiveTaskUrgencyBadgeStyle,
  executiveTaskUrgencyLabel,
  getExecutiveTaskUrgency,
} from "../../lib/executiveTaskUrgency";
import { TASK_STATUS_LABELS } from "../../lib/taskStatusActions";
import {
  deduplicateMonthlyEventsByTitle,
  deduplicateUpcomingEventsByTitle,
  type EventRecurringMeta,
} from "../../lib/eventRecurrence";
import { supabase } from "../../lib/supabaseClient";
import type { Club, ClubEvent, Post, RsvpCounts, Task, TaskStatus } from "../../types";
import Spinner from "../../components/ui/Spinner";
import { meetingNeedsRecap } from "./meetings/meetingDisplayHelpers";
import type { ClubMeeting } from "./meetings/meetingTypes";
import { isMeetingPast, mapMeetingRow, splitDateTime } from "./meetings/meetingUtils";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const SUCCESS_GREEN = "#4ade80";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const NEUTRAL_TOP_BORDER = "#3a3a3a";

const secondarySectionStyle: CSSProperties = {
  background: "#111111",
  borderColor: "#1f1f1f",
};

const secondarySectionHeading: CSSProperties = {
  fontWeight: 600,
  fontSize: "13px",
  color: "#888888",
  margin: "0 0 10px",
  letterSpacing: "-0.01em",
};

const urgentOutlinedButtonStyle: CSSProperties = {
  background: "transparent",
  color: ACCENT_RED,
  border: `1px solid ${ACCENT_RED}`,
  borderRadius: "6px",
  padding: "6px 14px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const sectionHeading: CSSProperties = {
  fontWeight: 700,
  fontSize: "15px",
  color: "#ffffff",
  margin: "0 0 12px",
  letterSpacing: "-0.01em",
};

const sectionCardStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "12px",
  padding: "16px",
};

const noteActionButtonStyle: CSSProperties = {
  background: "transparent",
  color: GOLD,
  border: `1px solid ${GOLD}`,
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const outlineButtonStyle: CSSProperties = {
  background: "transparent",
  color: "#cccccc",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const textLinkStyle: CSSProperties = {
  color: "#999999",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
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

function formatEventDateLine(dateStr: string, timeStr?: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
    ? new Date(`${dateStr.trim()}T12:00:00`)
    : new Date(dateStr);
  const dateLabel = Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const timeLabel =
    timeStr && timeStr.trim() && timeStr.toUpperCase() !== "TBD"
      ? formatEventTime12h(timeStr)
      : null;
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

function isHiddenLocation(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const upper = trimmed.toUpperCase();
  return upper === "TBD" || upper === "LOCATION TBD";
}

function eventDateBadgeParts(dateStr: string): { month: string; day: string } {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
    ? new Date(`${dateStr.trim()}T12:00:00`)
    : new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return { month: "---", day: "?" };
  }
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseTaskDueDate(dateStr: string | undefined): Date | null {
  if (!dateStr?.trim()) return null;
  const trimmed = dateStr.trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  return Number.isNaN(due.getTime()) ? null : due;
}

type ActivityKind = "join" | "rsvp" | "announcement" | "task" | "application";

type ActivityFeedItem = {
  id: string;
  kind: ActivityKind;
  description: string;
  timestamp: string;
  icon: ReactNode;
};

interface HiringSnapshot {
  openRolesCount: number;
  pendingApplicationsCount: number;
  rolesWithZeroApplicants: number;
  topOpenRole: { id: string; title: string } | null;
  loading: boolean;
}

type PendingActionItem = {
  id: string;
  label: string;
  actionLabel?: string;
  onAction?: () => void;
};

type UpcomingActivityRow =
  | {
      kind: "event";
      key: string;
      sortDate: string;
      title: string;
      dateStr: string;
      time?: string;
      location?: string;
      going: number;
      eventId: string;
    }
  | {
      kind: "meeting";
      key: string;
      sortDate: string;
      title: string;
      dateStr: string;
      timeLabel: string;
      locationLabel: string;
      meetingId: string;
    };

function taskStatusPillStyle(status: TaskStatus): CSSProperties {
  if (status === "in_progress") {
    return {
      background: "#2a1f00",
      border: "1px solid #FFC429",
      color: "#FFC429",
      borderRadius: "999px",
      padding: "2px 8px",
      fontSize: "10px",
      fontWeight: 600,
      flexShrink: 0,
    };
  }
  if (status === "pending_review") {
    return {
      background: "#1a1500",
      border: "1px solid #FFC429",
      color: "#FFC429",
      borderRadius: "999px",
      padding: "2px 8px",
      fontSize: "10px",
      fontWeight: 600,
      flexShrink: 0,
    };
  }
  if (status === "done") {
    return {
      background: "rgba(74, 222, 128, 0.08)",
      border: `1px solid ${SUCCESS_GREEN}`,
      color: SUCCESS_GREEN,
      borderRadius: "999px",
      padding: "2px 8px",
      fontSize: "10px",
      fontWeight: 600,
      flexShrink: 0,
    };
  }
  return {
    background: "#222222",
    border: "1px solid #444444",
    color: "#888888",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "10px",
    fontWeight: 600,
    flexShrink: 0,
  };
}

function taskSourceLabel(task: Task, clubName: string): string {
  if (task.linkedEventTitle?.trim()) return task.linkedEventTitle.trim();
  if (task.linkedMeetingTitle?.trim()) return task.linkedMeetingTitle.trim();
  if (task.linkedHiringTitle?.trim()) return task.linkedHiringTitle.trim();
  return clubName;
}

function formatTaskDueLabel(task: Task): string {
  if (!task.dueDate?.trim()) return "No due date";
  return formatTaskDate(task.dueDate);
}

function sortTasksByUrgency(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const leftUrgency = getExecutiveTaskUrgency(left.dueDate, left.status);
    const rightUrgency = getExecutiveTaskUrgency(right.dueDate, right.status);
    const rank = (value: ReturnType<typeof getExecutiveTaskUrgency>) => {
      if (value === "overdue") return 0;
      if (value === "due_today") return 1;
      if (value === "due_this_week") return 2;
      if (value === "upcoming") return 3;
      return 4;
    };
    const urgencyDiff = rank(leftUrgency) - rank(rightUrgency);
    if (urgencyDiff !== 0) return urgencyDiff;
    return (left.dueDate ?? "").localeCompare(right.dueDate ?? "");
  });
}

function ActivityTypeBadge({ label }: { label: "Event" | "Meeting" }) {
  const isEvent = label === "Event";
  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: isEvent ? GOLD : "#aaaaaa",
        background: isEvent ? "rgba(255, 196, 41, 0.1)" : "#1f1f1f",
        border: `1px solid ${isEvent ? "rgba(255, 196, 41, 0.25)" : CARD_BORDER}`,
        borderRadius: "999px",
        padding: "2px 7px",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function CompactTaskOverviewRow({
  task,
  meta,
  onClick,
}: {
  task: Task;
  meta: string;
  onClick: () => void;
}) {
  const urgency = getExecutiveTaskUrgency(task.dueDate, task.status);
  const urgencyLabel = executiveTaskUrgencyLabel(urgency);
  const urgencyStyle = executiveTaskUrgencyBadgeStyle(urgency);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        width: "100%",
        padding: "10px 12px",
        borderRadius: "8px",
        background: "#1a1a1a",
        border: `1px solid ${CARD_BORDER}`,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "4px",
            minWidth: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 600,
              color: "#ffffff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {task.title}
          </p>
          {urgencyLabel && urgencyStyle ? (
            <span style={urgencyStyle}>{urgencyLabel}</span>
          ) : null}
        </div>
        <p style={{ margin: 0, fontSize: "11px", color: "#777777", lineHeight: 1.35 }}>{meta}</p>
      </div>
      <span style={taskStatusPillStyle(task.status)}>
        {TASK_STATUS_LABELS[task.status] ?? task.status}
      </span>
    </button>
  );
}

function TaskOverviewColumn({
  title,
  emptyMessage,
  footerLabel,
  onFooterClick,
  isEmpty,
  children,
}: {
  title: string;
  emptyMessage: string;
  footerLabel: string;
  onFooterClick: () => void;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#111111",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        padding: "12px",
        minWidth: 0,
      }}
    >
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: "12px",
          fontWeight: 700,
          color: "#cccccc",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </h3>
      {isEmpty ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#666666", lineHeight: 1.45 }}>
          {emptyMessage}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>{children}</div>
      )}
      <button
        type="button"
        onClick={onFooterClick}
        style={{
          ...textLinkStyle,
          marginTop: "10px",
          fontSize: "12px",
          color: "#aaaaaa",
        }}
      >
        {footerLabel} →
      </button>
    </div>
  );
}

function UpcomingClubActivityRow({
  row,
  club,
  onManage,
}: {
  row: UpcomingActivityRow;
  club: Club;
  onManage: () => void;
}) {
  if (row.kind === "event") {
    const timeLabel =
      row.time && row.time.trim() && row.time.toUpperCase() !== "TBD"
        ? formatEventTime12h(row.time)
        : "Time TBD";
    const locationLabel =
      row.location && !isHiddenLocation(row.location) ? row.location.trim() : "Location TBD";

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 12px",
          borderRadius: "8px",
          background: "#1a1a1a",
          border: `1px solid ${CARD_BORDER}`,
        }}
      >
        <ActivityRowLeading club={club} dateStr={row.dateStr} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
              minWidth: 0,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "#ffffff",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
              }}
            >
              {row.title}
            </p>
            <ActivityTypeBadge label="Event" />
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#777777", lineHeight: 1.35 }}>
            {timeLabel} · {locationLabel}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: row.going > 0 ? GOLD : "#666666",
              background: row.going > 0 ? "rgba(255, 196, 41, 0.1)" : "#111111",
              border: `1px solid ${row.going > 0 ? "rgba(255, 196, 41, 0.25)" : CARD_BORDER}`,
              borderRadius: "999px",
              padding: "3px 8px",
            }}
          >
            {row.going} going
          </span>
          <button
            type="button"
            onClick={onManage}
            style={{
              ...textLinkStyle,
              fontSize: "12px",
              color: "#aaaaaa",
            }}
          >
            Manage →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        borderRadius: "8px",
        background: "#1a1a1a",
        border: `1px solid ${CARD_BORDER}`,
      }}
    >
      <ActivityRowLeading club={club} dateStr={row.dateStr} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
            minWidth: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              lineHeight: 1.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {row.title}
          </p>
          <ActivityTypeBadge label="Meeting" />
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#777777", lineHeight: 1.35 }}>
          {row.timeLabel} · {row.locationLabel}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#888888",
            background: "#111111",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "999px",
            padding: "3px 8px",
          }}
        >
          Scheduled
        </span>
        <button
          type="button"
          onClick={onManage}
          style={{
            ...textLinkStyle,
            fontSize: "12px",
            color: "#aaaaaa",
          }}
        >
          Manage →
        </button>
      </div>
    </div>
  );
}

const GOLD_OUTLINED_BUTTON_STYLE: CSSProperties = {
  ...urgentOutlinedButtonStyle,
  color: GOLD,
  border: `1px solid ${GOLD}`,
};

function CompactEventDateBadge({ dateStr }: { dateStr: string }) {
  const { month, day } = eventDateBadgeParts(dateStr);

  return (
    <div
      style={{
        width: "40px",
        height: "44px",
        borderRadius: "6px",
        background: ACCENT_RED,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#ffffff",
        lineHeight: 1.1,
      }}
    >
      <span style={{ fontSize: "9px", fontWeight: 600 }}>{month}</span>
      <span style={{ fontSize: "15px", fontWeight: 700 }}>{day}</span>
    </div>
  );
}

function ActivityRowLeading({ club, dateStr }: { club: Club; dateStr: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
      <CompactEventDateBadge dateStr={dateStr} />
      {club.logoUrl?.trim() ? (
        <img
          src={club.logoUrl}
          alt=""
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            objectFit: "cover",
            border: `1px solid ${CARD_BORDER}`,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            background: "#1a1a1a",
            border: `1px solid ${CARD_BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "11px",
            fontWeight: 800,
            color: GOLD,
          }}
        >
          {getClubInitials(club)}
        </div>
      )}
    </div>
  );
}

function ProfileSetupBanner({
  completion,
  missingLabels,
  onComplete,
}: {
  completion: number;
  missingLabels: string[];
  onComplete: () => void;
}) {
  return (
    <div
      style={{
        ...sectionCardStyle,
        background: "rgba(255, 196, 41, 0.08)",
        border: "1px solid rgba(255, 196, 41, 0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: "13px",
            fontWeight: 700,
            color: GOLD,
          }}
        >
          Profile setup incomplete ({completion}%)
        </p>
        <p style={{ margin: 0, fontSize: "12px", color: "#cccccc", lineHeight: 1.45 }}>
          {missingLabels.length > 0
            ? `Still needed: ${missingLabels.join(", ")}`
            : "Finish your club profile so members can find and trust your page."}
        </p>
      </div>
      <button type="button" style={noteActionButtonStyle} onClick={onComplete}>
        Complete Setup
      </button>
    </div>
  );
}

function CommandCenterStatCard({
  label,
  value,
  sublabel,
  actionLabel,
  icon,
  accentColor,
  iconColor,
  onClick,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  actionLabel?: string;
  icon: ReactNode;
  accentColor: string;
  iconColor?: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const resolvedIconColor = iconColor ?? accentColor;
  const style: CSSProperties = {
    background: CARD_BG,
    borderRadius: "12px",
    padding: "16px 18px",
    position: "relative",
    width: "100%",
    minHeight: "112px",
    textAlign: "left",
    borderTop: `2px solid ${accentColor}`,
    borderRight: `1px solid ${CARD_BORDER}`,
    borderBottom: `1px solid ${CARD_BORDER}`,
    borderLeft: `1px solid ${CARD_BORDER}`,
    cursor: onClick ? "pointer" : "default",
    transition: "transform 0.15s ease, border-color 0.15s ease",
    transform: hovered && onClick ? "translateY(-1px)" : undefined,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  };

  const content = (
    <>
      <span
        className="[&_svg]:h-[18px] [&_svg]:w-[18px]"
        style={{
          position: "absolute",
          top: "14px",
          right: "14px",
          color: resolvedIconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.9,
        }}
      >
        {icon}
      </span>
      <p
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#666666",
          margin: "0 0 8px",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "30px",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1,
          margin: "0 0 6px",
        }}
      >
        {value}
      </p>
      {sublabel ? (
        <p style={{ fontSize: "12px", color: "#555555", margin: 0, lineHeight: 1.35 }}>{sublabel}</p>
      ) : null}
      {actionLabel ? (
        <p
          style={{
            fontSize: "12px",
            color: accentColor,
            margin: "6px 0 0",
            lineHeight: 1.35,
            fontWeight: 600,
          }}
        >
          {actionLabel} →
        </p>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
      >
        {content}
      </button>
    );
  }

  return <div style={style}>{content}</div>;
}

function ClubIdentityHeader({
  club,
  roleContextLabel,
}: {
  club: Club;
  roleContextLabel?: string;
}) {
  const university = club.university?.trim() || "University of Guelph";

  return (
    <header
      style={{
        ...sectionCardStyle,
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "18px 20px",
        background: "linear-gradient(135deg, #161616 0%, #141414 100%)",
      }}
    >
      {club.logoUrl?.trim() ? (
        <img
          src={club.logoUrl}
          alt=""
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "12px",
            objectFit: "cover",
            flexShrink: 0,
            border: `1px solid ${CARD_BORDER}`,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
          }}
        />
      ) : (
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "12px",
            background: "#1a1a1a",
            border: `1px solid ${CARD_BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "20px",
            fontWeight: 800,
            color: GOLD,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
          }}
        >
          {getClubInitials(club)}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "6px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 700,
              color: ACCENT_RED,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Club Command Center
          </p>
          {roleContextLabel ? (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#888888",
                background: "#1f1f1f",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: "999px",
                padding: "2px 8px",
                letterSpacing: "0.02em",
              }}
            >
              {roleContextLabel}
            </span>
          ) : null}
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          {club.name}
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#888888", fontWeight: 500 }}>
          {university}
        </p>
      </div>
    </header>
  );
}

function parseListingDeadline(deadline: string | null | undefined): Date | null {
  if (!deadline?.trim()) return null;
  const trimmed = deadline.trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  return Number.isNaN(due.getTime()) ? null : due;
}

function HiringDonutChart({
  openRolesCount,
  rolesWithZeroApplicants,
}: {
  openRolesCount: number;
  rolesWithZeroApplicants: number;
}) {
  const size = 96;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rolesWithApplicants = Math.max(openRolesCount - rolesWithZeroApplicants, 0);
  const total = Math.max(openRolesCount, 1);
  const withApplicantsLength = (rolesWithApplicants / total) * circumference;
  const zeroApplicantsLength = (rolesWithZeroApplicants / total) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={stroke}
        />
        {openRolesCount > 0 ? (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={GOLD}
              strokeWidth={stroke}
              strokeDasharray={`${withApplicantsLength} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            {rolesWithZeroApplicants > 0 ? (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#555555"
                strokeWidth={stroke}
                strokeDasharray={`${zeroApplicantsLength} ${circumference}`}
                strokeDashoffset={-withApplicantsLength}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            ) : null}
          </>
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <span style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>
          {openRolesCount}
        </span>
        <span
          style={{
            fontSize: "8px",
            fontWeight: 700,
            color: "#777777",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginTop: "2px",
          }}
        >
          Open Roles
        </span>
      </div>
    </div>
  );
}

function HiringMetricLine({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "10px 12px",
        borderRadius: "8px",
        background: "#1a1a1a",
        border: `1px solid ${highlight ? "rgba(229, 25, 55, 0.35)" : CARD_BORDER}`,
      }}
    >
      <p
        style={{
          margin: "0 0 4px",
          fontSize: "10px",
          color: "#666666",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "22px",
          fontWeight: 800,
          color: highlight && value > 0 ? ACCENT_RED : "#ffffff",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function needsAttentionButtonStyle(itemId: string): CSSProperties {
  if (
    itemId === "join-requests" ||
    itemId === "applications" ||
    itemId === "overdue-tasks" ||
    itemId.startsWith("review-")
  ) {
    return urgentOutlinedButtonStyle;
  }
  if (itemId.startsWith("low-rsvp")) {
    return GOLD_OUTLINED_BUTTON_STYLE;
  }
  return outlineButtonStyle;
}

function PendingActionsSection({
  items,
  loading,
  sectionRef,
}: {
  items: PendingActionItem[];
  loading: boolean;
  sectionRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section ref={sectionRef} id="pending-actions" style={sectionCardStyle}>
      <h2
        style={{
          ...sectionHeading,
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span>Pending Actions</span>
        <span style={{ color: "#666666", fontWeight: 600, fontSize: "13px" }}>· {items.length}</span>
      </h2>
      {loading ? (
        <div className="flex justify-center py-3">
          <Spinner label="Loading pending actions…" />
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            background: "#111111",
            border: `1px solid ${CARD_BORDER}`,
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#666666" }}>
            Nothing needs attention right now.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "#1a1a1a",
                border: `1px solid ${CARD_BORDER}`,
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#cccccc", lineHeight: 1.4, flex: 1 }}>
                {item.label}
              </p>
              {item.onAction && item.actionLabel ? (
                <button
                  type="button"
                  style={{ ...needsAttentionButtonStyle(item.id), flexShrink: 0 }}
                  onClick={item.onAction}
                >
                  {item.actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function QuickActionTile({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px 14px",
        minHeight: "84px",
        background: hovered ? "#1f1f1f" : "#1a1a1a",
        border: `1px solid ${hovered ? "#333333" : CARD_BORDER}`,
        borderRadius: "8px",
        color: "#cccccc",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      <span style={{ color: GOLD, display: "flex" }}>{icon}</span>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "#dddddd", lineHeight: 1.3 }}>
        {label}
      </span>
    </button>
  );
}

function RemindersQuickActionsCard({
  reminderEvent,
  isMobile,
  quickActions,
  onUseReminderTemplate,
}: {
  reminderEvent: { title: string; dateLine: string } | null;
  isMobile: boolean;
  quickActions: { id: string; icon: ReactNode; label: string; onClick: () => void }[];
  onUseReminderTemplate: () => void;
}) {
  const gridColumns = isMobile
    ? "repeat(2, minmax(0, 1fr))"
    : `repeat(${Math.min(Math.max(quickActions.length, 1), 5)}, minmax(0, 1fr))`;

  return (
    <section style={sectionCardStyle}>
      <h2 style={{ ...sectionHeading, marginBottom: "10px" }}>Reminders &amp; Quick Actions</h2>
      {reminderEvent ? (
        <div
          style={{
            background: "rgba(255, 196, 41, 0.08)",
            border: `1px solid rgba(255, 196, 41, 0.28)`,
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "10px",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#cccccc", lineHeight: 1.45 }}>
            <strong style={{ color: GOLD }}>{reminderEvent.title}</strong> is coming up on{" "}
            {reminderEvent.dateLine}.
          </p>
          <button type="button" style={noteActionButtonStyle} onClick={onUseReminderTemplate}>
            Use Reminder Template
          </button>
        </div>
      ) : null}
      {quickActions.length === 0 ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#666666" }}>
          No quick actions available for your role.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridColumns,
            gap: "8px",
          }}
        >
          {quickActions.map((action) => (
            <QuickActionTile
              key={action.id}
              icon={action.icon}
              label={action.label}
              onClick={action.onClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export interface ClubCommandCenterProps {
  club: Club;
  clubId: string;
  tasks: Task[];
  tasksLoading: boolean;
  posts: Post[];
  postsLoading: boolean;
  eventsCount: number;
  upcomingOccurrences: (ClubEvent & { occurrenceDate: string })[];
  eventsLoading: boolean;
  eventRsvpCounts: Record<string, RsvpCounts>;
  eventRecurring: Record<string, EventRecurringMeta>;
  isMobile: boolean;
  onOpenTask: (task: Task) => void;
}

export default function ClubCommandCenter({
  club,
  clubId,
  tasks,
  tasksLoading,
  posts,
  eventsCount,
  upcomingOccurrences,
  eventsLoading,
  eventRsvpCounts,
  eventRecurring,
  isMobile,
  onOpenTask,
}: ClubCommandCenterProps) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const memberAccess = useClubMemberAccess(clubId);
  const { pendingMembers, loading: membersLoading } = useClubMembers(clubId);
  const pendingActionsRef = useRef<HTMLElement | null>(null);

  const [hiringSnapshot, setHiringSnapshot] = useState<HiringSnapshot>({
    openRolesCount: 0,
    pendingApplicationsCount: 0,
    rolesWithZeroApplicants: 0,
    topOpenRole: null,
    loading: true,
  });
  const [activityItems, setActivityItems] = useState<ActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [clubMeetings, setClubMeetings] = useState<ClubMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);

  const basePath = `/app/clubs/${clubId}`;
  const eventsPath = `${basePath}/events`;
  const meetingsPath = `${basePath}/meetings`;
  const announcementsPath = `${basePath}/announcements`;
  const tasksPath = `${basePath}/tasks`;
  const membersPath = `${basePath}/members`;
  const recruitingPath = `${basePath}/recruiting`;
  const settingsPath = `${basePath}/settings`;
  const analyticsPath = `${basePath}/analytics`;
  const setupSettingsPath = resolveClubSetupSettingsPath(settingsPath, club, {
    postsCount: posts.length,
    eventsCount,
  });

  const canManageMeetings =
    memberAccess.isPresident || memberAccess.can("manage_meetings");
  const canManageHiring =
    memberAccess.isPresident || memberAccess.can("manage_hiring");
  const canViewAnalytics =
    memberAccess.isPresident || memberAccess.can("view_analytics");
  const canCreateAnnouncement =
    memberAccess.isPresident || memberAccess.can("manage_announcements");
  const canCreateEvent =
    memberAccess.isPresident || memberAccess.can("manage_events");
  const canCreateTask =
    memberAccess.isPresident || memberAccess.can("manage_tasks");
  const canInviteMembersQuickAction = memberAccess.canInviteMembers;

  const openSetupSettings = () => navigate(setupSettingsPath);

  const scrollToPendingActions = () => {
    pendingActionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const roleContextLabel = useMemo(() => {
    if (memberAccess.loading) return undefined;
    const label = formatAccessLevelWithMemberTitle(
      memberAccess.accessLevel,
      memberAccess.role,
      memberAccess.memberTitle,
    );
    return `${label} View`;
  }, [
    memberAccess.accessLevel,
    memberAccess.loading,
    memberAccess.memberTitle,
    memberAccess.role,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadClubMeetings() {
      setMeetingsLoading(true);

      const { data, error } = await supabase
        .from("club_meetings")
        .select("*")
        .eq("club_id", clubId)
        .neq("status", "cancelled");

      if (cancelled) return;

      if (error) {
        console.error("Failed to load club meetings:", error.message);
        setClubMeetings([]);
        setMeetingsLoading(false);
        return;
      }

      setClubMeetings((data ?? []).map((row) => mapMeetingRow(row)));
      setMeetingsLoading(false);
    }

    void loadClubMeetings();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const needsRecapMeetings = useMemo(
    () =>
      canManageMeetings
        ? clubMeetings.filter(
            (meeting) => isMeetingPast(meeting) && meetingNeedsRecap(meeting),
          )
        : [],
    [canManageMeetings, clubMeetings],
  );

  const upcomingMeetings = useMemo(
    () =>
      [...clubMeetings]
        .filter((meeting) => !isMeetingPast(meeting))
        .sort(
          (left, right) =>
            new Date(left.date).getTime() - new Date(right.date).getTime(),
        ),
    [clubMeetings],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHiringSnapshot() {
      if (!canManageHiring) {
        setHiringSnapshot({
          openRolesCount: 0,
          pendingApplicationsCount: 0,
          rolesWithZeroApplicants: 0,
          topOpenRole: null,
          loading: false,
        });
        return;
      }

      setHiringSnapshot((prev) => ({ ...prev, loading: true }));

      const { data: listings, error: listingsError } = await supabase
        .from("hiring_listings")
        .select("id, title, deadline")
        .eq("club_id", clubId)
        .eq("is_open", true);

      if (cancelled) return;

      if (listingsError) {
        console.error("Failed to load hiring listings:", listingsError.message);
        setHiringSnapshot({
          openRolesCount: 0,
          pendingApplicationsCount: 0,
          rolesWithZeroApplicants: 0,
          topOpenRole: null,
          loading: false,
        });
        return;
      }

      const openListings = (listings ?? []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? "Open role",
        deadline: (row.deadline as string | null) ?? null,
      }));
      const listingIds = openListings.map((row) => row.id);
      let pendingApplicationsCount = 0;
      let rolesWithZeroApplicants = listingIds.length;
      let topOpenRole: { id: string; title: string } | null = null;

      if (listingIds.length > 0) {
        const { data: applications, error: applicationsError } = await supabase
          .from("hiring_applications")
          .select("listing_id, status")
          .in("listing_id", listingIds);

        if (cancelled) return;

        if (applicationsError) {
          console.error("Failed to load hiring applications:", applicationsError.message);
        } else {
          const countsByListing = new Map<string, number>();
          for (const application of applications ?? []) {
            const listingId = application.listing_id as string;
            countsByListing.set(listingId, (countsByListing.get(listingId) ?? 0) + 1);
            if ((application.status as string) === "pending") {
              pendingApplicationsCount += 1;
            }
          }
          rolesWithZeroApplicants = listingIds.filter(
            (listingId) => (countsByListing.get(listingId) ?? 0) === 0,
          ).length;

          const rankedListings = [...openListings].sort((left, right) => {
            const leftCount = countsByListing.get(left.id) ?? 0;
            const rightCount = countsByListing.get(right.id) ?? 0;
            if (rightCount !== leftCount) return rightCount - leftCount;

            const leftDeadline = parseListingDeadline(left.deadline);
            const rightDeadline = parseListingDeadline(right.deadline);
            if (leftDeadline && rightDeadline) {
              return leftDeadline.getTime() - rightDeadline.getTime();
            }
            if (leftDeadline) return -1;
            if (rightDeadline) return 1;
            return 0;
          });

          if (rankedListings[0]) {
            topOpenRole = {
              id: rankedListings[0].id,
              title: rankedListings[0].title,
            };
          }
        }
      }

      setHiringSnapshot({
        openRolesCount: listingIds.length,
        pendingApplicationsCount,
        rolesWithZeroApplicants,
        topOpenRole,
        loading: false,
      });
    }

    void loadHiringSnapshot();
    return () => {
      cancelled = true;
    };
  }, [clubId, canManageHiring]);

  useEffect(() => {
    let cancelled = false;

    async function loadActivityFeed() {
      setActivityLoading(true);

      const [
        membersRes,
        clubEventsRes,
        applicationsListingRes,
      ] = await Promise.all([
        supabase
          .from("club_members")
          .select(
            `
            created_at,
            member_profile:profiles!club_members_user_profile_fkey ( full_name )
          `,
          )
          .eq("club_id", clubId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("events").select("id, title").eq("club_id", clubId),
        supabase
          .from("hiring_listings")
          .select("id, title")
          .eq("club_id", clubId),
      ]);

      if (cancelled) return;

      const eventTitleById = new Map(
        (clubEventsRes.data ?? []).map((row) => [row.id as string, (row.title as string) ?? "Event"]),
      );
      const eventIds = Array.from(eventTitleById.keys());

      const listingTitleById = new Map(
        (applicationsListingRes.data ?? []).map((row) => [
          row.id as string,
          (row.title as string) ?? "Role",
        ]),
      );
      const listingIds = Array.from(listingTitleById.keys());

      const [rsvpsRes, applicationsRes] = await Promise.all([
        eventIds.length
          ? supabase
              .from("event_rsvps")
              .select("created_at, user_id, event_id")
              .in("event_id", eventIds)
              .order("created_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
        listingIds.length
          ? supabase
              .from("hiring_applications")
              .select("created_at, applicant_id, listing_id")
              .in("listing_id", listingIds)
              .order("created_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const profileIds = new Set<string>();
      for (const row of rsvpsRes.data ?? []) {
        profileIds.add(row.user_id as string);
      }
      for (const row of applicationsRes.data ?? []) {
        profileIds.add(row.applicant_id as string);
      }

      const profilesRes =
        profileIds.size > 0
          ? await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", Array.from(profileIds))
          : { data: [], error: null };

      if (cancelled) return;

      const profileNameById = new Map(
        (profilesRes.data ?? []).map((row) => [
          row.id as string,
          ((row.full_name as string | null) ?? "Someone").trim(),
        ]),
      );

      const feed: ActivityFeedItem[] = [];

      for (const row of membersRes.data ?? []) {
        const profileRaw = row.member_profile;
        const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
        const name = ((profile as { full_name?: string } | null)?.full_name ?? "Someone").trim();
        feed.push({
          id: `join-${row.created_at as string}-${name}`,
          kind: "join",
          description: `${name} joined the club`,
          timestamp: row.created_at as string,
          icon: <UserPlus size={14} color="#888888" aria-hidden />,
        });
      }

      for (const row of rsvpsRes.data ?? []) {
        const name = profileNameById.get(row.user_id as string) ?? "Someone";
        const eventTitle = eventTitleById.get(row.event_id as string) ?? "an event";
        feed.push({
          id: `rsvp-${row.created_at as string}-${row.user_id as string}`,
          kind: "rsvp",
          description: `${name} RSVP'd to ${eventTitle}`,
          timestamp: row.created_at as string,
          icon: <Calendar size={14} color="#888888" aria-hidden />,
        });
      }

      for (const post of posts.slice(0, 5)) {
        feed.push({
          id: `announcement-${post.id}`,
          kind: "announcement",
          description: `${post.authorName ?? "Someone"} posted an announcement`,
          timestamp: post.createdAt,
          icon: <Megaphone size={14} color="#888888" aria-hidden />,
        });
      }

      for (const task of tasks.filter((item) => item.status === "done").slice(0, 5)) {
        feed.push({
          id: `task-${task.id}`,
          kind: "task",
          description: `Task completed: ${task.title}`,
          timestamp: task.createdAt,
          icon: <CheckSquare size={14} color="#888888" aria-hidden />,
        });
      }

      for (const row of applicationsRes.data ?? []) {
        const name = profileNameById.get(row.applicant_id as string) ?? "Someone";
        const roleTitle = listingTitleById.get(row.listing_id as string) ?? "a role";
        feed.push({
          id: `application-${row.created_at as string}-${row.applicant_id as string}`,
          kind: "application",
          description: `${name} applied for ${roleTitle}`,
          timestamp: row.created_at as string,
          icon: <Briefcase size={14} color="#888888" aria-hidden />,
        });
      }

      feed.sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );

      setActivityItems(feed.slice(0, 5));
      setActivityLoading(false);
    }

    void loadActivityFeed();
    return () => {
      cancelled = true;
    };
  }, [clubId, posts, tasks]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.status !== "cancelled"),
    [tasks],
  );

  const eventsThisMonthCount = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const startYmd = startOfMonth.toISOString().slice(0, 10);
    const endYmd = endOfMonth.toISOString().slice(0, 10);

    const eventsThisMonth = upcomingOccurrences.filter(
      (event) => event.occurrenceDate >= startYmd && event.occurrenceDate <= endYmd,
    );
    return deduplicateMonthlyEventsByTitle(eventsThisMonth, eventRecurring).length;
  }, [upcomingOccurrences, eventRecurring]);

  const previewUpcomingEvents = useMemo(() => {
    const sorted = [...upcomingOccurrences].sort((left, right) =>
      left.occurrenceDate.localeCompare(right.occurrenceDate),
    );
    return deduplicateUpcomingEventsByTitle(sorted, 5);
  }, [upcomingOccurrences]);

  const previewUpcomingActivity = useMemo(() => {
    const rows: UpcomingActivityRow[] = [];

    for (const event of previewUpcomingEvents) {
      rows.push({
        kind: "event",
        key: `${event.id}-${event.occurrenceDate}`,
        sortDate: event.occurrenceDate,
        title: event.title,
        dateStr: event.occurrenceDate,
        time: event.time,
        location: event.location,
        going: eventRsvpCounts[event.id]?.going ?? 0,
        eventId: event.id,
      });
    }

    for (const meeting of upcomingMeetings) {
      const { time } = splitDateTime(meeting.date);
      const timeLabel = time?.trim() ? formatEventTime12h(time) : "Time TBD";
      const locationLabel = meeting.location?.trim()
        ? meeting.location.trim()
        : meeting.meetingLink?.trim()
          ? "Online"
          : "Location TBD";

      rows.push({
        kind: "meeting",
        key: `meeting-${meeting.id}`,
        sortDate: meeting.date,
        title: meeting.title,
        dateStr: meeting.date.slice(0, 10),
        timeLabel,
        locationLabel,
        meetingId: meeting.id,
      });
    }

    return rows
      .sort((left, right) => left.sortDate.localeCompare(right.sortDate))
      .slice(0, 3);
  }, [previewUpcomingEvents, upcomingMeetings, eventRsvpCounts]);

  const setupProgress = useMemo(
    () =>
      computeClubSetupProgress(club, {
        postsCount: posts.length,
        eventsCount,
      }),
    [club, posts.length, eventsCount],
  );
  const profileCompletion = setupProgress.percent;
  const profileMissingLabels = setupProgress.missingLabels;

  const pendingJoinCount = pendingMembers.length;
  const pendingApplicationCount = hiringSnapshot.pendingApplicationsCount;

  const needsReviewTasks = useMemo(() => {
    if (!user?.id) return [];
    return tasks.filter((task) => isTaskAwaitingReviewFromUser(task, user.id));
  }, [tasks, user?.id]);

  const myOpenAssignedTasks = useMemo(() => {
    if (!user?.id) return [];
    return openTasks.filter((task) => isOpenAssigneeTask(task, user.id));
  }, [openTasks, user?.id]);

  const myOverdueAssignedTasks = useMemo(
    () =>
      myOpenAssignedTasks.filter((task) => {
        const due = parseTaskDueDate(task.dueDate);
        return due != null && due.getTime() < today.getTime();
      }),
    [myOpenAssignedTasks, today],
  );

  const delegatedOpenTasks = useMemo(() => {
    if (!user?.id) return [];
    return openTasks.filter((task) => isOpenDelegatedTask(task, user.id));
  }, [openTasks, user?.id]);

  const delegatedOverdueTasks = useMemo(
    () =>
      delegatedOpenTasks.filter((task) => {
        const due = parseTaskDueDate(task.dueDate);
        return due != null && due.getTime() < today.getTime();
      }),
    [delegatedOpenTasks, today],
  );

  const unassignedDelegatedTasks = useMemo(() => {
    if (!user?.id) return [];
    return openTasks.filter(
      (task) =>
        task.createdBy === user.id &&
        !task.assignedTo &&
        (task.status === "todo" || task.status === "in_progress"),
    );
  }, [openTasks, user?.id]);

  const overdueTasks = useMemo(
    () =>
      openTasks.filter((task) => {
        const due = parseTaskDueDate(task.dueDate);
        return due != null && due.getTime() < today.getTime();
      }),
    [openTasks, today],
  );

  const pendingActionsAll = useMemo(() => {
    const items: PendingActionItem[] = [];

    if (memberAccess.canApproveMembers && pendingJoinCount > 0) {
      items.push({
        id: "join-requests",
        label: `${pendingJoinCount} pending join request${pendingJoinCount === 1 ? "" : "s"}`,
        actionLabel: "Review",
        onAction: () => navigate(`${membersPath}?tab=pending`),
      });
    }

    if (canManageHiring && pendingApplicationCount > 0) {
      items.push({
        id: "applications",
        label: `${pendingApplicationCount} pending application${pendingApplicationCount === 1 ? "" : "s"}`,
        actionLabel: "Review",
        onAction: () => navigate(`${recruitingPath}?tab=applications`),
      });
    }

    if (overdueTasks.length > 0) {
      items.push({
        id: "overdue-tasks",
        label: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
        actionLabel: "View Tasks",
        onAction: () => navigate(tasksPath),
      });
    }

    for (const task of needsReviewTasks) {
      items.push({
        id: `review-${task.id}`,
        label: `Task awaiting review: ${task.title}`,
        actionLabel: "Review Task",
        onAction: () => onOpenTask(task),
      });
    }

    if (canManageMeetings && needsRecapMeetings.length > 0) {
      items.push({
        id: "meeting-recaps",
        label: `${needsRecapMeetings.length} meeting${needsRecapMeetings.length === 1 ? "" : "s"} need recap`,
        actionLabel: "Add Recap",
        onAction: () => navigate(meetingsPath),
      });
    }

    for (const event of previewUpcomingEvents) {
      const going = eventRsvpCounts[event.id]?.going ?? 0;
      const eventDate = startOfDay(new Date(`${event.occurrenceDate}T12:00:00`));
      const daysUntil = Math.round(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil >= 0 && daysUntil <= 14 && going < 5) {
        items.push({
          id: `low-rsvp-${event.id}`,
          label: `Low RSVPs for ${event.title} (${going} going)`,
          actionLabel: "View RSVPs",
          onAction: () => navigate(`${eventsPath}?viewRsvps=${event.id}`),
        });
      }
    }

    return items;
  }, [
    memberAccess.canApproveMembers,
    canManageHiring,
    pendingJoinCount,
    pendingApplicationCount,
    overdueTasks.length,
    needsReviewTasks,
    canManageMeetings,
    needsRecapMeetings.length,
    previewUpcomingEvents,
    eventRsvpCounts,
    today,
    navigate,
    membersPath,
    recruitingPath,
    tasksPath,
    meetingsPath,
    eventsPath,
    onOpenTask,
  ]);

  const pendingActionsItems = useMemo(
    () => pendingActionsAll.slice(0, 8),
    [pendingActionsAll],
  );

  const pendingActionsCount = pendingActionsAll.length;

  const nextUpcomingEvent = previewUpcomingEvents[0] ?? null;

  const showProfileSetupBanner =
    memberAccess.canManageClubSettings && shouldShowProfileSetupBanner(club);

  const upcomingReminderEvent = useMemo(() => {
    const eventInThreeDays = upcomingOccurrences.find((event) => {
      const eventDate = startOfDay(new Date(`${event.occurrenceDate}T12:00:00`));
      const diffDays = Math.round(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return diffDays >= 0 && diffDays <= 3;
    });

    if (!eventInThreeDays) return null;

    return {
      title: eventInThreeDays.title,
      dateLine: formatEventDateLine(eventInThreeDays.occurrenceDate, eventInThreeDays.time),
    };
  }, [upcomingOccurrences, today]);

  const myTasksOverviewPreview = useMemo(
    () => sortTasksByUrgency(myOpenAssignedTasks).slice(0, 3),
    [myOpenAssignedTasks],
  );

  const delegatedTasksOverviewPreview = useMemo(
    () =>
      [...delegatedOpenTasks]
        .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""))
        .slice(0, 3),
    [delegatedOpenTasks],
  );

  const upcomingActivityLoading = eventsLoading || meetingsLoading;

  const pendingActionsLoading =
    tasksLoading || membersLoading || hiringSnapshot.loading || meetingsLoading;

  const delegatedTasksSublabel = useMemo(() => {
    if (delegatedOpenTasks.length === 0) {
      return "";
    }
    const parts: string[] = [];
    if (delegatedOverdueTasks.length > 0) {
      parts.push(`${delegatedOverdueTasks.length} overdue`);
    }
    if (unassignedDelegatedTasks.length > 0) {
      parts.push(`${unassignedDelegatedTasks.length} unassigned`);
    }
    return parts.length > 0 ? parts.join(" · ") : "";
  }, [
    delegatedOpenTasks.length,
    delegatedOverdueTasks.length,
    unassignedDelegatedTasks.length,
  ]);

  const hiringIsUrgent =
    canManageHiring && hiringSnapshot.pendingApplicationsCount > 0;

  const quickActions = useMemo(() => {
    const actions: { id: string; icon: ReactNode; label: string; onClick: () => void }[] = [];

    if (canCreateAnnouncement) {
      actions.push({
        id: "announcement",
        icon: <Megaphone size={16} aria-hidden />,
        label: "New Announcement",
        onClick: () => navigate(`${announcementsPath}?openCreate=true`),
      });
    }
    if (canCreateEvent) {
      actions.push({
        id: "event",
        icon: <Calendar size={16} aria-hidden />,
        label: "Add Event",
        onClick: () => navigate(`${eventsPath}?openCreate=true`),
      });
    }
    if (canCreateTask) {
      actions.push({
        id: "task",
        icon: <CheckSquare size={16} aria-hidden />,
        label: "Create Task",
        onClick: () => navigate(`${tasksPath}?openCreate=true`),
      });
    }
    if (canManageMeetings) {
      actions.push({
        id: "meeting",
        icon: <CalendarClock size={16} aria-hidden />,
        label: "Schedule Meeting",
        onClick: () => navigate(`${meetingsPath}/new`),
      });
    }
    if (canInviteMembersQuickAction) {
      actions.push({
        id: "invite",
        icon: <UserPlus size={16} aria-hidden />,
        label: "Invite Members",
        onClick: () => navigate(membersPath),
      });
    }
    if (canViewAnalytics) {
      actions.push({
        id: "analytics",
        icon: <BarChart2 size={16} aria-hidden />,
        label: "View Reports",
        onClick: () => navigate(analyticsPath),
      });
    }

    return actions;
  }, [
    analyticsPath,
    announcementsPath,
    canCreateAnnouncement,
    canCreateEvent,
    canCreateTask,
    canInviteMembersQuickAction,
    canManageMeetings,
    canViewAnalytics,
    eventsPath,
    meetingsPath,
    membersPath,
    navigate,
    tasksPath,
  ]);

  const topStatCardCount = canCreateTask ? 4 : 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <ClubIdentityHeader club={club} roleContextLabel={roleContextLabel} />

      {showProfileSetupBanner ? (
        <ProfileSetupBanner
          completion={profileCompletion}
          missingLabels={profileMissingLabels}
          onComplete={openSetupSettings}
        />
      ) : null}

      <section>
        {pendingActionsLoading ? (
          <div className="flex justify-center py-3">
            <Spinner label="Loading command center…" />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "repeat(2, 1fr)"
                : `repeat(${topStatCardCount}, 1fr)`,
              gap: "10px",
              alignItems: "stretch",
            }}
          >
            <CommandCenterStatCard
              label="Pending Actions"
              value={pendingActionsCount}
              sublabel={
                pendingActionsCount > 0
                  ? `${pendingActionsCount} need${pendingActionsCount === 1 ? "s" : ""} review`
                  : "All caught up"
              }
              actionLabel="Review"
              icon={<ClipboardList size={18} aria-hidden />}
              accentColor={ACCENT_RED}
              iconColor={ACCENT_RED}
              onClick={scrollToPendingActions}
            />
            <CommandCenterStatCard
              label="Upcoming Activity"
              value={eventsThisMonthCount}
              sublabel={
                nextUpcomingEvent
                  ? `Next: ${nextUpcomingEvent.title}`
                  : "Nothing scheduled this month"
              }
              actionLabel={nextUpcomingEvent ? "Manage Events" : "View Calendar"}
              icon={<Calendar size={18} aria-hidden />}
              accentColor={GOLD}
              iconColor={GOLD}
              onClick={() => navigate(eventsPath)}
            />
            <CommandCenterStatCard
              label="Tasks Assigned to Me"
              value={myOpenAssignedTasks.length}
              sublabel={
                myOverdueAssignedTasks.length > 0
                  ? `${myOverdueAssignedTasks.length} overdue`
                  : myOpenAssignedTasks.length === 0
                    ? "No open tasks"
                    : ""
              }
              actionLabel="View My Tasks"
              icon={<CheckSquare size={18} aria-hidden />}
              accentColor={
                myOverdueAssignedTasks.length > 0 ? ACCENT_RED : NEUTRAL_TOP_BORDER
              }
              iconColor={myOverdueAssignedTasks.length > 0 ? ACCENT_RED : "#888888"}
              onClick={() => navigate(`${tasksPath}?tab=assigned_to_me`)}
            />
            {canCreateTask ? (
              <CommandCenterStatCard
                label="Tasks I Assigned"
                value={delegatedOpenTasks.length}
                sublabel={delegatedTasksSublabel}
                actionLabel="Track Tasks"
                icon={<CheckSquare size={18} aria-hidden />}
                accentColor={
                  delegatedOverdueTasks.length > 0 ? ACCENT_RED : NEUTRAL_TOP_BORDER
                }
                iconColor={delegatedOverdueTasks.length > 0 ? ACCENT_RED : "#888888"}
                onClick={() => navigate(`${tasksPath}?tab=assigned_by_me`)}
              />
            ) : null}
          </div>
        )}
      </section>

      <PendingActionsSection
        items={pendingActionsItems}
        loading={pendingActionsLoading}
        sectionRef={pendingActionsRef}
      />

      <section style={sectionCardStyle}>
        <h2 style={sectionHeading}>Upcoming Club Activity</h2>
        {upcomingActivityLoading ? (
          <div className="flex justify-center py-3">
            <Spinner label="Loading upcoming activity…" />
          </div>
        ) : previewUpcomingActivity.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#666666" }}>
            No upcoming club activity scheduled.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {previewUpcomingActivity.map((row) => (
              <UpcomingClubActivityRow
                key={row.key}
                row={row}
                club={club}
                onManage={() =>
                  navigate(
                    row.kind === "event"
                      ? `${eventsPath}?manageEvent=${row.eventId}`
                      : `${meetingsPath}/${row.meetingId}`,
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section style={sectionCardStyle}>
        <h2 style={sectionHeading}>Task Overview</h2>
        {tasksLoading ? (
          <div className="flex justify-center py-3">
            <Spinner label="Loading tasks…" />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                isMobile || !canCreateTask
                  ? "1fr"
                  : "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <TaskOverviewColumn
              title="Tasks Assigned to Me"
              emptyMessage="No tasks assigned to you right now."
              footerLabel="View My Tasks"
              isEmpty={myTasksOverviewPreview.length === 0}
              onFooterClick={() => navigate(`${tasksPath}?tab=assigned_to_me`)}
            >
              {myTasksOverviewPreview.map((task) => (
                <CompactTaskOverviewRow
                  key={task.id}
                  task={task}
                  meta={`${taskSourceLabel(task, club.name)} · ${formatTaskDueLabel(task)}`}
                  onClick={() => onOpenTask(task)}
                />
              ))}
            </TaskOverviewColumn>
            {canCreateTask ? (
              <TaskOverviewColumn
                title="Tasks I Assigned"
                emptyMessage="You haven't assigned any tasks yet."
                footerLabel="Track Tasks"
                isEmpty={delegatedTasksOverviewPreview.length === 0}
                onFooterClick={() => navigate(`${tasksPath}?tab=assigned_by_me`)}
              >
                {delegatedTasksOverviewPreview.map((task) => (
                  <CompactTaskOverviewRow
                    key={task.id}
                    task={task}
                    meta={`${task.assigneeName ?? "Unassigned"} · ${formatTaskDueLabel(task)}`}
                    onClick={() => onOpenTask(task)}
                  />
                ))}
              </TaskOverviewColumn>
            ) : null}
          </div>
        )}
      </section>

      {canManageHiring ? (
        <section
          style={{
            ...sectionCardStyle,
            ...(hiringIsUrgent
              ? { borderColor: "rgba(229, 25, 55, 0.35)" }
              : secondarySectionStyle),
          }}
        >
          <h2
            style={
              hiringIsUrgent
                ? { ...sectionHeading, marginBottom: "10px" }
                : secondarySectionHeading
            }
          >
            Hiring Snapshot
            {hiringIsUrgent ? (
              <span style={{ color: ACCENT_RED, fontSize: "11px", marginLeft: "8px" }}>
                · Action needed
              </span>
            ) : null}
          </h2>
          {hiringSnapshot.loading ? (
            <div className="flex justify-center py-3">
              <Spinner label="Loading hiring snapshot…" />
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "auto 1fr",
                  gap: "12px",
                  alignItems: "center",
                  opacity: hiringIsUrgent ? 1 : 0.92,
                }}
              >
                <HiringDonutChart
                  openRolesCount={hiringSnapshot.openRolesCount}
                  rolesWithZeroApplicants={hiringSnapshot.rolesWithZeroApplicants}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? "repeat(3, minmax(0, 1fr))"
                      : "repeat(3, minmax(0, 1fr))",
                    gap: "8px",
                    width: "100%",
                  }}
                >
                  <HiringMetricLine
                    label="Pending Apps"
                    value={hiringSnapshot.pendingApplicationsCount}
                    highlight={hiringIsUrgent}
                  />
                  <HiringMetricLine
                    label="0 Applicants"
                    value={hiringSnapshot.rolesWithZeroApplicants}
                  />
                  <HiringMetricLine label="Total Roles" value={hiringSnapshot.openRolesCount} />
                </div>
              </div>
              {hiringSnapshot.topOpenRole ? (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#1a1a1a",
                    border: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: "10px",
                      color: "#666666",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: 700,
                    }}
                  >
                    Top Open Role
                  </p>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#ffffff",
                    }}
                  >
                    {hiringSnapshot.topOpenRole.title}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button
                      type="button"
                      style={
                        hiringIsUrgent ? urgentOutlinedButtonStyle : outlineButtonStyle
                      }
                      onClick={() => navigate(`${recruitingPath}?tab=applications`)}
                    >
                      Review Applications
                    </button>
                    <button
                      type="button"
                      style={noteActionButtonStyle}
                      onClick={() => navigate(`${recruitingPath}?openCreate=true`)}
                    >
                      Create Role
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                  <button
                    type="button"
                    style={noteActionButtonStyle}
                    onClick={() => navigate(`${recruitingPath}?openCreate=true`)}
                  >
                    Create Role
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ) : null}

      <RemindersQuickActionsCard
        reminderEvent={upcomingReminderEvent}
        isMobile={isMobile}
        quickActions={quickActions}
        onUseReminderTemplate={() => navigate(`${announcementsPath}?openTemplate=true`)}
      />

      <section
        style={{
          ...sectionCardStyle,
          background: "#111111",
          borderColor: "#1f1f1f",
        }}
      >
        <h2
          style={{
            fontWeight: 600,
            fontSize: "12px",
            color: "#777777",
            margin: "0 0 10px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Recent Club Activity
        </h2>
        {activityLoading ? (
          <div className="flex justify-center py-3">
            <Spinner label="Loading activity…" />
          </div>
        ) : activityItems.length === 0 ? (
          <p style={{ margin: 0, fontSize: "12px", color: "#555555" }}>No recent activity yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {activityItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 0",
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "#1a1a1a",
                    border: `1px solid ${CARD_BORDER}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "#888888",
                  }}
                >
                  {item.icon}
                </div>
                <p
                  style={{
                    margin: 0,
                    flex: 1,
                    minWidth: 0,
                    fontSize: "13px",
                    color: "#aaaaaa",
                    lineHeight: 1.35,
                  }}
                >
                  {item.description}
                </p>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#666666",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
