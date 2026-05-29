import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole } from "../../types";

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#242424";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";
const ACCENT_GOLD = "#FFC429";
const GRID = "#1e1e1e";
const LABEL_MUTED = "#747676";

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  weekly_meeting: "Weekly Meeting",
  team_social: "Team Social",
  conference: "Conference",
  workshop: "Workshop",
  public_event: "Public Event",
  fundraiser: "Fundraiser",
};

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  general: "#747676",
  weekly_meeting: "#6b7cff",
  team_social: "#4ade80",
  conference: "#FFC429",
  workshop: "#E51937",
  public_event: "#E51937",
  fundraiser: "#a78bfa",
};

interface MemberRow {
  created_at: string;
  role: string;
}

interface TaskRow {
  status: string;
}

interface PostRow {
  created_at: string;
}

interface EventRow {
  id: string;
  title: string;
  date: string;
  category: string | null;
}

interface RsvpRow {
  status: string;
  event_id: string;
}

interface DirectMessageRow {
  created_at: string;
}

interface InsightItem {
  text: string;
  dotColor: string;
}

const pageStyle: CSSProperties = {
  backgroundColor: PAGE_BG,
  minHeight: "100%",
  padding: "24px",
};

const chartCardStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "10px",
  padding: "20px",
};

const chartTitleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "15px",
  color: "#ffffff",
  margin: "0 0 16px",
};

const chartAxisProps = {
  tick: { fill: MUTED, fontSize: 11 },
  axisLine: { stroke: GRID },
  tickLine: false,
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: CARD_BG,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: "8px",
    fontSize: "12px",
    color: "#ffffff",
  },
  labelStyle: { color: MUTED },
};

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function truncateLabel(value: string, max = 12): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMemberGrowth(members: MemberRow[]) {
  const points: { label: string; count: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const count = members.filter(
      (m) => new Date(m.created_at) <= endOfMonth,
    ).length;
    points.push({
      label: monthDate.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      count,
    });
  }

  return points;
}

function buildEventAttendance(events: EventRow[], rsvps: RsvpRow[]) {
  const sorted = [...events]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .reverse();

  return sorted.map((event) => {
    const eventRsvps = rsvps.filter((r) => r.event_id === event.id);
    return {
      name: truncateLabel(event.title, 12),
      going: eventRsvps.filter((r) => r.status === "going").length,
      maybe: eventRsvps.filter((r) => r.status === "maybe").length,
      notGoing: eventRsvps.filter((r) => r.status === "not_going").length,
    };
  });
}

function buildTaskBreakdown(tasks: TaskRow[]) {
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  return [
    { name: "To Do", value: todo, color: "#747676" },
    { name: "In Progress", value: inProgress, color: ACCENT_GOLD },
    { name: "Done", value: done, color: "#4ade80" },
  ];
}

function buildEventCategoryBreakdown(events: EventRow[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = event.category?.trim() || "general";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([key, value]) => ({
    name: EVENT_CATEGORY_LABELS[key] ?? key,
    value,
    color: EVENT_CATEGORY_COLORS[key] ?? "#747676",
  }));
}

function buildInsights(params: {
  members: MemberRow[];
  tasks: TaskRow[];
  events: EventRow[];
  rsvps: RsvpRow[];
  posts: PostRow[];
  dmMessages: DirectMessageRow[];
}): InsightItem[] {
  const insights: InsightItem[] = [];
  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastMonthDate);

  const membersThisMonthEnd = params.members.filter((m) => {
    const joined = monthKey(new Date(m.created_at));
    return joined <= thisMonth;
  }).length;

  const membersLastMonthEnd = params.members.filter((m) => {
    const joined = monthKey(new Date(m.created_at));
    return joined <= lastMonth;
  }).length;

  if (membersLastMonthEnd > 0) {
    const growth = Math.round(
      ((membersThisMonthEnd - membersLastMonthEnd) / membersLastMonthEnd) *
        100,
    );
    insights.push({
      dotColor: ACCENT_RED,
      text: `Your club has grown ${growth >= 0 ? `${growth}%` : `${growth}%`} this month`,
    });
  } else if (membersThisMonthEnd > 0) {
    insights.push({
      dotColor: ACCENT_RED,
      text: `Your club has ${membersThisMonthEnd} member${membersThisMonthEnd === 1 ? "" : "s"} this month`,
    });
  }

  const totalTasks = params.tasks.length;
  const doneTasks = params.tasks.filter((t) => t.status === "done").length;
  if (totalTasks > 0) {
    const pct = Math.round((doneTasks / totalTasks) * 100);
    insights.push({
      dotColor: "#4ade80",
      text: `${pct}% of tasks are completed`,
    });
  }

  const categoryCounts = buildEventCategoryBreakdown(params.events);
  if (categoryCounts.length > 0) {
    const top = [...categoryCounts].sort((a, b) => b.value - a.value)[0];
    insights.push({
      dotColor: ACCENT_GOLD,
      text: `Most popular event type: ${top.name}`,
    });
  }

  let bestEvent: { title: string; going: number } | null = null;
  for (const event of params.events) {
    const going = params.rsvps.filter(
      (r) => r.event_id === event.id && r.status === "going",
    ).length;
    if (!bestEvent || going > bestEvent.going) {
      bestEvent = { title: event.title, going };
    }
  }
  if (bestEvent && bestEvent.going > 0) {
    insights.push({
      dotColor: "#6b7cff",
      text: `Most attended event: ${bestEvent.title} with ${bestEvent.going} going`,
    });
  }

  const postsThisMonth = params.posts.filter(
    (p) => monthKey(new Date(p.created_at)) === thisMonth,
  ).length;
  insights.push({
    dotColor: LABEL_MUTED,
    text: `${postsThisMonth} announcement${postsThisMonth === 1 ? "" : "s"} posted this month`,
  });

  if (params.dmMessages.length > 0) {
    const last7 = params.dmMessages.filter((m) => {
      const d = new Date(m.created_at);
      return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }).length;
    insights.push({
      dotColor: ACCENT_RED,
      text: `${last7} direct message${last7 === 1 ? "" : "s"} sent in the last 7 days`,
    });
  }

  return insights.slice(0, 5);
}

function AnalyticsRestrictedIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#555555"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string | number;
  accentColor: string;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <p
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: LABEL_MUTED,
          margin: "8px 0 0",
        }}
      >
        {label}
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      style={{
        ...chartCardStyle,
        minHeight: "260px",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    >
      <div
        style={{
          height: "16px",
          width: "40%",
          background: GRID,
          borderRadius: "4px",
          marginBottom: "20px",
        }}
      />
      <div
        style={{
          height: "200px",
          background: PAGE_BG,
          borderRadius: "8px",
        }}
      />
    </div>
  );
}

export default function ClubAnalyticsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [dmMessages, setDmMessages] = useState<DirectMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previewRole = localStorage.getItem("previewRole");
    if (previewRole) {
      setUserRole(previewRole as MemberRole);
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
        setUserRole(normalizeUserRole(data.role));
      }
    };
    void fetchRole();
  }, [clubId, user?.id]);

  useEffect(() => {
    if (!clubId || !isPrivileged) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      const [
        membersRes,
        tasksRes,
        postsRes,
        eventsRes,
        conversationsRes,
      ] = await Promise.all([
        supabase
          .from("club_members")
          .select("created_at, role")
          .eq("club_id", clubId)
          .eq("status", "active"),
        supabase.from("tasks").select("status").eq("club_id", clubId),
        supabase.from("posts").select("created_at").eq("club_id", clubId),
        supabase
          .from("events")
          .select("id, title, date, category")
          .eq("club_id", clubId),
        supabase.from("conversations").select("id").eq("club_id", clubId),
      ]);

      if (cancelled) return;

      const failures: string[] = [];
      if (membersRes.error) failures.push("members");
      if (tasksRes.error) failures.push("tasks");
      if (postsRes.error) failures.push("posts");
      if (eventsRes.error) failures.push("events");
      if (conversationsRes.error) failures.push("conversations");

      const eventRows = (eventsRes.data ?? []) as EventRow[];
      const eventIds = eventRows.map((e) => e.id);

      let rsvpRows: RsvpRow[] = [];
      if (eventIds.length > 0) {
        const rsvpsRes = await supabase
          .from("event_rsvps")
          .select("status, event_id")
          .in("event_id", eventIds);
        if (rsvpsRes.error) {
          failures.push("RSVPs");
        } else {
          rsvpRows = (rsvpsRes.data ?? []) as RsvpRow[];
        }
      }

      const conversationIds = (conversationsRes.data ?? []).map(
        (c) => c.id as string,
      );
      let dmRows: DirectMessageRow[] = [];
      if (conversationIds.length > 0) {
        const dmRes = await supabase
          .from("direct_messages")
          .select("created_at")
          .in("conversation_id", conversationIds);
        if (dmRes.error) {
          failures.push("messages");
        } else {
          dmRows = (dmRes.data ?? []) as DirectMessageRow[];
        }
      }

      if (cancelled) return;

      if (failures.length > 0) {
        setError(`Failed to load: ${failures.join(", ")}`);
      }

      setMembers((membersRes.data ?? []) as MemberRow[]);
      setTasks((tasksRes.data ?? []) as TaskRow[]);
      setPosts((postsRes.data ?? []) as PostRow[]);
      setEvents(eventRows);
      setRsvps(rsvpRows);
      setDmMessages(dmRows);
      setLoading(false);
    }

    void fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, [clubId, isPrivileged]);

  const memberGrowth = useMemo(() => buildMemberGrowth(members), [members]);
  const eventAttendance = useMemo(
    () => buildEventAttendance(events, rsvps),
    [events, rsvps],
  );
  const taskBreakdown = useMemo(() => buildTaskBreakdown(tasks), [tasks]);
  const eventCategories = useMemo(
    () => buildEventCategoryBreakdown(events),
    [events],
  );
  const insights = useMemo(
    () =>
      buildInsights({
        members,
        tasks,
        events,
        rsvps,
        posts,
        dmMessages,
      }),
    [members, tasks, events, rsvps, posts, dmMessages],
  );

  const totalMembers = members.length;
  const totalEvents = events.length;
  const totalAnnouncements = posts.length;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const taskCompletionRate =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (!isPrivileged) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            padding: "40px",
            textAlign: "center",
            maxWidth: "480px",
            margin: "48px auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <AnalyticsRestrictedIcon />
          </div>
          <p style={{ color: MUTED, fontSize: "14px", margin: 0 }}>
            Analytics are available to club executives and presidents only
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              height: "24px",
              width: "180px",
              background: GRID,
              borderRadius: "4px",
              marginBottom: "8px",
            }}
          />
          <div
            style={{
              height: "14px",
              width: "260px",
              background: GRID,
              borderRadius: "4px",
            }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: "8px",
                padding: "16px",
                minHeight: "88px",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
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

      {error ? (
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
      ) : null}

      {/* Section 1 — Key Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          label="Total Members"
          value={totalMembers}
          accentColor={ACCENT_RED}
        />
        <StatCard
          label="Total Events"
          value={totalEvents}
          accentColor={ACCENT_GOLD}
        />
        <StatCard
          label="Task Completion Rate"
          value={`${taskCompletionRate}%`}
          accentColor="#4ade80"
        />
        <StatCard
          label="Total Announcements"
          value={totalAnnouncements}
          accentColor={LABEL_MUTED}
        />
      </div>

      {/* Section 2 — Charts row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Member Growth</h3>
          <div style={{ width: "100%", height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={memberGrowth}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...chartAxisProps} />
                <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={ACCENT_RED}
                  strokeWidth={2}
                  dot={{ fill: ACCENT_RED, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Event Attendance</h3>
          <div style={{ width: "100%", height: "200px" }}>
            {eventAttendance.length === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: MUTED,
                  textAlign: "center",
                  marginTop: "80px",
                }}
              >
                No events yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={eventAttendance}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" {...chartAxisProps} />
                  <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: MUTED }}
                    iconType="circle"
                  />
                  <Bar dataKey="going" name="Going" fill="#4ade80" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maybe" name="Maybe" fill={ACCENT_GOLD} radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="notGoing"
                    name="Not Going"
                    fill={MUTED}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Section 3 — Smaller charts + insights */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Task Breakdown</h3>
          <div style={{ width: "100%", height: "200px", position: "relative" }}>
            {totalTasks === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: MUTED,
                  textAlign: "center",
                  marginTop: "80px",
                }}
              >
                No tasks yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={2}
                    labelLine={false}
                  >
                    {taskBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                    <Label
                      value={totalTasks}
                      position="center"
                      fill="#ffffff"
                      fontSize={18}
                      fontWeight={700}
                    />
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: MUTED }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Event Types</h3>
          <div style={{ width: "100%", height: "200px" }}>
            {eventCategories.length === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: MUTED,
                  textAlign: "center",
                  marginTop: "80px",
                }}
              >
                No events yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventCategories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    labelLine={false}
                  >
                    {eventCategories.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: MUTED }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Insights</h3>
          <div>
            {insights.length === 0 ? (
              <p style={{ fontSize: "13px", color: MUTED, margin: 0 }}>
                Not enough data for insights yet.
              </p>
            ) : (
              insights.map((insight, index) => (
                <div
                  key={insight.text}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "8px 0",
                    borderBottom:
                      index < insights.length - 1
                        ? `1px solid ${GRID}`
                        : "none",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: insight.dotColor,
                      flexShrink: 0,
                      marginTop: "5px",
                    }}
                  />
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#cccccc",
                      margin: 0,
                      lineHeight: 1.45,
                    }}
                  >
                    {insight.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
