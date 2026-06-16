import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Image,
  Megaphone,
  UserPlus,
  Users,
} from "lucide-react";
import VisibilityBadge from "../../components/club/VisibilityBadge";
import { useClubMembers } from "../../hooks/useClubMembers";
import {
  clubHasSocialLinks,
  computeClubProfileCompletionPercent,
  getClubProfileMissingLabels,
} from "../../lib/clubProfileCompletion";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { formatTaskDate } from "../../lib/taskDueUrgency";
import LinkedMeetingCancelledLabel from "../../components/tasks/LinkedMeetingCancelledLabel";
import { supabase } from "../../lib/supabaseClient";
import type { Club, ClubEvent, Post, RsvpCounts, Task, TaskStatus } from "../../types";
import Spinner from "../../components/ui/Spinner";

const ACCENT_RED = "#E51937";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

const sectionHeading: CSSProperties = {
  fontWeight: 600,
  fontSize: "16px",
  color: "#ffffff",
  margin: "0 0 16px",
};

const urgentSectionHeading: CSSProperties = {
  ...sectionHeading,
  marginBottom: "11px",
};

const THIS_WEEK_CARD_BG = "#161616";

const actionButtonStyle: CSSProperties = {
  background: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const outlineButtonStyle: CSSProperties = {
  background: "transparent",
  color: "#cccccc",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const textLinkStyle: CSSProperties = {
  color: ACCENT_RED,
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

function formatEventTime12h(timeStr: string): string {
  const t = timeStr.trim();
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

function formatEventDateLine(dateStr: string, timeStr?: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
    ? new Date(`${dateStr.trim()}T12:00:00`)
    : new Date(dateStr);
  const dateLabel = Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const timeLabel =
    timeStr && timeStr.trim() && timeStr.toUpperCase() !== "TBD"
      ? formatEventTime12h(timeStr)
      : null;
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 7);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseTaskDueDate(dateStr: string | undefined): Date | null {
  if (!dateStr?.trim()) return null;
  const trimmed = dateStr.trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  return Number.isNaN(due.getTime()) ? null : due;
}

function taskStatusLabel(status: TaskStatus): string {
  if (status === "cancelled") return "Cancelled";
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "To Do";
}

function taskStatusPillStyle(status: TaskStatus): CSSProperties {
  if (status === "in_progress") {
    return {
      background: "rgba(255, 196, 41, 0.12)",
      color: "#FFC429",
      border: "1px solid rgba(255, 196, 41, 0.35)",
      borderRadius: "999px",
      padding: "2px 8px",
      fontSize: "10px",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }
  if (status === "done") {
    return {
      background: "rgba(74, 222, 128, 0.12)",
      color: "#4ade80",
      border: "1px solid rgba(74, 222, 128, 0.35)",
      borderRadius: "999px",
      padding: "2px 8px",
      fontSize: "10px",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }
  return {
    background: "#1a1a1a",
    color: "#777777",
    border: "1px solid #333333",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "10px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

type ActivityKind = "join" | "rsvp" | "announcement" | "task" | "application";

type ActivityFeedItem = {
  id: string;
  kind: ActivityKind;
  description: string;
  timestamp: string;
  icon: ReactNode;
};

type SuggestedAction = {
  id: string;
  priority: number;
  icon: ReactNode;
  title: string;
  reason: string;
  actionLabel: string;
  onAction: () => void;
};

interface HiringSnapshot {
  openRolesCount: number;
  pendingApplicationsCount: number;
  rolesWithZeroApplicants: number;
  loading: boolean;
}

function ProfileCompletionUrgentCard({
  percent,
  missingLabels,
  onAction,
}: {
  percent: number;
  missingLabels: string[];
  onAction: () => void;
}) {
  return (
    <div
      style={{
        background: "#1a0a0a",
        border: "1px solid #2a2a2a",
        borderTop: "2px solid #FFC429",
        borderRadius: "8px",
        padding: "16px",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: "#FFC429",
          margin: "0 0 6px",
          lineHeight: 1,
        }}
      >
        {percent}%
      </p>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 10px",
        }}
      >
        Profile Completion
      </p>
      {missingLabels.length > 0 ? (
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#999999", lineHeight: 1.4 }}>
          Missing: {missingLabels.join(", ")}
        </p>
      ) : (
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#999999" }}>All setup items complete.</p>
      )}
      {percent < 100 ? (
        <button type="button" onClick={onAction} style={textLinkStyle}>
          Finish Setup →
        </button>
      ) : null}
    </div>
  );
}

function UrgentCountCard({
  title,
  value,
  actionLabel,
  onAction,
}: {
  title: string;
  value: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      style={{
        background: "#1a0a0a",
        border: "1px solid #2a2a2a",
        borderTop: "2px solid #E51937",
        borderRadius: "8px",
        padding: "16px",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontSize: "24px",
          fontWeight: 800,
          color: "#E51937",
          margin: "0 0 6px",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 12px",
        }}
      >
        {title}
      </p>
      <button type="button" onClick={onAction} style={actionButtonStyle}>
        {actionLabel}
      </button>
    </div>
  );
}

function SuggestionCard({
  icon,
  title,
  reason,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  reason: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          background: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#FFC429",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
          {title}
        </p>
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#777777", lineHeight: 1.45 }}>
          {reason}
        </p>
        <button type="button" onClick={onAction} style={actionButtonStyle}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export interface ClubCommandCenterProps {
  club: Club;
  clubId: string;
  tasks: Task[];
  tasksLoading: boolean;
  posts: Post[];
  postsLoading: boolean;
  upcomingOccurrences: (ClubEvent & { occurrenceDate: string })[];
  eventsLoading: boolean;
  eventRsvpCounts: Record<string, RsvpCounts>;
  isMobile: boolean;
  onOpenTask: (task: Task) => void;
}

export default function ClubCommandCenter({
  club,
  clubId,
  tasks,
  tasksLoading,
  posts,
  postsLoading,
  upcomingOccurrences,
  eventsLoading,
  eventRsvpCounts,
  isMobile,
  onOpenTask,
}: ClubCommandCenterProps) {
  const navigate = useNavigate();
  const { pendingMembers, loading: membersLoading } = useClubMembers(clubId);

  const [createOpen, setCreateOpen] = useState(false);
  const [hiringSnapshot, setHiringSnapshot] = useState<HiringSnapshot>({
    openRolesCount: 0,
    pendingApplicationsCount: 0,
    rolesWithZeroApplicants: 0,
    loading: true,
  });
  const [activityItems, setActivityItems] = useState<ActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const basePath = `/app/clubs/${clubId}`;
  const eventsPath = `${basePath}/events`;
  const announcementsPath = `${basePath}/announcements`;
  const tasksPath = `${basePath}/tasks`;
  const membersPath = `${basePath}/members`;
  const recruitingPath = `${basePath}/recruiting`;
  const settingsPath = `${basePath}/settings`;
  const publicProfilePath = `/clubs/${club.slug}`;

  useEffect(() => {
    if (!createOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-create-menu]")) {
        setCreateOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [createOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadHiringSnapshot() {
      setHiringSnapshot((prev) => ({ ...prev, loading: true }));

      const { data: listings, error: listingsError } = await supabase
        .from("hiring_listings")
        .select("id")
        .eq("club_id", clubId)
        .eq("is_open", true);

      if (cancelled) return;

      if (listingsError) {
        console.error("Failed to load hiring listings:", listingsError.message);
        setHiringSnapshot({
          openRolesCount: 0,
          pendingApplicationsCount: 0,
          rolesWithZeroApplicants: 0,
          loading: false,
        });
        return;
      }

      const listingIds = (listings ?? []).map((row) => row.id as string);
      let pendingApplicationsCount = 0;
      let rolesWithZeroApplicants = listingIds.length;

      if (listingIds.length > 0) {
        const { data: applications, error: applicationsError } = await supabase
          .from("hiring_applications")
          .select("listing_id, status")
          .in("listing_id", listingIds);

        if (cancelled) return;

        if (applicationsError) {
          console.error("Failed to load hiring applications:", applicationsError.message);
        } else {
          const countsByListing = new Map<string, number>();
          for (const application of applications ?? []) {
            const listingId = application.listing_id as string;
            countsByListing.set(listingId, (countsByListing.get(listingId) ?? 0) + 1);
            if ((application.status as string) === "pending") {
              pendingApplicationsCount += 1;
            }
          }
          rolesWithZeroApplicants = listingIds.filter(
            (listingId) => (countsByListing.get(listingId) ?? 0) === 0,
          ).length;
        }
      }

      setHiringSnapshot({
        openRolesCount: listingIds.length,
        pendingApplicationsCount,
        rolesWithZeroApplicants,
        loading: false,
      });
    }

    void loadHiringSnapshot();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  useEffect(() => {
    let cancelled = false;

    async function loadActivityFeed() {
      setActivityLoading(true);

      const [
        membersRes,
        clubEventsRes,
        applicationsListingRes,
      ] = await Promise.all([
        supabase
          .from("club_members")
          .select(
            `
            created_at,
            member_profile:profiles!club_members_user_profile_fkey ( full_name )
          `,
          )
          .eq("club_id", clubId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("events").select("id, title").eq("club_id", clubId),
        supabase
          .from("hiring_listings")
          .select("id, title")
          .eq("club_id", clubId),
      ]);

      if (cancelled) return;

      const eventTitleById = new Map(
        (clubEventsRes.data ?? []).map((row) => [row.id as string, (row.title as string) ?? "Event"]),
      );
      const eventIds = Array.from(eventTitleById.keys());

      const listingTitleById = new Map(
        (applicationsListingRes.data ?? []).map((row) => [
          row.id as string,
          (row.title as string) ?? "Role",
        ]),
      );
      const listingIds = Array.from(listingTitleById.keys());

      const [rsvpsRes, applicationsRes] = await Promise.all([
        eventIds.length
          ? supabase
              .from("event_rsvps")
              .select("created_at, user_id, event_id")
              .in("event_id", eventIds)
              .order("created_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
        listingIds.length
          ? supabase
              .from("hiring_applications")
              .select("created_at, applicant_id, listing_id")
              .in("listing_id", listingIds)
              .order("created_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const profileIds = new Set<string>();
      for (const row of rsvpsRes.data ?? []) {
        profileIds.add(row.user_id as string);
      }
      for (const row of applicationsRes.data ?? []) {
        profileIds.add(row.applicant_id as string);
      }

      const profilesRes =
        profileIds.size > 0
          ? await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", Array.from(profileIds))
          : { data: [], error: null };

      if (cancelled) return;

      const profileNameById = new Map(
        (profilesRes.data ?? []).map((row) => [
          row.id as string,
          ((row.full_name as string | null) ?? "Someone").trim(),
        ]),
      );

      const feed: ActivityFeedItem[] = [];

      for (const row of membersRes.data ?? []) {
        const profileRaw = row.member_profile;
        const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
        const name = ((profile as { full_name?: string } | null)?.full_name ?? "Someone").trim();
        feed.push({
          id: `join-${row.created_at as string}-${name}`,
          kind: "join",
          description: `${name} joined the club`,
          timestamp: row.created_at as string,
          icon: <UserPlus size={14} aria-hidden />,
        });
      }

      for (const row of rsvpsRes.data ?? []) {
        const name = profileNameById.get(row.user_id as string) ?? "Someone";
        const eventTitle = eventTitleById.get(row.event_id as string) ?? "an event";
        feed.push({
          id: `rsvp-${row.created_at as string}-${row.user_id as string}`,
          kind: "rsvp",
          description: `${name} RSVP'd to ${eventTitle}`,
          timestamp: row.created_at as string,
          icon: <Calendar size={14} aria-hidden />,
        });
      }

      for (const post of posts.slice(0, 5)) {
        feed.push({
          id: `announcement-${post.id}`,
          kind: "announcement",
          description: `${post.authorName ?? "Someone"} posted an announcement`,
          timestamp: post.createdAt,
          icon: <Megaphone size={14} aria-hidden />,
        });
      }

      for (const task of tasks.filter((item) => item.status === "done").slice(0, 5)) {
        feed.push({
          id: `task-${task.id}`,
          kind: "task",
          description: `Task completed: ${task.title}`,
          timestamp: task.createdAt,
          icon: <CheckSquare size={14} aria-hidden />,
        });
      }

      for (const row of applicationsRes.data ?? []) {
        const name = profileNameById.get(row.applicant_id as string) ?? "Someone";
        const roleTitle = listingTitleById.get(row.listing_id as string) ?? "a role";
        feed.push({
          id: `application-${row.created_at as string}-${row.applicant_id as string}`,
          kind: "application",
          description: `${name} applied for ${roleTitle}`,
          timestamp: row.created_at as string,
          icon: <Briefcase size={14} aria-hidden />,
        });
      }

      feed.sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );

      setActivityItems(feed.slice(0, 8));
      setActivityLoading(false);
    }

    void loadActivityFeed();
    return () => {
      cancelled = true;
    };
  }, [clubId, posts, tasks]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekEnd = useMemo(() => endOfWeek(new Date()), []);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.status !== "cancelled"),
    [tasks],
  );

  const tasksDueThisWeek = useMemo(
    () =>
      openTasks.filter((task) => {
        const due = parseTaskDueDate(task.dueDate);
        if (!due) return false;
        return due.getTime() >= today.getTime() && due.getTime() <= weekEnd.getTime();
      }),
    [openTasks, today, weekEnd],
  );

  const eventsThisWeek = useMemo(() => {
    const startYmd = today.toISOString().slice(0, 10);
    const endYmd = weekEnd.toISOString().slice(0, 10);
    return upcomingOccurrences.filter(
      (event) => event.occurrenceDate >= startYmd && event.occurrenceDate <= endYmd,
    );
  }, [upcomingOccurrences, today, weekEnd]);

  const previewUpcomingEvents = useMemo(() => {
    const seen = new Set<string>();
    const deduped: typeof upcomingOccurrences = [];
    for (const event of upcomingOccurrences) {
      const key = event.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(event);
      if (deduped.length >= 3) break;
    }
    return deduped;
  }, [upcomingOccurrences]);

  const profileCompletion = useMemo(
    () => computeClubProfileCompletionPercent(club, posts.length > 0, upcomingOccurrences.length > 0),
    [club, posts.length, upcomingOccurrences.length],
  );

  const profileMissingLabels = useMemo(
    () => getClubProfileMissingLabels(club, posts.length > 0, upcomingOccurrences.length > 0),
    [club, posts.length, upcomingOccurrences.length],
  );

  const pendingJoinCount = pendingMembers.length;
  const pendingApplicationCount = hiringSnapshot.pendingApplicationsCount;

  const suggestedActions = useMemo(() => {
    const actions: SuggestedAction[] = [];
    const profileActionIds = new Set(["logo", "banner", "contact-email", "social-links"]);

    if (profileCompletion < 100) {
      if (!club.logoUrl?.trim()) {
        actions.push({
          id: "logo",
          priority: 1,
          icon: <Image size={18} aria-hidden />,
          title: "Add a club logo",
          reason: "Clubs with logos look more credible on Explore and public profiles.",
          actionLabel: "Go to Settings",
          onAction: () => navigate(`${settingsPath}?section=branding`),
        });
      }

      if (!club.bannerUrl?.trim()) {
        actions.push({
          id: "banner",
          priority: 2,
          icon: <Image size={18} aria-hidden />,
          title: "Add a banner image",
          reason: "A banner helps your public profile stand out to prospective members.",
          actionLabel: "Go to Settings",
          onAction: () => navigate(`${settingsPath}?section=branding`),
        });
      }

      if (!club.contactEmail?.trim()) {
        actions.push({
          id: "contact-email",
          priority: 3,
          icon: <Megaphone size={18} aria-hidden />,
          title: "Add contact email",
          reason: "Prospective members need a way to reach your club leadership.",
          actionLabel: "Go to Settings",
          onAction: () => navigate(`${settingsPath}?section=profile`),
        });
      }

      if (!clubHasSocialLinks(club.socialLinks)) {
        actions.push({
          id: "social-links",
          priority: 4,
          icon: <Users size={18} aria-hidden />,
          title: "Add social links",
          reason: "Link your Instagram, website, or other channels on your public profile.",
          actionLabel: "Go to Settings",
          onAction: () => navigate(`${settingsPath}?section=social`),
        });
      }
    }

    if (pendingJoinCount > 0) {
      actions.push({
        id: "review-join",
        priority: 10,
        icon: <Users size={18} aria-hidden />,
        title: "Review join requests",
        reason: `${pendingJoinCount} student${pendingJoinCount === 1 ? "" : "s"} waiting for approval.`,
        actionLabel: "Review Requests",
        onAction: () => navigate(`${membersPath}?tab=pending`),
      });
    }

    if (pendingApplicationCount > 0) {
      actions.push({
        id: "review-applications",
        priority: 11,
        icon: <ClipboardList size={18} aria-hidden />,
        title: "Review applications",
        reason: `${pendingApplicationCount} hiring application${pendingApplicationCount === 1 ? "" : "s"} need review.`,
        actionLabel: "Review Applications",
        onAction: () => navigate(`${recruitingPath}?tab=applications`),
      });
    }

    const eventInThreeDays = upcomingOccurrences.find((event) => {
      const eventDate = startOfDay(new Date(`${event.occurrenceDate}T12:00:00`));
      const diffDays = Math.round(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return diffDays >= 0 && diffDays <= 3;
    });

    if (eventInThreeDays) {
      actions.push({
        id: "event-reminder",
        priority: 12,
        icon: <Megaphone size={18} aria-hidden />,
        title: "Post an event reminder",
        reason: `${eventInThreeDays.title} is coming up on ${formatEventDateLine(eventInThreeDays.occurrenceDate, eventInThreeDays.time)}.`,
        actionLabel: "Use Reminder Template",
        onAction: () => navigate(`${announcementsPath}?openTemplate=true`),
      });
    }

    if (upcomingOccurrences.length === 0) {
      actions.push({
        id: "first-event",
        priority: 13,
        icon: <Calendar size={18} aria-hidden />,
        title: "Create your first event",
        reason: "No upcoming events are scheduled for your club yet.",
        actionLabel: "Create Event",
        onAction: () => navigate(`${eventsPath}?openCreate=true`),
      });
    }

    const latestPost = posts[0];
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const announcementStale =
      !latestPost || new Date(latestPost.createdAt).getTime() < fourteenDaysAgo;

    if (announcementStale) {
      actions.push({
        id: "club-update",
        priority: 14,
        icon: <Megaphone size={18} aria-hidden />,
        title: "Post a club update",
        reason: latestPost
          ? "It has been more than 14 days since your last announcement."
          : "Keep members informed with a welcome or weekly update.",
        actionLabel: "Post Announcement",
        onAction: () => navigate(`${announcementsPath}?openCreate=true`),
      });
    }

    if (hiringSnapshot.rolesWithZeroApplicants > 0) {
      actions.push({
        id: "promote-role",
        priority: 15,
        icon: <Briefcase size={18} aria-hidden />,
        title: "Promote your open role",
        reason: `${hiringSnapshot.rolesWithZeroApplicants} open role${hiringSnapshot.rolesWithZeroApplicants === 1 ? "" : "s"} ha${hiringSnapshot.rolesWithZeroApplicants === 1 ? "s" : "ve"} no applicants yet.`,
        actionLabel: "View Hiring",
        onAction: () => navigate(recruitingPath),
      });
    }

    const sorted = actions.sort((left, right) => left.priority - right.priority);
    let result = sorted.slice(0, 4);

    if (
      profileCompletion < 100 &&
      !result.some((action) => profileActionIds.has(action.id))
    ) {
      const firstProfileAction = sorted.find((action) => profileActionIds.has(action.id));
      if (firstProfileAction) {
        result = [
          firstProfileAction,
          ...result.filter((action) => action.id !== firstProfileAction.id),
        ].slice(0, 4);
      }
    }

    return result;
  }, [
    profileCompletion,
    pendingJoinCount,
    pendingApplicationCount,
    upcomingOccurrences,
    today,
    posts,
    club.logoUrl,
    club.bannerUrl,
    club.contactEmail,
    club.socialLinks,
    hiringSnapshot.rolesWithZeroApplicants,
    navigate,
    membersPath,
    recruitingPath,
    announcementsPath,
    eventsPath,
    settingsPath,
  ]);

  const createOptions = [
    { label: "Event", onClick: () => navigate(`${eventsPath}?openCreate=true`) },
    { label: "Announcement", onClick: () => navigate(`${announcementsPath}?openCreate=true`) },
    { label: "Task", onClick: () => navigate(`${tasksPath}?openCreate=true`) },
    { label: "Hiring Role", onClick: () => navigate(`${recruitingPath}?openCreate=true`) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "24px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Club Command Center
          </h1>
          <p style={{ fontSize: "14px", color: "#777777", margin: "6px 0 0" }}>
            Here&apos;s what needs attention across your club.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            <Link to={publicProfilePath} target="_blank" rel="noopener noreferrer" style={textLinkStyle}>
              View Public Profile
            </Link>
            <span style={{ color: "#555555" }}>·</span>
            <Link to={settingsPath} style={textLinkStyle}>
              Manage Settings
            </Link>
          </div>
        </div>

        <div style={{ position: "relative" }} data-create-menu>
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            style={{
              ...actionButtonStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              fontSize: "13px",
            }}
          >
            Create
            <ChevronDown size={16} aria-hidden />
          </button>
          {createOpen ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                minWidth: "180px",
                background: "#151515",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: "8px",
                overflow: "hidden",
                zIndex: 20,
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              {createOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    option.onClick();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    color: "#cccccc",
                    padding: "10px 14px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <section style={{ marginBottom: "22px", paddingBottom: 0 }}>
        <h2 style={urgentSectionHeading}>Urgent Attention</h2>
        {tasksLoading || membersLoading || hiringSnapshot.loading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading urgent items…" />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
              gap: "16px",
            }}
          >
            <ProfileCompletionUrgentCard
              percent={profileCompletion}
              missingLabels={profileMissingLabels}
              onAction={() => navigate(`${settingsPath}?section=profile`)}
            />
            <UrgentCountCard
              title="Pending Requests"
              value={String(pendingJoinCount)}
              actionLabel="Review Requests"
              onAction={() => navigate(`${membersPath}?tab=pending`)}
            />
            <UrgentCountCard
              title="Tasks Due This Week"
              value={String(tasksDueThisWeek.length)}
              actionLabel="View Tasks"
              onAction={() => navigate(tasksPath)}
            />
            <UrgentCountCard
              title="Pending Applications"
              value={String(pendingApplicationCount)}
              actionLabel="Review Applications"
              onAction={() => navigate(`${recruitingPath}?tab=applications`)}
            />
          </div>
        )}
      </section>

      <section>
        <h2 style={sectionHeading}>This Week</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "16px",
          }}
        >
          <div
            style={{
              background: THIS_WEEK_CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "10px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
              Events This Week
            </p>
            {eventsLoading ? (
              <Spinner label="Loading events…" />
            ) : eventsThisWeek.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>No events this week.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {eventsThisWeek.slice(0, 4).map((event) => (
                  <div
                    key={`${event.id}-${event.occurrenceDate}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      borderTop: `1px solid ${CARD_BORDER}`,
                      paddingTop: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                        {event.title}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
                        {formatEventDateLine(event.occurrenceDate, event.time)} ·{" "}
                        {eventRsvpCounts[event.id]?.going ?? 0} RSVPs
                      </p>
                    </div>
                    <button
                      type="button"
                      style={outlineButtonStyle}
                      onClick={() => navigate(`${eventsPath}?manageEvent=${event.id}`)}
                    >
                      Manage Event
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              background: THIS_WEEK_CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "10px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
              Tasks Due This Week
            </p>
            {tasksLoading ? (
              <Spinner label="Loading tasks…" />
            ) : tasksDueThisWeek.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>No tasks due this week.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {tasksDueThisWeek.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenTask(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenTask(task);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      borderTop: `1px solid ${CARD_BORDER}`,
                      paddingTop: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                        {task.title}
                      </p>
                      <LinkedMeetingCancelledLabel task={task} />
                      <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
                        {task.assigneeName ?? "Unassigned"} ·{" "}
                        {task.dueDate ? formatTaskDate(task.dueDate) : "No due date"}
                      </p>
                    </div>
                    <span style={taskStatusPillStyle(task.status)}>
                      {taskStatusLabel(task.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              flex: "1 1 220px",
              background: THIS_WEEK_CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>
              Pending join requests: <strong style={{ color: "#ffffff" }}>{pendingJoinCount}</strong>
            </p>
            <button type="button" style={outlineButtonStyle} onClick={() => navigate(`${membersPath}?tab=pending`)}>
              Review Requests
            </button>
          </div>
          <div
            style={{
              flex: "1 1 220px",
              background: THIS_WEEK_CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>
              Pending applications:{" "}
              <strong style={{ color: "#ffffff" }}>{pendingApplicationCount}</strong>
            </p>
            <button type="button" style={outlineButtonStyle} onClick={() => navigate(`${recruitingPath}?tab=applications`)}>
              Review Applications
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 style={sectionHeading}>Suggested Next Actions</h2>
        {hiringSnapshot.loading && postsLoading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading suggestions…" />
          </div>
        ) : suggestedActions.length === 0 ? (
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
            No suggestions right now — your club looks healthy.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            {suggestedActions.map((action) => (
              <SuggestionCard key={action.id} {...action} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={sectionHeading}>Upcoming Events + RSVP Snapshot</h2>
        {eventsLoading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading upcoming events…" />
          </div>
        ) : previewUpcomingEvents.length === 0 ? (
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>No upcoming events scheduled.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {previewUpcomingEvents.map((event) => (
              <div
                key={`${event.id}-${event.occurrenceDate}`}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "10px",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                      {event.title}
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#999999" }}>
                      {formatEventDateLine(event.occurrenceDate, event.time)} ·{" "}
                      {eventRsvpCounts[event.id]?.going ?? 0} RSVPs
                    </p>
                    <VisibilityBadge visibility={event.visibility ?? "public"} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button
                      type="button"
                      style={outlineButtonStyle}
                      onClick={() => navigate(`${eventsPath}?manageEvent=${event.id}`)}
                    >
                      Manage Event
                    </button>
                    <button
                      type="button"
                      style={actionButtonStyle}
                      onClick={() => navigate(`${eventsPath}?viewRsvps=${event.id}`)}
                    >
                      View RSVPs
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={sectionHeading}>Hiring Snapshot</h2>
        {hiringSnapshot.loading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading hiring snapshot…" />
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "10px", padding: "16px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#777777" }}>Open roles</p>
                <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#ffffff" }}>
                  {hiringSnapshot.openRolesCount}
                </p>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "10px", padding: "16px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#777777" }}>Pending applications</p>
                <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#ffffff" }}>
                  {hiringSnapshot.pendingApplicationsCount}
                </p>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: "10px", padding: "16px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#777777" }}>Roles with 0 applicants</p>
                <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#ffffff" }}>
                  {hiringSnapshot.rolesWithZeroApplicants}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button type="button" style={outlineButtonStyle} onClick={() => navigate(recruitingPath)}>
                View Hiring
              </button>
              <button type="button" style={actionButtonStyle} onClick={() => navigate(`${recruitingPath}?openCreate=true`)}>
                Create Role
              </button>
            </div>
          </>
        )}
      </section>

      <section>
        <h2 style={sectionHeading}>Recent Club Activity</h2>
        {activityLoading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading activity…" />
          </div>
        ) : activityItems.length === 0 ? (
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>No recent activity yet.</p>
        ) : (
          <div
            style={{
              background: CARD_BG,
              border: "none",
              borderRadius: 0,
              overflow: "hidden",
            }}
          >
            {activityItems.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 0",
                  borderBottom:
                    index < activityItems.length - 1 ? "1px solid #1a1a1a" : "none",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "#1a1a1a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFC429",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>{item.description}</p>
                </div>
                <span style={{ fontSize: "11px", color: "#555555", whiteSpace: "nowrap" }}>
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
