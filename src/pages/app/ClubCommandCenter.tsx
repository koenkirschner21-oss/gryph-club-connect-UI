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
  ClipboardList,
  Image,
  Megaphone,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import CreateMenuDropdown from "../../components/club/CreateMenuDropdown";
import NeedsReviewSection from "../../components/dashboard/NeedsReviewSection";
import { isTaskAwaitingReviewFromUser } from "../../lib/taskCompletion";
import { useClubMembers } from "../../hooks/useClubMembers";
import {
  buildClubSettingsSectionPath,
  clubHasSocialLinks,
  computeClubProfileCompletionPercent,
  getClubProfileMissingLabels,
  resolveClubSetupSettingsPath,
} from "../../lib/clubProfileCompletion";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { formatTaskDate } from "../../lib/taskDueUrgency";
import {
  deduplicateMonthlyEventsByTitle,
  deduplicateUpcomingEventsByTitle,
  type EventRecurringMeta,
} from "../../lib/eventRecurrence";
import LinkedMeetingCancelledLabel from "../../components/tasks/LinkedMeetingCancelledLabel";
import { supabase } from "../../lib/supabaseClient";
import type { Club, ClubEvent, Post, RsvpCounts, Task, TaskStatus } from "../../types";
import Spinner from "../../components/ui/Spinner";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

const urgentOutlinedButtonStyle: CSSProperties = {
  background: "transparent",
  color: ACCENT_RED,
  border: `1px solid ${ACCENT_RED}`,
  borderRadius: "6px",
  padding: "6px 14px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const sectionHeading: CSSProperties = {
  fontWeight: 600,
  fontSize: "16px",
  color: "#ffffff",
  margin: "0 0 16px",
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

function isHiddenLocation(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const upper = trimmed.toUpperCase();
  return upper === "TBD" || upper === "LOCATION TBD";
}

function eventDateBadgeParts(dateStr: string): { month: string; day: string } {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
    ? new Date(`${dateStr.trim()}T12:00:00`)
    : new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return { month: "---", day: "?" };
  }
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function formatEventDetailLine(
  dateStr: string,
  timeStr?: string,
  location?: string,
): string {
  const dateLabel = formatEventDateLine(dateStr, timeStr);
  const locationLabel =
    location && !isHiddenLocation(location) ? location.trim() : null;
  return locationLabel ? `${dateLabel} · ${locationLabel}` : dateLabel;
}

function EventDateBadge({ dateStr }: { dateStr: string }) {
  const { month, day } = eventDateBadgeParts(dateStr);

  return (
    <div
      style={{
        width: "48px",
        height: "52px",
        borderRadius: "8px",
        background: ACCENT_RED,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#ffffff",
        lineHeight: 1.1,
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 600 }}>{month}</span>
      <span style={{ fontSize: "18px", fontWeight: 700 }}>{day}</span>
    </div>
  );
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

const GOLD_OUTLINED_BUTTON_STYLE: CSSProperties = {
  ...urgentOutlinedButtonStyle,
  color: GOLD,
  border: `1px solid ${GOLD}`,
};

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
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderTop: `2px solid ${GOLD}`,
        borderRadius: "8px",
        padding: "16px",
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <p
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: "#ffffff",
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
          margin: "0 0 8px",
        }}
      >
        Profile Completion
      </p>
      {missingLabels.length > 0 ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "12px",
            color: "#999999",
            lineHeight: 1.45,
            flex: 1,
          }}
        >
          Missing: {missingLabels.join(", ")}
        </p>
      ) : (
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#999999", flex: 1 }}>
          All setup items complete.
        </p>
      )}
      <button type="button" onClick={onAction} style={GOLD_OUTLINED_BUTTON_STYLE}>
        Complete Setup
      </button>
    </div>
  );
}

function UrgentCountCard({
  title,
  value,
  actionLabel,
  onAction,
  sublabel,
}: {
  title: string;
  value: string;
  actionLabel: string;
  onAction: () => void;
  sublabel?: string;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderTop: "2px solid #E51937",
        borderRadius: "8px",
        padding: "16px",
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <p
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: "#ffffff",
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
      {sublabel ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "12px",
            color: "#999999",
            lineHeight: 1.45,
            flex: 1,
          }}
        >
          {sublabel}
        </p>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <button type="button" onClick={onAction} style={{ ...urgentOutlinedButtonStyle, marginTop: "auto" }}>
        {actionLabel}
      </button>
    </div>
  );
}

function NextMeetingUrgentCard({
  display,
  onAction,
}: {
  display: {
    scheduled: boolean;
    dateLine: string;
    weekdayTimeLine: string;
    locationLine: string;
  };
  onAction: () => void;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderTop: "2px solid #E51937",
        borderRadius: "8px",
        padding: "16px",
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <p
        style={{
          fontSize: display.scheduled ? "22px" : "16px",
          fontWeight: 800,
          color: display.scheduled ? "#ffffff" : "#777777",
          fontStyle: display.scheduled ? undefined : "italic",
          margin: "0 0 6px",
          lineHeight: 1.15,
        }}
      >
        {display.dateLine}
      </p>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 8px",
        }}
      >
        Next Meeting
      </p>
      {display.weekdayTimeLine || display.locationLine ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "12px",
            color: "#999999",
            lineHeight: 1.45,
            flex: 1,
          }}
        >
          {[display.weekdayTimeLine, display.locationLine].filter(Boolean).join(" · ")}
        </p>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <button type="button" onClick={onAction} style={{ ...urgentOutlinedButtonStyle, marginTop: "auto" }}>
        View Events
      </button>
    </div>
  );
}

function RequestsApplicationsUrgentCard({
  joinCount,
  applicationCount,
  onReviewRequests,
  onReviewApplications,
}: {
  joinCount: number;
  applicationCount: number;
  onReviewRequests: () => void;
  onReviewApplications: () => void;
}) {
  const total = joinCount + applicationCount;

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderTop: "2px solid #E51937",
        borderRadius: "8px",
        padding: "16px",
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <p
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: "#ffffff",
          margin: "0 0 6px",
          lineHeight: 1,
        }}
      >
        {total}
      </p>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 8px",
        }}
      >
        Requests &amp; Applications
      </p>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: "12px",
          color: "#999999",
          lineHeight: 1.45,
          flex: 1,
        }}
      >
        {joinCount} join request{joinCount === 1 ? "" : "s"} · {applicationCount} application
        {applicationCount === 1 ? "" : "s"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto" }}>
        <button type="button" onClick={onReviewRequests} style={urgentOutlinedButtonStyle}>
          Review Requests
        </button>
        <button type="button" onClick={onReviewApplications} style={urgentOutlinedButtonStyle}>
          Review Applications
        </button>
      </div>
    </div>
  );
}

function ThisWeekPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: THIS_WEEK_CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "10px",
        padding: "16px",
        minHeight: "180px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
        {title}
      </p>
      <div style={{ flex: 1 }}>{children}</div>
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
        padding: "14px",
        marginBottom: "10px",
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ color: ACCENT_RED, flexShrink: 0, marginTop: "2px" }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            {title}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#777777", lineHeight: 1.45 }}>
            {reason}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        style={{
          ...actionButtonStyle,
          width: "100%",
          padding: "8px 14px",
        }}
      >
        {actionLabel}
      </button>
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
  eventRecurring: Record<string, EventRecurringMeta>;
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
  eventRecurring,
  isMobile,
  onOpenTask,
}: ClubCommandCenterProps) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { pendingMembers, loading: membersLoading } = useClubMembers(clubId);

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
  const setupSettingsPath = resolveClubSetupSettingsPath(settingsPath, club);

  const openSetupSettings = () => navigate(setupSettingsPath);

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
          icon: <UserPlus size={14} color="#555555" aria-hidden />,
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
          icon: <Calendar size={14} color="#555555" aria-hidden />,
        });
      }

      for (const post of posts.slice(0, 5)) {
        feed.push({
          id: `announcement-${post.id}`,
          kind: "announcement",
          description: `${post.authorName ?? "Someone"} posted an announcement`,
          timestamp: post.createdAt,
          icon: <Megaphone size={14} color="#555555" aria-hidden />,
        });
      }

      for (const task of tasks.filter((item) => item.status === "done").slice(0, 5)) {
        feed.push({
          id: `task-${task.id}`,
          kind: "task",
          description: `Task completed: ${task.title}`,
          timestamp: task.createdAt,
          icon: <CheckSquare size={14} color="#555555" aria-hidden />,
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
          icon: <Briefcase size={14} color="#555555" aria-hidden />,
        });
      }

      feed.sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      );

      setActivityItems(feed.slice(0, 5));
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

  const eventsThisWeekDisplay = useMemo(
    () => deduplicateMonthlyEventsByTitle(eventsThisWeek, eventRecurring),
    [eventsThisWeek, eventRecurring],
  );

  const eventsThisMonthCount = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const startYmd = startOfMonth.toISOString().slice(0, 10);
    const endYmd = endOfMonth.toISOString().slice(0, 10);

    const eventsThisMonth = upcomingOccurrences.filter(
      (event) => event.occurrenceDate >= startYmd && event.occurrenceDate <= endYmd,
    );
    return deduplicateMonthlyEventsByTitle(eventsThisMonth, eventRecurring).length;
  }, [upcomingOccurrences, eventRecurring]);

  const previewUpcomingEvents = useMemo(() => {
    const sorted = [...upcomingOccurrences].sort((left, right) =>
      left.occurrenceDate.localeCompare(right.occurrenceDate),
    );
    return deduplicateUpcomingEventsByTitle(sorted, 3);
  }, [upcomingOccurrences]);

  const nextMeetingDisplay = useMemo(() => {
    const scheduleText = club.meetingSchedule?.trim() ?? "";
    const recurringOccurrences = upcomingOccurrences.filter((event) => {
      const meta = eventRecurring[event.id];
      return meta?.isRecurring && meta.frequency;
    });
    const weeklyFirst = recurringOccurrences.find((event) => {
      const meta = eventRecurring[event.id];
      return meta?.frequency === "weekly";
    });
    const nextRecurring = weeklyFirst ?? recurringOccurrences[0];

    if (nextRecurring) {
      const d = new Date(`${nextRecurring.occurrenceDate}T12:00:00`);
      const value = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
      const timeLabel =
        nextRecurring.time &&
        nextRecurring.time.trim() !== "" &&
        nextRecurring.time.toUpperCase() !== "TBD"
          ? formatEventTime12h(nextRecurring.time)
          : "";
      const locationLabel =
        nextRecurring.location && !isHiddenLocation(nextRecurring.location)
          ? nextRecurring.location.trim()
          : "";
      const weekdayTimeLine = [weekday, timeLabel].filter(Boolean).join(" · ");
      return {
        scheduled: true,
        dateLine: value,
        weekdayTimeLine,
        locationLine: locationLabel,
      };
    }

    if (scheduleText) {
      return {
        scheduled: true,
        dateLine: scheduleText,
        weekdayTimeLine: "",
        locationLine:
          club.location && !isHiddenLocation(club.location)
            ? club.location.trim()
            : "",
      };
    }

    return {
      scheduled: false,
      dateLine: "No meetings scheduled",
      weekdayTimeLine: "",
      locationLine: "",
    };
  }, [club, upcomingOccurrences, eventRecurring]);

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
  const setupComplete = profileCompletion >= 100;

  const needsReviewTasks = useMemo(() => {
    if (!user?.id) return [];
    return tasks.filter((task) => isTaskAwaitingReviewFromUser(task, user.id));
  }, [tasks, user?.id]);

  const overdueTasks = useMemo(
    () =>
      openTasks.filter((task) => {
        const due = parseTaskDueDate(task.dueDate);
        return due != null && due.getTime() < today.getTime();
      }),
    [openTasks, today],
  );

  const needsAttentionItems = useMemo(() => {
    const items: {
      id: string;
      label: string;
      actionLabel?: string;
      onAction?: () => void;
    }[] = [];

    if (pendingJoinCount > 0) {
      items.push({
        id: "join-requests",
        label: `${pendingJoinCount} pending join request${pendingJoinCount === 1 ? "" : "s"}`,
        actionLabel: "Review",
        onAction: () => navigate(`${membersPath}?tab=pending`),
      });
    }

    if (pendingApplicationCount > 0) {
      items.push({
        id: "applications",
        label: `${pendingApplicationCount} pending application${pendingApplicationCount === 1 ? "" : "s"}`,
        actionLabel: "Review",
        onAction: () => navigate(`${recruitingPath}?tab=applications`),
      });
    }

    if (profileCompletion < 100) {
      items.push({
        id: "profile-setup",
        label:
          profileMissingLabels.length > 0
            ? `Profile ${profileCompletion}% complete — missing ${profileMissingLabels.join(", ")}`
            : `Profile ${profileCompletion}% complete`,
        actionLabel: "Complete Setup",
        onAction: openSetupSettings,
      });
    }

    if (overdueTasks.length > 0) {
      items.push({
        id: "overdue-tasks",
        label: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
        actionLabel: "View Tasks",
        onAction: () => navigate(tasksPath),
      });
    }

    for (const event of previewUpcomingEvents) {
      const going = eventRsvpCounts[event.id]?.going ?? 0;
      const eventDate = startOfDay(new Date(`${event.occurrenceDate}T12:00:00`));
      const daysUntil = Math.round(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil >= 0 && daysUntil <= 14 && going < 5) {
        items.push({
          id: `low-rsvp-${event.id}`,
          label: `Low RSVPs for ${event.title} (${going} going)`,
          actionLabel: "View RSVPs",
          onAction: () => navigate(`${eventsPath}?viewRsvps=${event.id}`),
        });
      }
    }

    return items.slice(0, 6);
  }, [
    pendingJoinCount,
    pendingApplicationCount,
    profileCompletion,
    profileMissingLabels,
    overdueTasks.length,
    previewUpcomingEvents,
    eventRsvpCounts,
    today,
    navigate,
    membersPath,
    recruitingPath,
    tasksPath,
    eventsPath,
    openSetupSettings,
  ]);

  const suggestedActions = useMemo(() => {
    const actions: SuggestedAction[] = [];
    const profileActionIds = new Set([
      "logo",
      "banner",
      "contact-email",
      "social-links",
      "short-description",
      "meeting-schedule",
      "complete-profile",
    ]);

    if (profileCompletion < 100) {
      if (!club.logoUrl?.trim()) {
        actions.push({
          id: "logo",
          priority: 1,
          icon: <Image size={20} aria-hidden />,
          title: "Add a club logo",
          reason: "Clubs with logos look more credible on Explore and public profiles.",
          actionLabel: "Complete Setup",
          onAction: () =>
            navigate(buildClubSettingsSectionPath(clubId, "branding")),
        });
      }

      if (!club.bannerUrl?.trim()) {
        actions.push({
          id: "banner",
          priority: 2,
          icon: <Image size={20} aria-hidden />,
          title: "Add a banner image",
          reason: "A banner helps your public profile stand out to prospective members.",
          actionLabel: "Complete Setup",
          onAction: () =>
            navigate(buildClubSettingsSectionPath(clubId, "branding")),
        });
      }

      if (!club.contactEmail?.trim()) {
        actions.push({
          id: "contact-email",
          priority: 3,
          icon: <Megaphone size={20} aria-hidden />,
          title: "Add contact email",
          reason: "Prospective members need a way to reach your club leadership.",
          actionLabel: "Complete Setup",
          onAction: () =>
            navigate(buildClubSettingsSectionPath(clubId, "profile")),
        });
      }

      if (!club.shortDescription?.trim()) {
        actions.push({
          id: "short-description",
          priority: 4,
          icon: <Megaphone size={20} aria-hidden />,
          title: "Add a short description",
          reason: "Help students understand what your club is about on your public profile.",
          actionLabel: "Complete Setup",
          onAction: () =>
            navigate(buildClubSettingsSectionPath(clubId, "profile")),
        });
      }

      if (!club.meetingSchedule?.trim()) {
        actions.push({
          id: "meeting-schedule",
          priority: 5,
          icon: <Calendar size={20} aria-hidden />,
          title: "Add meeting schedule",
          reason: "Let members know when and how often your club meets.",
          actionLabel: "Complete Setup",
          onAction: () =>
            navigate(buildClubSettingsSectionPath(clubId, "profile")),
        });
      }

      if (!clubHasSocialLinks(club.socialLinks)) {
        actions.push({
          id: "social-links",
          priority: 6,
          icon: <Users size={20} aria-hidden />,
          title: "Add social links",
          reason: "Link your Instagram, website, or other channels on your public profile.",
          actionLabel: "Complete Setup",
          onAction: () =>
            navigate(buildClubSettingsSectionPath(clubId, "social")),
        });
      }
    }

    if (pendingJoinCount > 0) {
      actions.push({
        id: "review-join",
        priority: 10,
        icon: <Users size={20} aria-hidden />,
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
        icon: <ClipboardList size={20} aria-hidden />,
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
        icon: <Megaphone size={20} aria-hidden />,
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
        icon: <Calendar size={20} aria-hidden />,
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
        icon: <Megaphone size={20} aria-hidden />,
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
        icon: <Briefcase size={20} aria-hidden />,
        title: "Promote your open role",
        reason: `${hiringSnapshot.rolesWithZeroApplicants} open role${hiringSnapshot.rolesWithZeroApplicants === 1 ? "" : "s"} ha${hiringSnapshot.rolesWithZeroApplicants === 1 ? "s" : "ve"} no applicants yet.`,
        actionLabel: "View Hiring",
        onAction: () => navigate(recruitingPath),
      });
    }

    if (profileCompletion < 100 && actions.length === 0) {
      actions.push({
        id: "complete-profile",
        priority: 0,
        icon: <Image size={20} aria-hidden />,
        title: "Complete your club profile",
        reason:
          profileMissingLabels.length > 0
            ? `Still missing: ${profileMissingLabels.join(", ")}.`
            : "Finish the remaining setup items for your club profile.",
        actionLabel: "Complete Setup",
        onAction: () => navigate(setupSettingsPath),
      });
    }

    const sorted = actions.sort((left, right) => left.priority - right.priority);
    let result = sorted.slice(0, 3);

    if (
      profileCompletion < 100 &&
      !result.some((action) => profileActionIds.has(action.id))
    ) {
      const firstProfileAction = sorted.find((action) => profileActionIds.has(action.id));
      if (firstProfileAction) {
        result = [
          firstProfileAction,
          ...result.filter((action) => action.id !== firstProfileAction.id),
        ].slice(0, 3);
      } else {
        result = [
          {
            id: "complete-profile",
            priority: 0,
            icon: <Image size={20} aria-hidden />,
            title: "Complete your club profile",
            reason:
              profileMissingLabels.length > 0
                ? `Still missing: ${profileMissingLabels.join(", ")}.`
                : "Finish the remaining setup items for your club profile.",
            actionLabel: "Complete Setup",
            onAction: () => navigate(setupSettingsPath),
          },
          ...result,
        ].slice(0, 3);
      }
    }

    return result;
  }, [
    profileCompletion,
    profileMissingLabels,
    pendingJoinCount,
    pendingApplicationCount,
    upcomingOccurrences,
    today,
    posts,
    club.logoUrl,
    club.bannerUrl,
    club.contactEmail,
    club.shortDescription,
    club.meetingSchedule,
    club.socialLinks,
    hiringSnapshot.rolesWithZeroApplicants,
    navigate,
    membersPath,
    recruitingPath,
    announcementsPath,
    eventsPath,
    settingsPath,
    setupSettingsPath,
  ]);

  const createOptions = [
    { label: "Event", onClick: () => navigate(`${eventsPath}?openCreate=true`) },
    { label: "Announcement", onClick: () => navigate(`${announcementsPath}?openCreate=true`) },
    { label: "Task", onClick: () => navigate(`${tasksPath}?openCreate=true`) },
    { label: "Hiring Role", onClick: () => navigate(`${recruitingPath}?openCreate=true`) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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

        <CreateMenuDropdown options={createOptions} />
      </div>

      <NeedsReviewSection
        tasks={needsReviewTasks}
        loading={tasksLoading}
        onReviewTask={onOpenTask}
      />

      <section style={{ marginBottom: "8px", paddingBottom: 0 }}>
        {tasksLoading || membersLoading || hiringSnapshot.loading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading command center…" />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
              gap: "16px",
              alignItems: "stretch",
            }}
          >
            {setupComplete ? (
              <NextMeetingUrgentCard
                display={nextMeetingDisplay}
                onAction={() => navigate(eventsPath)}
              />
            ) : (
              <ProfileCompletionUrgentCard
                percent={profileCompletion}
                missingLabels={profileMissingLabels}
                onAction={openSetupSettings}
              />
            )}
            <UrgentCountCard
              title="Events This Month"
              value={String(eventsThisMonthCount)}
              actionLabel="View Events"
              onAction={() => navigate(eventsPath)}
            />
            <UrgentCountCard
              title="Incomplete Club Tasks"
              value={String(openTasks.length)}
              actionLabel="View Tasks"
              onAction={() => navigate(tasksPath)}
            />
            <RequestsApplicationsUrgentCard
              joinCount={pendingJoinCount}
              applicationCount={pendingApplicationCount}
              onReviewRequests={() => navigate(`${membersPath}?tab=pending`)}
              onReviewApplications={() => navigate(`${recruitingPath}?tab=applications`)}
            />
          </div>
        )}
      </section>

      <section>
        <h2 style={sectionHeading}>This Week</h2>
        <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#777777" }}>
          Events, tasks, and actions that need attention this week.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: "16px",
          }}
        >
          <ThisWeekPanel title="Schedule">
            {eventsLoading ? (
              <Spinner label="Loading events…" />
            ) : eventsThisWeekDisplay.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>No events this week.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {eventsThisWeekDisplay.slice(0, 4).map((event) => (
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                          {event.title}
                        </p>
                        {event.showRecurringBadge ? (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              color: GOLD,
                              border: `1px solid rgba(255, 196, 41, 0.35)`,
                              background: "rgba(255, 196, 41, 0.1)",
                              borderRadius: "4px",
                              padding: "2px 6px",
                            }}
                          >
                            Recurring
                          </span>
                        ) : null}
                      </div>
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
          </ThisWeekPanel>

          <ThisWeekPanel title="Tasks Due">
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
                      cursor: "pointer",
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
          </ThisWeekPanel>

          <ThisWeekPanel title="Needs Attention">
            {tasksLoading || membersLoading || hiringSnapshot.loading ? (
              <Spinner label="Loading…" />
            ) : needsAttentionItems.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>
                Nothing needs attention right now.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {needsAttentionItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      borderTop: `1px solid ${CARD_BORDER}`,
                      paddingTop: "10px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "12px", color: "#cccccc", lineHeight: 1.45, flex: 1 }}>
                      {item.label}
                    </p>
                    {item.onAction && item.actionLabel ? (
                      <button
                        type="button"
                        style={{ ...outlineButtonStyle, flexShrink: 0 }}
                        onClick={item.onAction}
                      >
                        {item.actionLabel}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </ThisWeekPanel>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "24px" }}>
          <section>
            <h2 style={sectionHeading}>Upcoming Events &amp; RSVPs</h2>
            {eventsLoading ? (
              <div className="flex justify-center py-6">
                <Spinner label="Loading upcoming events…" />
              </div>
            ) : previewUpcomingEvents.length === 0 ? (
              <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
                No upcoming events scheduled.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {previewUpcomingEvents.map((event) => {
                  const rsvp = eventRsvpCounts[event.id];
                  const going = rsvp?.going ?? 0;
                  const maybe = rsvp?.maybe ?? 0;

                  return (
                    <div
                      key={`${event.id}-${event.occurrenceDate}`}
                      style={{
                        background: CARD_BG,
                        border: `1px solid ${CARD_BORDER}`,
                        borderRadius: "10px",
                        padding: "16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                        }}
                      >
                        <EventDateBadge dateStr={event.occurrenceDate} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: "0 0 4px",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#ffffff",
                            }}
                          >
                            {event.title}
                          </p>
                          <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
                            {formatEventDetailLine(
                              event.occurrenceDate,
                              event.time,
                              event.location,
                            )}
                          </p>
                        </div>
                        <div
                          style={{
                            textAlign: "center",
                            flexShrink: 0,
                            minWidth: "72px",
                            padding: "0 8px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "32px",
                              fontWeight: 800,
                              color: going > 0 ? "#ffffff" : "#777777",
                              lineHeight: 1,
                            }}
                          >
                            {going}
                          </p>
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#777777",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Going
                          </p>
                          {maybe > 0 ? (
                            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555555" }}>
                              +{maybe} maybe
                            </p>
                          ) : null}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: "8px",
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => navigate(`${eventsPath}?manageEvent=${event.id}`)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#777777",
                              fontSize: "12px",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Manage Event
                          </button>
                          <button
                            type="button"
                            style={urgentOutlinedButtonStyle}
                            onClick={() => navigate(`${eventsPath}?viewRsvps=${event.id}`)}
                          >
                            View RSVPs
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "#1a1a1a",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: "8px",
                      padding: "14px",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: "11px",
                        color: "#555555",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Open roles
                    </p>
                    <p style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
                      {hiringSnapshot.openRolesCount}
                    </p>
                  </div>
                  <div
                    style={{
                      background: "#1a1a1a",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: "8px",
                      padding: "14px",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: "11px",
                        color: "#555555",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Pending applications
                    </p>
                    <p style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
                      {hiringSnapshot.pendingApplicationsCount}
                    </p>
                  </div>
                  <div
                    style={{
                      background: "#1a1a1a",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: "8px",
                      padding: "14px",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: "11px",
                        color: "#555555",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Roles with 0 applicants
                    </p>
                    <p style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
                      {hiringSnapshot.rolesWithZeroApplicants}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button type="button" style={outlineButtonStyle} onClick={() => navigate(recruitingPath)}>
                    View Hiring
                  </button>
                  <button
                    type="button"
                    style={actionButtonStyle}
                    onClick={() => navigate(`${recruitingPath}?openCreate=true`)}
                  >
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
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                    gap: "4px",
                  }}
                >
                  {activityItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 0",
                        borderBottom: "1px solid #1a1a1a",
                      }}
                    >
                      <div style={{ color: "#555555", flexShrink: 0 }}>{item.icon}</div>
                      <p
                        style={{
                          margin: 0,
                          flex: 1,
                          minWidth: 0,
                          fontSize: "13px",
                          color: "#cccccc",
                        }}
                      >
                        {item.description}
                      </p>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#555555",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "center", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => navigate(membersPath)}
                    style={textLinkStyle}
                  >
                    View all activity →
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <aside
          style={{
            width: isMobile ? "100%" : "320px",
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontWeight: 700,
              fontSize: "15px",
              color: "#ffffff",
              margin: "0 0 12px",
            }}
          >
            Suggested Next Actions
          </h2>
          {hiringSnapshot.loading && postsLoading ? (
            <div className="flex justify-center py-6">
              <Spinner label="Loading suggestions…" />
            </div>
          ) : suggestedActions.length === 0 && profileCompletion >= 100 ? (
            <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
              No suggestions right now — your club looks healthy.
            </p>
          ) : (
            <div>
              {suggestedActions.map((action) => (
                <SuggestionCard
                  key={action.id}
                  icon={action.icon}
                  title={action.title}
                  reason={action.reason}
                  actionLabel={action.actionLabel}
                  onAction={action.onAction}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
