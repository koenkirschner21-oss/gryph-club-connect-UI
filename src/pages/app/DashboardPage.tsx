import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Calendar, CheckSquare } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import { useDashboardEvents, type DashboardEvent } from "../../hooks/useDashboardEvents";
import { useDashboardTasks } from "../../hooks/useDashboardTasks";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import {
  registerUnreadCountRefresh,
  requestOpenNotificationsDropdown,
} from "../../components/ui/NotificationsDropdown";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------
type DashboardTab = "overview" | "events" | "tasks";

function deriveAbbreviation(name: string, maxLen = 3): string {
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuthContext();
  const { clubs, joinedClubs, savedClubs, loading, getUserRole } = useClubContext();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [profile, setProfile] = useState<{
    fullName: string;
    program: string;
    university: string;
  } | null>(null);

  // Fetch profile data
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("full_name, program, university")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load profile:", error.message);
          return;
        }
        if (data) {
          setProfile({
            fullName: (data.full_name as string) ?? "",
            program: (data.program as string) ?? "",
            university: (data.university as string) ?? "",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const myClubs = useMemo(
    () => clubs.filter((c) => joinedClubs.includes(c.id)),
    [clubs, joinedClubs],
  );

  const mySavedClubs = useMemo(
    () => clubs.filter((c) => savedClubs.includes(c.id)),
    [clubs, savedClubs],
  );

  const { events: upcomingEvents, loading: eventsLoading } =
    useDashboardEvents(joinedClubs);
  const { activeCount: taskCount } = useDashboardTasks(joinedClubs);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (joinedClubs.length === 0) {
      setClubLogos({});
      return;
    }

    let cancelled = false;

    supabase
      .from("clubs")
      .select("id, logo_url")
      .in("id", joinedClubs)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load club logos:", error.message);
          setClubLogos({});
          return;
        }
        const map: Record<string, string> = {};
        (data ?? []).forEach((row) => {
          const url = row.logo_url as string | null;
          if (url) map[row.id as string] = url;
        });
        setClubLogos(map);
      });

    return () => {
      cancelled = true;
    };
  }, [joinedClubs]);

  const fetchUnreadNotificationCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadNotificationCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) {
      console.error("Failed to load unread notification count:", error.message);
      return;
    }

    setUnreadNotificationCount(data?.length ?? 0);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void fetchUnreadNotificationCount();
  }, [authLoading, fetchUnreadNotificationCount]);

  useEffect(() => {
    return registerUnreadCountRefresh(fetchUnreadNotificationCount);
  }, [fetchUnreadNotificationCount]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    const channel = supabase
      .channel(`dashboard-notifications-count:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchUnreadNotificationCount();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void fetchUnreadNotificationCount();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, fetchUnreadNotificationCount, user?.id]);

  function handleUnreadStatClick() {
    requestOpenNotificationsDropdown();
  }

  // RSVP data for upcoming events
  const eventIds = useMemo(
    () => upcomingEvents.map((e) => e.id),
    [upcomingEvents],
  );
  const { myRsvps, counts: rsvpCounts } = useEventRsvps(eventIds);

  const sourceName = profile?.fullName || user?.email?.split("@")[0] || "";
  const displayName = sourceName.split(" ")[0];

  // Subtitle parts
  const subtitleParts = [
    profile?.program,
    profile?.university,
  ].filter(Boolean);

  // Count upcoming events this month
  const eventsThisMonth = useMemo(() => {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return upcomingEvents.filter((e) => {
      const d = new Date(e.date);
      return d <= monthEnd;
    }).length;
  }, [upcomingEvents]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading dashboard…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "24px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Welcome back, {displayName}
          </h1>
          {subtitleParts.length > 0 && (
            <p
              style={{
                marginTop: "4px",
                fontSize: "13px",
                color: "#555555",
              }}
            >
              {subtitleParts.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to="/app/create-club"
            className="inline-flex h-9 items-center rounded-[var(--r-md)] bg-[var(--red)] px-4 text-sm font-medium text-white transition hover:bg-[var(--red-hover)]"
          >
            Create a Club
          </Link>
          <Link
            to="/app/join-club"
            className="inline-flex h-9 items-center rounded-[var(--r-md)] border border-[var(--border-md)] px-4 text-sm font-medium text-[var(--text-1)] transition hover:bg-[var(--bg-3)]"
          >
            Join with Code
          </Link>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="mb-8 flex items-center gap-6 border-b border-border">
        <TabButton
          label="Overview"
          active={activeTab === "overview"}
          badge={unreadNotificationCount > 0 ? unreadNotificationCount : undefined}
          onClick={() => setActiveTab("overview")}
        />
        <TabButton
          label="Events"
          active={activeTab === "events"}
          onClick={() => setActiveTab("events")}
        />
        <TabButton
          label="Tasks"
          active={activeTab === "tasks"}
          onClick={() => setActiveTab("tasks")}
        />
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "overview" && (
        <OverviewTab
          myClubs={myClubs}
          mySavedClubs={mySavedClubs}
          upcomingEvents={upcomingEvents}
          eventsLoading={eventsLoading}
          eventsThisMonth={eventsThisMonth}
          taskCount={taskCount}
          unreadNotificationCount={unreadNotificationCount}
          onUnreadStatClick={handleUnreadStatClick}
          totalClubs={clubs.length}
          myRsvps={myRsvps}
          rsvpCounts={rsvpCounts}
          getUserRole={getUserRole}
          userId={user?.id}
          joinedClubIds={joinedClubs}
          clubLogos={clubLogos}
          onViewAllEvents={() => setActiveTab("events")}
          onViewAllTasks={() => setActiveTab("tasks")}
        />
      )}
      {activeTab === "events" && (
        <EventsTab
          upcomingEvents={upcomingEvents}
          eventsLoading={eventsLoading}
          myRsvps={myRsvps}
          rsvpCounts={rsvpCounts}
          clubLogos={clubLogos}
        />
      )}
      {activeTab === "tasks" && <TasksTab joinedClubs={joinedClubs} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------
function TabButton({
  label,
  active,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative cursor-pointer pb-3 text-sm font-medium transition-colors ${
        active
          ? "text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary"
          : "text-muted hover:text-white"
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------
const viewAllLinkStyle = {
  color: "#E51937",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  cursor: "pointer",
  background: "none",
  border: "none",
  padding: 0,
} as const;

const overviewEmptyTextStyle = {
  color: "#555555",
  fontSize: "13px",
  margin: 0,
} as const;

type OverviewTask = {
  id: string;
  title: string;
  status: string;
  clubName: string;
  clubId: string;
  dueDate?: string;
};

function taskStatusBorder(status: string): string {
  if (status === "in_progress") return "#FFC429";
  if (status === "done") return "#E51937";
  return "#747676";
}

function taskStatusLabel(status: string): string {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "To Do";
}

function taskStatusPillStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    borderRadius: "20px",
    padding: "2px 8px",
    flexShrink: 0,
  };
  if (status === "in_progress") {
    return {
      ...base,
      background: "#2a1f00",
      border: "1px solid #3a2f00",
      color: "#FFC429",
    };
  }
  if (status === "done") {
    return {
      ...base,
      background: "#1a0a0a",
      border: "1px solid #3a1a1a",
      color: "#E51937",
    };
  }
  return {
    ...base,
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "#747676",
  };
}

function isTaskOverdue(dueDate: string): boolean {
  const trimmed = dueDate.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function SectionHeadingWithIcon({
  icon,
  iconColor,
  children,
}: {
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className="mb-5 flex items-center gap-2"
      style={{
        fontSize: "15px",
        fontWeight: 600,
        color: "#ffffff",
      }}
    >
      <span style={{ color: iconColor, display: "flex" }}>{icon}</span>
      {children}
    </h2>
  );
}

function hasEventLocation(location: string | null | undefined): boolean {
  const trimmed = location?.trim();
  return !!trimmed && trimmed !== "TBD";
}

function formatEventDateShort(dateStr: string): string {
  const trimmedDate = dateStr.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)
    ? new Date(`${trimmedDate}T12:00:00`)
    : new Date(trimmedDate);

  if (Number.isNaN(d.getTime())) return trimmedDate;

  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatClubRoleDisplay(
  role: import("../../types").MemberRole | null | undefined,
): { label: string; color: string } {
  if (role === "owner") {
    return { label: "President", color: "#FFC429" };
  }
  if (role === "executive") {
    return { label: "Executive", color: "#E51937" };
  }
  return { label: "Member", color: "#747676" };
}

function formatTaskDueDate(dateStr: string): string {
  const trimmed = dateStr.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type OverviewAnnouncement = {
  id: string;
  clubId: string;
  title: string;
  clubName: string;
  createdAt: string;
};

function formatTimeAgo(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay >= 2) return `${diffDay} days ago`;
  if (diffDay === 1) return "yesterday";
  if (diffHr >= 2) return `${diffHr} hours ago`;
  if (diffHr === 1) return "1 hour ago";
  if (diffMin >= 2) return `${diffMin} minutes ago`;
  if (diffMin === 1) return "1 minute ago";
  return "just now";
}

function scrollToDashboardMyClubs() {
  document
    .getElementById("dashboard-my-clubs")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function OverviewTab({
  myClubs,
  mySavedClubs,
  upcomingEvents,
  eventsLoading,
  eventsThisMonth,
  taskCount,
  unreadNotificationCount,
  onUnreadStatClick,
  totalClubs,
  myRsvps,
  rsvpCounts,
  getUserRole,
  userId,
  joinedClubIds,
  clubLogos,
  onViewAllEvents,
  onViewAllTasks,
}: {
  myClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  mySavedClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  upcomingEvents: DashboardEvent[];
  eventsLoading: boolean;
  eventsThisMonth: number;
  taskCount: number;
  unreadNotificationCount: number;
  onUnreadStatClick: () => void;
  totalClubs: number;
  myRsvps: Record<string, string>;
  rsvpCounts: Record<string, import("../../types").RsvpCounts>;
  getUserRole: (clubId: string) => import("../../types").MemberRole | null;
  userId?: string;
  joinedClubIds: string[];
  clubLogos: Record<string, string>;
  onViewAllEvents: () => void;
  onViewAllTasks: () => void;
}) {
  const navigate = useNavigate();

  const handleMyClubsStatClick = () => {
    navigate("/app");
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToDashboardMyClubs);
    });
  };

  const [myTasks, setMyTasks] = useState<OverviewTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [recentAnnouncements, setRecentAnnouncements] = useState<OverviewAnnouncement[]>(
    [],
  );
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const previewEvents = useMemo(
    () => upcomingEvents.slice(0, 3),
    [upcomingEvents],
  );

  useEffect(() => {
    if (!userId || joinedClubIds.length === 0) {
      queueMicrotask(() => {
        setMyTasks([]);
        setTasksLoading(false);
      });
      return;
    }

    let cancelled = false;

    supabase
      .from("tasks")
      .select(`
        id,
        club_id,
        title,
        description,
        status,
        priority,
        assigned_to,
        due_date,
        created_by,
        created_at,
        clubs:club_id ( name )
      `)
      .in("club_id", joinedClubIds)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(3)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load dashboard tasks:", error.message);
          setMyTasks([]);
        } else {
          setMyTasks(
            (data ?? []).map((row) => {
              const clubRaw = row.clubs as unknown;
              const club = (
                Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
              ) as Record<string, unknown>;
              return {
                id: row.id as string,
                title: (row.title as string) ?? "",
                status: (row.status as string) ?? "todo",
                clubName: (club.name as string) ?? "",
                clubId: row.club_id as string,
                dueDate: (row.due_date as string) ?? undefined,
              };
            }),
          );
        }
        setTasksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, joinedClubIds]);

  useEffect(() => {
    if (joinedClubIds.length === 0) {
      queueMicrotask(() => {
        setRecentAnnouncements([]);
        setAnnouncementsLoading(false);
      });
      return;
    }

    let cancelled = false;

    supabase
      .from("posts")
      .select(`
        id,
        club_id,
        title,
        created_at,
        clubs:club_id ( name )
      `)
      .in("club_id", joinedClubIds)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load dashboard announcements:", error.message);
          setRecentAnnouncements([]);
        } else {
          setRecentAnnouncements(
            (data ?? []).map((row) => {
              const clubRaw = row.clubs as unknown;
              const club = (
                Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
              ) as Record<string, unknown>;
              return {
                id: row.id as string,
                clubId: row.club_id as string,
                title: (row.title as string) ?? "",
                clubName: (club.name as string) ?? "",
                createdAt: (row.created_at as string) ?? "",
              };
            }),
          );
        }
        setAnnouncementsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [joinedClubIds]);

  return (
    <>
      {/* ── Stat Cards ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="MY CLUBS"
          accentColor="#E51937"
          iconColor="#E51937"
          value={myClubs.length}
          sublabel="Active memberships"
          onClick={handleMyClubsStatClick}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />
        <StatCard
          label="UPCOMING"
          accentColor="#FFC429"
          iconColor="#FFC429"
          value={eventsThisMonth}
          sublabel="Events this month"
          onClick={onViewAllEvents}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
        />
        <StatCard
          label="TASKS"
          accentColor="#E51937"
          iconColor="#E51937"
          value={taskCount}
          sublabel="Active tasks"
          onClick={onViewAllTasks}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="UNREAD"
          accentColor="#747676"
          iconColor="#747676"
          value={unreadNotificationCount}
          sublabel="Notifications"
          onClick={onUnreadStatClick}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          }
        />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: My Tasks + Upcoming Events */}
        <div className="space-y-6">
          <Card className="p-6">
            <SectionHeadingWithIcon
              icon={<CheckSquare size={15} aria-hidden />}
              iconColor="#555555"
            >
              My Tasks
            </SectionHeadingWithIcon>

            {tasksLoading ? (
              <div className="flex justify-center py-8">
                <Spinner label="Loading tasks…" />
              </div>
            ) : myTasks.length === 0 ? (
              <p style={overviewEmptyTextStyle}>No active tasks</p>
            ) : (
              <div className="space-y-3">
                {myTasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/app/clubs/${task.clubId}/tasks`}
                    className="block no-underline"
                  >
                    <div
                      style={{
                        position: "relative",
                        background: "#1a1a1a",
                        borderTop: "1px solid #242424",
                        borderRight: "1px solid #242424",
                        borderBottom: "1px solid #242424",
                        borderLeft: `3px solid ${taskStatusBorder(task.status)}`,
                        borderRadius: "8px",
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "#ffffff",
                            margin: "0 0 4px",
                          }}
                        >
                          {task.title}
                        </p>
                        <p
                          style={{
                            fontSize: "11px",
                            color: "#555555",
                            margin: 0,
                            maxWidth: "180px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {task.clubName}
                        </p>
                        {task.dueDate?.trim() ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              marginTop: "6px",
                              fontSize: "11px",
                              color: isTaskOverdue(task.dueDate)
                                ? "#E51937"
                                : "#555555",
                            }}
                          >
                            <Calendar size={11} aria-hidden />
                            {formatTaskDueDate(task.dueDate)}
                          </span>
                        ) : null}
                      </div>
                      <span
                        style={{
                          ...taskStatusPillStyle(task.status),
                          alignSelf: "flex-start",
                        }}
                      >
                        {taskStatusLabel(task.status)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!tasksLoading && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onViewAllTasks}
                  style={viewAllLinkStyle}
                >
                  View All Tasks
                </button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <SectionHeadingWithIcon
              icon={<Calendar size={15} aria-hidden />}
              iconColor="#555555"
            >
              Upcoming Events
            </SectionHeadingWithIcon>

            {eventsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner label="Loading events…" />
              </div>
            ) : previewEvents.length === 0 ? (
              <p style={overviewEmptyTextStyle}>No upcoming events</p>
            ) : (
              <div>
                {previewEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    rsvpStatus={myRsvps[event.id]}
                    counts={rsvpCounts[event.id]}
                    logoUrl={
                      event.clubId ? clubLogos[event.clubId] : undefined
                    }
                  />
                ))}
              </div>
            )}

            {!eventsLoading && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onViewAllEvents}
                  style={viewAllLinkStyle}
                >
                  View All Events
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Right: My Clubs + Saved Clubs */}
        <div className="space-y-6">
          {/* My Clubs */}
          <div id="dashboard-my-clubs">
          <Card className="p-5">
            <h3 className="mb-4 text-base font-bold text-white">My Clubs</h3>
            {myClubs.length === 0 ? (
              <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-3)] px-4 py-8 text-center">
                <svg className="mx-auto mb-2 h-6 w-6 text-[var(--text-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z" />
                </svg>
                <p className="text-sm text-[var(--text-2)]">You have not joined any clubs yet.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <Link to="/app/join-club" className="inline-flex h-9 items-center rounded-[var(--r-md)] border border-[var(--border-md)] px-3 text-sm text-[var(--text-1)] hover:bg-[var(--bg-4)]">Join Club</Link>
                  <Link to="/explore" className="inline-flex h-9 items-center rounded-[var(--r-md)] bg-[var(--red)] px-3 text-sm text-white hover:bg-[var(--red-hover)]">Explore</Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {myClubs.map((club) => {
                  const roleDisplay = formatClubRoleDisplay(getUserRole(club.id));
                  return (
                  <Link
                    key={club.id}
                    to={`/app/clubs/${club.id}`}
                    className="flex items-center gap-3 p-3 transition-[border-color] duration-150 ease-in-out hover:border-[#333333]"
                    style={{
                      background: "#191919",
                      border: "1px solid #242424",
                      borderRadius: 7,
                    }}
                  >
                    <ClubBadge
                      abbreviation={club.abbreviation}
                      name={club.name}
                      logoUrl={clubLogos[club.id] ?? club.logoUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {club.name}
                      </p>
                      <p className="text-xs text-[var(--text-2)]">
                        {club.memberCount} members ·{" "}
                        <span style={{ color: roleDisplay.color }}>
                          {roleDisplay.label}
                        </span>
                      </p>
                    </div>
                    <span className="text-xs text-[var(--text-2)]">Open workspace →</span>
                  </Link>
                  );
                })}
              </div>
            )}
            <Link
              to="/explore"
              className="mt-4 flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Explore {totalClubs}+ clubs at U of G
            </Link>
          </Card>
          </div>

          {/* Recent Announcements */}
          <Card className="p-5">
            <h3 className="mb-4 text-base font-bold text-white">
              Recent Announcements
            </h3>
            {announcementsLoading ? (
              <div className="flex justify-center py-6">
                <Spinner label="Loading announcements…" />
              </div>
            ) : recentAnnouncements.length === 0 ? (
              <p
                style={{
                  color: "#555555",
                  fontSize: "12px",
                  padding: "10px 12px",
                  margin: 0,
                }}
              >
                No announcements yet
              </p>
            ) : (
              <div>
                {recentAnnouncements.map((announcement) => (
                  <Link
                    key={announcement.id}
                    to={`/app/clubs/${announcement.clubId}/announcements`}
                    className="block no-underline"
                    style={{
                      background: "#191919",
                      border: "1px solid #222",
                      borderRadius: 7,
                      padding: "10px 12px",
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#333";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#222";
                    }}
                  >
                    <p
                      style={{
                        fontSize: "10px",
                        color: "#E51937",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        margin: "0 0 3px",
                      }}
                    >
                      {announcement.clubName}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#d0d0d0",
                        margin: "0 0 4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {announcement.title}
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#555555",
                        margin: 0,
                      }}
                    >
                      {formatTimeAgo(announcement.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Saved Clubs */}
          {mySavedClubs.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
                <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                Saved Clubs
              </h3>
              <div className="space-y-3">
                {mySavedClubs.map((club) => (
                  <Link
                    key={club.id}
                    to={`/clubs/${club.slug}`}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-alt"
                  >
                    <ClubBadge
                      abbreviation={club.abbreviation}
                      name={club.name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {club.name}
                      </p>
                      <p className="text-xs text-muted">{club.category}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Events Tab (full-page list)
// ---------------------------------------------------------------------------
function EventsTab({
  upcomingEvents,
  eventsLoading,
  myRsvps,
  rsvpCounts,
  clubLogos,
}: {
  upcomingEvents: DashboardEvent[];
  eventsLoading: boolean;
  myRsvps: Record<string, string>;
  rsvpCounts: Record<string, import("../../types").RsvpCounts>;
  clubLogos: Record<string, string>;
}) {
  if (eventsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading events…" />
      </div>
    );
  }

  if (upcomingEvents.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted">No upcoming events from your clubs.</p>
      </Card>
    );
  }

  return (
    <div>
      {upcomingEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          rsvpStatus={myRsvps[event.id]}
          counts={rsvpCounts[event.id]}
          logoUrl={event.clubId ? clubLogos[event.clubId] : undefined}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tasks Tab
// ---------------------------------------------------------------------------
function TasksTab({ joinedClubs }: { joinedClubs: string[] }) {
  const { user } = useAuthContext();
  const [tasks, setTasks] = useState<
    { id: string; title: string; status: string; priority: string; clubName: string; clubId: string; dueDate?: string }[]
  >([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    if (joinedClubs.length === 0 || !user) {
      queueMicrotask(() => setLoadingTasks(false));
      return;
    }

    let cancelled = false;

    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date, club_id, clubs:club_id ( name )")
      .in("club_id", joinedClubs)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load tasks:", error.message);
        } else {
          setTasks(
            (data ?? []).map((row) => {
              const clubRaw = row.clubs as unknown;
              const club = (
                Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
              ) as Record<string, unknown>;
              return {
                id: row.id as string,
                title: (row.title as string) ?? "",
                status: (row.status as string) ?? "todo",
                priority: (row.priority as string) ?? "medium",
                clubName: (club.name as string) ?? "",
                clubId: row.club_id as string,
                dueDate: (row.due_date as string) ?? undefined,
              };
            }),
          );
        }
        setLoadingTasks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [joinedClubs, user]);

  if (loadingTasks) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading tasks…" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted">No active tasks across your clubs.</p>
      </Card>
    );
  }

  const priorityColors: Record<string, string> = {
    high: "text-red-400",
    medium: "text-yellow-400",
    low: "text-green-400",
  };

  const statusLabels: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
  };

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Link key={task.id} to={`/app/clubs/${task.clubId}/tasks`}>
          <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-alt">
            <div
              className={`h-2 w-2 shrink-0 rounded-full ${
                task.priority === "high"
                  ? "bg-red-400"
                  : task.priority === "medium"
                    ? "bg-yellow-400"
                    : "bg-green-400"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{task.title}</p>
              <p className="text-xs text-muted">
                {task.clubName}
                {task.dueDate && ` · Due ${task.dueDate}`}
              </p>
            </div>
            <span className={`text-xs font-medium ${priorityColors[task.priority] ?? "text-muted"}`}>
              {task.priority}
            </span>
            <span className="rounded-md bg-surface-alt px-2 py-0.5 text-xs text-muted">
              {statusLabels[task.status] ?? task.status}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  sublabel,
  icon,
  accentColor,
  iconColor,
  onClick,
}: {
  label: string;
  value: number;
  sublabel: string;
  icon: React.ReactNode;
  accentColor: string;
  iconColor?: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const resolvedIconColor = iconColor ?? accentColor;
  const borderColor = hovered ? "#2a2a2a" : "transparent";
  const style: CSSProperties = {
    background: "#1a1a1a",
    borderRadius: "8px",
    padding: "12px 16px",
    position: "relative",
    width: "100%",
    textAlign: "left",
    borderTop: `1px solid ${borderColor}`,
    borderRight: `1px solid ${borderColor}`,
    borderBottom: `1px solid ${borderColor}`,
    borderLeft: `3px solid ${accentColor}`,
    cursor: onClick ? "pointer" : undefined,
    transition: "all 0.15s ease",
    transform: hovered ? "translateY(-1px)" : undefined,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <StatCardContent
          label={label}
          value={value}
          sublabel={sublabel}
          icon={icon}
          iconColor={resolvedIconColor}
        />
      </button>
    );
  }

  return (
    <div style={style}>
      <StatCardContent
        label={label}
        value={value}
        sublabel={sublabel}
        icon={icon}
        iconColor={resolvedIconColor}
      />
    </div>
  );
}

function StatCardContent({
  label,
  value,
  sublabel,
  icon,
  iconColor,
}: {
  label: string;
  value: number;
  sublabel: string;
  icon: React.ReactNode;
  iconColor: string;
}) {
  return (
    <>
      <span
        className="[&_svg]:h-[18px] [&_svg]:w-[18px]"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          color: iconColor,
          fontSize: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <p
        style={{
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#747676",
          margin: "0 0 6px",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1,
          margin: "0 0 3px",
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: "11px", color: "#555555", margin: 0 }}>{sublabel}</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Club Badge (abbreviation circle)
// ---------------------------------------------------------------------------
function ClubBadge({
  abbreviation,
  name,
  size = "md",
  logoUrl,
}: {
  abbreviation?: string;
  name: string;
  size?: "sm" | "md";
  logoUrl?: string;
}) {
  const abbr = abbreviation || deriveAbbreviation(name);
  const sizeClass = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="shrink-0"
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center font-bold`}
      style={{
        backgroundColor: "#2a2a2a",
        color: "#888888",
        border: "1px solid #333",
        borderRadius: "8px",
      }}
    >
      {abbr}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Card
// ---------------------------------------------------------------------------
const EVENT_DATE_BLOCK_SIZE = 48;
const EVENT_CLUB_LOGO_SIZE = 40;

const eventCardTextEllipsis: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  margin: 0,
};

const eventDateBlockStyle = {
  backgroundColor: "#E51937",
  borderRadius: "8px",
  width: `${EVENT_DATE_BLOCK_SIZE}px`,
  height: `${EVENT_DATE_BLOCK_SIZE}px`,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
} as const;

function parseEventDate(
  dateStr: string | null | undefined,
): { month: string; day: string } | null {
  if (dateStr == null || typeof dateStr !== "string") return null;

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
    <div style={eventDateBlockStyle}>
      {parsed ? (
        <>
          <span
            style={{
              fontSize: "9px",
              textTransform: "uppercase",
              color: "#ffffff",
              lineHeight: 1,
              letterSpacing: "0.08em",
            }}
          >
            {parsed.month}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            {parsed.day}
          </span>
        </>
      ) : (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          TBD
        </span>
      )}
    </div>
  );
}

function EventClubLogo({
  name,
  abbreviation,
  logoUrl,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
}) {
  const abbr = abbreviation || deriveAbbreviation(name);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${EVENT_CLUB_LOGO_SIZE}px`,
          height: `${EVENT_CLUB_LOGO_SIZE}px`,
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
        width: `${EVENT_CLUB_LOGO_SIZE}px`,
        height: `${EVENT_CLUB_LOGO_SIZE}px`,
        borderRadius: "8px",
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888",
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

function EventCard({
  event,
  rsvpStatus,
  counts,
  logoUrl,
}: {
  event: DashboardEvent;
  rsvpStatus?: string;
  counts?: import("../../types").RsvpCounts;
  logoUrl?: string;
}) {
  const goingCount = counts?.going ?? 0;
  const maybeCount = counts?.maybe ?? 0;

  const dateLine = hasEventLocation(event.location)
    ? `${formatEventDateShort(event.date)} · ${event.location.trim()}`
    : formatEventDateShort(event.date);

  let rsvpLine: string | null = null;
  if (rsvpStatus === "going") {
    rsvpLine = "Going";
  } else if (rsvpStatus === "maybe") {
    rsvpLine = "Maybe";
  } else if (goingCount > 0 || maybeCount > 0) {
    rsvpLine = `${goingCount} going${maybeCount > 0 ? ` · ${maybeCount} maybe` : ""}`;
  } else if (!rsvpStatus) {
    rsvpLine = "Open to all students";
  }

  return (
    <Link to={`/app/clubs/${event.clubId}/events`} className="block">
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "14px",
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "10px",
          padding: "16px 20px",
          marginBottom: "10px",
        }}
      >
        <EventDateBlock date={event.date} />
        <EventClubLogo
          name={event.clubName}
          abbreviation={event.clubAbbreviation}
          logoUrl={logoUrl}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              ...eventCardTextEllipsis,
              fontSize: "15px",
              fontWeight: 600,
              color: "#ffffff",
              marginBottom: "4px",
            }}
          >
            {event.title}
          </p>
          <p
            style={{
              ...eventCardTextEllipsis,
              fontSize: "12px",
              color: "#555555",
            }}
          >
            {dateLine}
          </p>
          <p
            style={{
              ...eventCardTextEllipsis,
              fontSize: "12px",
              color: "#555555",
            }}
          >
            {event.clubName}
          </p>
          {rsvpLine ? (
            <p
              style={{
                ...eventCardTextEllipsis,
                fontSize: "12px",
                color: "#555555",
              }}
            >
              {rsvpLine}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}