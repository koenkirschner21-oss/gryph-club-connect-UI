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
  Calendar,
  CheckSquare,
  ClipboardList,
} from "lucide-react";
import {
  CommandCenterCreateMenu,
  type CreateMenuAction,
} from "../../components/commandCenter/CommandCenterCreateMenu";
import { ClubHealthSnapshot } from "../../components/commandCenter/ClubHealthSnapshot";
import { PendingActionsOverlay } from "../../components/commandCenter/PendingActionsOverlay";
import {
  sortPendingActions,
  type PendingActionItem,
} from "../../lib/commandCenterPending";
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
import { formatTaskDate, isTaskInactiveForDueTracking } from "../../lib/taskDueUrgency";
import {
  HIRING_APPLICATION_UPDATED_EVENT,
  type HiringApplicationUpdatedDetail,
} from "../../lib/clubDataSyncEvents";
import { isHiringApplicationPendingReview } from "../../lib/hiringPipelineUtils";
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
import { getWorkspaceEventManagePath } from "../../lib/eventNavigation";
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


interface HiringSnapshot {
  openRolesCount: number;
  pendingApplicationsCount: number;
  rolesWithZeroApplicants: number;
  topOpenRole: { id: string; title: string } | null;
  pendingApplications: {
    id: string;
    listingId: string;
    listingTitle: string;
    createdAt: string;
  }[];
  loading: boolean;
}

interface ClubHealthState {
  totalMembers: number;
  newMembersThisMonth: number;
  rsvpsThisMonth: number;
  loading: boolean;
}

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

function formatTaskDueLabel(task: Task): string {
  if (!task.dueDate?.trim()) return "No due date";
  return formatTaskDate(task.dueDate);
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
        <p style={{ margin: 0, fontSize: "11px", color: "#a8a8a8", lineHeight: 1.35 }}>{meta}</p>
      </div>
      <span style={taskStatusPillStyle(task.status)}>
        {TASK_STATUS_LABELS[task.status] ?? task.status}
      </span>
    </button>
  );
}

function TaskOverviewColumn({
  title,
  count,
  emptyMessage,
  footerLabel,
  onFooterClick,
  isEmpty,
  children,
}: {
  title: string;
  count: number;
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
          color: "#d8d8d8",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {title} · {count}
      </h3>
      {isEmpty ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#888888", lineHeight: 1.45 }}>
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
          color: "#c8c8c8",
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
          <p style={{ margin: 0, fontSize: "12px", color: "#a8a8a8", lineHeight: 1.35 }}>
            {timeLabel} · {locationLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onManage}
          style={{
            ...textLinkStyle,
            fontSize: "12px",
            color: "#c8c8c8",
            flexShrink: 0,
          }}
        >
          Manage →
        </button>
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
        <p style={{ margin: 0, fontSize: "12px", color: "#a8a8a8", lineHeight: 1.35 }}>
          {row.timeLabel} · {row.locationLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={onManage}
        style={{
          ...textLinkStyle,
          fontSize: "12px",
          color: "#c8c8c8",
          flexShrink: 0,
        }}
      >
        Manage →
      </button>
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
        Complete Next Step
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
        <p style={{ fontSize: "12px", color: "#9a9a9a", margin: 0, lineHeight: 1.35 }}>{sublabel}</p>
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
                fontWeight: 700,
                color: "#d0d0d0",
                background: "#242424",
                border: `1px solid #3a3a3a`,
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
    itemId.startsWith("join-request-") ||
    itemId.startsWith("application-") ||
    itemId.startsWith("overdue-task-") ||
    itemId.startsWith("review-") ||
    itemId.startsWith("meeting-recap-")
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
  totalCount,
  loading,
  sectionRef,
  onOpenAll,
}: {
  items: PendingActionItem[];
  totalCount: number;
  loading: boolean;
  sectionRef?: React.RefObject<HTMLElement | null>;
  onOpenAll: () => void;
}) {
  return (
    <section ref={sectionRef} id="pending-actions" style={sectionCardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        <h2
          style={{
            ...sectionHeading,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Pending Actions</span>
          <span style={{ color: "#9a9a9a", fontWeight: 600, fontSize: "13px" }}>· {totalCount}</span>
        </h2>
        {totalCount > 0 ? (
          <button type="button" style={{ ...textLinkStyle, color: "#c8c8c8" }} onClick={onOpenAll}>
            View All Pending Actions →
          </button>
        ) : null}
      </div>
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
          <p style={{ margin: 0, fontSize: "13px", color: "#888888" }}>
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
              <p style={{ margin: 0, fontSize: "13px", color: "#d8d8d8", lineHeight: 1.4, flex: 1 }}>
                {item.label}
              </p>
              <button
                type="button"
                style={{ ...needsAttentionButtonStyle(item.id), flexShrink: 0 }}
                onClick={item.onAction}
              >
                {item.actionLabel}
              </button>
            </div>
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
  const { members, pendingMembers, loading: membersLoading } = useClubMembers(clubId);
  const pendingActionsRef = useRef<HTMLElement | null>(null);

  const [hiringSnapshot, setHiringSnapshot] = useState<HiringSnapshot>({
    openRolesCount: 0,
    pendingApplicationsCount: 0,
    rolesWithZeroApplicants: 0,
    topOpenRole: null,
    pendingApplications: [],
    loading: true,
  });
  const [clubHealth, setClubHealth] = useState<ClubHealthState>({
    totalMembers: 0,
    newMembersThisMonth: 0,
    rsvpsThisMonth: 0,
    loading: true,
  });
  const [pendingOverlayOpen, setPendingOverlayOpen] = useState(false);
  const [clubMeetings, setClubMeetings] = useState<ClubMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);

  const basePath = `/app/clubs/${clubId}`;
  const eventsPath = `${basePath}/events`;
  const meetingsPath = `${basePath}/meetings`;
  const announcementsPath = `${basePath}/announcements`;
  const tasksPath = `${basePath}/tasks`;
  const membersPath = `${basePath}/members`;
  const recruitingPath = `${basePath}/recruiting`;
  const documentsPath = `${basePath}/documents`;
  const settingsPath = `${basePath}/settings`;
  const setupSettingsPath = resolveClubSetupSettingsPath(settingsPath, club, {
    postsCount: posts.length,
    eventsCount,
  });

  const canManageMeetings =
    memberAccess.isPresident || memberAccess.can("manage_meetings");
  const canManageHiring =
    memberAccess.isPresident || memberAccess.can("manage_hiring");
  const canCreateAnnouncement =
    memberAccess.isPresident || memberAccess.can("manage_announcements");
  const canCreateEvent =
    memberAccess.isPresident || memberAccess.can("manage_events");
  const canCreateTask =
    memberAccess.isPresident || memberAccess.can("manage_tasks");
  const canManageDocuments =
    memberAccess.isPresident || memberAccess.can("manage_documents");
  const canInviteMembers = memberAccess.canInviteMembers;
  const isPresident = memberAccess.isPresident;

  const openSetupSettings = () => navigate(setupSettingsPath);

  const openPendingOverlay = () => setPendingOverlayOpen(true);

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
          pendingApplications: [],
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
          pendingApplications: [],
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

      let pendingApplications: HiringSnapshot["pendingApplications"] = [];

      if (listingIds.length > 0) {
        const listingTitleById = new Map(openListings.map((row) => [row.id, row.title]));
        const { data: applications, error: applicationsError } = await supabase
          .from("hiring_applications")
          .select("id, listing_id, status, sub_status, created_at")
          .in("listing_id", listingIds);

        if (cancelled) return;

        if (applicationsError) {
          console.error("Failed to load hiring applications:", applicationsError.message);
        } else {
          const countsByListing = new Map<string, number>();
          for (const application of applications ?? []) {
            const listingId = application.listing_id as string;
            countsByListing.set(listingId, (countsByListing.get(listingId) ?? 0) + 1);
            const subStatus =
              (application.sub_status as string | null) ??
              ((application.status as string) === "pending" ? "submitted" : "reviewed");
            if (isHiringApplicationPendingReview(subStatus)) {
              pendingApplicationsCount += 1;
              pendingApplications.push({
                id: application.id as string,
                listingId,
                listingTitle: listingTitleById.get(listingId) ?? "Open role",
                createdAt: (application.created_at as string) ?? "",
              });
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
        pendingApplications,
        loading: false,
      });
    }

    void loadHiringSnapshot();

    function onHiringUpdated(event: Event) {
      const detail = (event as CustomEvent<HiringApplicationUpdatedDetail>).detail;
      if (detail?.clubId && detail.clubId !== clubId) return;
      void loadHiringSnapshot();
    }

    window.addEventListener(HIRING_APPLICATION_UPDATED_EVENT, onHiringUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(HIRING_APPLICATION_UPDATED_EVENT, onHiringUpdated);
    };
  }, [clubId, canManageHiring]);

  useEffect(() => {
    let cancelled = false;

    async function loadClubHealth() {
      if (!isPresident) {
        setClubHealth({
          totalMembers: 0,
          newMembersThisMonth: 0,
          rsvpsThisMonth: 0,
          loading: false,
        });
        return;
      }

      setClubHealth((prev) => ({ ...prev, loading: true }));

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartIso = monthStart.toISOString();

      const { data: eventRows } = await supabase
        .from("events")
        .select("id")
        .eq("club_id", clubId);
      if (cancelled) return;

      const eventIds = (eventRows ?? []).map((row) => row.id as string);
      let rsvpsThisMonth = 0;
      if (eventIds.length > 0) {
        const { count, error } = await supabase
          .from("event_rsvps")
          .select("id", { count: "exact", head: true })
          .in("event_id", eventIds)
          .gte("created_at", monthStartIso);
        if (error) {
          console.error("Failed to load RSVP health metric:", error.message);
        } else {
          rsvpsThisMonth = count ?? 0;
        }
      }

      if (cancelled) return;

      const activeMembers = members.filter((member) => member.status === "active");
      const newMembersThisMonth = activeMembers.filter((member) => {
        const joined = new Date(member.joinedAt);
        return !Number.isNaN(joined.getTime()) && joined.getTime() >= monthStart.getTime();
      }).length;

      setClubHealth({
        totalMembers: activeMembers.length,
        newMembersThisMonth,
        rsvpsThisMonth,
        loading: false,
      });
    }

    void loadClubHealth();
    return () => {
      cancelled = true;
    };
  }, [clubId, isPresident, members]);

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
        if (isTaskInactiveForDueTracking(task.status)) return false;
        const due = parseTaskDueDate(task.dueDate);
        return due != null && due.getTime() < today.getTime();
      }),
    [openTasks, today],
  );

  const pendingActionsAll = useMemo(() => {
    const items: PendingActionItem[] = [];

    for (const task of overdueTasks) {
      items.push({
        id: `overdue-task-${task.id}`,
        label: `Overdue task: ${task.title}`,
        category: "tasks",
        urgency: "overdue",
        sortDate: task.dueDate ?? null,
        actionLabel: "Open Task",
        onAction: () => onOpenTask(task),
      });
    }

    for (const task of needsReviewTasks) {
      items.push({
        id: `review-${task.id}`,
        label: `Task awaiting review: ${task.title}`,
        category: "tasks",
        urgency: "needs_review",
        sortDate: task.dueDate ?? task.completedAt ?? task.createdAt,
        actionLabel: "Review Task",
        onAction: () => onOpenTask(task),
      });
    }

    for (const meeting of needsRecapMeetings) {
      items.push({
        id: `meeting-recap-${meeting.id}`,
        label: `Add recap: ${meeting.title}`,
        category: "meetings",
        urgency: "needs_review",
        sortDate: meeting.date,
        actionLabel: "Add Recap",
        onAction: () =>
          navigate(`${meetingsPath}/${meeting.id}?focus=recap&tab=past`),
      });
    }

    for (const application of hiringSnapshot.pendingApplications) {
      items.push({
        id: `application-${application.id}`,
        label: `Pending application for ${application.listingTitle}`,
        category: "hiring",
        urgency: "needs_review",
        sortDate: application.createdAt,
        actionLabel: "Review",
        onAction: () =>
          navigate(
            `${recruitingPath}?listing=${application.listingId}&application=${application.id}`,
          ),
      });
    }

    if (memberAccess.canApproveMembers) {
      for (const member of pendingMembers) {
        const name = member.fullName?.trim() || member.email?.trim() || "Member";
        items.push({
          id: `join-request-${member.id}`,
          label: `Join request: ${name}`,
          category: "join_requests",
          urgency: "needs_review",
          sortDate: member.joinedAt,
          actionLabel: "Review",
          onAction: () =>
            navigate(`${membersPath}?tab=pending&request=${member.id}`),
        });
      }
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
          label: `Low RSVPs for ${event.title}`,
          category: "events",
          urgency: "due_soon",
          sortDate: event.occurrenceDate,
          actionLabel: "View RSVPs",
          onAction: () => navigate(`${eventsPath}?viewRsvps=${event.id}`),
        });
      }
    }

    return sortPendingActions(items);
  }, [
    memberAccess.canApproveMembers,
    overdueTasks,
    needsReviewTasks,
    needsRecapMeetings,
    hiringSnapshot.pendingApplications,
    pendingMembers,
    previewUpcomingEvents,
    eventRsvpCounts,
    today,
    navigate,
    membersPath,
    recruitingPath,
    meetingsPath,
    eventsPath,
    onOpenTask,
  ]);

  const pendingActionsItems = useMemo(
    () => pendingActionsAll.slice(0, 5),
    [pendingActionsAll],
  );

  const pendingActionsCount = pendingActionsAll.length;

  const nextUpcomingEvent = previewUpcomingEvents[0] ?? null;

  const showProfileSetupBanner =
    memberAccess.canManageClubSettings && shouldShowProfileSetupBanner(club);

  const myTasksOverviewPreview = useMemo(() => {
    return [...myOpenAssignedTasks]
      .sort((left, right) => {
        const leftDue = parseTaskDueDate(left.dueDate);
        const rightDue = parseTaskDueDate(right.dueDate);
        const leftOverdue = leftDue != null && leftDue.getTime() < today.getTime();
        const rightOverdue = rightDue != null && rightDue.getTime() < today.getTime();
        if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
        const leftKey = left.dueDate?.trim() || "9999-12-31";
        const rightKey = right.dueDate?.trim() || "9999-12-31";
        return leftKey.localeCompare(rightKey);
      })
      .slice(0, 5);
  }, [myOpenAssignedTasks, today]);

  const delegatedTasksOverviewPreview = useMemo(() => {
    return [...delegatedOpenTasks]
      .sort((left, right) => {
        const leftReview = left.status === "pending_review" ? 0 : 1;
        const rightReview = right.status === "pending_review" ? 0 : 1;
        if (leftReview !== rightReview) return leftReview - rightReview;
        const leftDue = parseTaskDueDate(left.dueDate);
        const rightDue = parseTaskDueDate(right.dueDate);
        const leftOverdue = leftDue != null && leftDue.getTime() < today.getTime();
        const rightOverdue = rightDue != null && rightDue.getTime() < today.getTime();
        if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
        const leftKey = left.dueDate?.trim() || "9999-12-31";
        const rightKey = right.dueDate?.trim() || "9999-12-31";
        return leftKey.localeCompare(rightKey);
      })
      .slice(0, 5);
  }, [delegatedOpenTasks, today]);

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
    isPresident && canManageHiring && hiringSnapshot.pendingApplicationsCount > 0;

  const createMenuActions = useMemo(() => {
    const actions: CreateMenuAction[] = [];

    if (canCreateAnnouncement) {
      actions.push({
        id: "announcement",
        label: "Announcement",
        onClick: () => navigate(`${announcementsPath}?openCreate=true`),
      });
    }
    if (canCreateEvent) {
      actions.push({
        id: "event",
        label: "Event",
        onClick: () => navigate(`${eventsPath}?openCreate=true`),
      });
    }
    if (canCreateTask) {
      actions.push({
        id: "task",
        label: "Task",
        onClick: () => navigate(`${tasksPath}?openCreate=true`),
      });
    }
    if (canManageMeetings) {
      actions.push({
        id: "meeting",
        label: "Meeting",
        onClick: () => navigate(`${meetingsPath}/new`),
      });
    }
    if (canManageHiring) {
      actions.push({
        id: "hiring",
        label: "Hiring Position",
        onClick: () => navigate(`${recruitingPath}?openCreate=true`),
      });
    }
    if (canManageDocuments) {
      actions.push({
        id: "upload_file",
        label: isPresident ? "Upload Document" : "Upload File",
        onClick: () => navigate(`${documentsPath}?openUpload=true`),
      });
      actions.push({
        id: "add_resource",
        label: "Add Resource Link",
        onClick: () => navigate(`${documentsPath}?openAddLink=true`),
      });
    }
    if (isPresident && canInviteMembers) {
      actions.push({
        id: "invite_members",
        label: "Invite Members",
        onClick: () => navigate(`${membersPath}?invite=members`),
      });
      actions.push({
        id: "invite_executive",
        label: "Invite Executive",
        onClick: () => navigate(`${membersPath}?invite=executive`),
      });
    }

    return actions;
  }, [
    announcementsPath,
    canCreateAnnouncement,
    canCreateEvent,
    canCreateTask,
    canInviteMembers,
    canManageDocuments,
    canManageHiring,
    canManageMeetings,
    documentsPath,
    eventsPath,
    isPresident,
    meetingsPath,
    membersPath,
    navigate,
    recruitingPath,
    tasksPath,
  ]);

  const openHiringApplications = () => {
    const pending = hiringSnapshot.pendingApplications;
    if (pending.length === 1) {
      navigate(
        `${recruitingPath}?listing=${pending[0].listingId}&application=${pending[0].id}`,
      );
      return;
    }
    navigate(`${recruitingPath}?tab=applications`);
  };

  const clubHealthMetrics = useMemo(() => {
    const nextMeeting = upcomingMeetings[0] ?? null;
    const pending = hiringSnapshot.pendingApplications;
    return [
      {
        id: "total-members",
        label: "Total members",
        value: clubHealth.totalMembers,
        onClick: () => navigate(membersPath),
      },
      {
        id: "new-members",
        label: "New this month",
        value: clubHealth.newMembersThisMonth,
        onClick: () => navigate(`${membersPath}?filter=recent`),
      },
      {
        id: "upcoming-events",
        label: "Upcoming events",
        value: eventsThisMonthCount,
        onClick: () => navigate(`${eventsPath}?filter=upcoming`),
      },
      {
        id: "rsvps",
        label: "RSVPs this month",
        value: clubHealth.rsvpsThisMonth,
        onClick: () => navigate(eventsPath),
      },
      {
        id: "open-roles",
        label: "Open roles",
        value: hiringSnapshot.openRolesCount,
        onClick: () => navigate(`${recruitingPath}?filter=open`),
      },
      {
        id: "pending-apps",
        label: "Pending applicants",
        value: hiringSnapshot.pendingApplicationsCount,
        highlight: hiringSnapshot.pendingApplicationsCount > 0,
        onClick: () => {
          if (pending.length === 1) {
            navigate(
              `${recruitingPath}?listing=${pending[0].listingId}&application=${pending[0].id}`,
            );
            return;
          }
          navigate(`${recruitingPath}?tab=applications`);
        },
      },
      {
        id: "overdue-tasks",
        label: "Overdue tasks",
        value: overdueTasks.length,
        highlight: overdueTasks.length > 0,
        onClick: () => navigate(`${tasksPath}?filter=overdue`),
      },
      {
        id: "next-meeting",
        label: "Next meeting",
        value: nextMeeting
          ? `${nextMeeting.title.slice(0, 18)}${nextMeeting.title.length > 18 ? "…" : ""}`
          : "None",
        onClick: () =>
          navigate(nextMeeting ? `${meetingsPath}/${nextMeeting.id}` : meetingsPath),
      },
    ];
  }, [
    clubHealth.newMembersThisMonth,
    clubHealth.rsvpsThisMonth,
    clubHealth.totalMembers,
    eventsThisMonthCount,
    eventsPath,
    hiringSnapshot.openRolesCount,
    hiringSnapshot.pendingApplications,
    hiringSnapshot.pendingApplicationsCount,
    meetingsPath,
    membersPath,
    navigate,
    overdueTasks.length,
    recruitingPath,
    tasksPath,
    upcomingMeetings,
  ]);

  const topStatCardCount = canCreateTask ? 4 : 3;

  const formatTaskMeta = (task: Task, includeAssignee: boolean) => {
    const parts = [
      formatTaskDueLabel(task),
      TASK_STATUS_LABELS[task.status] ?? task.status,
      task.priority,
    ];
    if (includeAssignee) {
      parts.push(task.assigneeName ?? "Unassigned");
    }
    return parts.join(" · ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <ClubIdentityHeader club={club} roleContextLabel={roleContextLabel} />
        </div>
        <CommandCenterCreateMenu actions={createMenuActions} />
      </div>

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
                  ? `${pendingActionsCount} need${pendingActionsCount === 1 ? "s" : ""} attention`
                  : "All caught up"
              }
              actionLabel="Review"
              icon={<ClipboardList size={18} aria-hidden />}
              accentColor={ACCENT_RED}
              iconColor={ACCENT_RED}
              onClick={openPendingOverlay}
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
              label="My Tasks"
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
                label="Assigned by Me"
                value={delegatedOpenTasks.length}
                sublabel={delegatedTasksSublabel}
                actionLabel="View All Assigned Tasks"
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
        totalCount={pendingActionsCount}
        loading={pendingActionsLoading}
        sectionRef={pendingActionsRef}
        onOpenAll={openPendingOverlay}
      />

      <section style={sectionCardStyle}>
        <h2 style={sectionHeading}>Upcoming Club Activity</h2>
        {upcomingActivityLoading ? (
          <div className="flex justify-center py-3">
            <Spinner label="Loading upcoming activity…" />
          </div>
        ) : previewUpcomingActivity.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#888888" }}>
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
                      ? getWorkspaceEventManagePath(clubId, row.eventId)
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
              title="My Tasks"
              count={myOpenAssignedTasks.length}
              emptyMessage="No tasks assigned to you right now."
              footerLabel="View My Tasks"
              isEmpty={myTasksOverviewPreview.length === 0}
              onFooterClick={() => navigate(`${tasksPath}?tab=assigned_to_me`)}
            >
              {myTasksOverviewPreview.map((task) => (
                <CompactTaskOverviewRow
                  key={task.id}
                  task={task}
                  meta={formatTaskMeta(task, false)}
                  onClick={() => onOpenTask(task)}
                />
              ))}
            </TaskOverviewColumn>
            {canCreateTask ? (
              <TaskOverviewColumn
                title="Assigned by Me"
                count={delegatedOpenTasks.length}
                emptyMessage="You haven't assigned any tasks yet."
                footerLabel="View All Assigned Tasks"
                isEmpty={delegatedTasksOverviewPreview.length === 0}
                onFooterClick={() => navigate(`${tasksPath}?tab=assigned_by_me`)}
              >
                {delegatedTasksOverviewPreview.map((task) => (
                  <CompactTaskOverviewRow
                    key={task.id}
                    task={task}
                    meta={formatTaskMeta(task, true)}
                    onClick={() => onOpenTask(task)}
                  />
                ))}
              </TaskOverviewColumn>
            ) : null}
          </div>
        )}
      </section>

      {isPresident && canManageHiring ? (
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
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "8px",
                    width: "100%",
                  }}
                >
                  <button
                    type="button"
                    onClick={openHiringApplications}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <HiringMetricLine
                      label="Pending Apps"
                      value={hiringSnapshot.pendingApplicationsCount}
                      highlight={hiringIsUrgent}
                    />
                  </button>
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
                      color: "#9a9a9a",
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
                      onClick={openHiringApplications}
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

      {isPresident ? (
        <ClubHealthSnapshot
          metrics={clubHealthMetrics}
          loading={clubHealth.loading || membersLoading || hiringSnapshot.loading || meetingsLoading}
        />
      ) : null}

      <PendingActionsOverlay
        open={pendingOverlayOpen}
        items={pendingActionsAll}
        loading={pendingActionsLoading}
        onClose={() => setPendingOverlayOpen(false)}
      />
    </div>
  );
}