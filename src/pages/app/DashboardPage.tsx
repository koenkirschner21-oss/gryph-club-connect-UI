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
  type ReactNode,
} from "react";
import {
  Calendar,
  CheckSquare,
  Bell,
  Compass,
  ChevronRight,
  Megaphone,
  Users,
  Briefcase,
  UserCircle,
} from "lucide-react";
import type { InboxMessage } from "../../lib/inboxUtils";
import { resolveInboxLink } from "../../lib/inboxUtils";
import { normalizeInboxUiType } from "../../components/inbox/inboxMessageUi";
import { supabase } from "../../lib/supabaseClient";
import { removeRealtimeChannel, uniqueRealtimeTopic } from "../../lib/realtimeChannels";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import { useDashboardEvents, type DashboardEvent } from "../../hooks/useDashboardEvents";
import LinkedMeetingCancelledLabel from "../../components/tasks/LinkedMeetingCancelledLabel";
import { useDashboardTasks } from "../../hooks/useDashboardTasks";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import { eventRequiresRsvpQuestionnaire } from "../../lib/eventRsvpActions";
import { getEventRsvpPath, getPublicEventDetailPath, resolveEventDetailPath } from "../../lib/eventNavigation";
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
  TaskListGroupSection,
  TasksTabFooter,
  DashboardTaskScopeToggle,
  type TasksTabTask,
  type DashboardTaskScope,
  TaskProgressCard,
  buildTaskListGroups,
  useTaskBreakdown,
  useTaskProgress,
  type TaskGroupByOption,
  type TaskProgressTimeRange,
  type TaskSortOption,
} from "../dashboard/TasksTabUI";
import {
  EventsTabHeader,
  EventsTabTimeline,
  useEventsTabSummary,
} from "../dashboard/EventsTabUI";
import {
  MyClubsFilterBar,
  MyClubsGrid,
  MyClubsHeader,
  MyClubsPagination,
  filterMyClubs,
  paginateClubs,
  sortMyClubs,
  type ClubFilterOption,
  type ClubSortOption,
} from "../dashboard/MyClubsTabUI";
import {
  TasksWeekEmptyState,
  ThisWeekEventCard,
  WeekAchievementCard,
  WeekCalendarStrip,
  WeekClubLogo,
  MonthCalendarGrid,
  MonthWeekToggle,
  type CalendarViewMode,
} from "../dashboard/ThisWeekTabUI";
import {
  resolveOnboardingIntent,
  type OnboardingIntent,
} from "../../lib/onboardingIntent";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------
type DashboardTab = "overview" | "events" | "tasks" | "month" | "clubs" | "inbox";

function deriveAbbreviation(name: string, maxLen = 3): string {
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

const newUserGuideCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  background: "#141414",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "20px",
  textDecoration: "none",
  color: "inherit",
  transition: "border-color 0.15s ease, transform 0.15s ease",
};

const newUserGuideCardSecondaryStyle: CSSProperties = {
  ...newUserGuideCardStyle,
  background: "#121212",
  border: "1px solid #1e1e1e",
};

type GuideCard = {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  secondary?: boolean;
};

const DISCOVER_GUIDE_CARDS: GuideCard[] = [
  {
    to: "/explore",
    title: "Explore clubs",
    description: "Browse campus clubs by category and find communities to join.",
    icon: <Compass size={22} color="#E51937" aria-hidden />,
  },
  {
    to: "/events",
    title: "Browse events",
    description: "See what's happening on campus and RSVP to public events.",
    icon: <Calendar size={22} color="#FFC429" aria-hidden />,
  },
  {
    to: "/hiring",
    title: "Browse hiring roles",
    description: "Find executive and volunteer openings posted by clubs.",
    icon: <Briefcase size={22} color="#E51937" aria-hidden />,
  },
  {
    to: "/app/settings",
    title: "Complete your profile",
    description: "Add a photo, program, and preferences so clubs recognize you.",
    icon: <UserCircle size={22} color="#747676" aria-hidden />,
  },
];

const MANAGE_GUIDE_CARDS: GuideCard[] = [
  {
    to: "/explore?claim=true",
    title: "Claim a club",
    description: "Take ownership of an existing unclaimed club listing on campus.",
    icon: <Users size={22} color="#E51937" aria-hidden />,
  },
  {
    to: "/app/create-club",
    title: "Create a club",
    description: "Submit a request to add a new club to Gryph ClubConnect.",
    icon: <Megaphone size={22} color="#FFC429" aria-hidden />,
  },
  {
    to: "/app/join-club",
    title: "Join with code",
    description: "Enter an invite code from your club's admin to join their workspace.",
    icon: <CheckSquare size={22} color="#E51937" aria-hidden />,
  },
  {
    to: "/explore",
    title: "Explore clubs",
    description: "Browse what's already on campus while you get set up.",
    icon: <Compass size={22} color="#747676" aria-hidden />,
    secondary: true,
  },
];

function emptyDashboardSubtitle(intent: OnboardingIntent | null): string {
  if (intent === "manage") {
    return "You haven't joined or created a club yet. Start by claiming an existing club, creating a new club, or joining with a code.";
  }
  if (intent === "discover") {
    return "Explore clubs, events, and hiring roles to find your place on campus.";
  }
  if (intent === "both") {
    return "Get involved as a member and set up a club you want to lead — pick a starting point below.";
  }
  return "Get started by exploring campus clubs and events.";
}

function NewUserGuideSection({
  title,
  cards,
  isMobileGuide,
}: {
  title?: string;
  cards: GuideCard[];
  isMobileGuide: boolean;
}) {
  return (
    <div style={{ marginBottom: title ? "24px" : 0 }}>
      {title ? (
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#777777",
            margin: "0 0 12px",
          }}
        >
          {title}
        </h3>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobileGuide ? "1fr" : "1fr 1fr",
          gap: "14px",
        }}
      >
        {cards.map((card) => (
          <Link
            key={`${title ?? "default"}-${card.to}-${card.title}`}
            to={card.to}
            style={card.secondary ? newUserGuideCardSecondaryStyle : newUserGuideCardStyle}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = "#333333";
              event.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = card.secondary ? "#1e1e1e" : "#242424";
              event.currentTarget.style.transform = "none";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {card.icon}
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: card.secondary ? "#cccccc" : "#ffffff",
                }}
              >
                {card.title}
              </span>
              <ChevronRight
                size={16}
                color="#555555"
                style={{ marginLeft: "auto" }}
                aria-hidden
              />
            </div>
            <p
              style={{
                fontSize: "13px",
                color: card.secondary ? "#666666" : "#777777",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewUserDashboardGuide({ intent }: { intent: OnboardingIntent | null }) {
  const isMobileGuide = useIsMobile();

  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1e1e1e",
        borderRadius: "12px",
        padding: isMobileGuide ? "28px 20px" : "40px 32px",
      }}
    >
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 8px",
          textAlign: "center",
        }}
      >
        Welcome to Gryph ClubConnect
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: "#666666",
          margin: "0 0 28px",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {emptyDashboardSubtitle(intent)}
      </p>

      {intent === "manage" ? (
        <NewUserGuideSection cards={MANAGE_GUIDE_CARDS} isMobileGuide={isMobileGuide} />
      ) : intent === "discover" ? (
        <NewUserGuideSection cards={DISCOVER_GUIDE_CARDS} isMobileGuide={isMobileGuide} />
      ) : intent === "both" ? (
        <>
          <NewUserGuideSection
            title="Get involved"
            cards={DISCOVER_GUIDE_CARDS}
            isMobileGuide={isMobileGuide}
          />
          <NewUserGuideSection
            title="Run a club"
            cards={MANAGE_GUIDE_CARDS}
            isMobileGuide={isMobileGuide}
          />
        </>
      ) : (
        <NewUserGuideSection cards={DISCOVER_GUIDE_CARDS} isMobileGuide={isMobileGuide} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();
  const { clubs, joinedClubs, savedClubs, loading, getUserRole, isPending, isJoined } =
    useClubContext();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [onboardingIntent, setOnboardingIntent] = useState<OnboardingIntent | null>(null);
  const inbox = useInbox();

  useEffect(() => {
    if (!user?.id) {
      setOnboardingIntent(null);
      return;
    }

    let cancelled = false;
    void resolveOnboardingIntent(user.id).then((intent) => {
      if (!cancelled) setOnboardingIntent(intent);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const pendingTab = sessionStorage.getItem("dashboardTab");
    if (pendingTab === "inbox") {
      setActiveTab("inbox");
      sessionStorage.removeItem("dashboardTab");
    }
  }, []);
  const [rsvpBusyEventId, setRsvpBusyEventId] = useState<string | null>(null);
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

  const { events: upcomingEvents, loading: eventsLoading, refresh: refreshEvents } =
    useDashboardEvents(joinedClubs, user?.id);
  const { activeCount: taskCount } = useDashboardTasks(joinedClubs, user?.id);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [clubLogos, setClubLogos] = useState<Record<string, string>>({});
  const [overdueTaskCount, setOverdueTaskCount] = useState(0);
  const [dueSoonTaskCount, setDueSoonTaskCount] = useState(0);

  useEffect(() => {
    const clubIds = Array.from(
      new Set([
        ...joinedClubs,
        ...upcomingEvents.map((event) => event.clubId).filter(Boolean),
      ]),
    );

    if (clubIds.length === 0) {
      setClubLogos({});
      return;
    }

    let cancelled = false;

    supabase
      .from("clubs")
      .select("*")
      .in("id", clubIds)
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
  }, [joinedClubs, upcomingEvents]);

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

    const channel = supabase.channel(
      uniqueRealtimeTopic(`dashboard-notifications-count:${user.id}`),
    );

    channel.on(
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
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void fetchUnreadNotificationCount();
      }
    });

    return () => {
      removeRealtimeChannel(supabase, channel);
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
  const { myRsvps, setRsvp, removeRsvp } = useEventRsvps(eventIds);

  const handleDashboardSetRsvp = useCallback(
    async (eventId: string, status: import("../../types").RsvpStatus) => {
      const ok = await setRsvp(eventId, status);
      if (ok) refreshEvents();
      return ok;
    },
    [refreshEvents, setRsvp],
  );

  const handleDashboardEventRsvpClick = useCallback(
    async (
      eventId: string,
      _clubId: string,
      currentStatus?: import("../../types").RsvpStatus | string,
    ) => {
      if (currentStatus) return;

      const target = getEventRsvpPath(eventId);
      if (!user) {
        navigate(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }

      setRsvpBusyEventId(eventId);
      try {
        const needsQuestionnaire = await eventRequiresRsvpQuestionnaire(eventId, true);
        if (needsQuestionnaire) {
          navigate(target);
          return;
        }

        await handleDashboardSetRsvp(eventId, "going");
      } finally {
        setRsvpBusyEventId(null);
      }
    },
    [handleDashboardSetRsvp, navigate, user],
  );

  const handleDashboardRemoveRsvp = useCallback(
    async (eventId: string) => {
      const ok = await removeRsvp(eventId);
      if (ok) refreshEvents();
      return ok;
    },
    [refreshEvents, removeRsvp],
  );

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
            {joinedClubs.length === 0
              ? emptyDashboardSubtitle(onboardingIntent)
              : "Here's what's happening across your clubs this week."}
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
        <NewUserDashboardGuide intent={onboardingIntent} />
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
          sublabel="My open tasks"
          onClick={() => setActiveTab("tasks")}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="UNREAD ALERTS"
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
        <ThisMonthTabButton
          active={activeTab === "month"}
          onClick={() => setActiveTab("month")}
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
      {activeTab === "month" && (
        <ThisMonthTab
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
          isPending={isPending}
          isMobile={isMobile}
        />
      )}
      {activeTab === "events" && (
        <EventsTab
          upcomingEvents={upcomingEvents}
          eventsLoading={eventsLoading}
          myRsvps={myRsvps}
          clubLogos={clubLogos}
          isClubMember={isJoined}
          onRsvpClick={handleDashboardEventRsvpClick}
          onSetRsvp={handleDashboardSetRsvp}
          onRemoveRsvp={handleDashboardRemoveRsvp}
          rsvpBusyEventId={rsvpBusyEventId}
        />
      )}
      {activeTab === "tasks" && <TasksTab joinedClubs={joinedClubs} />}
      {activeTab === "inbox" && (
        <InboxTab
          {...inbox}
          clubLogos={clubLogos}
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

function ThisMonthTabButton({
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
      This Month
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
  size = 28,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  size?: number;
}) {
  const abbr = abbreviation?.trim() || deriveAbbreviation(name);
  const fontSize = size >= 40 ? "12px" : size >= 32 ? "11px" : "10px";
  const radius = size >= 40 ? "10px" : size >= 32 ? "8px" : "6px";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
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
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        background: "#2a2a2a",
        color: "#888888",
        fontSize,
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

function formatOverviewTaskDueLabel(dueDate: string): { text: string; color: string } {
  const trimmed = dueDate.trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(due.getTime())) {
    return { text: formatTaskDate(dueDate), color: "#777777" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffMs = dueDay.getTime() - today.getTime();

  if (diffMs < 0) {
    return { text: "Overdue", color: "#E51937" };
  }
  if (diffMs === 0) {
    return { text: "Due Today", color: "#777777" };
  }

  const month = due.toLocaleDateString("en-US", { month: "short" });
  const day = due.getDate();
  return { text: `Due ${month} ${day}`, color: "#777777" };
}

function truncateOverviewPreview(text: string, maxLength = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  const slice = normalized.slice(0, maxLength);
  const sentenceBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceBreak > 40) {
    return `${slice.slice(0, sentenceBreak + 1).trim()}…`;
  }

  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.trim()}…`;
}

function resolveOverviewInboxAction(message: InboxMessage): { label: string; href: string } {
  const uiType = normalizeInboxUiType(message);
  const href = resolveInboxLink(message);

  switch (uiType) {
    case "join_approved":
    case "claim_approved":
      return { label: "Open →", href };
    case "new_join_request":
    case "new_claim_request":
    case "application_update":
      return { label: "Review →", href };
    case "join_rejected":
    case "claim_rejected":
      return { label: "View Club →", href };
    case "claim_submitted":
      return { label: "Read More →", href };
    default:
      if (message.actionRequired && !message.actionCompleted) {
        return { label: "Review →", href };
      }
      return { label: "Read More →", href };
  }
}

function overviewClubRoleBadgeStyle(role: import("../../types").MemberRole | null): CSSProperties {
  const roleDisplay = formatClubRoleDisplay(role);
  const background =
    roleDisplay.color === "#FFC429"
      ? "#1a1200"
      : roleDisplay.color === "#E51937"
        ? "#1a0505"
        : "#1a1a1a";

  return {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 600,
    color: roleDisplay.color,
    background,
    border: `1px solid ${roleDisplay.color}`,
    borderRadius: "12px",
    padding: "2px 10px",
    marginTop: "2px",
  };
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
            (() => {
              const dueLabel = formatOverviewTaskDueLabel(task.dueDate);
              return (
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: dueLabel.color }}>
                  {dueLabel.text}
                </p>
              );
            })()
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
  logoUrl,
  isClubMember,
}: {
  event: DashboardEvent;
  logoUrl?: string;
  isClubMember: boolean;
}) {
  const timeLabel = formatOverviewEventTime(event.time);
  const locationLabel = hasEventLocation(event.location) ? event.location.trim() : null;
  const metaParts = [locationLabel, timeLabel].filter(Boolean);

  return (
    <Link
      to={
        event.clubId
          ? resolveEventDetailPath(event.id, event.clubId, isClubMember)
          : getPublicEventDetailPath(event.id)
      }
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <OverviewClubLogo
          name={event.clubName}
          abbreviation={event.clubAbbreviation}
          logoUrl={logoUrl}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
            {event.title}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#777777" }}>{event.clubName}</p>
          {metaParts.length > 0 ? (
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#777777" }}>
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>
        <div style={{ flexShrink: 0, alignSelf: "flex-start" }}>
          <OverviewCompactEventDateBadge date={event.date} />
        </div>
      </div>
    </Link>
  );
}

function OverviewCompactClubRow({
  club,
  logoUrl,
  userRole,
}: {
  club: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"][number];
  logoUrl?: string;
  userRole: import("../../types").MemberRole | null;
}) {
  return (
    <Link
      to={`/app/clubs/${club.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          ...overviewRowDividerStyle,
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "14px 0",
        }}
      >
        <OverviewClubLogo
          name={club.name}
          abbreviation={club.abbreviation}
          logoUrl={logoUrl}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
            {club.name}
          </p>
          <span style={{ ...overviewClubRoleBadgeStyle(userRole), marginTop: "4px", display: "inline-block" }}>
            {formatClubRoleDisplay(userRole).label}
          </span>
        </div>
        <ChevronRight size={16} color="#555555" aria-hidden style={{ flexShrink: 0 }} />
      </div>
    </Link>
  );
}

function OverviewCompactInboxRow({ message }: { message: InboxMessage }) {
  const navigate = useNavigate();
  const action = resolveOverviewInboxAction(message);
  const preview = truncateOverviewPreview(message.message);

  return (
    <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
          {message.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#777777" }}>
          {message.clubName ?? "Gryph Club Connect"}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#555555" }}>
          {formatTimeAgo(message.createdAt)}
        </p>
        {preview ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "12px",
              color: "#777777",
              lineHeight: 1.45,
            }}
          >
            {preview}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => navigate(action.href)}
          style={{
            ...viewAllLinkStyle,
            marginTop: "6px",
            display: "inline-block",
          }}
        >
          {action.label}
        </button>
      </div>
    </div>
  );
}

function OverviewCompactAnnouncementRow({
  announcement,
  logoUrl,
}: {
  announcement: OverviewAnnouncement;
  logoUrl?: string;
}) {
  const preview = truncateOverviewPreview(announcement.content);

  return (
    <div style={{ ...overviewRowDividerStyle, display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <OverviewClubLogo
        name={announcement.clubName}
        logoUrl={logoUrl}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
          {announcement.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#777777" }}>
          {announcement.clubName}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#555555" }}>
          {formatTimeAgo(announcement.createdAt)}
        </p>
        {preview ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "12px",
              color: "#777777",
              lineHeight: 1.45,
            }}
          >
            {preview}
          </p>
        ) : null}
        <Link
          to={`/app/clubs/${announcement.clubId}/announcements`}
          style={{ ...viewAllLinkStyle, marginTop: "6px", display: "inline-block" }}
        >
          Read More →
        </Link>
      </div>
    </div>
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

function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}

function calendarMonthDays(reference: Date): Array<{
  dateKey: string;
  dayNum: number;
  inCurrentMonth: boolean;
}> {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const startDay = firstOfMonth.getDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  const gridStart = new Date(year, month, 1 + mondayOffset);

  const endDay = lastOfMonth.getDay();
  const sundayOffset = endDay === 0 ? 0 : 7 - endDay;
  const gridEnd = new Date(year, month, lastOfMonth.getDate() + sundayOffset);

  const days: Array<{
    dateKey: string;
    dayNum: number;
    inCurrentMonth: boolean;
  }> = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push({
      dateKey: localIsoDate(cursor),
      dayNum: cursor.getDate(),
      inCurrentMonth: cursor.getMonth() === month,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function monthBounds(reference: Date): { start: string; end: string } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { start: localIsoDate(start), end: localIsoDate(end) };
}

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
        <WeekClubLogo name={task.clubName} logoUrl={logoUrl} />
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

function ThisMonthTab({
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
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthlyCompleted, setMonthlyCompleted] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const plannerItemsRef = useRef<HTMLDivElement>(null);
  const todayKey = todayIsoDate();

  const monthReference = useMemo(() => {
    const ref = new Date();
    ref.setDate(1);
    ref.setMonth(ref.getMonth() + monthOffset);
    return ref;
  }, [monthOffset]);

  const monthDays = useMemo(
    () => calendarMonthDays(monthReference),
    [monthReference],
  );
  const monthRange = useMemo(() => monthBounds(monthReference), [monthReference]);
  const monthLabel = monthReference.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const weekReference = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return ref;
  }, [weekOffset]);
  const weekDays = useMemo(() => calendarWeekDays(weekReference), [weekReference]);
  const weekStart = weekDays[0]?.dateKey ?? todayKey;
  const weekEnd = weekDays[6]?.dateKey ?? addDaysIso(todayKey, 6);

  const fetchStart = useMemo(
    () => minIso(monthRange.start, weekStart),
    [monthRange.start, weekStart],
  );
  const fetchEnd = useMemo(
    () => maxIso(monthRange.end, weekEnd),
    [monthRange.end, weekEnd],
  );

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

    async function loadPlanner() {
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
          .gte("due_date", fetchStart)
          .lte("due_date", fetchEnd)
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
          .gte("date", fetchStart)
          .lte("date", fetchEnd)
          .order("date", { ascending: true })
          .order("time", { ascending: true }),
        supabase
          .from("tasks")
          .select("id, status")
          .in("club_id", joinedClubIds)
          .neq("status", "cancelled")
          .gte("due_date", monthRange.start)
          .lte("due_date", monthRange.end),
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

    void loadPlanner();

    return () => {
      cancelled = true;
    };
  }, [joinedClubIds, fetchStart, fetchEnd, monthRange.start, monthRange.end]);

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

  const filteredTasks = useMemo(() => {
    let tasks = items.filter((i): i is WeekTaskItem => i.kind === "task");
    if (selectedDayKey) {
      tasks = tasks.filter((t) => t.dateKey === selectedDayKey);
    } else if (calendarView === "week") {
      tasks = tasks.filter((t) => t.dateKey >= weekStart && t.dateKey <= weekEnd);
    } else {
      tasks = tasks.filter(
        (t) => t.dateKey >= monthRange.start && t.dateKey <= monthRange.end,
      );
    }
    return [...tasks].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [items, selectedDayKey, calendarView, weekStart, weekEnd, monthRange]);

  const filteredEvents = useMemo(() => {
    let events = items.filter((i): i is WeekEventItem => i.kind === "event");
    if (selectedDayKey) {
      events = events.filter((e) => e.dateKey === selectedDayKey);
    } else if (calendarView === "week") {
      events = events.filter((e) => e.dateKey >= weekStart && e.dateKey <= weekEnd);
    } else {
      events = events.filter(
        (e) => e.dateKey >= monthRange.start && e.dateKey <= monthRange.end,
      );
    }
    return [...events].sort((a, b) => {
      const byDate = a.dateKey.localeCompare(b.dateKey);
      if (byDate !== 0) return byDate;
      return (a.time ?? "").localeCompare(b.time ?? "");
    });
  }, [items, selectedDayKey, calendarView, weekStart, weekEnd, monthRange]);

  const previewTasks = filteredTasks.slice(0, 3);
  const previewEvents = filteredEvents.slice(0, 3);

  const tasksEmptyMessage = selectedDayKey
    ? "No tasks due on this day."
    : calendarView === "week"
      ? "No tasks due this week."
      : "No tasks due this month.";

  const eventsEmptyMessage = selectedDayKey
    ? "No events on this day."
    : calendarView === "week"
      ? "No events this week."
      : "No events this month.";

  function handleDayClick(dateKey: string) {
    setSelectedDayKey((prev) => (prev === dateKey ? null : dateKey));
    requestAnimationFrame(() => {
      plannerItemsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleCalendarViewChange(mode: CalendarViewMode) {
    setCalendarView(mode);
    setSelectedDayKey(null);
  }

  function handlePrevMonth() {
    setMonthOffset((prev) => prev - 1);
    setSelectedDayKey(null);
  }

  function handleNextMonth() {
    setMonthOffset((prev) => prev + 1);
    setSelectedDayKey(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading your month…" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          This Month
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#777777" }}>
          Your tasks, events, meetings, and club activity for the month.
        </p>
      </div>

      <MonthWeekToggle value={calendarView} onChange={handleCalendarViewChange} />

      {calendarView === "month" ? (
        <MonthCalendarGrid
          monthLabel={monthLabel}
          monthDays={monthDays}
          todayKey={todayKey}
          selectedDayKey={selectedDayKey}
          dayMeta={dayMeta}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onDayClick={handleDayClick}
        />
      ) : (
        <WeekCalendarStrip
          weekDays={weekDays}
          todayKey={todayKey}
          selectedDayKey={selectedDayKey}
          dayMeta={dayMeta}
          onPrevWeek={() => {
            setWeekOffset((prev) => prev - 1);
            setSelectedDayKey(null);
          }}
          onNextWeek={() => {
            setWeekOffset((prev) => prev + 1);
            setSelectedDayKey(null);
          }}
          onDayClick={handleDayClick}
        />
      )}

      <WeekAchievementCard
        displayName={displayName}
        completedCount={monthlyCompleted}
        totalCount={monthlyTotal}
      />

      <div ref={plannerItemsRef}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 10px",
          }}
        >
          Tasks This Month
        </h3>
        {filteredTasks.length === 0 ? (
          <TasksWeekEmptyState onViewAllTasks={onViewAllTasks} message={tasksEmptyMessage} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            {previewTasks.map((task) => (
              <WeekTaskCard
                key={task.id}
                task={task}
                logoUrl={clubLogos[task.clubId]}
              />
            ))}
            {filteredTasks.length > 3 ? (
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
          Events This Month
        </h3>
        {filteredEvents.length === 0 ? (
          <p style={{ color: "#444444", fontSize: "13px", margin: 0 }}>
            {eventsEmptyMessage}
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
  options?: {
    isPendingMembership?: boolean;
    isSavedOnly?: boolean;
  },
): { label: string; color: string; borderColor?: string } {
  if (options?.isPendingMembership) {
    return { label: "Pending", color: "#999988", borderColor: "#666655" };
  }
  if (role === "owner") {
    return { label: "President", color: "#FFC429" };
  }
  if (role === "executive") {
    return { label: "Executive", color: "#E51937", borderColor: "#FFC429" };
  }
  if (options?.isSavedOnly) {
    return { label: "Saved", color: "#747676" };
  }
  return { label: "Member", color: "#747676" };
}


type OverviewAnnouncement = {
  id: string;
  clubId: string;
  title: string;
  clubName: string;
  content: string;
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

function MyClubsTab({
  myClubs,
  mySavedClubs,
  clubLogos,
  getUserRole,
  isPending,
  isMobile,
}: {
  myClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  mySavedClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  clubLogos: Record<string, string>;
  getUserRole: (clubId: string) => import("../../types").MemberRole | null;
  isPending: (clubId: string) => boolean;
  isMobile: boolean;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClubFilterOption>("all");
  const [sort, setSort] = useState<ClubSortOption>("recent");
  const [page, setPage] = useState(1);

  const sourceClubs = filter === "saved" ? mySavedClubs : myClubs;

  const filteredClubs = useMemo(
    () => filterMyClubs(sourceClubs, search, filter, getUserRole),
    [sourceClubs, search, filter, getUserRole],
  );
  const sortedClubs = useMemo(
    () => sortMyClubs(filteredClubs, sort, getUserRole),
    [filteredClubs, sort, getUserRole],
  );
  const pagination = useMemo(
    () => paginateClubs(sortedClubs, page),
    [sortedClubs, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search, filter, sort]);

  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  if (myClubs.length === 0 && mySavedClubs.length === 0) {
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
      <MyClubsHeader />
      <MyClubsFilterBar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        showSearch={myClubs.length >= 8}
      />

      {sortedClubs.length === 0 ? (
        <div
          style={{
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#555555", fontSize: "13px", margin: 0 }}>
            No clubs match your search or filters.
          </p>
        </div>
      ) : (
        <>
          <MyClubsGrid
            clubs={pagination.items}
            clubLogos={clubLogos}
            getUserRole={getUserRole}
            formatClubRoleDisplay={formatClubRoleDisplay}
            isPendingMembership={isPending}
            onOpenWorkspace={(clubId) => navigate(`/app/clubs/${clubId}`)}
            isMobile={isMobile}
          />
          <MyClubsPagination
            page={pagination.safePage}
            totalPages={pagination.totalPages}
            start={pagination.start}
            end={pagination.end}
            total={pagination.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

function OverviewTab({
  myClubs,
  upcomingEvents,
  eventsLoading,
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

  const previewClubs = useMemo(() => myClubs.slice(0, 3), [myClubs]);

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
        content,
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
                content: (row.content as string) ?? "",
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
              logoUrl={clubLogos[event.clubId ?? ""]}
              isClubMember={event.clubId ? joinedClubIds.includes(event.clubId) : false}
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
              userRole={getUserRole(club.id)}
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
              logoUrl={clubLogos[announcement.clubId]}
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
          gridTemplateColumns: "34fr 34fr 28fr",
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
function groupDashboardEventsByDate(events: DashboardEvent[]) {
  const grouped = new Map<string, DashboardEvent[]>();

  for (const event of events) {
    const existing = grouped.get(event.date) ?? [];
    existing.push(event);
    grouped.set(event.date, existing);
  }

  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, dateEvents]) => ({ date, events: dateEvents }));
}

function EventsTab({
  upcomingEvents,
  eventsLoading,
  myRsvps,
  clubLogos,
  isClubMember,
  onRsvpClick,
  onSetRsvp,
  onRemoveRsvp,
  rsvpBusyEventId,
}: {
  upcomingEvents: DashboardEvent[];
  eventsLoading: boolean;
  myRsvps: Record<string, string>;
  clubLogos: Record<string, string>;
  isClubMember: (clubId: string) => boolean;
  onRsvpClick: (
    eventId: string,
    clubId: string,
    currentStatus?: import("../../types").RsvpStatus | string,
  ) => void;
  onSetRsvp: (eventId: string, status: import("../../types").RsvpStatus) => Promise<boolean>;
  onRemoveRsvp: (eventId: string) => Promise<boolean>;
  rsvpBusyEventId: string | null;
}) {
  const eventsByDate = useMemo(
    () => groupDashboardEventsByDate(upcomingEvents),
    [upcomingEvents],
  );
  const summary = useEventsTabSummary(upcomingEvents);

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
        <p className="text-muted">
          No upcoming events. RSVP to campus events from Explore to see them here.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <EventsTabHeader eventCount={summary.eventCount} clubCount={summary.clubCount} />
      <EventsTabTimeline
        groups={eventsByDate}
        myRsvps={myRsvps}
        clubLogos={clubLogos}
        isClubMember={isClubMember}
        onRsvpClick={onRsvpClick}
        onSetRsvp={onSetRsvp}
        onRemoveRsvp={onRemoveRsvp}
        rsvpBusyEventId={rsvpBusyEventId}
      />
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
  const [taskScope, setTaskScope] = useState<DashboardTaskScope>("assigned_to_me");
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<TaskGroupByOption>("status");
  const [sort, setSort] = useState<TaskSortOption>("due_date");
  const [progressRange, setProgressRange] = useState<TaskProgressTimeRange>("semester");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
      queueMicrotask(() => {
        setTasks([]);
        setLoadingTasks(false);
      });
      return;
    }

    let cancelled = false;
    setLoadingTasks(true);

    let query = supabase
      .from("tasks")
      .select(
        "id, title, status, priority, task_type, due_date, created_at, club_id, assigned_to, created_by, linked_meeting_id, linked_meeting:club_meetings!tasks_linked_meeting_id_fkey ( status ), clubs:club_id ( name, logo_url, abbreviation )",
      )
      .neq("status", "cancelled")
      .in("club_id", joinedClubs);

    if (taskScope === "assigned_to_me") {
      query = query.eq("assigned_to", user.id);
    } else {
      query = query
        .eq("created_by", user.id)
        .not("assigned_to", "is", null)
        .neq("assigned_to", user.id);
    }

    query
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
  }, [joinedClubs, taskScope, user]);

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
    taskScope !== "assigned_to_me" ||
    search.trim().length > 0 ||
    clubFilter !== "all" ||
    sort !== "due_date";

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (clubFilter !== "all" && task.clubId !== clubFilter) return false;
      if (query && !task.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [tasks, search, clubFilter]);

  const taskGroups = useMemo(
    () =>
      buildTaskListGroups({
        tasks: filteredTasks,
        allTasks: tasks,
        groupBy,
        sort,
        clubFilter,
      }),
    [filteredTasks, tasks, groupBy, sort, clubFilter],
  );

  const taskProgress = useTaskProgress(filteredTasks, progressRange);
  const breakdown = useTaskBreakdown(filteredTasks);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const group of taskGroups) {
        if (next[group.id] === undefined) next[group.id] = true;
      }
      return next;
    });
  }, [taskGroups]);

  if (loadingTasks) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading tasks…" />
      </div>
    );
  }

  if (tasks.length === 0) {
    const emptyMessage =
      taskScope === "delegated"
        ? "No tasks you've assigned to others."
        : "No tasks assigned to you.";

    return (
      <Card className="p-10 text-center">
        <DashboardTaskScopeToggle active={taskScope} onChange={setTaskScope} />
        <p className="text-muted">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div>
      <DashboardTaskScopeToggle active={taskScope} onChange={setTaskScope} />
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        <TaskProgressCard
          completed={taskProgress.completed}
          total={taskProgress.total}
          labels={taskProgress.labels}
          counts={taskProgress.counts}
          useSummaryOnly={taskProgress.useSummaryOnly}
          range={progressRange}
          onRangeChange={setProgressRange}
        />
        <TaskBreakdownCard arcs={breakdown.arcs} segments={breakdown.segments} />
      </div>

      <TasksFilterBar
        search={search}
        onSearchChange={setSearch}
        clubFilter={clubFilter}
        onClubFilterChange={setClubFilter}
        clubOptions={clubOptions}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sort={sort}
        onSortChange={setSort}
      />

      {taskGroups.map((group) => (
        <TaskListGroupSection
          key={group.id}
          group={group}
          groupBy={groupBy}
          logoUrl={
            group.clubMeta
              ? group.tasks[0]?.clubLogoUrl ?? clubLogos[group.clubMeta.clubId]
              : undefined
          }
          clubLogos={clubLogos}
          expanded={expandedGroups[group.id] ?? true}
          onToggle={() =>
            setExpandedGroups((prev) => ({
              ...prev,
              [group.id]: !(prev[group.id] ?? true),
            }))
          }
        />
      ))}

      <TasksTabFooter
        visibleCount={filteredTasks.length}
        totalCount={tasks.length}
        clubCount={new Set(filteredTasks.map((task) => task.clubId)).size}
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