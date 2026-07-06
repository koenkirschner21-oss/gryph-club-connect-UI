import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Calendar,
  CheckCircle,
  CheckSquare,
  Download,
  Eye,
  Globe,
  Info,
  LayoutDashboard,
  Megaphone,
  Users,
} from "lucide-react";
import { useIsMobile } from "../../hooks/useWindowWidth";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildAnnouncementSectionInsight,
  buildAnnouncementSeenBreakdown,
  buildAnnouncementViewsOverTime,
  buildAnalyticsOverviewInsight,
  buildEventAttendanceTrend,
  buildEventCategoryBreakdown,
  buildEventSectionInsight,
  buildExecutiveBreakdown,
  buildHiringByRole,
  buildHiringByStatus,
  buildHiringFunnel,
  buildHiringSectionInsight,
  buildMemberGrowth,
  buildMemberSectionInsight,
  buildMostViewedAnnouncements,
  buildRsvpBreakdown,
  buildTaskBreakdown,
  buildTaskCompletionOverTime,
  buildTaskSectionInsight,
  buildTasksByAssignee,
  buildTopAttendedEvents,
  computeOverallSeenRate,
  countEventsThisMonth,
  countNewMembersThisMonth,
  countOverdueTasks,
  isExecutiveMember,
  sectionInsightStyle,
  toMonthlyNewMembers,
  type EventRow,
  type HiringApplicationRow,
  type HiringListingRow,
  type MemberRow,
  type PostRow,
  type PostViewRow,
  type RsvpRow,
  type SectionInsight,
  type TaskRow,
} from "../../lib/analyticsMetrics";
import { supabase } from "../../lib/supabaseClient";
import {
  buildProfileViewsOverTime,
  buildPublicProfileSectionInsight,
  countEventsByType,
  fetchClubSavedCount,
  fetchPublicProfileEvents,
  isLowPublicProfileData,
  type PublicProfileEventRow,
} from "../../lib/publicProfileAnalytics";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import Spinner from "../../components/ui/Spinner";

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";
const ACCENT_GOLD = "#FFC429";
const GRID = "#1e1e1e";

type TimeRange = "30d" | "semester" | "year" | "all";
type MemberGrowthMode = "cumulative" | "monthly";

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

function toMonthlyGrowth(points: { label: string; count: number }[]) {
  return toMonthlyNewMembers(points);
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

function AnalyticsBuildingMessage({ message }: { message?: string }) {
  return (
    <div
      style={{
        ...chartEmptyStyle,
        flexDirection: "column",
        gap: "8px",
        padding: "16px",
      }}
    >
      <p style={{ fontSize: "14px", fontWeight: 600, color: MUTED, margin: 0 }}>
        {message ?? "Not enough data yet"}
      </p>
    </div>
  );
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
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
              {label}
            </span>
            <Info size={12} color={MUTED} aria-hidden />
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
              <span>{trend.percent}% vs last year</span>
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
        color: MUTED,
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

function SectionInsightBox({ insight }: { insight: SectionInsight }) {
  return <p style={sectionInsightStyle(insight.sentiment)}>{insight.text}</p>;
}

function AnalyticsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <span style={{ color: ACCENT_RED, display: "flex" }}>{icon}</span>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 800,
            color: "#ffffff",
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function StatCardsRow({
  isMobile,
  children,
}: {
  isMobile: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "16px",
      }}
    >
      {children}
    </div>
  );
}

function ChartsGrid({
  isMobile,
  children,
}: {
  isMobile: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "16px",
      }}
    >
      {children}
    </div>
  );
}

function DonutChart({
  data,
  total,
  centerLabel,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
  centerLabel?: string;
}) {
  if (total === 0 || data.every((segment) => segment.value === 0)) {
    return <AnalyticsBuildingMessage />;
  }
  return (
    <>
      <div style={{ width: "100%", minWidth: 0, height: "180px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
              <Label
                value={centerLabel ?? total}
                position="center"
                fill="#ffffff"
                fontSize={18}
                fontWeight={700}
              />
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <TaskBreakdownLegend segments={data} total={total} />
    </>
  );
}

function TopEventsList({
  events,
}: {
  events: ReturnType<typeof buildTopAttendedEvents>;
}) {
  if (events.length === 0) {
    return <AnalyticsBuildingMessage message="No RSVP data for events yet" />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {events.map((event, index) => (
        <div
          key={event.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "10px 12px",
            background: "#121212",
            borderRadius: "8px",
            border: "1px solid #1e1e1e",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {index + 1}. {event.title}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: MUTED }}>
              {event.going} going · {event.maybe} maybe
            </p>
          </div>
          <span style={{ fontSize: "12px", color: ACCENT_GOLD, fontWeight: 600 }}>
            {event.going}
          </span>
        </div>
      ))}
    </div>
  );
}

function HiringFunnelVisual({
  stages,
}: {
  stages: ReturnType<typeof buildHiringFunnel>;
}) {
  if (stages.length === 0) {
    return <AnalyticsBuildingMessage message="No applicants in the funnel yet" />;
  }
  const max = Math.max(...stages.map((stage) => stage.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {stages.map((stage) => (
        <div key={stage.stage}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#cccccc",
              marginBottom: "4px",
            }}
          >
            <span>{stage.stage}</span>
            <span>{stage.count}</span>
          </div>
          <div
            style={{
              height: "8px",
              background: "#1a1a1a",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(8, (stage.count / max) * 100)}%`,
                height: "100%",
                background: stage.color,
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MostViewedList({
  posts,
}: {
  posts: ReturnType<typeof buildMostViewedAnnouncements>;
}) {
  if (posts.length === 0) {
    return <AnalyticsBuildingMessage message="No announcement views recorded yet" />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {posts.map((post, index) => (
        <div
          key={post.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "10px 12px",
            background: "#121212",
            borderRadius: "8px",
            border: "1px solid #1e1e1e",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {index + 1}. {post.title}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: MUTED }}>
              {post.seenRate}% seen rate
            </p>
          </div>
          <span style={{ fontSize: "12px", color: ACCENT_GOLD, fontWeight: 600 }}>
            {post.views} views
          </span>
        </div>
      ))}
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
      <div style={{ height: "200px", background: PAGE_BG, borderRadius: "8px" }} />
    </div>
  );
}

export default function ClubAnalyticsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const isMobile = useIsMobile();
  const memberAccess = useClubMemberAccess(clubId);
  const canViewAnalytics =
    memberAccess.isPresident || memberAccess.can("view_analytics");

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postViews, setPostViews] = useState<PostViewRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [hiringApplications, setHiringApplications] = useState<HiringApplicationRow[]>([]);
  const [hiringListings, setHiringListings] = useState<HiringListingRow[]>([]);
  const [openHiringListingsCount, setOpenHiringListingsCount] = useState(0);
  const [profileEvents, setProfileEvents] = useState<PublicProfileEventRow[]>([]);
  const [savedClubCount, setSavedClubCount] = useState(0);
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [memberGrowthMode, setMemberGrowthMode] = useState<MemberGrowthMode>("cumulative");

  useEffect(() => {
    if (!clubId || !canViewAnalytics) {
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
        listingsRes,
      ] = await Promise.all([
        supabase
          .from("club_members")
          .select("user_id, created_at, role, access_level")
          .eq("club_id", clubId)
          .eq("status", "active"),
        supabase
          .from("tasks")
          .select("status, created_at, assigned_to, due_date")
          .eq("club_id", clubId),
        supabase.from("posts").select("id, title, created_at").eq("club_id", clubId),
        supabase
          .from("events")
          .select("id, title, date, category, visibility")
          .eq("club_id", clubId),
        supabase
          .from("hiring_listings")
          .select("id, title, is_open")
          .eq("club_id", clubId),
      ]);

      if (cancelled) return;

      const failures: string[] = [];
      if (membersRes.error) failures.push("members");
      if (tasksRes.error) failures.push("tasks");
      if (postsRes.error) failures.push("posts");
      if (eventsRes.error) failures.push("events");
      if (listingsRes.error) failures.push("hiring listings");

      const eventRows = (eventsRes.data ?? []) as EventRow[];
      const postRows = (postsRes.data ?? []) as PostRow[];
      const listingRows = (listingsRes.data ?? []) as (HiringListingRow & {
        is_open?: boolean;
      })[];
      const taskRows = (tasksRes.data ?? []) as TaskRow[];

      const eventIds = eventRows.map((event) => event.id);
      const postIds = postRows.map((post) => post.id);
      const listingIds = listingRows.map((listing) => listing.id);
      const assigneeIds = Array.from(
        new Set(
          taskRows
            .map((task) => task.assigned_to)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const [rsvpsRes, viewsRes, appsRes, profilesRes, profileEventsRes, savedCount] =
        await Promise.all([
        eventIds.length > 0
          ? supabase
              .from("event_rsvps")
              .select("status, event_id")
              .in("event_id", eventIds)
          : Promise.resolve({ data: [], error: null }),
        postIds.length > 0
          ? supabase
              .from("post_views")
              .select("post_id, user_id, viewed_at")
              .in("post_id", postIds)
          : Promise.resolve({ data: [], error: null }),
        listingIds.length > 0
          ? supabase
              .from("hiring_applications")
              .select("id, listing_id, applicant_id, status, sub_status, created_at")
              .in("listing_id", listingIds)
          : Promise.resolve({ data: [], error: null }),
        assigneeIds.length > 0
          ? supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
          : Promise.resolve({ data: [], error: null }),
        fetchPublicProfileEvents(clubId!),
        fetchClubSavedCount(clubId!),
      ]);

      if (cancelled) return;

      if (rsvpsRes.error) failures.push("RSVPs");
      if (viewsRes.error) failures.push("announcement views");
      if (appsRes.error) failures.push("hiring applications");

      const nameMap: Record<string, string> = {};
      for (const row of profilesRes.data ?? []) {
        nameMap[row.id as string] = ((row.full_name as string | null) ?? "Member").trim();
      }

      if (failures.length > 0) {
        setError(`Failed to load: ${failures.join(", ")}`);
      }

      setMembers((membersRes.data ?? []) as MemberRow[]);
      setTasks(taskRows);
      setPosts(postRows);
      setPostViews((viewsRes.data ?? []) as PostViewRow[]);
      setEvents(eventRows);
      setRsvps((rsvpsRes.data ?? []) as RsvpRow[]);
      setHiringApplications((appsRes.data ?? []) as HiringApplicationRow[]);
      setHiringListings(
        listingRows.map(({ id, title }) => ({ id, title })),
      );
      setOpenHiringListingsCount(
        listingRows.filter((listing) => listing.is_open !== false).length,
      );
      setAssigneeNames(nameMap);
      setProfileEvents(profileEventsRes);
      setSavedClubCount(savedCount);
      setLoading(false);
    }

    void fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, [clubId, canViewAnalytics]);

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
  const scopedPostIds = useMemo(() => new Set(scopedPosts.map((post) => post.id)), [scopedPosts]);
  const scopedPostViews = useMemo(
    () => postViews.filter((view) => scopedPostIds.has(view.post_id)),
    [postViews, scopedPostIds],
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
  const scopedApplications = useMemo(
    () => filterRowsSince(hiringApplications, (row) => row.created_at, rangeStart),
    [hiringApplications, rangeStart],
  );
  const activeClubMemberIds = useMemo(
    () => new Set(members.map((member) => member.user_id)),
    [members],
  );
  const hiringAnalyticsOptions = useMemo(
    () => ({ activeClubMemberIds }),
    [activeClubMemberIds],
  );
  const scopedProfileEvents = useMemo(
    () => filterRowsSince(profileEvents, (row) => row.created_at, rangeStart),
    [profileEvents, rangeStart],
  );

  const profilePageViews = countEventsByType(scopedProfileEvents, "page_view");
  const profileJoinClicks =
    countEventsByType(scopedProfileEvents, "join_click") +
    countEventsByType(scopedProfileEvents, "join_request");
  const profileEventClicks = countEventsByType(scopedProfileEvents, "event_click");
  const profileHiringClicks = countEventsByType(scopedProfileEvents, "hiring_click");
  const profileViewsTrend = useMemo(
    () => buildProfileViewsOverTime(scopedProfileEvents),
    [scopedProfileEvents],
  );
  const profileInsight = useMemo(
    () =>
      buildPublicProfileSectionInsight({
        totalEvents: scopedProfileEvents.length,
        pageViews: profilePageViews,
        joinClicks: profileJoinClicks,
        savedCount: savedClubCount,
      }),
    [scopedProfileEvents.length, profilePageViews, profileJoinClicks, savedClubCount],
  );
  const lowProfileData = isLowPublicProfileData(scopedProfileEvents.length);

  const activeMemberCount = members.length;
  const memberGrowth = useMemo(() => buildMemberGrowth(scopedMembers), [scopedMembers]);
  const memberGrowthChartData = useMemo(
    () =>
      memberGrowthMode === "monthly" ? toMonthlyGrowth(memberGrowth) : memberGrowth,
    [memberGrowth, memberGrowthMode],
  );
  const newMembersByMonth = useMemo(
    () => toMonthlyNewMembers(memberGrowth),
    [memberGrowth],
  );
  const executiveBreakdown = useMemo(
    () => buildExecutiveBreakdown(scopedMembers),
    [scopedMembers],
  );
  const memberInsight = useMemo(
    () => buildMemberSectionInsight(scopedMembers),
    [scopedMembers],
  );

  const eventAttendanceTrend = useMemo(
    () => buildEventAttendanceTrend(scopedEvents, scopedRsvps),
    [scopedEvents, scopedRsvps],
  );
  const rsvpBreakdown = useMemo(() => buildRsvpBreakdown(scopedRsvps), [scopedRsvps]);
  const topAttendedEvents = useMemo(
    () => buildTopAttendedEvents(scopedEvents, scopedRsvps),
    [scopedEvents, scopedRsvps],
  );
  const eventCategories = useMemo(
    () =>
      buildEventCategoryBreakdown(
        scopedEvents,
        EVENT_CATEGORY_LABELS,
        EVENT_CATEGORY_COLORS,
        EVENT_TYPE_FALLBACK_COLORS,
      ),
    [scopedEvents],
  );
  const eventInsight = useMemo(
    () => buildEventSectionInsight(scopedEvents, scopedRsvps),
    [scopedEvents, scopedRsvps],
  );

  const taskBreakdown = useMemo(() => buildTaskBreakdown(scopedTasks), [scopedTasks]);
  const taskCompletionOverTime = useMemo(
    () => buildTaskCompletionOverTime(scopedTasks),
    [scopedTasks],
  );
  const tasksByAssignee = useMemo(
    () => buildTasksByAssignee(scopedTasks, assigneeNames),
    [scopedTasks, assigneeNames],
  );
  const overdueTasks = useMemo(() => countOverdueTasks(scopedTasks), [scopedTasks]);
  const taskInsight = useMemo(() => buildTaskSectionInsight(scopedTasks), [scopedTasks]);

  const hiringByStatus = useMemo(
    () => buildHiringByStatus(scopedApplications, hiringAnalyticsOptions),
    [scopedApplications, hiringAnalyticsOptions],
  );
  const hiringByRole = useMemo(
    () => buildHiringByRole(scopedApplications, hiringListings),
    [scopedApplications, hiringListings],
  );
  const hiringFunnel = useMemo(
    () => buildHiringFunnel(scopedApplications, hiringAnalyticsOptions),
    [scopedApplications, hiringAnalyticsOptions],
  );
  const hiringInsight = useMemo(
    () =>
      buildHiringSectionInsight(
        scopedApplications,
        openHiringListingsCount,
        hiringAnalyticsOptions,
      ),
    [scopedApplications, openHiringListingsCount, hiringAnalyticsOptions],
  );

  const announcementViewsTrend = useMemo(
    () => buildAnnouncementViewsOverTime(scopedPostViews),
    [scopedPostViews],
  );
  const overallSeenRate = useMemo(
    () => computeOverallSeenRate(scopedPosts, scopedPostViews, activeMemberCount),
    [scopedPosts, scopedPostViews, activeMemberCount],
  );
  const announcementSeenBreakdown = useMemo(
    () =>
      buildAnnouncementSeenBreakdown(scopedPosts, scopedPostViews, activeMemberCount),
    [scopedPosts, scopedPostViews, activeMemberCount],
  );
  const mostViewedAnnouncements = useMemo(
    () =>
      buildMostViewedAnnouncements(scopedPosts, scopedPostViews, activeMemberCount),
    [scopedPosts, scopedPostViews, activeMemberCount],
  );
  const announcementInsight = useMemo(
    () =>
      buildAnnouncementSectionInsight(
        scopedPosts,
        scopedPostViews,
        activeMemberCount,
      ),
    [scopedPosts, scopedPostViews, activeMemberCount],
  );

  const totalMembers = scopedMembers.length;
  const executivesCount = scopedMembers.filter(isExecutiveMember).length;
  const newThisMonth = countNewMembersThisMonth(scopedMembers);
  const totalEvents = scopedEvents.length;
  const totalRsvps = scopedRsvps.length;
  const goingRsvps = scopedRsvps.filter((row) => row.status === "going").length;
  const goingRate =
    totalRsvps > 0 ? Math.round((goingRsvps / totalRsvps) * 100) : 0;
  const totalTasks = scopedTasks.length;
  const doneTasks = scopedTasks.filter((task) => task.status === "done").length;
  const taskCompletionRate =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const inProgressTasks = scopedTasks.filter(
    (task) => task.status === "in_progress",
  ).length;
  const totalApplicants = scopedApplications.length;
  const interviewApplicants = hiringByStatus.find(
    (segment) => segment.name === "Interview",
  )?.value ?? 0;
  const acceptedApplicants = hiringByStatus.find(
    (segment) => segment.name === "Accepted",
  )?.value ?? 0;
  const totalAnnouncementViews = scopedPostViews.length;

  const yearAgo = oneYearAgoDate();
  const membersYearAgo = scopedMembers.filter(
    (member) => new Date(member.created_at) <= yearAgo,
  ).length;
  const memberTrend = computeYearOverYearTrend(totalMembers, membersYearAgo);
  const eventsThisMonth = countEventsThisMonth(scopedEvents);

  const overviewInsight = useMemo(
    () =>
      buildAnalyticsOverviewInsight(
        {
          totalMembers,
          eventsThisMonth,
          taskCompletionRate,
          openHiringRoles: openHiringListingsCount,
          overdueTasks,
          newMembersThisMonth: newThisMonth,
        },
        {
          member: memberInsight,
          event: eventInsight,
          task: taskInsight,
          hiring: hiringInsight,
          announcement: announcementInsight,
          profile: profileInsight,
        },
      ),
    [
      totalMembers,
      eventsThisMonth,
      taskCompletionRate,
      openHiringListingsCount,
      overdueTasks,
      newThisMonth,
      memberInsight,
      eventInsight,
      taskInsight,
      hiringInsight,
      announcementInsight,
      profileInsight,
    ],
  );

  const clubBasePath = clubId ? `/app/clubs/${clubId}` : "/app";

  if (memberAccess.loading) {
    return (
      <div style={pageStyle(isMobile)}>
        <Spinner label="Loading analytics…" />
      </div>
    );
  }

  if (!canViewAnalytics) {
    return <Navigate to={clubId ? `/app/clubs/${clubId}` : "/app"} replace />;
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
        </div>
        <ChartsGrid isMobile={isMobile}>
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </ChartsGrid>
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
            <p style={{ fontSize: "14px", color: MUTED, marginTop: "4px", marginBottom: 0 }}>
              Membership, events, tasks, hiring, and announcement insights.
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

      <AnalyticsSection title="Overview" icon={<LayoutDashboard size={20} aria-hidden />}>
        <StatCardsRow isMobile={isMobile}>
          <StatCard
            label="Total Members"
            value={totalMembers}
            topColor={ACCENT_RED}
            icon={<Users size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
            trend={memberTrend}
          />
          <StatCard
            label="Events This Month"
            value={eventsThisMonth}
            topColor={ACCENT_GOLD}
            valueColor={eventsThisMonth > 0 ? ACCENT_GOLD : "#ffffff"}
            icon={<Calendar size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="Task Completion"
            value={`${taskCompletionRate}%`}
            topColor={taskCompletionRate >= 60 ? ACCENT_GOLD : "#777777"}
            valueColor={taskCompletionRate >= 60 ? ACCENT_GOLD : "#ffffff"}
            icon={<CheckSquare size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="Open Hiring Roles"
            value={openHiringListingsCount}
            topColor="#6b7cff"
            icon={<Briefcase size={22} aria-hidden />}
            iconBg="rgba(107, 124, 255, 0.15)"
            iconColor="#6b7cff"
          />
        </StatCardsRow>
        <div style={{ marginBottom: "16px" }}>
          <SectionInsightBox insight={overviewInsight} />
        </div>
        <ChartsGrid isMobile={isMobile}>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Member Growth (6 mo)" />
            <div style={{ width: "100%", minWidth: 0, height: "160px" }}>
              {totalMembers === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={newMembersByMonth}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} />
                    <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <Tooltip content={<MemberGrowthTooltip />} />
                    <Bar dataKey="count" name="New members" fill={ACCENT_RED} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Event Attendance (6 mo)" />
            <div style={{ width: "100%", minWidth: 0, height: "160px" }}>
              {totalEvents === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={eventAttendanceTrend}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} />
                    <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="going"
                      name="Going"
                      stroke={ACCENT_GOLD}
                      strokeWidth={2}
                      dot={{ fill: ACCENT_GOLD, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </ChartsGrid>
      </AnalyticsSection>

      <AnalyticsSection title="Members" icon={<Users size={20} aria-hidden />}>
        <StatCardsRow isMobile={isMobile}>
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
            label="New This Month"
            value={newThisMonth}
            topColor={ACCENT_GOLD}
            valueColor={ACCENT_GOLD}
            icon={<Users size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="Executives"
            value={executivesCount}
            topColor={ACCENT_GOLD}
            icon={<Users size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="General Members"
            value={Math.max(0, totalMembers - executivesCount)}
            topColor="#777777"
            icon={<Users size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
        </StatCardsRow>
        <ChartsGrid isMobile={isMobile}>
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
              {totalMembers === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={memberGrowthChartData}>
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
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="New Members by Month" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {totalMembers === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={newMembersByMonth}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} />
                    <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" name="New members" fill={ACCENT_GOLD} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Executive vs General" />
            <DonutChart
              data={executiveBreakdown}
              total={totalMembers}
              centerLabel={`${totalMembers}`}
            />
          </div>
        </ChartsGrid>
        <SectionInsightBox insight={memberInsight} />
      </AnalyticsSection>

      <AnalyticsSection title="Events & RSVPs" icon={<Calendar size={20} aria-hidden />}>
        <StatCardsRow isMobile={isMobile}>
          <StatCard
            label="Total Events"
            value={totalEvents}
            topColor={ACCENT_RED}
            icon={<Calendar size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Total RSVPs"
            value={totalRsvps}
            topColor="#777777"
            icon={<Calendar size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Going Rate"
            value={`${goingRate}%`}
            topColor={ACCENT_GOLD}
            valueColor={ACCENT_GOLD}
            icon={<Calendar size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="Top Event Going"
            value={topAttendedEvents[0]?.going ?? 0}
            topColor={ACCENT_GOLD}
            icon={<Calendar size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
        </StatCardsRow>
        <ChartsGrid isMobile={isMobile}>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Attendance Trend" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {totalEvents === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={eventAttendanceTrend}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} />
                    <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="going"
                      name="Going"
                      stroke={ACCENT_GOLD}
                      strokeWidth={2}
                      dot={{ fill: ACCENT_GOLD, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="RSVP Breakdown" />
            <DonutChart
              data={rsvpBreakdown}
              total={totalRsvps}
              centerLabel={`${totalRsvps}`}
            />
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Event Types" />
            <div style={{ width: "100%", minWidth: 0, height: Math.max(180, eventCategories.length * 36) }}>
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
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Top Attended Events" />
            <TopEventsList events={topAttendedEvents} />
            {topAttendedEvents.length > 0 ? (
              <div style={{ marginTop: "12px" }}>
                <Link
                  to={`${clubBasePath}/events`}
                  style={{ fontSize: "13px", color: ACCENT_RED, textDecoration: "none", fontWeight: 600 }}
                >
                  View all events →
                </Link>
              </div>
            ) : null}
          </div>
        </ChartsGrid>
        <SectionInsightBox insight={eventInsight} />
      </AnalyticsSection>

      <AnalyticsSection title="Tasks" icon={<CheckSquare size={20} aria-hidden />}>
        <StatCardsRow isMobile={isMobile}>
          <StatCard
            label="Total Tasks"
            value={totalTasks}
            topColor="#777777"
            icon={<CheckSquare size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Completion Rate"
            value={`${taskCompletionRate}%`}
            topColor={ACCENT_GOLD}
            valueColor={ACCENT_GOLD}
            icon={<CheckCircle size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="Overdue"
            value={overdueTasks}
            topColor={ACCENT_RED}
            valueColor={overdueTasks > 0 ? ACCENT_RED : "#ffffff"}
            icon={<CheckSquare size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="In Progress"
            value={inProgressTasks}
            topColor={ACCENT_RED}
            icon={<CheckSquare size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
        </StatCardsRow>
        <ChartsGrid isMobile={isMobile}>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Task Status" />
            <DonutChart data={taskBreakdown} total={totalTasks} centerLabel={`${totalTasks}`} />
            {totalTasks > 0 ? (
              <div style={{ marginTop: "8px" }}>
                <Link
                  to={`${clubBasePath}/tasks`}
                  style={{ fontSize: "13px", color: ACCENT_RED, textDecoration: "none", fontWeight: 600 }}
                >
                  View all tasks →
                </Link>
              </div>
            ) : null}
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Completion Rate Over Time" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {totalTasks === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={taskCompletionOverTime}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} />
                    <YAxis domain={[0, 100]} {...chartAxisProps} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name="Completion %"
                      stroke={ACCENT_GOLD}
                      strokeWidth={2}
                      dot={{ fill: ACCENT_GOLD, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Open Tasks by Assignee" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {tasksByAssignee.length === 0 ? (
                <AnalyticsBuildingMessage message="No assigned open tasks" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tasksByAssignee} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fill: MUTED, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill={ACCENT_RED} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </ChartsGrid>
        <SectionInsightBox insight={taskInsight} />
      </AnalyticsSection>

      <AnalyticsSection title="Hiring" icon={<Briefcase size={20} aria-hidden />}>
        <StatCardsRow isMobile={isMobile}>
          <StatCard
            label="Applicants"
            value={totalApplicants}
            topColor={ACCENT_RED}
            icon={<Briefcase size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Open Roles"
            value={openHiringListingsCount}
            topColor="#777777"
            icon={<Briefcase size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="In Interview"
            value={interviewApplicants}
            topColor="#6b7cff"
            icon={<Briefcase size={22} aria-hidden />}
            iconBg="rgba(107, 124, 255, 0.15)"
            iconColor="#6b7cff"
          />
          <StatCard
            label="Accepted"
            value={acceptedApplicants}
            topColor={ACCENT_GOLD}
            valueColor={ACCENT_GOLD}
            icon={<Briefcase size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
        </StatCardsRow>
        <ChartsGrid isMobile={isMobile}>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Applicants by Status" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {totalApplicants === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hiringByStatus}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="name" {...chartAxisProps} />
                    <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {hiringByStatus.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Applicants per Role" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {hiringByRole.length === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hiringByRole} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fill: MUTED, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill={ACCENT_GOLD} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Hiring Funnel" />
            <HiringFunnelVisual stages={hiringFunnel} />
            {totalApplicants > 0 ? (
              <div style={{ marginTop: "12px" }}>
                <Link
                  to={`${clubBasePath}/recruiting`}
                  style={{ fontSize: "13px", color: ACCENT_RED, textDecoration: "none", fontWeight: 600 }}
                >
                  Open recruiting →
                </Link>
              </div>
            ) : null}
          </div>
        </ChartsGrid>
        <SectionInsightBox insight={hiringInsight} />
      </AnalyticsSection>

      <AnalyticsSection title="Announcements" icon={<Megaphone size={20} aria-hidden />}>
        <StatCardsRow isMobile={isMobile}>
          <StatCard
            label="Announcements"
            value={scopedPosts.length}
            topColor="#777777"
            icon={<Megaphone size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Total Views"
            value={totalAnnouncementViews}
            topColor={ACCENT_RED}
            icon={<Eye size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Seen Rate"
            value={`${overallSeenRate}%`}
            topColor={ACCENT_GOLD}
            valueColor={ACCENT_GOLD}
            icon={<Eye size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="Unread Slots"
            value={announcementSeenBreakdown[1]?.value ?? 0}
            topColor="#777777"
            icon={<Megaphone size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
        </StatCardsRow>
        <ChartsGrid isMobile={isMobile}>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Views Over Time" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {scopedPosts.length === 0 ? (
                <AnalyticsBuildingMessage />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={announcementViewsTrend}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} />
                    <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="views"
                      name="Views"
                      stroke={ACCENT_RED}
                      strokeWidth={2}
                      dot={{ fill: ACCENT_RED, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Seen vs Not Seen" />
            <DonutChart
              data={announcementSeenBreakdown}
              total={announcementSeenBreakdown.reduce((sum, row) => sum + row.value, 0)}
            />
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Most Viewed" />
            <MostViewedList posts={mostViewedAnnouncements} />
          </div>
        </ChartsGrid>
        <SectionInsightBox insight={announcementInsight} />
      </AnalyticsSection>

      <AnalyticsSection title="Public Profile" icon={<Globe size={20} aria-hidden />}>
        {lowProfileData ? (
          <div
            style={{
              ...chartCardStyle,
              marginBottom: "16px",
              borderLeft: `3px solid ${MUTED}`,
            }}
          >
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#cccccc" }}>
              Tracking is live, but data is still thin
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: MUTED, lineHeight: 1.6 }}>
              Profile views and clicks are recorded from your public club page. Share the link
              to build a meaningful picture — numbers below reflect real activity only.
            </p>
          </div>
        ) : null}
        <StatCardsRow isMobile={isMobile}>
          <StatCard
            label="Profile Views"
            value={profilePageViews}
            topColor={ACCENT_RED}
            icon={<Globe size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Saved / Followed"
            value={savedClubCount}
            topColor={ACCENT_GOLD}
            valueColor={ACCENT_GOLD}
            icon={<Users size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
          <StatCard
            label="Join Clicks"
            value={profileJoinClicks}
            topColor="#777777"
            icon={<Users size={22} aria-hidden />}
            iconBg="rgba(229, 25, 55, 0.15)"
            iconColor={ACCENT_RED}
          />
          <StatCard
            label="Event Clicks"
            value={profileEventClicks}
            topColor={ACCENT_GOLD}
            icon={<Calendar size={22} aria-hidden />}
            iconBg="rgba(255, 196, 41, 0.15)"
            iconColor={ACCENT_GOLD}
          />
        </StatCardsRow>
        <ChartsGrid isMobile={isMobile}>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Profile Views Over Time" />
            <div style={{ width: "100%", minWidth: 0, height: "200px" }}>
              {profilePageViews === 0 ? (
                <AnalyticsBuildingMessage message="No profile views tracked yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profileViewsTrend}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" {...chartAxisProps} />
                    <YAxis allowDecimals={false} {...chartAxisProps} axisLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="views"
                      name="Views"
                      stroke={ACCENT_RED}
                      strokeWidth={2}
                      dot={{ fill: ACCENT_RED, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div style={chartCardStyle}>
            <ChartCardHeader title="Public Profile Actions" />
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Join clicks / requests", value: profileJoinClicks },
                { label: "Event card clicks", value: profileEventClicks },
                { label: "Hiring post clicks", value: profileHiringClicks },
                { label: "Save clicks", value: countEventsByType(scopedProfileEvents, "save_click") },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "#121212",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#cccccc",
                  }}
                >
                  <span>{row.label}</span>
                  <span style={{ fontWeight: 700, color: "#ffffff" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartsGrid>
        <SectionInsightBox insight={profileInsight} />
      </AnalyticsSection>
    </div>
  );
}
