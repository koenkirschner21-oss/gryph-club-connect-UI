import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../../lib/supabaseClient";
import { useClubContext } from "../../context/useClubContext";
import { isPrivilegedClubRole } from "../../lib/clubRoles";
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

interface MessageActivityPoint {
  label: string;
  count: number;
}

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#242424";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";
const ACCENT_GOLD = "#FFC429";
const ACCENT_GRAY = "#747676";
const SECTION_ACCENTS = [ACCENT_RED, ACCENT_GOLD, ACCENT_GRAY] as const;

const pageStyle: CSSProperties = {
  backgroundColor: PAGE_BG,
  minHeight: "100%",
  padding: "16px 24px",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: MUTED,
  marginBottom: "12px",
};

const statCardStyle = (accentIndex: number): CSSProperties => ({
  backgroundColor: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderLeft: `3px solid ${SECTION_ACCENTS[accentIndex] ?? ACCENT_GRAY}`,
  borderRadius: "8px",
  padding: "12px 16px",
});

const chartCardStyle: CSSProperties = {
  backgroundColor: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "8px",
  overflow: "hidden",
  marginTop: "32px",
};

function buildMessageActivity(
  rows: { created_at: string }[],
  days = 14,
): MessageActivityPoint[] {
  const buckets = new Map<string, number>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([date, count]) => {
    const d = new Date(`${date}T12:00:00`);
    const label = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return { label, count };
  });
}

export default function ClubAnalyticsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getUserRole } = useClubContext();
  const role = getUserRole(clubId ?? "");
  const isPrivileged = isPrivilegedClubRole(role);

  const [analytics, setAnalytics] = useState<ClubAnalytics | null>(null);
  const [messageActivity, setMessageActivity] = useState<MessageActivityPoint[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;

    let cancelled = false;

    async function fetchAnalytics() {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const fourteenDaysAgo = new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const { data: eventRows } = await supabase
        .from("events")
        .select("id")
        .eq("club_id", clubId);
      const eventIds = (eventRows ?? []).map((e) => e.id as string);

      if (cancelled) return;

      const [
        membersRes,
        newMembersRes,
        eventsRes,
        upcomingEventsRes,
        postsRes,
        messagesRes,
        messageTimelineRes,
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
          .from("messages")
          .select("created_at")
          .eq("club_id", clubId)
          .gte("created_at", fourteenDaysAgo),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("status", "done"),
        eventIds.length > 0
          ? supabase
              .from("event_rsvps")
              .select("id", { count: "exact", head: true })
              .in("event_id", eventIds)
          : Promise.resolve({ count: 0, error: null } as {
              count: number | null;
              error: null;
            }),
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

      if (!messageTimelineRes.error) {
        setMessageActivity(
          buildMessageActivity(
            (messageTimelineRes.data ?? []) as { created_at: string }[],
          ),
        );
      }

      setLoading(false);
    }

    fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const taskCompletionRate = useMemo(() => {
    if (!analytics || analytics.totalTasks === 0) return 0;
    return Math.round(
      (analytics.completedTasks / analytics.totalTasks) * 100,
    );
  }, [analytics]);

  if (!isPrivileged) {
    return (
      <div style={pageStyle}>
        <p style={{ fontSize: "13px", color: MUTED, textAlign: "center" }}>
          Only admins and execs can view analytics.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          minHeight: "40vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner label="Loading analytics…" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={pageStyle}>
        <p style={{ fontSize: "13px", color: ACCENT_RED, textAlign: "center" }}>
          {error ?? "Failed to load analytics."}
        </p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontWeight: 700,
            fontSize: "22px",
            color: "#ffffff",
            margin: 0,
          }}
        >
          Club Analytics
        </h1>
        <p style={{ fontSize: "13px", color: MUTED, margin: "4px 0 0" }}>
          Overview of your club&apos;s activity and growth.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            border: `1px solid ${ACCENT_RED}`,
            backgroundColor: "rgba(229, 25, 55, 0.1)",
            padding: "12px 16px",
            fontSize: "13px",
            color: ACCENT_RED,
          }}
        >
          {error}
        </div>
      )}

      <h2 style={sectionLabelStyle}>Membership</h2>
      <div
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        style={{ marginBottom: "32px" }}
      >
        <StatCard
          accentIndex={0}
          label="Total Members"
          value={analytics.totalMembers}
        />
        <StatCard
          accentIndex={1}
          label="New (Last 7 Days)"
          value={analytics.newMembersLast7Days}
          valueColor="#4ade80"
        />
      </div>

      <h2 style={sectionLabelStyle}>Events</h2>
      <div
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        style={{ marginBottom: "32px" }}
      >
        <StatCard
          accentIndex={0}
          label="Total Events"
          value={analytics.totalEvents}
        />
        <StatCard
          accentIndex={1}
          label="Upcoming"
          value={analytics.upcomingEvents}
        />
        <StatCard
          accentIndex={2}
          label="Total RSVPs"
          value={analytics.eventRsvps}
        />
      </div>

      <h2 style={sectionLabelStyle}>Activity</h2>
      <div
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        style={{ marginBottom: "32px" }}
      >
        <StatCard
          accentIndex={0}
          label="Announcements"
          value={analytics.totalPosts}
        />
        <StatCard
          accentIndex={1}
          label="Messages"
          value={analytics.totalMessages}
        />
      </div>

      <h2 style={sectionLabelStyle}>Tasks</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          accentIndex={0}
          label="Total Tasks"
          value={analytics.totalTasks}
        />
        <StatCard
          accentIndex={1}
          label="Completed"
          value={analytics.completedTasks}
        />
        <StatCard
          accentIndex={2}
          label="Completion Rate"
          value={`${taskCompletionRate}%`}
          valueColor={ACCENT_GOLD}
        />
      </div>

      <div style={chartCardStyle}>
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            margin: 0,
            padding: "16px 16px 0",
          }}
        >
          Message Activity
        </h3>
        <div style={{ padding: "16px" }}>
          <div
            style={{
              width: "100%",
              height: "200px",
              backgroundColor: PAGE_BG,
              overflow: "hidden",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={messageActivity}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                style={{ background: PAGE_BG }}
              >
                <CartesianGrid stroke="#1e1e1e" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: MUTED, fontSize: 11 }}
                  axisLine={{ stroke: "#1e1e1e" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CARD_BG,
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#ffffff",
                  }}
                  labelStyle={{ color: MUTED }}
                  cursor={{ fill: "rgba(229, 25, 55, 0.08)" }}
                />
                <Bar
                  dataKey="count"
                  fill={ACCENT_RED}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accentIndex,
  valueColor = "#ffffff",
}: {
  label: string;
  value: number | string;
  accentIndex: number;
  valueColor?: string;
}) {
  return (
    <div style={statCardStyle(accentIndex)}>
      <p
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: valueColor,
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "12px",
          color: MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          margin: "8px 0 0",
        }}
      >
        {label}
      </p>
    </div>
  );
}
