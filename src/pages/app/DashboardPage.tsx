import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import { useDashboardEvents, type DashboardEvent } from "../../hooks/useDashboardEvents";
import { useDashboardTasks } from "../../hooks/useDashboardTasks";
import { useNotifications } from "../../hooks/useNotifications";
import { useEventRsvps } from "../../hooks/useEventRsvps";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------
type DashboardTab = "overview" | "events" | "tasks";

/** Derive an abbreviation from a club name (e.g. "Guelph Marketing Association" → "GMA"). */
function deriveAbbreviation(name: string, maxLen = 3): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { user } = useAuthContext();
  const { clubs, joinedClubs, savedClubs, loading } = useClubContext();
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
  const { unreadCount } = useNotifications();

  // RSVP data for upcoming events
  const eventIds = useMemo(
    () => upcomingEvents.map((e) => e.id),
    [upcomingEvents],
  );
  const { myRsvps, counts: rsvpCounts } = useEventRsvps(eventIds);

  // Primary club (first joined club) for the "Open" button
  const primaryClub = myClubs[0] ?? null;
  const displayName = profile?.fullName || user?.email?.split("@")[0] || "";

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
          <p className="text-xs font-medium tracking-wider text-muted uppercase">
            Gryph Club Connect
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">
            Welcome back, {displayName} 👋
          </h1>
          {subtitleParts.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              {subtitleParts.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-surface-alt"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Explore Clubs
          </Link>
          {primaryClub && (
            <Link
              to={`/app/clubs/${primaryClub.id}`}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Open {primaryClub.abbreviation || deriveAbbreviation(primaryClub.name, 4)} →
            </Link>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="mb-8 flex items-center gap-6 border-b border-border">
        <TabButton
          label="Overview"
          active={activeTab === "overview"}
          badge={unreadCount > 0 ? unreadCount : undefined}
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
          unreadCount={unreadCount}
          totalClubs={clubs.length}
          myRsvps={myRsvps}
          rsvpCounts={rsvpCounts}
        />
      )}
      {activeTab === "events" && (
        <EventsTab
          upcomingEvents={upcomingEvents}
          eventsLoading={eventsLoading}
          myRsvps={myRsvps}
          rsvpCounts={rsvpCounts}
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
function OverviewTab({
  myClubs,
  mySavedClubs,
  upcomingEvents,
  eventsLoading,
  eventsThisMonth,
  taskCount,
  unreadCount,
  totalClubs,
  myRsvps,
  rsvpCounts,
}: {
  myClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  mySavedClubs: ReturnType<typeof import("../../context/useClubContext").useClubContext>["clubs"];
  upcomingEvents: DashboardEvent[];
  eventsLoading: boolean;
  eventsThisMonth: number;
  taskCount: number;
  unreadCount: number;
  totalClubs: number;
  myRsvps: Record<string, string>;
  rsvpCounts: Record<string, import("../../types").RsvpCounts>;
}) {
  return (
    <>
      {/* ── Stat Cards ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="MY CLUBS"
          value={myClubs.length}
          sublabel="Active memberships"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />
        <StatCard
          label="UPCOMING"
          value={eventsThisMonth}
          sublabel="Events this month"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          }
        />
        <StatCard
          label="TASKS"
          value={taskCount}
          sublabel="Active tasks"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="UNREAD"
          value={unreadCount}
          sublabel="Notifications"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          }
        />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: Upcoming Events */}
        <div>
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Upcoming Events</h2>
              <Link
                to="/explore"
                className="text-sm font-medium text-primary hover:text-primary-light"
              >
                View All →
              </Link>
            </div>

            {eventsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner label="Loading events…" />
              </div>
            ) : upcomingEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                No upcoming events from your clubs.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 6).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    rsvpStatus={myRsvps[event.id]}
                    counts={rsvpCounts[event.id]}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: My Clubs + Saved Clubs */}
        <div className="space-y-6">
          {/* My Clubs */}
          <Card className="p-5">
            <h3 className="mb-4 text-base font-bold text-white">My Clubs</h3>
            {myClubs.length === 0 ? (
              <p className="text-sm text-muted">You haven't joined any clubs yet.</p>
            ) : (
              <div className="space-y-3">
                {myClubs.map((club) => (
                  <Link
                    key={club.id}
                    to={`/app/clubs/${club.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-alt"
                  >
                    <ClubBadge
                      abbreviation={club.abbreviation}
                      name={club.name}
                      brandColor={club.brandColor}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {club.name}
                      </p>
                      <p className="text-xs text-muted">
                        {club.memberCount} members
                      </p>
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
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
                      brandColor={club.brandColor}
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
}: {
  upcomingEvents: DashboardEvent[];
  eventsLoading: boolean;
  myRsvps: Record<string, string>;
  rsvpCounts: Record<string, import("../../types").RsvpCounts>;
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
    <div className="space-y-3">
      {upcomingEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          rsvpStatus={myRsvps[event.id]}
          counts={rsvpCounts[event.id]}
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
}: {
  label: string;
  value: number;
  sublabel: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wider text-muted">{label}</p>
        <span className="text-muted">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sublabel}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Club Badge (abbreviation circle)
// ---------------------------------------------------------------------------
function ClubBadge({
  abbreviation,
  name,
  brandColor,
  size = "md",
}: {
  abbreviation?: string;
  name: string;
  brandColor?: string;
  size?: "sm" | "md";
}) {
  const abbr = abbreviation || deriveAbbreviation(name);

  const bg = brandColor || "#C20430";
  const sizeClass = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: bg }}
    >
      {abbr}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Card
// ---------------------------------------------------------------------------
function EventCard({
  event,
  rsvpStatus,
  counts,
}: {
  event: DashboardEvent;
  rsvpStatus?: string;
  counts?: import("../../types").RsvpCounts;
}) {
  const goingCount = counts?.going ?? 0;
  const maybeCount = counts?.maybe ?? 0;

  return (
    <Link to={`/app/clubs/${event.clubId}/events`}>
      <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-alt">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white">{event.title}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {event.date}
              {event.time ? ` · ${event.time}` : ""}
            </span>
            {event.location && (
              <>
                <span>·</span>
                <span>{event.location}</span>
              </>
            )}
          </div>

          {/* RSVP info */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {rsvpStatus === "going" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                ✓ Going
              </span>
            )}
            {rsvpStatus === "maybe" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-400">
                Maybe
              </span>
            )}
            {(goingCount > 0 || maybeCount > 0) ? (
              <span className="text-xs text-muted">
                {goingCount} going
                {maybeCount > 0 ? ` · ${maybeCount} maybe` : ""}
              </span>
            ) : !rsvpStatus ? (
              <span className="text-xs text-muted">
                👥 Open to all students
              </span>
            ) : null}
          </div>
        </div>

        {/* Club badge */}
        <ClubBadge
          abbreviation={event.clubAbbreviation}
          name={event.clubName}
          brandColor={event.clubBrandColor}
          size="md"
        />
      </div>
    </Link>
  );
}