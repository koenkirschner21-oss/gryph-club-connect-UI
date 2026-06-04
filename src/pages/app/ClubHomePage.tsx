import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getTaskDueUrgency,
  taskDueBadgeConfig,
  taskDueDateColor,
  taskDueLeftBorder,
} from "../../lib/taskDueUrgency";
import { X, Check, CheckSquare } from "lucide-react";
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
import { supabase } from "../../lib/supabaseClient";
import type { ClubEvent, MemberRole, Post, Task, TaskStatus } from "../../types";
import Spinner from "../../components/ui/Spinner";

const sectionHeadingRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "16px",
};

const sectionHeading: CSSProperties = {
  fontWeight: 700,
  fontSize: "16px",
  color: "#ffffff",
  margin: 0,
};

const viewAllLink: CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#E51937",
  textDecoration: "none",
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
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
};

const quickActionOutlineButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "transparent",
  backgroundColor: "transparent",
  border: "1px solid #E51937",
  color: "#E51937",
  borderRadius: "6px",
  padding: "8px 16px",
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

function ClubLogoMark({
  name,
  abbreviation,
  logoUrl,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
}) {
  const abbr = abbreviation?.trim() || deriveAbbreviation(name);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${CLUB_LOGO_SIZE}px`,
          height: `${CLUB_LOGO_SIZE}px`,
          borderRadius: "6px",
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
        borderRadius: "6px",
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

function taskStatusAccent(status: TaskStatus): string {
  switch (status) {
    case "in_progress":
      return "#FFC429";
    case "done":
      return "#E51937";
    default:
      return "#747676";
  }
}

function ClubStatCard({
  label,
  value,
  sublabel,
  accentColor,
  to,
  icon,
  valueFontSize = "2rem",
  valueColor = "#ffffff",
  valueFontStyle,
  valueHint,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  accentColor: string;
  to?: string;
  icon?: ReactNode;
  valueFontSize?: string;
  valueColor?: string;
  valueFontStyle?: CSSProperties["fontStyle"];
  valueHint?: string;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const borderMuted = hovered ? "#333333" : "#242424";

  const card = (
    <div
      className="flex h-full min-h-[120px] flex-col justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#1a1a1a",
        borderTop: `1px solid ${borderMuted}`,
        borderRight: `1px solid ${borderMuted}`,
        borderBottom: `1px solid ${borderMuted}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: "8px",
        padding: "16px",
        cursor: to ? "pointer" : undefined,
        transform: hovered && to ? "translateY(-1px)" : undefined,
        transition: "all 0.15s ease",
      }}
    >
      <p
        className="uppercase"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          color: "#747676",
          margin: 0,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {icon}
        {label}
      </p>
      <p
        style={{
          fontSize: valueFontSize,
          fontWeight: valueFontStyle === "italic" ? 400 : 700,
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
            fontSize: "11px",
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
            fontSize: "11px",
            color: "#555555",
            margin: "4px 0 0",
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

function ClubEventCard({
  title,
  date,
  time,
  location,
  clubName,
  clubAbbreviation,
  clubLogoUrl,
}: {
  title: string;
  date: string;
  time?: string;
  location?: string;
  clubName: string;
  clubAbbreviation?: string;
  clubLogoUrl?: string;
}) {
  const parsedDate = new Date(date);
  const monthLabel = Number.isNaN(parsedDate.getTime())
    ? "---"
    : parsedDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayLabel = Number.isNaN(parsedDate.getTime())
    ? "?"
    : String(parsedDate.getDate());

  const timeLabel =
    time && time.trim() !== "" && time.toUpperCase() !== "TBD"
      ? formatEventTime12h(time)
      : null;
  const dateShort = formatEventDateShort(date);
  const locationLabel =
    location && !isHiddenLocation(location) ? location.trim() : null;

  const metaParts = [dateShort, timeLabel, locationLabel].filter(Boolean);

  return (
    <div
      className="flex"
      style={{
        gap: "16px",
        backgroundColor: "#1a1a1a",
        border: "1px solid #242424",
        borderRadius: "8px",
        padding: "16px 20px",
        marginBottom: "8px",
      }}
    >
      <div
        className="flex shrink-0 flex-col items-center justify-center"
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: "#E51937",
          borderRadius: "6px",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            textTransform: "uppercase",
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {monthLabel}
        </span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {dayLabel}
        </span>
      </div>
      <ClubLogoMark
        name={clubName}
        abbreviation={clubAbbreviation}
        logoUrl={clubLogoUrl}
      />
      <div className="min-w-0 flex-1">
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#ffffff",
            margin: 0,
          }}
        >
          {title}
        </h3>
        {metaParts.length > 0 ? (
          <p
            style={{
              fontSize: "12px",
              color: "#555555",
              margin: "4px 0 0",
            }}
          >
            {metaParts.join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TaskDueBadge({ dueDate, status }: { dueDate?: string; status: TaskStatus }) {
  const urgency = getTaskDueUrgency(dueDate, status);
  const badge = taskDueBadgeConfig(urgency);
  if (!badge) return null;
  return <span style={badge.style}>{badge.label}</span>;
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

function DashboardItemModal({
  onClose,
  children,
  footerLink,
}: {
  onClose: () => void;
  children: ReactNode;
  footerLink: { label: string; to: string };
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
      </div>
    </div>
  );
}

function ClubTaskCard({
  task,
  clubName,
  clubAbbreviation,
  clubLogoUrl,
  onClick,
}: {
  task: Task;
  clubName: string;
  clubAbbreviation?: string;
  clubLogoUrl?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const statusLabel =
    task.status === "in_progress"
      ? "In progress"
      : task.status === "done"
        ? "Done"
        : "To do";

  const borderMuted = hovered ? "#333333" : "#242424";
  const dueUrgency = getTaskDueUrgency(task.dueDate, task.status);
  const leftBorder = taskDueLeftBorder(dueUrgency, taskStatusAccent(task.status));
  const dueLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      className="block cursor-pointer no-underline"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "14px",
          background: "#1a1a1a",
          borderTop: `1px solid ${borderMuted}`,
          borderRight: `1px solid ${borderMuted}`,
          borderBottom: `1px solid ${borderMuted}`,
          borderLeft: `4px solid ${leftBorder}`,
          borderRadius: "8px",
          padding: "14px 16px 14px 14px",
          marginBottom: "8px",
          transform: hovered ? "translateY(-1px)" : undefined,
          transition: "all 0.15s ease",
        }}
      >
        <ClubLogoMark
          name={clubName}
          abbreviation={clubAbbreviation}
          logoUrl={clubLogoUrl}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              margin: "0 0 4px",
            }}
          >
            {task.title}
          </p>
          <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
            {statusLabel}
            {task.assigneeName ? ` · ${task.assigneeName}` : ""}
          </p>
          {dueLabel ? (
            <p
              style={{
                fontSize: "12px",
                color: taskDueDateColor(dueUrgency),
                margin: "4px 0 0",
              }}
            >
              Due {dueLabel}
            </p>
          ) : null}
        </div>
        <TaskDueBadge dueDate={task.dueDate} status={task.status} />
      </div>
    </div>
  );
}

function NextEventBanner({
  event,
  eventsPath,
}: {
  event: { title: string; date: string; time?: string };
  eventsPath: string;
}) {
  const parsedDate = new Date(event.date);
  const monthLabel = Number.isNaN(parsedDate.getTime())
    ? "---"
    : parsedDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayLabel = Number.isNaN(parsedDate.getTime())
    ? "?"
    : String(parsedDate.getDate());
  const timeLabel =
    event.time && event.time.trim() !== "" && event.time.toUpperCase() !== "TBD"
      ? formatEventTime12h(event.time)
      : null;

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #E51937",
        borderRadius: "10px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}
    >
      <div
        className="flex shrink-0 flex-col items-center justify-center"
        style={{
          width: "44px",
          height: "44px",
          backgroundColor: "#E51937",
          borderRadius: "8px",
        }}
      >
        <span style={{ fontSize: "9px", color: "#fff", lineHeight: 1 }}>
          {monthLabel}
        </span>
        <span style={{ fontSize: "18px", fontWeight: 700, color: "#fff", lineHeight: 1 }}>
          {dayLabel}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#747676",
            margin: 0,
          }}
        >
          Next Event
        </p>
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "4px 0 0" }}>
          {event.title}
        </p>
        {timeLabel ? (
          <p style={{ fontSize: "12px", color: "#555555", margin: "4px 0 0" }}>{timeLabel}</p>
        ) : null}
      </div>
      <Link to={eventsPath} style={viewAllLink}>
        View Event →
      </Link>
    </div>
  );
}

export default function ClubHomePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { getClubById, getUserRole, userRoles } = useClubContext();
  const club = getClubById(clubId ?? "");

  const clubBasePath = clubId ? `/app/clubs/${clubId}` : "";
  const eventsPath = `${clubBasePath}/events`;
  const announcementsPath = `${clubBasePath}/announcements`;
  const tasksPath = `${clubBasePath}/tasks`;

  const contextRole = clubId
    ? getUserRole(clubId) ?? userRoles[clubId] ?? null
    : null;

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [clubHeaderHovered, setClubHeaderHovered] = useState(false);
  const [memberRsvps, setMemberRsvps] = useState<
    Record<string, "going" | "maybe" | "not_going" | null>
  >({});
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Post | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<
    (ClubEvent & { occurrenceDate: string }) | null
  >(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [recurringColumnReady, setRecurringColumnReady] = useState(false);
  const [eventRecurring, setEventRecurring] = useState<
    Record<string, EventRecurringMeta>
  >({});
  const [openTaskCount, setOpenTaskCount] = useState(0);

  useEffect(() => {
    const previewRole = localStorage.getItem("previewRole");
    if (previewRole) {
      setUserRole(previewRole as MemberRole);
      return;
    }
    if (contextRole) {
      setUserRole(normalizeUserRole(contextRole as MemberRole));
      return;
    }
    const fetchRole = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (data?.role) {
        setUserRole(normalizeUserRole(data.role as MemberRole));
      }
    };
    fetchRole();
  }, [clubId, user?.id, contextRole]);

  const { events, loading: eventsLoading } = useClubEvents(clubId);
  const { posts, loading: postsLoading } = useClubPosts(clubId);
  const { tasks, loading: tasksLoading } = useClubTasks(clubId);

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
      const sublabelParts = [weekday, timeLabel, locationLabel].filter(Boolean);
      return {
        value,
        sublabel: sublabelParts.join(" · "),
        scheduled: true,
      };
    }

    if (scheduleText) {
      return {
        value: scheduleText,
        sublabel:
          club?.location && !isHiddenLocation(club.location)
            ? club.location.trim()
            : "",
        scheduled: true,
      };
    }

    return { value: "Not scheduled", sublabel: "", scheduled: false };
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
  const previewTasks = tasksForRole.slice(0, 3);
  const tasksSectionTitle =
    userRole === "owner"
      ? "Club Tasks"
      : userRole === "executive"
        ? "My Tasks"
        : "My Tasks";
  const totalTasks = tasksForRole.length;
  const completedTasks = tasksForRole.filter((t) => t.status === "done").length;
  const taskProgressPercent =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const progressLabel =
    userRole === "executive"
      ? `${completedTasks} of ${totalTasks} of your tasks completed`
      : `${completedTasks} of ${totalTasks} tasks completed`;

  const postsCap = userRole === "member" ? 4 : 2;
  const previewPosts = posts.slice(0, postsCap);
  const eventsCap = userRole === "member" ? 4 : 3;
  const previewEvents = eventsThisMonth.slice(0, eventsCap);
  const previewEventIds = useMemo(
    () => eventsThisMonth.slice(0, eventsCap).map((e) => e.id),
    [eventsThisMonth, eventsCap],
  );
  const { counts: eventRsvpCounts } = useEventRsvps(previewEventIds);

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

  const clubPublicPath = club.slug ? `/clubs/${club.slug}` : "/explore";
  const settingsPath = `${clubBasePath}/settings`;

  const hasLogo = Boolean(club.logoUrl);
  const hasDescription = Boolean(club.description?.trim());
  const hasExtraMembers = club.memberCount > 1;
  const showSetupBanner =
    userRole === "owner" && !hasLogo && !hasDescription && !hasExtraMembers;
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        backgroundColor: "#0f0f0f",
        padding: isMobile ? "16px" : "24px",
      }}
    >
      {showSetupBanner ? (
        <div
          style={{
            background: "linear-gradient(135deg, #1a1500, #2a2000)",
            border: "1px solid #3a2f00",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "13px",
                color: "#FFC429",
                margin: "0 0 10px",
                fontWeight: 600,
              }}
            >
              Complete your club setup to start attracting members
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                alignItems: "center",
              }}
            >
              {[
                { done: hasLogo, label: "Add a logo" },
                { done: hasDescription, label: "Write a description" },
                { done: hasExtraMembers, label: "Invite your first member" },
              ].map((item) => (
                <span
                  key={item.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    color: item.done ? "#cccccc" : "#777777",
                  }}
                >
                  {item.done ? (
                    <Check size={12} color="#E51937" aria-hidden />
                  ) : (
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#555555",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <Link
            to={settingsPath}
            style={{
              background: "#FFC429",
              color: "#000000",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Go to Settings
          </Link>
        </div>
      ) : null}

      <div className="mb-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate(clubPublicPath)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(clubPublicPath);
            }
          }}
          onMouseEnter={() => setClubHeaderHovered(true)}
          onMouseLeave={() => setClubHeaderHovered(false)}
          style={{
            display: "inline-flex",
            alignItems: "flex-start",
            gap: "12px",
            cursor: "pointer",
            opacity: clubHeaderHovered ? 0.8 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          <ClubLogoMark
            name={club.name}
            abbreviation={club.abbreviation}
            logoUrl={club.logoUrl}
          />
          <div>
            <h1
              style={{
                fontWeight: 700,
                fontSize: "22px",
                color: "#ffffff",
                margin: 0,
              }}
            >
              {club.name}
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "6px 0 0",
              }}
            >
              {club.description}
            </p>
          </div>
        </div>
      </div>

      {userRole === "owner" ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`${announcementsPath}?create=true`)}
            style={{
              ...quickActionButton,
              cursor: "pointer",
              fontFamily: "inherit",
              border: "none",
            }}
          >
            <Megaphone size={16} strokeWidth={2} aria-hidden />
            New Announcement
          </button>
          <button
            type="button"
            onClick={() => navigate(`${eventsPath}?create=true`)}
            style={{
              ...quickActionOutlineButton,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Calendar size={16} strokeWidth={2} aria-hidden />
            New Event
          </button>
        </div>
      ) : null}

      {userRole === "executive" ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`${announcementsPath}?create=true`)}
            style={{
              ...quickActionButton,
              cursor: "pointer",
              fontFamily: "inherit",
              border: "none",
            }}
          >
            <Megaphone size={16} strokeWidth={2} aria-hidden />
            New Announcement
          </button>
          <button
            type="button"
            onClick={() => navigate(`${eventsPath}?create=true`)}
            style={{
              ...quickActionOutlineButton,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Calendar size={16} strokeWidth={2} aria-hidden />
            New Event
          </button>
        </div>
      ) : null}

      <div
        className={`grid items-stretch gap-4 ${
          isMobile
            ? "grid-cols-2"
            : userRole === "member"
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {userRole !== "member" ? (
          <ClubStatCard
            label="Open Tasks"
            value={openTaskCount}
            sublabel="Incomplete tasks"
            accentColor="#E51937"
            to={tasksPath}
            icon={<CheckSquare size={18} strokeWidth={2} aria-hidden />}
          />
        ) : null}
        <ClubStatCard
          label="Events This Month"
          value={eventsLoading ? "…" : eventsThisMonth.length}
          sublabel="Scheduled this month"
          accentColor="#FFC429"
          to={eventsPath}
        />
        <ClubStatCard
          label="Meeting"
          value={nextMeetingDisplay.value}
          sublabel={nextMeetingDisplay.sublabel}
          accentColor="#747676"
          to={eventsPath}
          valueFontSize={nextMeetingDisplay.scheduled ? "2rem" : "13px"}
          valueColor={nextMeetingDisplay.scheduled ? "#ffffff" : "#555555"}
          valueFontStyle={nextMeetingDisplay.scheduled ? undefined : "italic"}
          valueHint={
            nextMeetingDisplay.scheduled ? undefined : "Click to schedule →"
          }
        />
      </div>

      {nextEvent ? (
        <div className="mt-8">
          <NextEventBanner
            event={{
              title: nextEvent.title,
              date: nextEvent.occurrenceDate,
              time: nextEvent.time,
            }}
            eventsPath={eventsPath}
          />
        </div>
      ) : null}

      <div className="mt-8">
        <div style={sectionHeadingRow}>
          <h2 style={sectionHeading}>Recent Announcements</h2>
          {posts.length > 0 ? (
            <Link to={announcementsPath} style={viewAllLink}>
              View All →
            </Link>
          ) : null}
        </div>
        {postsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading announcements…" />
          </div>
        ) : posts.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "8px",
            }}
          >
            <p className="text-sm" style={{ color: "#555555" }}>
              No announcements yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {previewPosts.map((post) => (
              <article
                key={post.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedAnnouncement(post)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAnnouncement(post);
                  }
                }}
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #242424",
                  borderLeft: "3px solid #E51937",
                  borderRadius: "8px",
                  padding: userRole === "member" ? "20px" : "16px",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <h3
                  style={{
                    fontSize: userRole === "member" ? "15px" : "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                    margin: 0,
                  }}
                >
                  {post.title}
                </h3>
                {userRole !== "member" ? (
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#555555",
                      margin: "6px 0 0",
                    }}
                  >
                    {post.authorName ?? "Unknown"} ·{" "}
                    {new Date(post.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                ) : (
                  <p style={{ fontSize: "11px", color: "#555555", margin: "6px 0 0" }}>
                    {new Date(post.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
                <p
                  className={userRole === "member" ? "line-clamp-3" : "line-clamp-2"}
                  style={{
                    fontSize: "13px",
                    color: "#777777",
                    lineHeight: 1.5,
                    margin: "8px 0 0",
                  }}
                >
                  {post.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      {(userRole !== "member" || totalTasks > 0) ? (
      <div className="mt-8">
        <div style={sectionHeadingRow}>
          <h2 style={sectionHeading}>{tasksSectionTitle}</h2>
          {tasksForRole.length > 0 ? (
            <Link to={tasksPath} style={viewAllLink}>
              View All →
            </Link>
          ) : null}
        </div>
        {totalTasks > 0 ? (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                height: "4px",
                borderRadius: "2px",
                background: "#1e1e1e",
                width: "100%",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: "2px",
                  background: "#E51937",
                  width: `${taskProgressPercent}%`,
                  transition: "width 0.15s ease",
                }}
              />
            </div>
            <p
              style={{
                fontSize: "11px",
                color: "#555555",
                margin: "6px 0 0",
              }}
            >
              {progressLabel}
            </p>
          </div>
        ) : null}
        {tasksLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading tasks…" />
          </div>
        ) : previewTasks.length === 0 ? (
          <div
            className="text-center"
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <p style={{ color: "#555555", fontSize: "13px", margin: 0 }}>
              {userRole === "owner"
                ? "No active tasks in this club."
                : "No active tasks assigned to you."}
            </p>
          </div>
        ) : (
          <div>
            {previewTasks.map((task) => (
              <ClubTaskCard
                key={task.id}
                task={task}
                clubName={club.name}
                clubAbbreviation={club.abbreviation}
                clubLogoUrl={club.logoUrl}
                onClick={() => setSelectedTask(task)}
              />
            ))}
          </div>
        )}
      </div>
      ) : null}

      <div className="mt-8">
        <div style={sectionHeadingRow}>
          <h2 style={sectionHeading}>Events This Month</h2>
          {eventsThisMonth.length > 0 ? (
            <Link to={eventsPath} style={viewAllLink}>
              View All →
            </Link>
          ) : null}
        </div>
        {eventsThisMonth.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "8px",
            }}
          >
            <p className="text-sm" style={{ color: "#555555" }}>
              No events scheduled this month.
            </p>
            <Link to={eventsPath} className="mt-3 inline-block" style={viewAllLink}>
              View Events Page →
            </Link>
          </div>
        ) : (
          <div>
            {previewEvents.map((event) => (
              <div key={event.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className="block cursor-pointer no-underline"
                  onClick={() => setSelectedEvent(event)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedEvent(event);
                    }
                  }}
                >
                  <ClubEventCard
                    title={event.title}
                    date={event.occurrenceDate}
                    time={event.time}
                    location={event.location}
                    clubName={club.name}
                    clubAbbreviation={club.abbreviation}
                    clubLogoUrl={club.logoUrl}
                  />
                </div>
                  {userRole === "member" ? (
                    <div
                      style={{
                        marginTop: "-2px",
                        marginBottom: "10px",
                        marginLeft: "92px",
                        display: "flex",
                        gap: "8px",
                      }}
                    >
                      {(["going", "maybe", "not_going"] as const).map((status) => {
                        const active = memberRsvps[event.id] === status;
                        const activeStyles =
                          status === "going"
                            ? { background: "#0d2b0d", color: "#4ade80", border: "1px solid #1a4a1a" }
                            : status === "maybe"
                              ? { background: "#2a2a0d", color: "#FFC429", border: "1px solid #3a3a1a" }
                              : { background: "#1a1a1a", color: "#888888", border: "1px solid #333333" };
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberRsvps((prev) => ({
                                ...prev,
                                [event.id]: prev[event.id] === status ? null : status,
                              }));
                            }}
                            style={{
                              borderRadius: "6px",
                              padding: "4px 10px",
                              fontSize: "12px",
                              cursor: "pointer",
                              ...(active
                                ? activeStyles
                                : { background: "transparent", color: "#777777", border: "1px solid #333333" }),
                            }}
                          >
                            {status === "going" ? "Going" : status === "maybe" ? "Maybe" : "Not Going"}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAnnouncement ? (
        <DashboardItemModal
          onClose={() => setSelectedAnnouncement(null)}
          footerLink={{
            label: "View All Announcements →",
            to: announcementsPath,
          }}
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
            {selectedAnnouncement.authorName ?? "Unknown"} ·{" "}
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
          footerLink={{ label: "View All Events →", to: eventsPath }}
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
          <p style={{ fontSize: "13px", color: "#888888", margin: "16px 0 0" }}>
            <span style={{ color: "#555555" }}>RSVPs: </span>
            {(eventRsvpCounts[selectedEvent.id]?.going ?? 0)} going
          </p>
        </DashboardItemModal>
      ) : null}

      {selectedTask ? (
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
