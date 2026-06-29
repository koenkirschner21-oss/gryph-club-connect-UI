import { isExecutiveAccessLevel } from "./clubPermissions";
import {
  matchesApplicantPipelineFilter,
  type ApplicantPipelineFilter,
} from "./hiringPipelineUtils";

const ACCENT_RED = "#E51937";
const ACCENT_GOLD = "#FFC429";
const MUTED = "#555555";

export interface MemberRow {
  created_at: string;
  role: string;
  access_level?: string | null;
}

export interface TaskRow {
  status: string;
  created_at: string;
  assigned_to?: string | null;
  due_date?: string | null;
}

export interface PostRow {
  id: string;
  title: string;
  created_at: string;
}

export interface PostViewRow {
  post_id: string;
  user_id: string;
  viewed_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  date: string;
  category: string | null;
  visibility?: string | null;
}

export interface RsvpRow {
  status: string;
  event_id: string;
}

export interface HiringApplicationRow {
  id: string;
  listing_id: string;
  status: string;
  sub_status: string | null;
  created_at: string;
}

export interface HiringListingRow {
  id: string;
  title: string;
}

export interface ChartSegment {
  name: string;
  value: number;
  color: string;
}

export interface SectionInsight {
  text: string;
  sentiment: "warning" | "positive" | "neutral";
}

export interface TopAttendedEvent {
  id: string;
  title: string;
  going: number;
  maybe: number;
  notGoing: number;
  total: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  color: string;
}

export interface MostViewedPost {
  id: string;
  title: string;
  views: number;
  seenRate: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function insightSentimentColor(sentiment: SectionInsight["sentiment"]): string {
  if (sentiment === "warning") return ACCENT_RED;
  if (sentiment === "positive") return ACCENT_GOLD;
  return MUTED;
}

export function isExecutiveMember(member: MemberRow): boolean {
  return isExecutiveAccessLevel(
    member.access_level as Parameters<typeof isExecutiveAccessLevel>[0],
    member.role,
  );
}

export function countNewMembersThisMonth(members: MemberRow[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return members.filter((m) => new Date(m.created_at) >= monthStart).length;
}

export function buildMemberGrowth(members: MemberRow[]) {
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
    const count = members.filter((m) => new Date(m.created_at) <= endOfMonth).length;
    points.push({ label: monthLabel(monthDate), count });
  }

  return points;
}

export function toMonthlyNewMembers(points: { label: string; count: number }[]) {
  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1].count : 0;
    return {
      label: point.label,
      count: Math.max(0, point.count - previous),
    };
  });
}

export function buildExecutiveBreakdown(members: MemberRow[]): ChartSegment[] {
  const executives = members.filter(isExecutiveMember).length;
  const general = Math.max(0, members.length - executives);
  return [
    { name: "Executives", value: executives, color: ACCENT_GOLD },
    { name: "General Members", value: general, color: MUTED },
  ];
}

export function buildMemberSectionInsight(members: MemberRow[]): SectionInsight {
  const total = members.length;
  const newThisMonth = countNewMembersThisMonth(members);
  const executives = members.filter(isExecutiveMember).length;

  if (total === 0) {
    return {
      sentiment: "warning",
      text: "No active members yet. Share your invite code to start building the roster.",
    };
  }
  if (newThisMonth === 0) {
    return {
      sentiment: "warning",
      text: `You have ${total} member${total === 1 ? "" : "s"} but none joined this month. Promote your club during peak recruiting weeks.`,
    };
  }
  const execPct = total > 0 ? Math.round((executives / total) * 100) : 0;
  return {
    sentiment: "positive",
    text: `${newThisMonth} new member${newThisMonth === 1 ? "" : "s"} this month. Executives make up ${execPct}% of your ${total}-person roster.`,
  };
}

export function buildEventAttendanceTrend(events: EventRow[], rsvps: RsvpRow[]) {
  const now = new Date();
  const points: { label: string; going: number; total: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const monthEvents = events.filter((event) => {
      const d = new Date(event.date);
      return d >= monthDate && d <= monthEnd;
    });
    const eventIds = new Set(monthEvents.map((event) => event.id));
    const monthRsvps = rsvps.filter((row) => eventIds.has(row.event_id));
    const going = monthRsvps.filter((row) => row.status === "going").length;
    points.push({
      label: monthLabel(monthDate),
      going,
      total: monthRsvps.length,
    });
  }

  return points;
}

export function buildRsvpBreakdown(rsvps: RsvpRow[]): ChartSegment[] {
  const going = rsvps.filter((r) => r.status === "going").length;
  const maybe = rsvps.filter((r) => r.status === "maybe").length;
  const notGoing = rsvps.filter((r) => r.status === "not_going").length;
  return [
    { name: "Going", value: going, color: ACCENT_GOLD },
    { name: "Maybe", value: maybe, color: MUTED },
    { name: "Not Going", value: notGoing, color: ACCENT_RED },
  ];
}

export function buildTopAttendedEvents(
  events: EventRow[],
  rsvps: RsvpRow[],
  limit = 5,
): TopAttendedEvent[] {
  return events
    .map((event) => {
      const eventRsvps = rsvps.filter((row) => row.event_id === event.id);
      const going = eventRsvps.filter((row) => row.status === "going").length;
      const maybe = eventRsvps.filter((row) => row.status === "maybe").length;
      const notGoing = eventRsvps.filter((row) => row.status === "not_going").length;
      return {
        id: event.id,
        title: event.title,
        going,
        maybe,
        notGoing,
        total: going + maybe + notGoing,
      };
    })
    .filter((event) => event.total > 0)
    .sort((a, b) => b.going - a.going || b.total - a.total)
    .slice(0, limit);
}

export function buildEventCategoryBreakdown(
  events: EventRow[],
  labels: Record<string, string>,
  colors: Record<string, string>,
  fallbackColors: string[],
): ChartSegment[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = event.category?.trim() || "general";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, value], index) => ({
      name: labels[key] ?? key,
      value,
      color: colors[key] ?? fallbackColors[index % fallbackColors.length],
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildEventSectionInsight(
  events: EventRow[],
  rsvps: RsvpRow[],
): SectionInsight {
  const totalRsvps = rsvps.length;
  const going = rsvps.filter((row) => row.status === "going").length;
  const top = buildTopAttendedEvents(events, rsvps, 1)[0];

  if (events.length === 0) {
    return {
      sentiment: "neutral",
      text: "No events in this period. Schedule your next meeting or social to track attendance.",
    };
  }
  if (totalRsvps === 0) {
    return {
      sentiment: "warning",
      text: `${events.length} event${events.length === 1 ? "" : "s"} listed but no RSVPs yet. Remind members to respond in the app.`,
    };
  }
  const goingRate = Math.round((going / totalRsvps) * 100);
  if (top) {
    return {
      sentiment: goingRate >= 50 ? "positive" : "warning",
      text: `${goingRate}% of RSVPs are "Going". Top draw: ${top.title} (${top.going} going).`,
    };
  }
  return {
    sentiment: "neutral",
    text: `${goingRate}% of RSVPs are marked as going across ${events.length} events.`,
  };
}

export function buildTaskBreakdown(tasks: TaskRow[]): ChartSegment[] {
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pendingReview = tasks.filter((t) => t.status === "pending_review").length;
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;

  const segments: ChartSegment[] = [
    { name: "To Do", value: todo, color: MUTED },
    { name: "In Progress", value: inProgress, color: ACCENT_RED },
    { name: "Done", value: done, color: ACCENT_GOLD },
  ];
  if (pendingReview > 0) {
    segments.push({ name: "Needs Review", value: pendingReview, color: "#6b7cff" });
  }
  if (cancelled > 0) {
    segments.push({ name: "Cancelled", value: cancelled, color: "#333333" });
  }
  return segments.filter((segment) => segment.value > 0);
}

export function countOverdueTasks(tasks: TaskRow[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tasks.filter((task) => {
    if (!task.due_date) return false;
    if (task.status === "done" || task.status === "cancelled") return false;
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;
}

export function buildTaskCompletionOverTime(tasks: TaskRow[]) {
  const now = new Date();
  const points: { label: string; rate: number; total: number }[] = [];

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
    const relevant = tasks.filter((task) => new Date(task.created_at) <= endOfMonth);
    const done = relevant.filter((task) => task.status === "done").length;
    const rate = relevant.length > 0 ? Math.round((done / relevant.length) * 100) : 0;
    points.push({
      label: monthLabel(monthDate),
      rate,
      total: relevant.length,
    });
  }

  return points;
}

export function buildTasksByAssignee(
  tasks: TaskRow[],
  nameByUserId: Record<string, string>,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "done" || task.status === "cancelled") continue;
    const key = task.assigned_to ?? "unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([userId, count]) => ({
      name:
        userId === "unassigned"
          ? "Unassigned"
          : nameByUserId[userId]?.trim() || "Member",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function buildTaskSectionInsight(tasks: TaskRow[]): SectionInsight {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const overdue = countOverdueTasks(tasks);
  const unassigned = tasks.filter(
    (task) =>
      !task.assigned_to &&
      task.status !== "done" &&
      task.status !== "cancelled",
  ).length;

  if (total === 0) {
    return {
      sentiment: "neutral",
      text: "No tasks tracked in this period. Create assignments to monitor exec workload.",
    };
  }
  const rate = Math.round((done / total) * 100);
  if (overdue > 0) {
    return {
      sentiment: "warning",
      text: `${overdue} overdue task${overdue === 1 ? "" : "s"} and ${rate}% completion overall. Prioritize due dates or reassign blocked work.`,
    };
  }
  if (unassigned > 0) {
    return {
      sentiment: "warning",
      text: `${unassigned} open task${unassigned === 1 ? "" : "s"} have no assignee. ${rate}% of all tasks are complete.`,
    };
  }
  return {
    sentiment: rate >= 60 ? "positive" : "neutral",
    text: `${rate}% completion (${done}/${total}). No overdue tasks in this period.`,
  };
}

function applicantPipelineStage(
  status: string,
  subStatus: string | null,
): ApplicantPipelineFilter {
  if (matchesApplicantPipelineFilter(status, subStatus ?? "submitted", "accepted")) {
    return "accepted";
  }
  if (matchesApplicantPipelineFilter(status, subStatus ?? "submitted", "rejected")) {
    return "rejected";
  }
  if (matchesApplicantPipelineFilter(status, subStatus ?? "submitted", "interview")) {
    return "interview";
  }
  if (matchesApplicantPipelineFilter(status, subStatus ?? "submitted", "reviewed")) {
    return "reviewed";
  }
  return "pending";
}

export function buildHiringByStatus(applications: HiringApplicationRow[]): ChartSegment[] {
  const counts = new Map<string, number>();
  for (const app of applications) {
    const stage = applicantPipelineStage(app.status, app.sub_status);
    const label =
      stage === "pending"
        ? "Applied"
        : stage === "reviewed"
          ? "Reviewed"
          : stage === "interview"
            ? "Interview"
            : stage === "accepted"
              ? "Accepted"
              : "Rejected";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const colorByLabel: Record<string, string> = {
    Applied: MUTED,
    Reviewed: ACCENT_GOLD,
    Interview: "#6b7cff",
    Accepted: ACCENT_GOLD,
    Rejected: ACCENT_RED,
  };

  return Array.from(counts.entries()).map(([name, value]) => ({
    name,
    value,
    color: colorByLabel[name] ?? MUTED,
  }));
}

export function buildHiringByRole(
  applications: HiringApplicationRow[],
  listings: HiringListingRow[],
): { name: string; count: number }[] {
  const titleById = new Map(listings.map((listing) => [listing.id, listing.title]));
  const counts = new Map<string, number>();

  for (const app of applications) {
    const title = titleById.get(app.listing_id) ?? "Unknown role";
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function buildHiringFunnel(applications: HiringApplicationRow[]): FunnelStage[] {
  const stages: FunnelStage[] = [
    { stage: "Applied", count: 0, color: MUTED },
    { stage: "Reviewed", count: 0, color: ACCENT_GOLD },
    { stage: "Interview", count: 0, color: "#6b7cff" },
    { stage: "Accepted", count: 0, color: ACCENT_GOLD },
    { stage: "Rejected", count: 0, color: ACCENT_RED },
  ];

  for (const app of applications) {
    const pipeline = applicantPipelineStage(app.status, app.sub_status);
    if (pipeline === "accepted") stages[3].count += 1;
    else if (pipeline === "rejected") stages[4].count += 1;
    else if (pipeline === "interview") stages[2].count += 1;
    else if (pipeline === "reviewed") stages[1].count += 1;
    else stages[0].count += 1;
  }

  return stages.filter((stage) => stage.count > 0);
}

export function buildHiringSectionInsight(
  applications: HiringApplicationRow[],
  openListings: number,
): SectionInsight {
  const total = applications.length;
  const accepted = applications.filter(
    (app) => applicantPipelineStage(app.status, app.sub_status) === "accepted",
  ).length;
  const interview = applications.filter(
    (app) => applicantPipelineStage(app.status, app.sub_status) === "interview",
  ).length;

  if (total === 0 && openListings === 0) {
    return {
      sentiment: "neutral",
      text: "No hiring activity yet. Post an open role when you're ready to recruit.",
    };
  }
  if (total === 0) {
    return {
      sentiment: "warning",
      text: `${openListings} open role${openListings === 1 ? "" : "s"} but no applications yet. Share your public hiring link.`,
    };
  }
  return {
    sentiment: accepted > 0 ? "positive" : "neutral",
    text: `${total} applicant${total === 1 ? "" : "s"} across open roles — ${interview} in interview, ${accepted} accepted.`,
  };
}

export function buildAnnouncementViewsOverTime(
  views: PostViewRow[],
): { label: string; views: number }[] {
  const now = new Date();
  const points: { label: string; views: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const count = views.filter((view) => {
      const viewedAt = new Date(view.viewed_at);
      return viewedAt >= monthDate && viewedAt <= monthEnd;
    }).length;
    points.push({ label: monthLabel(monthDate), views: count });
  }

  return points;
}

export function computeOverallSeenRate(
  posts: PostRow[],
  views: PostViewRow[],
  activeMemberCount: number,
): number {
  if (posts.length === 0 || activeMemberCount === 0) return 0;
  const possible = posts.length * activeMemberCount;
  const actual = views.length;
  return Math.min(100, Math.round((actual / possible) * 100));
}

export function buildAnnouncementSeenBreakdown(
  posts: PostRow[],
  views: PostViewRow[],
  activeMemberCount: number,
): ChartSegment[] {
  const seen = views.length;
  const possible = posts.length * activeMemberCount;
  const unread = Math.max(0, possible - seen);
  return [
    { name: "Seen", value: seen, color: ACCENT_GOLD },
    { name: "Not seen", value: unread, color: MUTED },
  ];
}

export function buildMostViewedAnnouncements(
  posts: PostRow[],
  views: PostViewRow[],
  activeMemberCount: number,
  limit = 5,
): MostViewedPost[] {
  const viewsByPost = new Map<string, number>();
  for (const view of views) {
    viewsByPost.set(view.post_id, (viewsByPost.get(view.post_id) ?? 0) + 1);
  }

  return posts
    .map((post) => {
      const viewCount = viewsByPost.get(post.id) ?? 0;
      const seenRate =
        activeMemberCount > 0
          ? Math.min(100, Math.round((viewCount / activeMemberCount) * 100))
          : 0;
      return {
        id: post.id,
        title: post.title,
        views: viewCount,
        seenRate,
      };
    })
    .sort((a, b) => b.views - a.views || b.seenRate - a.seenRate)
    .slice(0, limit);
}

export function buildAnnouncementSectionInsight(
  posts: PostRow[],
  views: PostViewRow[],
  activeMemberCount: number,
): SectionInsight {
  const totalViews = views.length;
  const seenRate = computeOverallSeenRate(posts, views, activeMemberCount);
  const zeroViewPosts = posts.filter(
    (post) => !views.some((view) => view.post_id === post.id),
  ).length;

  if (posts.length === 0) {
    return {
      sentiment: "neutral",
      text: "No announcements in this period. Post updates to measure reach.",
    };
  }
  if (totalViews === 0) {
    return {
      sentiment: "warning",
      text: `${posts.length} announcement${posts.length === 1 ? "" : "s"} with no recorded views yet. Ask members to open updates in the app.`,
    };
  }
  if (zeroViewPosts > 0) {
    return {
      sentiment: "warning",
      text: `${seenRate}% overall seen rate across ${activeMemberCount} members. ${zeroViewPosts} post${zeroViewPosts === 1 ? "" : "s"} still have zero views.`,
    };
  }
  return {
    sentiment: seenRate >= 50 ? "positive" : "neutral",
    text: `${totalViews} total view${totalViews === 1 ? "" : "s"} (${seenRate}% seen rate among ${activeMemberCount} active members).`,
  };
}

export function sectionInsightStyle(sentiment: SectionInsight["sentiment"]) {
  return {
    borderLeft: `3px solid ${insightSentimentColor(sentiment)}`,
    background: "#121212",
    borderRadius: "8px",
    padding: "12px 14px",
    fontSize: "13px",
    color: "#cccccc",
    lineHeight: 1.6,
    marginTop: "16px",
  };
}

export function monthKeyFromDate(date: Date): string {
  return monthKey(date);
}
