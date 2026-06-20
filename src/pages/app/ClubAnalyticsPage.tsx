import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Calendar,
  CheckCircle,
  CheckSquare,
  Download,
  Info,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { useIsMobile } from "../../hooks/useWindowWidth";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
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
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";
const ACCENT_GOLD = "#FFC429";
const GRID = "#1e1e1e";

type TimeRange = "30d" | "semester" | "year" | "all";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "30d", label: "30 Days" },
  { value: "semester", label: "Semester" },
  { value: "year", label: "Year" },
  { value: "all", label: "All Time" },
];

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
  weekly_meeting: "#555555",
  public_event: "#E51937",
  workshop: "#FFC429",
  fundraiser: "#FFC429",
  team_social: "#777777",
  general: "#333333",
  conference: "#777777",
};

const EVENT_TYPE_FALLBACK_COLORS = [
  "#E51937",
  "#FFC429",
  "#555555",
  "#777777",
  "#333333",
  "#2a2a2a",
];

interface MemberRow {
  created_at: string;
  role: string;
}

interface TaskRow {
  status: string;
  created_at: string;
}

interface PostRow {
  created_at: string;
}

interface EventRow {
  id: string;
  title: string;
  date: string;
  category: string | null;
  visibility?: string | null;
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
  sentiment: "warning" | "positive" | "neutral";
}

type MemberGrowthMode = "cumulative" | "monthly";
type EventAttendanceFilter = "all" | "public" | "internal";

interface StatTrend {
  percent: number;
  positive: boolean;
}

const pageStyle = (isMobile: boolean): CSSProperties => ({
  backgroundColor: PAGE_BG,
  minHeight: "100%",
  padding: isMobile ? "16px" : "24px",
});

const chartEmptyStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  fontSize: "13px",
  color: "#555555",
  textAlign: "center",
};

function timeRangeStart(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "semester": {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 4);
      return start;
    }
    case "year": {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return start;
    }
    case "all":
    default:
      return null;
  }
}

function filterRowsSince<T>(
  rows: T[],
  getDateValue: (row: T) => string,
  rangeStart: Date | null,
): T[] {
  if (!rangeStart) return rows;
  return rows.filter((row) => {
    const parsed = new Date(getDateValue(row));
    return !Number.isNaN(parsed.getTime()) && parsed >= rangeStart;
  });
}

function AnalyticsBuildingMessage() {
  return (
    <div
      style={{
        ...chartEmptyStyle,
        flexDirection: "column",
        gap: "8px",
        padding: "16px",
      }}
    >
      <p
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#555555",
          margin: 0,
        }}
      >
        Analytics are still building
      </p>
      <p
        style={{
          fontSize: "12px",
          color: "#444444",
          margin: 0,
          lineHeight: 1.5,
          maxWidth: "280px",
        }}
      >
        As your club gets more members, RSVPs, announcements, and task activity, this
        page will become more useful.
      </p>
    </div>
  );
}

function memberGrowthIsSparse(totalMembers: number, chartData: { count: number }[]): boolean {
  if (totalMembers <= 1) return true;
  if (chartData.length === 0) return true;
  const counts = chartData.map((point) => point.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  return max <= 2 && max - min <= 1;
}

function eventAttendanceIsSparse(
  attendance: { going: number; maybe: number; notGoing: number }[],
): boolean {
  if (attendance.length === 0) return true;
  return !attendance.some(
    (event) => event.going + event.maybe + event.notGoing > 0,
  );
}

const chartCardStyle: CSSProperties = {
  background: CARD_BG,
  borderTop: `1px solid ${CARD_BORDER}`,
  borderRight: `1px solid ${CARD_BORDER}`,
  borderBottom: `1px solid ${CARD_BORDER}`,
  borderLeft: `1px solid ${CARD_BORDER}`,
  borderRadius: "10px",
  padding: "24px",
};

const chartDropdownStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "6px 12px",
  color: "#cccccc",
  fontSize: "12px",
  cursor: "pointer",
};

function insightDotColor(sentiment: InsightItem["sentiment"]): string {
  if (sentiment === "warning") return ACCENT_RED;
  if (sentiment === "positive") return ACCENT_GOLD;
  return MUTED;
}

function oneYearAgoDate(): Date {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  date.setFullYear(date.getFullYear() - 1);
  return date;
}

function computeYearOverYearTrend(
  current: number,
  prior: number,
): StatTrend | null {
  if (prior <= 0) return null;
  const percent = Math.round(((current - prior) / prior) * 100);
  if (percent === 0) return null;
  return { percent: Math.abs(percent), positive: percent > 0 };
}

function toMonthlyGrowth(points: { label: string; count: number }[]) {
  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1].count : 0;
    return {
      label: point.label,
      count: Math.max(0, point.count - previous),
    };
  });
}

function MemberGrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const count = payload[0]?.value ?? 0;
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
        color: "#ffffff",
      }}
    >
      <div style={{ color: MUTED, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>
        {count} Member{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function ChartCardHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      <h3 style={{ ...chartTitleStyle, margin: 0 }}>{title}</h3>
      {action}
    </div>
  );
}

const chartTitleStyle: CSSProperties = {
  fontWeight: 700,
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
  return `${value.slice(0, max)}...`;
}

function countNewMembersThisMonth(members: MemberRow[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return members.filter((m) => new Date(m.created_at) >= monthStart).length;
}

function countPostsThisMonth(posts: PostRow[]): number {
  const thisMonth = monthKey(new Date());
  return posts.filter((p) => monthKey(new Date(p.created_at)) === thisMonth).length;
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
    { name: "To Do", value: todo, color: "#555555" },
    { name: "In Progress", value: inProgress, color: ACCENT_RED },
    { name: "Done", value: done, color: ACCENT_GOLD },
  ];
}

function buildEventCategoryBreakdown(events: EventRow[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = event.category?.trim() || "general";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, value], index) => ({
      name: EVENT_CATEGORY_LABELS[key] ?? key,
      value,
      color:
        EVENT_CATEGORY_COLORS[key] ??
        EVENT_TYPE_FALLBACK_COLORS[index % EVENT_TYPE_FALLBACK_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);
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
  const newThisMonth = countNewMembersThisMonth(params.members);
  const totalTasks = params.tasks.length;
  const doneTasks = params.tasks.filter((t) => t.status === "done").length;
  const taskPct =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const postsThisMonth = countPostsThisMonth(params.posts);

  if (newThisMonth === 0) {
    insights.push({
      sentiment: "warning",
      dotColor: ACCENT_RED,
      text: "No new members this month. Share your invite code to grow your club.",
    });
  } else {
    insights.push({
      sentiment: "positive",
      dotColor: ACCENT_GOLD,
      text: `${newThisMonth} new member${newThisMonth === 1 ? "" : "s"} joined this month — keep the momentum going.`,
    });
  }

  if (totalTasks === 0) {
    insights.push({
      sentiment: "neutral",
      dotColor: MUTED,
      text: "No tasks tracked yet. Create tasks to monitor team progress.",
    });
  } else if (taskPct < 50) {
    insights.push({
      sentiment: "warning",
      dotColor: ACCENT_RED,
      text: `Task completion is low — ${doneTasks} of ${totalTasks} tasks are done. Review assignments or update task statuses.`,
    });
  } else {
    insights.push({
      sentiment: "positive",
      dotColor: ACCENT_GOLD,
      text: `${taskPct}% of tasks are complete (${doneTasks} of ${totalTasks}).`,
    });
  }

  if (postsThisMonth === 0) {
    insights.push({
      sentiment: "warning",
      dotColor: ACCENT_RED,
      text: "No announcements this month. Post an update to keep members engaged.",
    });
  } else {
    insights.push({
      sentiment: "positive",
      dotColor: ACCENT_GOLD,
      text: `${postsThisMonth} announcement${postsThisMonth === 1 ? "" : "s"} posted this month.`,
    });
  }

  const categoryCounts = buildEventCategoryBreakdown(params.events);
  if (categoryCounts.length > 0) {
    const top = categoryCounts[0];
    insights.push({
      sentiment: "neutral",
      dotColor: MUTED,
      text: `Most common event type: ${top.name} (${top.value} event${top.value === 1 ? "" : "s"}).`,
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
      sentiment: "neutral",
      dotColor: MUTED,
      text: `Top attendance: ${bestEvent.title} with ${bestEvent.going} going.`,
    });
  }

  if (params.dmMessages.length > 0) {
    const last7 = params.dmMessages.filter((m) => {
      const d = new Date(m.created_at);
      return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }).length;
    insights.push({
      sentiment: "neutral",
      dotColor: MUTED,
      text: `${last7} direct message${last7 === 1 ? "" : "s"} sent in the last 7 days.`,
    });
  }

  return insights.slice(0, 5).map((insight) => ({
    ...insight,
    dotColor: insightDotColor(insight.sentiment),
  }));
}

interface RecommendedAction {
  icon: "CheckSquare" | "Bell" | "Users" | "Calendar";
  text: string;
  color: string;
}

function buildRecommendedActions(params: {
  taskCompletionRate: number;
  announcementsThisMonth: number;
  totalMembers: number;
}): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if (params.taskCompletionRate === 0) {
    actions.push({
      icon: "CheckSquare",
      text: "Mark completed tasks as done to improve your tracking.",
      color: ACCENT_GOLD,
    });
  }
  if (params.announcementsThisMonth === 0) {
    actions.push({
      icon: "Bell",
      text: "Post an announcement to keep your members informed.",
      color: ACCENT_RED,
    });
  }
  if (params.totalMembers < 5) {
    actions.push({
      icon: "Users",
      text: "Invite more members using your club invite code.",
      color: ACCENT_GOLD,
    });
  }
  actions.push({
    icon: "Calendar",
    text: "Add RSVP questions to upcoming public events.",
    color: MUTED,
  });

  return actions.slice(0, 4);
}

function RecommendedActionIcon({
  icon,
  color,
}: {
  icon: RecommendedAction["icon"];
  color: string;
}) {
  const props = { size: 16, color, "aria-hidden": true as const };
  switch (icon) {
    case "CheckSquare":
      return <CheckSquare {...props} />;
    case "Bell":
      return <Bell {...props} />;
    case "Users":
      return <Users {...props} />;
    case "Calendar":
      return <Calendar {...props} />;
    default:
      return <Calendar {...props} />;
  }
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
  topColor,
  valueColor = "#ffffff",
  icon,
  iconBg,
  iconColor,
  trend,
}: {
  label: string;
  value: string | number;
  topColor: string;
  valueColor?: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: StatTrend | null;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        borderRadius: "10px",
        padding: "20px",
        borderTop: `3px solid ${topColor}`,
        borderRight: `1px solid ${CARD_BORDER}`,
        borderBottom: `1px solid ${CARD_BORDER}`,
        borderLeft: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: iconColor, display: "flex" }}>{icon}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {label}
            </span>
            <Info size={12} color="#555555" aria-hidden />
          </div>

          <p
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: valueColor,
              margin: 0,
              lineHeight: 1,
            }}
          >
            {value}
          </p>

          {trend ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "8px",
                fontSize: "12px",
                color: trend.positive ? "#22C55E" : ACCENT_RED,
              }}
            >
              {trend.positive ? (
                <ArrowUp size={14} aria-hidden />
              ) : (
                <ArrowDown size={14} aria-hidden />
              )}
              <span>
                {trend.percent}% vs last year
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExportMenuButton() {
  return (
    <button
      type="button"
      disabled
      title="Export is coming soon"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "8px",
        padding: "8px 16px",
        color: "#555555",
        fontSize: "13px",
        cursor: "not-allowed",
        opacity: 0.85,
      }}
    >
      <Download size={16} aria-hidden />
      Export (Coming soon)
    </button>
  );
}

function TaskBreakdownLegend({
  segments,
  total,
}: {
  segments: { name: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div style={{ marginTop: "12px" }}>
      {segments.map((segment) => {
        const pct =
          total > 0 ? ((segment.value / total) * 100).toFixed(1) : "0.0";
        return (
          <div
            key={segment.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "6px 0",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: segment.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#cccccc" }}>{segment.name}</span>
            </div>
            <span style={{ color: MUTED }}>
              {segment.value} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CardFooterLink({
  left,
  rightHref,
  rightLabel,
}: {
  left?: ReactNode;
  rightHref: string;
  rightLabel: string;
}) {
  return (
    <div
      style={{
        borderTop: "1px solid #2a2a2a",
        paddingTop: "12px",
        marginTop: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <div>{left}</div>
      <Link
        to={rightHref}
        style={{
          fontSize: "13px",
          color: ACCENT_RED,
          textDecoration: "none",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {rightLabel}
      </Link>
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
  const isMobile = useIsMobile();
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
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [memberGrowthMode, setMemberGrowthMode] = useState<MemberGrowthMode>("cumulative");
  const [attendanceFilter, setAttendanceFilter] = useState<EventAttendanceFilter>("all");

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
        supabase.from("tasks").select("status, created_at").eq("club_id", clubId),
        supabase.from("posts").select("created_at").eq("club_id", clubId),
        supabase
          .from("events")
          .select("id, title, date, category, visibility")
          .eq("club_id", clubId),
        supabase.from("conversations").select("id").eq("club_id", clubId),
      ]);

      if (cancelled) return;

      const failures: string[] = [];
      if (membersRes.error) failures.push("members");
      if (tasksRes.error) failures.push("tasks");
      if (postsRes.error) failures.push("posts");
      if (eventsRes.error) failures.push("events");
      if (conversationsRes.error) {
        console.error(
          "Failed to load conversations for analytics:",
          conversationsRes.error.message,
        );
      }

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
          console.error("Failed to load messages for analytics:", dmRes.error.message);
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

  const rangeStart = useMemo(() => timeRangeStart(timeRange), [timeRange]);

  const scopedMembers = useMemo(
    () => filterRowsSince(members, (row) => row.created_at, rangeStart),
    [members, rangeStart],
  );
  const scopedTasks = useMemo(
    () => filterRowsSince(tasks, (row) => row.created_at, rangeStart),
    [tasks, rangeStart],
  );
  const scopedPosts = useMemo(
    () => filterRowsSince(posts, (row) => row.created_at, rangeStart),
    [posts, rangeStart],
  );
  const scopedEvents = useMemo(
    () => filterRowsSince(events, (row) => row.date, rangeStart),
    [events, rangeStart],
  );
  const scopedEventIds = useMemo(
    () => new Set(scopedEvents.map((event) => event.id)),
    [scopedEvents],
  );
  const scopedRsvps = useMemo(
    () => rsvps.filter((row) => scopedEventIds.has(row.event_id)),
    [rsvps, scopedEventIds],
  );
  const scopedDmMessages = useMemo(
    () => filterRowsSince(dmMessages, (row) => row.created_at, rangeStart),
    [dmMessages, rangeStart],
  );

  const memberGrowth = useMemo(() => buildMemberGrowth(scopedMembers), [scopedMembers]);
  const memberGrowthChartData = useMemo(
    () =>
      memberGrowthMode === "monthly"
        ? toMonthlyGrowth(memberGrowth)
        : memberGrowth,
    [memberGrowth, memberGrowthMode],
  );
  const filteredEventsForAttendance = useMemo(() => {
    let list = scopedEvents;
    if (attendanceFilter === "public") {
      list = list.filter((event) => event.visibility !== "members_only");
    } else if (attendanceFilter === "internal") {
      list = list.filter((event) => event.visibility === "members_only");
    }
    return list;
  }, [scopedEvents, attendanceFilter]);
  const eventAttendance = useMemo(
    () => buildEventAttendance(filteredEventsForAttendance, scopedRsvps),
    [filteredEventsForAttendance, scopedRsvps],
  );
  const taskBreakdown = useMemo(() => buildTaskBreakdown(scopedTasks), [scopedTasks]);
  const eventCategories = useMemo(
    () => buildEventCategoryBreakdown(scopedEvents),
    [scopedEvents],
  );
  const insights = useMemo(
    () =>
      buildInsights({
        members: scopedMembers,
        tasks: scopedTasks,
        events: scopedEvents,
        rsvps: scopedRsvps,
        posts: scopedPosts,
        dmMessages: scopedDmMessages,
      }),
    [scopedMembers, scopedTasks, scopedEvents, scopedRsvps, scopedPosts, scopedDmMessages],
  );

  const totalMembers = scopedMembers.length;
  const totalEvents = scopedEvents.length;
  const totalAnnouncements = scopedPosts.length;
  const totalTasks = scopedTasks.length;
  const doneTasks = scopedTasks.filter((t) => t.status === "done").length;
  const taskCompletionRate =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const announcementsThisMonth = countPostsThisMonth(scopedPosts);

  const yearAgo = oneYearAgoDate();
  const membersYearAgo = scopedMembers.filter(
    (member) => new Date(member.created_at) <= yearAgo,
  ).length;
  const eventsYearAgo = scopedEvents.filter((event) => {
    const eventDate = new Date(event.date);
    return !Number.isNaN(eventDate.getTime()) && eventDate <= yearAgo;
  }).length;
  const announcementsYearAgo = scopedPosts.filter(
    (post) => new Date(post.created_at) <= yearAgo,
  ).length;

  const memberTrend = computeYearOverYearTrend(totalMembers, membersYearAgo);
  const eventTrend = computeYearOverYearTrend(totalEvents, eventsYearAgo);
  const announcementTrend = computeYearOverYearTrend(
    totalAnnouncements,
    announcementsYearAgo,
  );

  const tasksBasePath = clubId ? `/app/clubs/${clubId}` : "/app";

  const recommendedActions = useMemo(
    () =>
      buildRecommendedActions({
        taskCompletionRate,
        announcementsThisMonth,
        totalMembers,
      }),
    [taskCompletionRate, announcementsThisMonth, totalMembers],
  );

  if (!isPrivileged) {
    return (
      <div style={pageStyle(isMobile)}>
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
      <div style={pageStyle(isMobile)}>
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
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
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
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
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
    <div style={pageStyle(isMobile)}>
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <h1
              style={{
                fontWeight: 800,
                fontSize: "28px",
                color: "#ffffff",
                margin: 0,
              }}
            >
              Club Analytics
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: MUTED,
                marginTop: "4px",
                marginBottom: 0,
              }}
            >
              Track membership, engagement, events, and team activity.
            </p>
          </div>
          <ExportMenuButton />
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "16px",
          }}
        >
          {TIME_RANGE_OPTIONS.map((option) => {
            const active = timeRange === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeRange(option.value)}
                style={{
                  background: active ? ACCENT_RED : "transparent",
                  color: active ? "#ffffff" : "#777777",
                  border: active ? "none" : "1px solid #333333",
                  borderRadius: "6px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
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
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          label="Total Members"
          value={totalMembers}
          topColor="#777777"
          icon={<Users size={22} aria-hidden />}
          iconBg="rgba(229, 25, 55, 0.15)"
          iconColor={ACCENT_RED}
          trend={memberTrend}
        />
        <StatCard
          label="Total Events"
          value={totalEvents}
          topColor={ACCENT_RED}
          icon={<Calendar size={22} aria-hidden />}
          iconBg="rgba(229, 25, 55, 0.15)"
          iconColor={ACCENT_RED}
          trend={eventTrend}
        />
        <StatCard
          label="Task Completion Rate"
          value={`${taskCompletionRate}%`}
          topColor={ACCENT_GOLD}
          valueColor={ACCENT_GOLD}
          icon={<CheckCircle size={22} aria-hidden />}
          iconBg="rgba(255, 196, 41, 0.15)"
          iconColor={ACCENT_GOLD}
        />
        <StatCard
          label="Total Announcements"
          value={totalAnnouncements}
          topColor="#777777"
          icon={<Megaphone size={22} aria-hidden />}
          iconBg="rgba(229, 25, 55, 0.15)"
          iconColor={ACCENT_RED}
          trend={announcementTrend}
        />
      </div>

      {/* Section 2 — Charts row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={chartCardStyle}>
          <ChartCardHeader
            title="Member Growth"
            action={
              <select
                value={memberGrowthMode}
                onChange={(event) =>
                  setMemberGrowthMode(event.target.value as MemberGrowthMode)
                }
                style={chartDropdownStyle}
                aria-label="Member growth view"
              >
                <option value="cumulative">Cumulative</option>
                <option value="monthly">Monthly</option>
              </select>
            }
          />
          <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
            {memberGrowthIsSparse(totalMembers, memberGrowthChartData) ? (
              <AnalyticsBuildingMessage />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={memberGrowthChartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" {...chartAxisProps} />
                  <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                  <Tooltip content={<MemberGrowthTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={ACCENT_RED}
                    strokeWidth={2}
                    dot={{ fill: ACCENT_RED, r: 3 }}
                    activeDot={{ r: 5, fill: ACCENT_RED, stroke: "#ffffff", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={chartCardStyle}>
          <ChartCardHeader
            title="Event Attendance"
            action={
              <select
                value={attendanceFilter}
                onChange={(event) =>
                  setAttendanceFilter(event.target.value as EventAttendanceFilter)
                }
                style={chartDropdownStyle}
                aria-label="Event attendance filter"
              >
                <option value="all">All Events</option>
                <option value="public">Public Only</option>
                <option value="internal">Internal Only</option>
              </select>
            }
          />
          <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
            {eventAttendanceIsSparse(eventAttendance) ? (
              <AnalyticsBuildingMessage />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={eventAttendance}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="name"
                    {...chartAxisProps}
                    tickFormatter={(value) => truncateLabel(String(value), 12)}
                  />
                  <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", color: MUTED }}
                    iconType="circle"
                  />
                  <Bar dataKey="going" name="Going" fill={ACCENT_GOLD} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maybe" name="Maybe" fill="#555555" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="notGoing"
                    name="Not Going"
                    fill={ACCENT_RED}
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
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Task Breakdown</h3>
          <div
            style={{ width: "100%", minWidth: 0, height: "180px", position: "relative" }}
          >
            {totalTasks === 0 ? (
              <AnalyticsBuildingMessage />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
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
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {totalTasks > 0 ? (
            <>
              <TaskBreakdownLegend segments={taskBreakdown} total={totalTasks} />
              <CardFooterLink
                rightHref={`${tasksBasePath}/tasks`}
                rightLabel="View all tasks →"
              />
            </>
          ) : null}
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Event Types</h3>
          <div
            style={{
              width: "100%",
              minWidth: 0,
              height: Math.max(180, eventCategories.length * 36),
            }}
          >
            {totalEvents === 0 ? (
              <AnalyticsBuildingMessage />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={eventCategories}
                  layout="vertical"
                  margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} {...chartAxisProps} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: MUTED, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="value" name="Events" radius={[0, 4, 4, 0]}>
                    {eventCategories.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      fill="#cccccc"
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {eventCategories.length > 0 ? (
            <CardFooterLink
              left={
                <span style={{ fontSize: "13px", color: "#777777" }}>
                  Total Events: {totalEvents}
                </span>
              }
              rightHref={`${tasksBasePath}/events`}
              rightLabel="View all events →"
            />
          ) : null}
        </div>

        <div style={chartCardStyle}>
          <h3
            style={{
              ...chartTitleStyle,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <TrendingUp size={16} color={ACCENT_GOLD} aria-hidden />
            Insights
          </h3>
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
                    padding: "10px 0",
                    borderBottom:
                      index < insights.length - 1
                        ? "1px solid #1a1a1a"
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
                      marginTop: "6px",
                    }}
                  />
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#cccccc",
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {insight.text}
                  </p>
                </div>
              ))
            )}
          </div>
          {insights.length > 0 ? (
            <div style={{ marginTop: "12px" }}>
              <Link
                to={`${tasksBasePath}/analytics`}
                style={{
                  fontSize: "13px",
                  color: ACCENT_RED,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                View full report →
              </Link>
            </div>
          ) : null}
        </div>

        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "10px",
            padding: "24px",
            gridColumn: isMobile ? undefined : "1 / -1",
          }}
        >
          <h3 style={chartTitleStyle}>Recommended Actions</h3>
          <div>
            {recommendedActions.map((action, index) => (
              <div
                key={action.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom:
                    index < recommendedActions.length - 1
                      ? "1px solid #1a1a1a"
                      : "none",
                }}
              >
                <RecommendedActionIcon icon={action.icon} color={action.color} />
                <p
                  style={{
                    fontSize: "13px",
                    color: "#cccccc",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {action.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
