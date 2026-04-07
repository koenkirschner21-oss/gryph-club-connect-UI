import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useClubContext } from "../../context/useClubContext";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";

interface ClubAnalytics {
  totalMembers: number;
  newMembersLast7Days: number;
  totalEvents: number;
  upcomingEvents: number;
  totalPosts: number;
  totalMessages: number;
  totalTasks: number;
  completedTasks: number;
  eventRsvps: number;
}

export default function ClubAnalyticsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getUserRole } = useClubContext();
  const role = getUserRole(clubId ?? "");
  const isAdminOrExec = role === "admin" || role === "exec";

  const [analytics, setAnalytics] = useState<ClubAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;

    let cancelled = false;

    async function fetchAnalytics() {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      // Use local date for upcoming events comparison
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const [
        membersRes,
        newMembersRes,
        eventsRes,
        upcomingEventsRes,
        postsRes,
        messagesRes,
        tasksRes,
        completedTasksRes,
        rsvpsRes,
      ] = await Promise.all([
        supabase
          .from("club_members")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("status", "active"),
        supabase
          .from("club_members")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("status", "active")
          .gte("created_at", sevenDaysAgo),
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId),
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .gte("date", today),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("status", "done"),
        supabase
          .from("event_rsvps")
          .select("id, events!inner(club_id)", { count: "exact", head: true })
          .eq("events.club_id", clubId),
      ]);

      if (cancelled) return;

      const errors: string[] = [];
      if (membersRes.error) errors.push("members");
      if (newMembersRes.error) errors.push("new members");
      if (eventsRes.error) errors.push("events");
      if (upcomingEventsRes.error) errors.push("upcoming events");
      if (postsRes.error) errors.push("posts");
      if (messagesRes.error) errors.push("messages");
      if (tasksRes.error) errors.push("tasks");
      if (completedTasksRes.error) errors.push("completed tasks");
      if (rsvpsRes.error) errors.push("RSVPs");

      if (errors.length > 0) {
        console.error("Analytics query failures:", errors);
        setError(`Failed to load: ${errors.join(", ")}`);
      }

      setAnalytics({
        totalMembers: membersRes.count ?? 0,
        newMembersLast7Days: newMembersRes.count ?? 0,
        totalEvents: eventsRes.count ?? 0,
        upcomingEvents: upcomingEventsRes.count ?? 0,
        totalPosts: postsRes.count ?? 0,
        totalMessages: messagesRes.count ?? 0,
        totalTasks: tasksRes.count ?? 0,
        completedTasks: completedTasksRes.count ?? 0,
        eventRsvps: rsvpsRes.count ?? 0,
      });
      setLoading(false);
    }

    fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (!isAdminOrExec) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            Only admins and execs can view analytics.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading analytics…" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-sm text-red-400">
            {error ?? "Failed to load analytics."}
          </p>
        </Card>
      </div>
    );
  }

  const taskCompletionRate =
    analytics.totalTasks > 0
      ? Math.round((analytics.completedTasks / analytics.totalTasks) * 100)
      : 0;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Club Analytics</h1>
        <p className="text-sm text-muted">
          Overview of your club&apos;s activity and growth.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
        >
          {error}
        </div>
      )}

      {/* Membership section */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Membership
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon="👥"
          label="Total Members"
          value={analytics.totalMembers}
        />
        <StatCard
          icon="🆕"
          label="New (Last 7 Days)"
          value={analytics.newMembersLast7Days}
          highlight={analytics.newMembersLast7Days > 0}
        />
      </div>

      {/* Events section */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Events
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon="📅"
          label="Total Events"
          value={analytics.totalEvents}
        />
        <StatCard
          icon="⏰"
          label="Upcoming"
          value={analytics.upcomingEvents}
        />
        <StatCard
          icon="✋"
          label="Total RSVPs"
          value={analytics.eventRsvps}
        />
      </div>

      {/* Activity section */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Activity
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon="📢"
          label="Announcements"
          value={analytics.totalPosts}
        />
        <StatCard
          icon="💬"
          label="Messages"
          value={analytics.totalMessages}
        />
      </div>

      {/* Tasks section */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Tasks
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon="📋"
          label="Total Tasks"
          value={analytics.totalTasks}
        />
        <StatCard
          icon="✅"
          label="Completed"
          value={analytics.completedTasks}
        />
        <StatCard
          icon="📊"
          label="Completion Rate"
          value={`${taskCompletionRate}%`}
          highlight={taskCompletionRate >= 75}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              highlight ? "text-green-400" : "text-white"
            }`}
          >
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}
