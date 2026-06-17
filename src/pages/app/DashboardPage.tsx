import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Calendar,
  CheckSquare,
  Bell,
  Compass,
  ChevronRight,
  Megaphone,
  Users,
} from "lucide-react";
import type { InboxMessage } from "../../lib/inboxUtils";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import { useDashboardEvents, type DashboardEvent } from "../../hooks/useDashboardEvents";
import LinkedMeetingCancelledLabel from "../../components/tasks/LinkedMeetingCancelledLabel";
import { useDashboardTasks } from "../../hooks/useDashboardTasks";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import {
  registerUnreadCountRefresh,
  requestOpenNotificationsDropdown,
} from "../../components/ui/NotificationsDropdown";
import {
  formatTaskDate,
  getTaskDueUrgency,
  taskDueBadgeConfig,
  taskDueDateColor,
  taskDueLeftBorder,
} from "../../lib/taskDueUrgency";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { useInbox } from "../../hooks/useInbox";
import InboxTab from "../dashboard/InboxTab";
import {
  TasksFilterBar,
  TaskBreakdownCard,
  TaskClubGroupSection,
  TasksTabFooter,
  type TasksTabTask,
  WeeklyTaskProgressCard,
  prioritySortValue,
  statusSortValue,
  useTaskBreakdown,
  useWeeklyTaskProgress,
  type TaskPriorityFilter,
  type TaskSortOption,
} from "../dashboard/TasksTabUI";
import {
  TasksWeekEmptyState,
  ThisWeekEventCard,
  WeekAchievementCard,
  WeekCalendarStrip,
} from "../dashboard/ThisWeekTabUI";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------
type DashboardTab = "overview" | "events" | "tasks" | "week" | "clubs" | "inbox";

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
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();
  const { clubs, joinedClubs, savedClubs, loading, getUserRole } = useClubContext();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const inbox = useInbox();

  useEffect(() => {
    const pendingTab = sessionStorage.getItem("dashboardTab");
    if (pendingTab === "inbox") {
      setActiveTab("inbox");
      sessionStorage.removeItem("dashboardTab");
    }
  }, []);
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
  const [overdueTaskCount, setOverdueTaskCount] = useState(0);
  const [dueSoonTaskCount, setDueSoonTaskCount] = useState(0);

  useEffect(() => {
    if (joinedClubs.length === 0) {
      setClubLogos({});
      return;
    }

    let cancelled = false;

    supabase
      .from("clubs")
      .select("*")
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

  useEffect(() => {
    if (!user?.id || joinedClubs.length === 0) {
      setOverdueTaskCount(0);
      setDueSoonTaskCount(0);
      return;
    }

    let cancelled = false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    supabase
      .from("tasks")
      .select("id, due_date")
      .in("club_id", joinedClubs)
      .neq("status", "done")
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .not("due_date", "is", null)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load task deadline counts:", error.message);
          setOverdueTaskCount(0);
          setDueSoonTaskCount(0);
          return;
        }

        let overdue = 0;
        let dueSoon = 0;

        for (const row of data ?? []) {
          const dueDate = (row.due_date as string) ?? "";
          if (!dueDate) continue;
          const trimmed = dueDate.trim();
          const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
            ? new Date(`${trimmed}T00:00:00`)
            : new Date(trimmed);
          if (Number.isNaN(due.getTime())) continue;
          due.setHours(0, 0, 0, 0);
          const diffMs = due.getTime() - today.getTime();
          if (diffMs < 0) {
            overdue += 1;
          } else if (diffMs <= threeDaysMs) {
            dueSoon += 1;
          }
        }

        setOverdueTaskCount(overdue);
        setDueSoonTaskCount(dueSoon);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, joinedClubs]);

  function handleUnreadStatClick() {
    requestOpenNotificationsDropdown();
  }

  // RSVP data for upcoming events
  const eventIds = useMemo(
    () => upcomingEvents.map((e) => e.id),
    [upcomingEvents],
  );
  const { myRsvps } = useEventRsvps(eventIds);

  const sourceName = profile?.fullName || user?.email?.split("@")[0] || "";
  const displayName = sourceName.split(" ")[0];

  // Count upcoming events this month
  const eventsThisMonth = useMemo(() => {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return upcomingEvents.filter((e) => {
      const d = new Date(e.date);
      return d <= monthEnd;
    }).length;
  }, [upcomingEvents]);

  const handleMyClubsStatClick = () => {
    setActiveTab("clubs");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading dashboard…" />
      </div>
    );
  }

  return (
    <div
      className={`mx-auto max-w-7xl py-8 ${isMobile ? "px-4" : "px-4 sm:px-6 lg:px-8"}`}
    >
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
          <p
            style={{
              marginTop: "4px",
              fontSize: "13px",
              color: "#999999",
            }}
          >
            Here&apos;s what&apos;s happening across your clubs this week.
          </p>
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

      {joinedClubs.length === 0 ? (
        <div
          style={{
            background: "#0f0f0f",
            borderRadius: "12px",
            padding: "64px 24px",
            textAlign: "center",
          }}
        >
          <Compass
            size={48}
            color="#333333"
            style={{ marginBottom: "16px" }}
            aria-hidden
          />
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
            }}
          >
            You haven&apos;t joined any clubs yet
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#555555",
              marginTop: "8px",
              marginBottom: 0,
            }}
          >
            Explore clubs on campus and join ones that match your interests
          </p>
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <Link
              to="/explore"
              style={{
                background: "#E51937",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Explore Clubs
            </Link>
            <Link
              to="/hiring"
              style={{
                background: "transparent",
                border: "1px solid #333333",
                color: "#cccccc",
                borderRadius: "8px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Browse Hiring
            </Link>
          </div>
        </div>
      ) : (
        <>
      {/* ── Stat Cards (always visible) ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          onClick={() => setActiveTab("events")}
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
          onClick={() => setActiveTab("tasks")}
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
          onClick={handleUnreadStatClick}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          }
        />
      </div>

      {overdueTaskCount > 0 ? (
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          style={{
            width: "100%",
            background: "#1a0505",
            border: "1px solid #3a1010",
            borderRadius: "8px",
            padding: "10px 16px",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Bell size={14} color="#E51937" aria-hidden />
          <span style={{ fontSize: "13px", color: "#E51937" }}>
            You have {overdueTaskCount} overdue task
            {overdueTaskCount === 1 ? "" : "s"}
          </span>
        </button>
      ) : null}

      {dueSoonTaskCount > 0 ? (
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          style={{
            width: "100%",
            background: "#1a1500",
            border: "1px solid #3a2f00",
            borderRadius: "8px",
            padding: "10px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <Bell size={14} color="#FFC429" aria-hidden />
          <span style={{ fontSize: "13px", color: "#FFC429" }}>
            You have {dueSoonTaskCount} task
            {dueSoonTaskCount === 1 ? "" : "s"} due in the next 3 days
          </span>
        </button>
      ) : null}

      {/* ── Tab Navigation ── */}
      <div
        className={`mb-6 border-b border-border ${
          isMobile
            ? "flex flex-nowrap items-center gap-6 overflow-x-auto"
            : "flex items-center gap-6"
        }`}
      >
        <TabButton
          label="Overview"
          active={activeTab === "overview"}
          badge={unreadNotificationCount > 0 ? unreadNotificationCount : undefined}
          onClick={() => setActiveTab("overview")}
        />
        <ThisWeekTabButton
          active={activeTab === "week"}
          onClick={() => setActiveTab("week")}
        />
        <TabButton
          label="Inbox"
          active={activeTab === "inbox"}
          badge={inbox.unreadCount > 0 ? inbox.unreadCount : undefined}
          onClick={() => setActiveTab("inbox")}
        />
        <TabButton
          label="My Clubs"
          active={activeTab === "clubs"}
          onClick={() => setActiveTab("clubs")}
        />
        <TabButton
          label="Tasks"
          active={activeTab === "tasks"}
          onClick={() => setActiveTab("tasks")}
        />
        <TabButton
          label="Events"
          active={activeTab === "events"}
          onClick={() => setActiveTab("events")}
        />
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "overview" && (
        <OverviewTab
          myClubs={myClubs}
          upcomingEvents={upcomingEvents}
          eventsLoading={eventsLoading}
          myRsvps={myRsvps}
          getUserRole={getUserRole}
          userId={user?.id}
          joinedClubIds={joinedClubs}
          clubLogos={clubLogos}
          inboxMessages={inbox.messages}
          inboxLoading={inbox.loading}
          inboxUnreadCount={inbox.unreadCount}
          isMobile={isMobile}
          onViewAllEvents={() => setActiveTab("events")}
          onViewAllTasks={() => setActiveTab("tasks")}
          onViewAllClubs={() => setActiveTab("clubs")}
          onViewAllInbox={() => setActiveTab("inbox")}
          onViewAllAnnouncements={() => {
            const firstClubId = joinedClubs[0];
            if (firstClubId) {
              navigate(`/app/clubs/${firstClubId}/announcements`);
              return;
            }
            setActiveTab("clubs");
          }}
        />
      )}
      {activeTab === "week" && (
        <ThisWeekTab
          joinedClubIds={joinedClubs}
          clubLogos={clubLogos}
          displayName={displayName}
          onViewAllTasks={() => setActiveTab("tasks")}
          onViewAllEvents={() => setActiveTab("events")}
        />
      )}
      {activeTab === "clubs" && (
        <MyClubsTab
          myClubs={myClubs}
          mySavedClubs={mySavedClubs}
          clubLogos={clubLogos}
          getUserRole={getUserRole}
        />
      )}
      {activeTab === "events" && (
        <EventsTab
          upcomingEvents={upcomingEvents}
          eventsLoading={eventsLoading}
          myRsvps={myRsvps}
          clubLogos={clubLogos}
        />
      )}
      {activeTab === "tasks" && <TasksTab joinedClubs={joinedClubs} />}
      {activeTab === "inbox" && (
        <InboxTab
          {...inbox}
          clubLogos={clubLogos}
          displayName={displayName}
          joinedClubs={myClubs.map((club) => ({ id: club.id, name: club.name }))}
          onViewMyClubs={() => setActiveTab("clubs")}
        />
      )}
        </>
      )}
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
      type="button"
      onClick={onClick}
      className={`relative box-border inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-white"
          : "border-transparent text-muted hover:text-white"
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

function ThisWeekTabButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="box-border inline-flex h-10 shrink-0 items-center"
      style={{
        position: "relative",
        gap: "6px",
        padding: 0,
        fontSize: "14px",
        fontWeight: 500,
        lineHeight: "20px",
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid #FFC429" : "2px solid transparent",
        color: active ? "#ffffff" : "#FFC429",
        cursor: "pointer",
        textShadow:
          hovered && !active ? "0 0 8px rgba(255, 196, 41, 0.4)" : "none",
        transition: "color 0.15s ease, text-shadow 0.15s ease",
      }}
    >
      <Calendar size={13} strokeWidth={2} aria-hidden />
      This Week
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

const overviewColumnCardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "16px",
};

const overviewColumnHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
  fontSize: "15px",
  fontWeight: 700,
  color: "#ffffff",
  margin: "0 0 12px",
};

const overviewRowDividerStyle: CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #1a1a1a",
};

function OverviewColumnCard({
  title,
  icon,
  badge,
  children,
  footer,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div style={overviewColumnCardStyle}>
      <div style={overviewColumnHeaderStyle}>
        {icon}
        <span>{title}</span>
        {badge}
      </div>
      {children}
      {footer}
    </div>
  );
}

function OverviewClubLogo({
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
          width: "28px",
          height: "28px",
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
        width: "28px",
        height: "28px",
        borderRadius: "6px",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: "10px",
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

function OverviewCompactEventDateBadge({ date }: { date: string }) {
  const parsed = parseEventDate(date);

  return (
    <div
      style={{
        width: "40px",
        height: "44px",
        borderRadius: "8px",
        background: "#E51937",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#ffffff",
        lineHeight: 1.1,
      }}
    >
      {parsed ? (
        <>
          <span style={{ fontSize: "9px", fontWeight: 600 }}>{parsed.month}</span>
          <span style={{ fontSize: "16px", fontWeight: 700 }}>{parsed.day}</span>
        </>
      ) : (
        <span style={{ fontSize: "10px", fontWeight: 600 }}>TBD</span>
      )}
    </div>
  );
}

function formatOverviewEventTime(timeStr: string): string | null {
  const t = timeStr?.trim();
  if (!t || t.toUpperCase() === "TBD") return null;

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

function OverviewViewAllLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{ ...viewAllLinkStyle, marginTop: "12px" }}>
      {label}
    </button>
  );
}

function OverviewCompactTaskRow({
  task,
  logoUrl,
}: {
  task: OverviewTask;
  logoUrl?: string;
}) {
  return (
    <Link
      to={`/app/clubs/${task.clubId}/tasks`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "center", gap: "10px" }}>
        <OverviewClubLogo name={task.clubName} logoUrl={logoUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
            {task.title}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#777777" }}>{task.clubName}</p>
          {task.dueDate?.trim() ? (
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#777777" }}>
              {formatTaskDate(task.dueDate)}
            </p>
          ) : null}
        </div>
        <span style={dashboardTaskStatusBadgeStyle(task.status)}>
          {taskStatusLabel(task.status)}
        </span>
      </div>
    </Link>
  );
}

function OverviewCompactEventRow({
  event,
  rsvpStatus,
}: {
  event: DashboardEvent;
  rsvpStatus?: string;
}) {
  const timeLabel = formatOverviewEventTime(event.time);
  const locationLabel = hasEventLocation(event.location) ? event.location.trim() : null;

  return (
    <Link
      to={`/app/clubs/${event.clubId}/events`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <OverviewCompactEventDateBadge date={event.date} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
            {event.title}
          </p>
          {locationLabel ? (
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#777777" }}>{locationLabel}</p>
          ) : null}
          {timeLabel ? (
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#777777" }}>{timeLabel}</p>
          ) : null}
        </div>
        {rsvpStatus === "going" ? (
          <span style={dashboardEventRsvpBadgeStyle("going")}>Going</span>
        ) : null}
      </div>
    </Link>
  );
}

function OverviewCompactClubRow({
  club,
  logoUrl,
  roleLabel,
}: {
  club: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"][number];
  logoUrl?: string;
  roleLabel: string;
}) {
  return (
    <Link
      to={`/app/clubs/${club.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "center", gap: "10px" }}>
        <OverviewClubLogo
          name={club.name}
          abbreviation={club.abbreviation}
          logoUrl={logoUrl}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
            {club.name}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#E51937" }}>{roleLabel}</p>
        </div>
        <ChevronRight size={16} color="#555555" aria-hidden style={{ flexShrink: 0 }} />
      </div>
    </Link>
  );
}

function OverviewCompactInboxRow({ message }: { message: InboxMessage }) {
  return (
    <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
          {message.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#777777" }}>
          {message.clubName ?? "Gryph Club Connect"}
        </p>
      </div>
      <span style={{ fontSize: "11px", color: "#555555", whiteSpace: "nowrap", flexShrink: 0 }}>
        {formatTimeAgo(message.createdAt)}
      </span>
    </div>
  );
}

function OverviewCompactAnnouncementRow({
  announcement,
}: {
  announcement: OverviewAnnouncement;
}) {
  return (
    <Link
      to={`/app/clubs/${announcement.clubId}/announcements`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#E51937", fontWeight: 600 }}>
            {announcement.clubName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
            {announcement.title}
          </p>
        </div>
        <span style={{ fontSize: "11px", color: "#555555", whiteSpace: "nowrap", flexShrink: 0 }}>
          {formatTimeAgo(announcement.createdAt)}
        </span>
      </div>
    </Link>
  );
}

function localIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIsoDate(): string {
  return localIsoDate(new Date());
}

function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(year, month - 1, day + days);
  return localIsoDate(next);
}

const CALENDAR_WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function calendarWeekDays(reference = new Date()): Array<{
  dateKey: string;
  label: string;
  dayNum: number;
}> {
  const ref = new Date(reference);
  const dayOfWeek = ref.getDay();
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diff);

  return CALENDAR_WEEK_LABELS.map((label, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return {
      dateKey: localIsoDate(d),
      label,
      dayNum: d.getDate(),
    };
  });
}

function isLinkedMeetingCancelledRow(row: Record<string, unknown>): boolean {
  const raw = row.linked_meeting;
  const meeting = Array.isArray(raw) ? raw[0] : raw;
  return (meeting as { status?: string } | null)?.status === "cancelled";
}

type WeekTaskItem = {
  kind: "task";
  id: string;
  dateKey: string;
  title: string;
  clubName: string;
  clubId: string;
  priority: string;
  status: string;
  linkedMeetingCancelled?: boolean;
};

type WeekEventItem = {
  kind: "event";
  id: string;
  dateKey: string;
  title: string;
  clubName: string;
  clubId: string;
  time: string;
  location: string;
  visibility?: string | null;
};

type WeekPlannerItem = WeekTaskItem | WeekEventItem;

function TaskDueBadgeInline({
  dueDate,
  status,
}: {
  dueDate?: string;
  status: string;
}) {
  const badge = taskDueBadgeConfig(getTaskDueUrgency(dueDate, status));
  if (!badge) return null;
  return <span style={badge.style}>{badge.label}</span>;
}

function WeekTaskCard({
  task,
  logoUrl,
}: {
  task: WeekTaskItem;
  logoUrl?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const borderMuted = hovered ? "#333" : "#242424";
  const dueUrgency = getTaskDueUrgency(task.dateKey, task.status);
  const leftBorder = taskDueLeftBorder(dueUrgency, taskStatusBorder(task.status));

  return (
    <Link
      to={`/app/clubs/${task.clubId}/tasks`}
      className="block w-full no-underline"
      style={{ cursor: "pointer" }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#1a1a1a",
          borderTop: `1px solid ${borderMuted}`,
          borderRight: `1px solid ${borderMuted}`,
          borderBottom: `1px solid ${borderMuted}`,
          borderLeft: `4px solid ${leftBorder}`,
          borderRadius: "8px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          transition: "all 0.15s ease",
          transform: hovered ? "translateY(-1px)" : undefined,
        }}
      >
        <ClubBadge name={task.clubName} size="sm" logoUrl={logoUrl} />
        <div style={{ minWidth: 0, flex: 1 }}>
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
          <LinkedMeetingCancelledLabel show={task.linkedMeetingCancelled} />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: taskDueDateColor(dueUrgency),
            }}
          >
            <Calendar size={11} aria-hidden />
            {formatTaskDate(task.dateKey)}
          </span>
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
          <TaskDueBadgeInline dueDate={task.dateKey} status={task.status} />
          <span style={{ ...dashboardTaskStatusBadgeStyle(task.status) }}>
            {taskStatusLabel(task.status)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ThisWeekTab({
  joinedClubIds,
  clubLogos,
  displayName,
  onViewAllTasks,
}: {
  joinedClubIds: string[];
  clubLogos: Record<string, string>;
  displayName: string;
  onViewAllTasks: () => void;
  onViewAllEvents: () => void;
}) {
  const [items, setItems] = useState<WeekPlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthlyCompleted, setMonthlyCompleted] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const weekItemsRef = useRef<HTMLDivElement>(null);
  const todayKey = todayIsoDate();
  const weekReference = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return ref;
  }, [weekOffset]);
  const weekDays = useMemo(() => calendarWeekDays(weekReference), [weekReference]);
  const weekStart = weekDays[0]?.dateKey ?? todayKey;
  const weekEnd = weekDays[6]?.dateKey ?? addDaysIso(todayKey, 6);

  useEffect(() => {
    if (joinedClubIds.length === 0) {
      queueMicrotask(() => {
        setItems([]);
        setMonthlyCompleted(0);
        setMonthlyTotal(0);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartIso = localIsoDate(monthStart);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const monthEndIso = localIsoDate(monthEnd);

    async function loadWeek() {
      setLoading(true);

      const [tasksRes, eventsRes, monthTasksRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(
            `
            id,
            club_id,
            title,
            priority,
            status,
            due_date,
            linked_meeting_id,
            linked_meeting:club_meetings!tasks_linked_meeting_id_fkey ( status ),
            clubs:club_id ( name )
          `,
          )
          .in("club_id", joinedClubIds)
          .gte("due_date", weekStart)
          .lte("due_date", weekEnd)
          .neq("status", "done")
          .neq("status", "cancelled")
          .order("due_date", { ascending: true }),
        supabase
          .from("events")
          .select(
            `
            id,
            club_id,
            title,
            date,
            time,
            location,
            visibility,
            clubs:club_id ( name )
          `,
          )
          .in("club_id", joinedClubIds)
          .gte("date", weekStart)
          .lte("date", weekEnd)
          .order("date", { ascending: true })
          .order("time", { ascending: true }),
        supabase
          .from("tasks")
          .select("id, status")
          .in("club_id", joinedClubIds)
          .neq("status", "cancelled")
          .gte("due_date", monthStartIso)
          .lte("due_date", monthEndIso),
      ]);

      if (cancelled) return;

      const plannerItems: WeekPlannerItem[] = [];

      if (!eventsRes.error) {
        for (const row of eventsRes.data ?? []) {
          const clubRaw = row.clubs as unknown;
          const club = (
            Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
          ) as Record<string, unknown>;
          const dateKey = (row.date as string) ?? "";
          if (!dateKey) continue;
          plannerItems.push({
            kind: "event",
            id: row.id as string,
            dateKey,
            title: (row.title as string) ?? "",
            clubName: (club.name as string) ?? "",
            clubId: row.club_id as string,
            time: (row.time as string) ?? "",
            location: (row.location as string) ?? "",
            visibility: (row.visibility as string) ?? null,
          });
        }
      }

      if (!tasksRes.error) {
        for (const row of tasksRes.data ?? []) {
          const clubRaw = row.clubs as unknown;
          const club = (
            Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
          ) as Record<string, unknown>;
          const dateKey = (row.due_date as string) ?? "";
          if (!dateKey) continue;
          plannerItems.push({
            kind: "task",
            id: row.id as string,
            dateKey,
            title: (row.title as string) ?? "",
            clubName: (club.name as string) ?? "",
            clubId: row.club_id as string,
            priority: (row.priority as string) ?? "medium",
            status: (row.status as string) ?? "todo",
            linkedMeetingCancelled: isLinkedMeetingCancelledRow(
              row as Record<string, unknown>,
            ),
          });
        }
      }

      if (!monthTasksRes.error) {
        const monthRows = monthTasksRes.data ?? [];
        const completed = monthRows.filter((row) => row.status === "done").length;
        setMonthlyCompleted(completed);
        setMonthlyTotal(monthRows.length);
      } else {
        setMonthlyCompleted(0);
        setMonthlyTotal(0);
      }

      setItems(plannerItems);
      setLoading(false);
    }

    void loadWeek();

    return () => {
      cancelled = true;
    };
  }, [joinedClubIds, weekStart, weekEnd]);

  const dayMeta = useMemo(() => {
    const map = new Map<
      string,
      { hasEvents: boolean; hasTasks: boolean; itemCount: number }
    >();
    for (const item of items) {
      const existing = map.get(item.dateKey) ?? {
        hasEvents: false,
        hasTasks: false,
        itemCount: 0,
      };
      if (item.kind === "event") existing.hasEvents = true;
      if (item.kind === "task") existing.hasTasks = true;
      existing.itemCount += 1;
      map.set(item.dateKey, existing);
    }
    return map;
  }, [items]);

  const weekTasks = useMemo(() => {
    const tasks = items.filter((i): i is WeekTaskItem => i.kind === "task");
    const filtered = selectedDayKey
      ? tasks.filter((t) => t.dateKey === selectedDayKey)
      : tasks;
    return [...filtered].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [items, selectedDayKey]);

  const weekEvents = useMemo(() => {
    const events = items.filter((i): i is WeekEventItem => i.kind === "event");
    const filtered = selectedDayKey
      ? events.filter((e) => e.dateKey === selectedDayKey)
      : events;
    return [...filtered].sort((a, b) => {
      const byDate = a.dateKey.localeCompare(b.dateKey);
      if (byDate !== 0) return byDate;
      return (a.time ?? "").localeCompare(b.time ?? "");
    });
  }, [items, selectedDayKey]);

  const previewTasks = weekTasks.slice(0, 3);
  const previewEvents = weekEvents.slice(0, 3);

  function handleDayClick(dateKey: string) {
    setSelectedDayKey((prev) => (prev === dateKey ? null : dateKey));
    requestAnimationFrame(() => {
      weekItemsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading your week…" />
      </div>
    );
  }

  return (
    <div>
      <WeekCalendarStrip
        weekDays={weekDays}
        todayKey={todayKey}
        selectedDayKey={selectedDayKey}
        dayMeta={dayMeta}
        onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
        onNextWeek={() => setWeekOffset((prev) => prev + 1)}
        onDayClick={handleDayClick}
      />

      <div ref={weekItemsRef}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 10px",
          }}
        >
          Tasks This Week
        </h3>
        {weekTasks.length === 0 ? (
          <TasksWeekEmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            {previewTasks.map((task) => (
              <WeekTaskCard
                key={task.id}
                task={task}
                logoUrl={clubLogos[task.clubId]}
              />
            ))}
            {weekTasks.length > 3 ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={onViewAllTasks} style={viewAllLinkStyle}>
                  View All →
                </button>
              </div>
            ) : null}
          </div>
        )}

        <h3
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 10px",
          }}
        >
          Events This Week
        </h3>
        {weekEvents.length === 0 ? (
          <p style={{ color: "#444444", fontSize: "13px", margin: 0 }}>
            No events this week
          </p>
        ) : (
          <div>
            {previewEvents.map((event) => (
              <ThisWeekEventCard
                key={event.id}
                event={event}
                logoUrl={clubLogos[event.clubId]}
              />
            ))}
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <Link to="/events" style={{ ...viewAllLinkStyle, display: "inline-block" }}>
                View all events →
              </Link>
            </div>
          </div>
        )}

        <WeekAchievementCard
          displayName={displayName}
          completedCount={monthlyCompleted}
          totalCount={monthlyTotal}
        />
      </div>
    </div>
  );
}

type OverviewTask = {
  id: string;
  title: string;
  status: string;
  clubName: string;
  clubId: string;
  dueDate?: string;
  linkedMeetingCancelled?: boolean;
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

function dashboardEventRsvpBadgeStyle(rsvpStatus?: string): CSSProperties {
  const base: CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    borderRadius: "5px",
    padding: "3px 8px",
    flexShrink: 0,
  };
  if (rsvpStatus === "going") {
    return {
      ...base,
      background: "#1a1200",
      border: "1px solid #FFC429",
      color: "#FFC429",
    };
  }
  if (rsvpStatus === "maybe") {
    return {
      ...base,
      background: "#1f1a00",
      border: "1px solid #2a2400",
      color: "#9a7a00",
    };
  }
  return {
    ...base,
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#666666",
  };
}

function dashboardTaskStatusBadgeStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    borderRadius: "5px",
    padding: "3px 8px",
    flexShrink: 0,
  };
  if (status === "in_progress") {
    return {
      ...base,
      background: "#1f1a00",
      border: "1px solid #2a2400",
      color: "#9a7a00",
    };
  }
  if (status === "done") {
    return {
      ...base,
      background: "#1a0a0a",
      border: "1px solid #2a1a1a",
      color: "#8a3a3a",
    };
  }
  return {
    ...base,
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#666666",
  };
}

function hasEventLocation(location: string | null | undefined): boolean {
  const trimmed = location?.trim();
  return !!trimmed && trimmed !== "TBD";
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

function MyClubsTabClubAvatar({
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
          width: 48,
          height: 48,
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
        width: 48,
        height: 48,
        borderRadius: "8px",
        border: "1px solid #333333",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: "13px",
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

function MyClubsTab({
  myClubs,
  mySavedClubs,
  clubLogos,
  getUserRole,
}: {
  myClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  mySavedClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  clubLogos: Record<string, string>;
  getUserRole: (clubId: string) => import("../../types").MemberRole | null;
}) {
  const navigate = useNavigate();

  if (myClubs.length === 0) {
    return (
      <div
        className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-3)] px-4 py-10 text-center"
      >
        <p style={{ color: "#555555", fontSize: "13px", margin: 0 }}>
          You have not joined any clubs yet.
        </p>
        <Link
          to="/explore"
          className="mt-4 inline-flex h-9 items-center rounded-[var(--r-md)] bg-[var(--red)] px-3 text-sm text-white hover:bg-[var(--red-hover)]"
        >
          Explore clubs
        </Link>
      </div>
    );
  }

  return (
  <>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "16px",
      }}
    >
      {myClubs.map((club) => {
        const roleDisplay = formatClubRoleDisplay(getUserRole(club.id));
        return (
          <div
            key={club.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/app/clubs/${club.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/app/clubs/${club.id}`);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#333333";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#242424";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <MyClubsTabClubAvatar
                name={club.name}
                abbreviation={club.abbreviation}
                logoUrl={clubLogos[club.id] ?? club.logoUrl}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#ffffff",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {club.name}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "8px",
                    borderRadius: "20px",
                    padding: "2px 10px",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: roleDisplay.color,
                    border: `1px solid ${roleDisplay.color}`,
                    background: "transparent",
                  }}
                >
                  {roleDisplay.label}
                </span>
                <p style={{ fontSize: "12px", color: "#555555", margin: "8px 0 0" }}>
                  {club.memberCount} members
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app/clubs/${club.id}`);
              }}
              style={{
                background: "#E51937",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "9px 0",
                fontSize: "13px",
                fontWeight: 600,
                width: "100%",
                textAlign: "center",
                cursor: "pointer",
                border: "none",
                display: "block",
                marginTop: "12px",
              }}
            >
              Open Workspace
            </button>
          </div>
        );
      })}
    </div>

    {mySavedClubs.length > 0 ? (
      <div style={{ marginTop: "32px" }}>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <svg
            className="h-4 w-4 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
          Saved Clubs
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
          }}
        >
          {mySavedClubs.map((club) => (
            <Link
              key={club.id}
              to={`/clubs/${club.slug}`}
              className="flex items-start gap-3 no-underline"
              style={{
                background: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "10px",
                padding: "16px",
                cursor: "pointer",
              }}
            >
              <ClubBadge abbreviation={club.abbreviation} name={club.name} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                  {club.name}
                </p>
                <p className="text-xs text-muted">{club.category}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    ) : null}
  </>
  );
}

function OverviewTab({
  myClubs,
  upcomingEvents,
  eventsLoading,
  myRsvps,
  getUserRole,
  userId,
  joinedClubIds,
  clubLogos,
  inboxMessages,
  inboxLoading,
  inboxUnreadCount,
  isMobile,
  onViewAllEvents,
  onViewAllTasks,
  onViewAllClubs,
  onViewAllInbox,
  onViewAllAnnouncements,
}: {
  myClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  upcomingEvents: DashboardEvent[];
  eventsLoading: boolean;
  myRsvps: Record<string, string>;
  getUserRole: (clubId: string) => import("../../types").MemberRole | null;
  userId?: string;
  joinedClubIds: string[];
  clubLogos: Record<string, string>;
  inboxMessages: InboxMessage[];
  inboxLoading: boolean;
  inboxUnreadCount: number;
  isMobile: boolean;
  onViewAllEvents: () => void;
  onViewAllTasks: () => void;
  onViewAllClubs: () => void;
  onViewAllInbox: () => void;
  onViewAllAnnouncements: () => void;
}) {
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

  const previewClubs = useMemo(() => myClubs.slice(0, 4), [myClubs]);

  const previewInboxMessages = useMemo(
    () => inboxMessages.slice(0, 3),
    [inboxMessages],
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
        linked_meeting_id,
        linked_meeting:club_meetings!tasks_linked_meeting_id_fkey ( status ),
        clubs:club_id ( name )
      `)
      .in("club_id", joinedClubIds)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .neq("status", "done")
      .neq("status", "cancelled")
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
                linkedMeetingCancelled: isLinkedMeetingCancelledRow(
                  row as Record<string, unknown>,
                ),
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

  const tasksColumn = (
    <OverviewColumnCard
      title="My Tasks"
      icon={<CheckSquare size={16} color="#555555" aria-hidden />}
      footer={
        !tasksLoading ? (
          <OverviewViewAllLink label="View All Tasks →" onClick={onViewAllTasks} />
        ) : null
      }
    >
      {tasksLoading ? (
        <div className="flex justify-center py-6">
          <Spinner label="Loading tasks…" />
        </div>
      ) : myTasks.length === 0 ? (
        <p style={overviewEmptyTextStyle}>No active tasks</p>
      ) : (
        <div>
          {myTasks.map((task) => (
            <OverviewCompactTaskRow
              key={task.id}
              task={task}
              logoUrl={clubLogos[task.clubId]}
            />
          ))}
        </div>
      )}
    </OverviewColumnCard>
  );

  const eventsColumn = (
    <OverviewColumnCard
      title="Upcoming Events"
      icon={<Calendar size={16} color="#555555" aria-hidden />}
      footer={
        !eventsLoading ? (
          <OverviewViewAllLink label="View All Events →" onClick={onViewAllEvents} />
        ) : null
      }
    >
      {eventsLoading ? (
        <div className="flex justify-center py-6">
          <Spinner label="Loading events…" />
        </div>
      ) : previewEvents.length === 0 ? (
        <p style={overviewEmptyTextStyle}>No upcoming events</p>
      ) : (
        <div>
          {previewEvents.map((event) => (
            <OverviewCompactEventRow
              key={event.id}
              event={event}
              rsvpStatus={myRsvps[event.id]}
            />
          ))}
        </div>
      )}
    </OverviewColumnCard>
  );

  const clubsColumn = (
    <OverviewColumnCard
      title="My Clubs"
      icon={<Users size={16} color="#555555" aria-hidden />}
      footer={
        <OverviewViewAllLink label="View All Clubs →" onClick={onViewAllClubs} />
      }
    >
      {previewClubs.length === 0 ? (
        <p style={overviewEmptyTextStyle}>You have not joined any clubs yet.</p>
      ) : (
        <div>
          {previewClubs.map((club) => (
            <OverviewCompactClubRow
              key={club.id}
              club={club}
              logoUrl={clubLogos[club.id] ?? club.logoUrl}
              roleLabel={formatClubRoleDisplay(getUserRole(club.id)).label}
            />
          ))}
        </div>
      )}
    </OverviewColumnCard>
  );

  const inboxColumn = (
    <OverviewColumnCard
      title="Inbox"
      icon={<Bell size={16} color="#555555" aria-hidden />}
      badge={
        inboxUnreadCount > 0 ? (
          <span
            style={{
              marginLeft: "auto",
              background: "#E51937",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {inboxUnreadCount}
          </span>
        ) : null
      }
      footer={<OverviewViewAllLink label="View All Messages →" onClick={onViewAllInbox} />}
    >
      {inboxLoading ? (
        <div className="flex justify-center py-6">
          <Spinner label="Loading inbox…" />
        </div>
      ) : previewInboxMessages.length === 0 ? (
        <p style={overviewEmptyTextStyle}>No messages yet</p>
      ) : (
        <div>
          {previewInboxMessages.map((message) => (
            <OverviewCompactInboxRow key={message.id} message={message} />
          ))}
        </div>
      )}
    </OverviewColumnCard>
  );

  const announcementsColumn = (
    <OverviewColumnCard
      title="Recent Announcements"
      icon={<Megaphone size={16} color="#555555" aria-hidden />}
      footer={<OverviewViewAllLink label="View All Announcements →" onClick={onViewAllAnnouncements} />}
    >
      {announcementsLoading ? (
        <div className="flex justify-center py-6">
          <Spinner label="Loading announcements…" />
        </div>
      ) : recentAnnouncements.length === 0 ? (
        <p style={overviewEmptyTextStyle}>No announcements yet</p>
      ) : (
        <div>
          {recentAnnouncements.map((announcement) => (
            <OverviewCompactAnnouncementRow
              key={announcement.id}
              announcement={announcement}
            />
          ))}
        </div>
      )}
    </OverviewColumnCard>
  );

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {tasksColumn}
        {eventsColumn}
        {clubsColumn}
        {inboxColumn}
        {announcementsColumn}
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        {tasksColumn}
        {eventsColumn}
        {clubsColumn}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "16px",
        }}
      >
        {inboxColumn}
        {announcementsColumn}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Events Tab (full-page list)
// ---------------------------------------------------------------------------
type DeduplicatedDashboardEvent = DashboardEvent & {
  moreDatesCount: number;
};

function deduplicateDashboardEvents(
  events: DashboardEvent[],
): DeduplicatedDashboardEvent[] {
  const grouped = new Map<string, DashboardEvent[]>();

  for (const event of events) {
    const key = `${event.clubId}::${event.title.trim().toLowerCase()}`;
    const existing = grouped.get(key) ?? [];
    existing.push(event);
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((group) => {
      const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
      const next = sorted[0];
      return {
        ...next,
        moreDatesCount: sorted.length - 1,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function groupDashboardEventsByDate(events: DeduplicatedDashboardEvent[]) {
  const grouped = new Map<string, DeduplicatedDashboardEvent[]>();

  for (const event of events) {
    const existing = grouped.get(event.date) ?? [];
    existing.push(event);
    grouped.set(event.date, existing);
  }

  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, dateEvents]) => ({ date, events: dateEvents }));
}

function parseDashboardEventDay(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatEventsTabDateGroupLabel(dateStr: string): string {
  const eventDay = parseDashboardEventDay(dateStr);
  if (!eventDay) return dateStr;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const compareDay = new Date(eventDay);
  compareDay.setHours(0, 0, 0, 0);

  if (compareDay.getTime() === today.getTime()) return "Today";
  if (compareDay.getTime() === tomorrow.getTime()) return "Tomorrow";

  return eventDay.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatEventsTabTime12h(timeStr: string): string | null {
  const t = timeStr.trim();
  if (!t || t.toUpperCase() === "TBD") return null;

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

function EventsTabClubLogo({
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
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: "10px",
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

function EventsTabEventCard({
  event,
  rsvpStatus,
  logoUrl,
}: {
  event: DashboardEvent;
  rsvpStatus?: string;
  logoUrl?: string;
}) {
  const timeLabel = event.time ? formatEventsTabTime12h(event.time) : null;
  const metaParts = [timeLabel, event.clubName].filter(Boolean);
  const isGoing = rsvpStatus === "going";

  return (
    <Link
      to={`/app/clubs/${event.clubId}/events`}
      className="block"
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "#141414",
          borderTop: "1px solid #2a2a2a",
          borderRight: "1px solid #2a2a2a",
          borderBottom: "1px solid #2a2a2a",
          borderLeft: "1px solid #2a2a2a",
          borderRadius: "10px",
          padding: "12px 16px",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <EventsTabClubLogo
          name={event.clubName}
          abbreviation={event.clubAbbreviation}
          logoUrl={logoUrl}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </p>
          {metaParts.length > 0 ? (
            <p
              style={{
                fontSize: "12px",
                color: "#555555",
                marginTop: "2px",
                marginBottom: 0,
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
            borderRadius: "4px",
            padding: "3px 10px",
            fontSize: "11px",
            fontWeight: 500,
            ...(isGoing
              ? {
                  background: "#1a1200",
                  border: "1px solid #FFC429",
                  color: "#FFC429",
                }
              : {
                  background: "#1a1a1a",
                  border: "1px solid #333333",
                  color: "#555555",
                }),
          }}
        >
          {isGoing ? "Going" : "Open"}
        </span>
      </div>
    </Link>
  );
}

function EventsTab({
  upcomingEvents,
  eventsLoading,
  myRsvps,
  clubLogos,
}: {
  upcomingEvents: DashboardEvent[];
  eventsLoading: boolean;
  myRsvps: Record<string, string>;
  clubLogos: Record<string, string>;
}) {
  const eventsByDate = useMemo(() => {
    const deduplicated = deduplicateDashboardEvents(upcomingEvents);
    return groupDashboardEventsByDate(deduplicated);
  }, [upcomingEvents]);

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
      {eventsByDate.map((group, groupIndex) => (
        <section key={group.date}>
          <h3
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#555555",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
              marginTop: groupIndex === 0 ? 0 : "20px",
              paddingBottom: "8px",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            {formatEventsTabDateGroupLabel(group.date)}
          </h3>
          {group.events.map((event) => (
            <EventsTabEventCard
              key={`${event.id}-${event.date}`}
              event={event}
              rsvpStatus={myRsvps[event.id]}
              logoUrl={event.clubId ? clubLogos[event.clubId] : undefined}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tasks Tab
// ---------------------------------------------------------------------------
function TasksTab({ joinedClubs }: { joinedClubs: string[] }) {
  const { user } = useAuthContext();
  const [tasks, setTasks] = useState<TasksTabTask[]>([]);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [joinedClubOptions, setJoinedClubOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState("all");
  const [sort, setSort] = useState<TaskSortOption>("due_date");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>("all");
  const [expandedClubs, setExpandedClubs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (joinedClubs.length === 0) {
      queueMicrotask(() => {
        setClubLogos({});
        setJoinedClubOptions([]);
      });
      return;
    }

    let cancelled = false;

    supabase
      .from("clubs")
      .select("*")
      .in("id", joinedClubs)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load task tab club logos:", error.message);
          setClubLogos({});
          setJoinedClubOptions([]);
          return;
        }
        const map: Record<string, string> = {};
        const options: Array<{ id: string; name: string }> = [];
        for (const row of data ?? []) {
          const id = row.id as string;
          const url = row.logo_url as string | null;
          if (url) map[id] = url;
          options.push({ id, name: (row.name as string) ?? "Unknown Club" });
        }
        options.sort((a, b) => a.name.localeCompare(b.name));
        setClubLogos(map);
        setJoinedClubOptions(options);
      });

    return () => {
      cancelled = true;
    };
  }, [joinedClubs]);

  useEffect(() => {
    if (joinedClubs.length === 0 || !user) {
      queueMicrotask(() => setLoadingTasks(false));
      return;
    }

    let cancelled = false;

    supabase
      .from("tasks")
      .select(
        "id, title, status, priority, task_type, due_date, created_at, club_id, linked_meeting_id, linked_meeting:club_meetings!tasks_linked_meeting_id_fkey ( status ), clubs:club_id ( name, logo_url, abbreviation )",
      )
      .in("club_id", joinedClubs)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
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
              const clubLogoUrl = (club.logo_url as string | null) ?? undefined;
              return {
                id: row.id as string,
                title: (row.title as string) ?? "",
                status: (row.status as string) ?? "todo",
                priority: (row.priority as string) ?? "medium",
                taskType: (row.task_type as string) ?? "general",
                clubName: (club.name as string) ?? "",
                clubId: row.club_id as string,
                clubAbbreviation: (club.abbreviation as string) ?? undefined,
                clubLogoUrl: clubLogoUrl || undefined,
                dueDate: (row.due_date as string | null) ?? undefined,
                createdAt: (row.created_at as string) ?? undefined,
                linkedMeetingCancelled: isLinkedMeetingCancelledRow(
                  row as Record<string, unknown>,
                ),
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

  useEffect(() => {
    const missingClubIds = [
      ...new Set(
        tasks
          .filter((t) => !t.clubLogoUrl && !clubLogos[t.clubId])
          .map((t) => t.clubId),
      ),
    ];
    if (missingClubIds.length === 0) return;

    let cancelled = false;

    supabase
      .from("clubs")
      .select("*")
      .in("id", missingClubIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load missing task club logos:", error.message);
          return;
        }
        setClubLogos((prev) => {
          const next = { ...prev };
          for (const row of data ?? []) {
            const url = row.logo_url as string | null;
            if (url) next[row.id as string] = url;
          }
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tasks, clubLogos]);

  const clubOptions = joinedClubOptions;

  const filtersActive =
    search.trim().length > 0 ||
    clubFilter !== "all" ||
    priorityFilter !== "all" ||
    sort !== "due_date";

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (clubFilter !== "all" && task.clubId !== clubFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (query && !task.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [tasks, search, clubFilter, priorityFilter]);

  const sortedTasks = useMemo(() => {
    const next = [...filteredTasks];

    next.sort((a, b) => {
      if (sort === "club_name") {
        return a.clubName.localeCompare(b.clubName) || a.title.localeCompare(b.title);
      }

      if (sort === "status") {
        return (
          statusSortValue(a.status) - statusSortValue(b.status) ||
          a.title.localeCompare(b.title)
        );
      }

      if (sort === "priority") {
        return (
          prioritySortValue(a.priority) - prioritySortValue(b.priority) ||
          a.title.localeCompare(b.title)
        );
      }

      const aDue = a.dueDate?.trim() ?? "9999-12-31";
      const bDue = b.dueDate?.trim() ?? "9999-12-31";
      return aDue.localeCompare(bDue) || a.title.localeCompare(b.title);
    });

    return next;
  }, [filteredTasks, sort]);

  const groupedTasks = useMemo(() => {
    const byClub = new Map<string, TasksTabTask[]>();
    for (const task of sortedTasks) {
      const existing = byClub.get(task.clubId) ?? [];
      existing.push(task);
      byClub.set(task.clubId, existing);
    }

    const allClubIds = new Set([...byClub.keys()]);
    if (clubFilter !== "all") {
      allClubIds.add(clubFilter);
    }

    return Array.from(allClubIds)
      .map((clubId) => {
        const clubTasks = byClub.get(clubId) ?? [];
        const sourceTasks = tasks.filter((task) => task.clubId === clubId);
        const doneCount = sourceTasks.filter((task) => task.status === "done").length;
        return {
          clubId,
          clubName: clubTasks[0]?.clubName ?? sourceTasks[0]?.clubName ?? "Unknown Club",
          clubAbbreviation: clubTasks[0]?.clubAbbreviation ?? sourceTasks[0]?.clubAbbreviation,
          tasks: clubTasks,
          doneCount,
          totalCount: sourceTasks.length,
        };
      })
      .filter((group) => group.totalCount > 0)
      .sort((a, b) => a.clubName.localeCompare(b.clubName));
  }, [sortedTasks, tasks, clubFilter]);

  const weeklyProgress = useWeeklyTaskProgress(tasks);
  const breakdown = useTaskBreakdown(filteredTasks);

  useEffect(() => {
    setExpandedClubs((prev) => {
      const next = { ...prev };
      for (const group of groupedTasks) {
        if (next[group.clubId] === undefined) next[group.clubId] = true;
      }
      return next;
    });
  }, [groupedTasks]);

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

  return (
    <div>
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        <WeeklyTaskProgressCard
          completed={weeklyProgress.completed}
          total={weeklyProgress.total}
          dailyCounts={weeklyProgress.dailyCounts}
          weekLabels={weeklyProgress.weekLabels}
        />
        <TaskBreakdownCard arcs={breakdown.arcs} segments={breakdown.segments} />
      </div>

      <TasksFilterBar
        search={search}
        onSearchChange={setSearch}
        clubFilter={clubFilter}
        onClubFilterChange={setClubFilter}
        clubOptions={clubOptions}
        sort={sort}
        onSortChange={setSort}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
      />

      {groupedTasks.map((group) => (
        <TaskClubGroupSection
          key={group.clubId}
          group={group}
          logoUrl={group.tasks[0]?.clubLogoUrl ?? clubLogos[group.clubId]}
          expanded={expandedClubs[group.clubId] ?? true}
          onToggle={() =>
            setExpandedClubs((prev) => ({
              ...prev,
              [group.clubId]: !(prev[group.clubId] ?? true),
            }))
          }
        />
      ))}

      <TasksTabFooter
        visibleCount={sortedTasks.length}
        totalCount={tasks.length}
        clubCount={groupedTasks.length}
        filtersActive={filtersActive}
      />
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
          fontSize: "12px",
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