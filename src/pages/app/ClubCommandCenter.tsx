import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  CheckSquare,
  ClipboardList,
  Megaphone,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { isTaskAwaitingReviewFromUser } from "../../lib/taskCompletion";
import { getClubInitials } from "../../lib/clubUtils";
import { useClubMembers } from "../../hooks/useClubMembers";
import {
  computeClubProfileCompletionPercent,
  getClubProfileMissingLabels,
  resolveClubSetupSettingsPath,
} from "../../lib/clubProfileCompletion";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import {
  deduplicateMonthlyEventsByTitle,
  deduplicateUpcomingEventsByTitle,
  type EventRecurringMeta,
} from "../../lib/eventRecurrence";
import { supabase } from "../../lib/supabaseClient";
import type { Club, ClubEvent, Post, RsvpCounts, Task } from "../../types";
import Spinner from "../../components/ui/Spinner";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const NEUTRAL_TOP_BORDER = "#3a3a3a";

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

const noteActionButtonStyle: CSSProperties = {
  background: "transparent",
  color: GOLD,
  border: `1px solid ${GOLD}`,
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
  color: "#999999",
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

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
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

type ActivityKind = "join" | "rsvp" | "announcement" | "task" | "application";

type ActivityFeedItem = {
  id: string;
  kind: ActivityKind;
  description: string;
  timestamp: string;
  icon: ReactNode;
};

interface HiringSnapshot {
  openRolesCount: number;
  pendingApplicationsCount: number;
  rolesWithZeroApplicants: number;
  topOpenRole: { id: string; title: string } | null;
  loading: boolean;
}

type PendingActionItem = {
  id: string;
  label: string;
  actionLabel?: string;
  onAction?: () => void;
};

const GOLD_OUTLINED_BUTTON_STYLE: CSSProperties = {
  ...urgentOutlinedButtonStyle,
  color: GOLD,
  border: `1px solid ${GOLD}`,
};

function CompactEventDateBadge({ dateStr }: { dateStr: string }) {
  const { month, day } = eventDateBadgeParts(dateStr);

  return (
    <div
      style={{
        width: "40px",
        height: "44px",
        borderRadius: "6px",
        background: GOLD,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#1a1200",
        lineHeight: 1.1,
      }}
    >
      <span style={{ fontSize: "9px", fontWeight: 600 }}>{month}</span>
      <span style={{ fontSize: "15px", fontWeight: 700 }}>{day}</span>
    </div>
  );
}

function CommandCenterStatCard({
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
  icon: ReactNode;
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
    cursor: onClick ? "pointer" : "default",
    transition: "border-color 0.15s ease",
  };

  const content = (
    <>
      <span
        className="[&_svg]:h-[18px] [&_svg]:w-[18px]"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          color: resolvedIconColor,
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

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
      >
        {content}
      </button>
    );
  }

  return <div style={style}>{content}</div>;
}

function ClubIdentityHeader({ club }: { club: Club }) {
  const university = club.university?.trim() || "University of Guelph";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        paddingBottom: "20px",
        borderBottom: `1px solid ${CARD_BORDER}`,
      }}
    >
      {club.logoUrl?.trim() ? (
        <img
          src={club.logoUrl}
          alt=""
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "10px",
            objectFit: "cover",
            flexShrink: 0,
            border: `1px solid ${CARD_BORDER}`,
          }}
        />
      ) : (
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "10px",
            background: "#1a1a1a",
            border: `1px solid ${CARD_BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "18px",
            fontWeight: 700,
            color: GOLD,
          }}
        >
          {getClubInitials(club)}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.2,
          }}
        >
          {club.name}
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#777777" }}>{university}</p>
      </div>
    </header>
  );
}

function parseListingDeadline(deadline: string | null | undefined): Date | null {
  if (!deadline?.trim()) return null;
  const trimmed = deadline.trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  return Number.isNaN(due.getTime()) ? null : due;
}

function HiringDonutChart({
  openRolesCount,
  rolesWithZeroApplicants,
}: {
  openRolesCount: number;
  rolesWithZeroApplicants: number;
}) {
  const size = 120;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rolesWithApplicants = Math.max(openRolesCount - rolesWithZeroApplicants, 0);
  const total = Math.max(openRolesCount, 1);
  const withApplicantsLength = (rolesWithApplicants / total) * circumference;
  const zeroApplicantsLength = (rolesWithZeroApplicants / total) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={stroke}
        />
        {openRolesCount > 0 ? (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={GOLD}
              strokeWidth={stroke}
              strokeDasharray={`${withApplicantsLength} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            {rolesWithZeroApplicants > 0 ? (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#555555"
                strokeWidth={stroke}
                strokeDasharray={`${zeroApplicantsLength} ${circumference}`}
                strokeDashoffset={-withApplicantsLength}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            ) : null}
          </>
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <span style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>
          {openRolesCount}
        </span>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 600,
            color: "#777777",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginTop: "2px",
          }}
        >
          Open Role
        </span>
      </div>
    </div>
  );
}

function HiringMetricLine({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p
        style={{
          margin: "0 0 2px",
          fontSize: "11px",
          color: "#555555",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>{value}</p>
    </div>
  );
}

function needsAttentionButtonStyle(itemId: string): CSSProperties {
  if (
    itemId === "join-requests" ||
    itemId === "applications" ||
    itemId === "overdue-tasks" ||
    itemId.startsWith("review-")
  ) {
    return urgentOutlinedButtonStyle;
  }
  if (itemId.startsWith("low-rsvp")) {
    return GOLD_OUTLINED_BUTTON_STYLE;
  }
  return outlineButtonStyle;
}

function PendingActionsSection({
  items,
  loading,
}: {
  items: PendingActionItem[];
  loading: boolean;
}) {
  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "10px",
        padding: "16px",
      }}
    >
      <h2
        style={{
          ...sectionHeading,
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span>Pending Actions</span>
        <span style={{ color: "#777777", fontWeight: 500 }}>· {items.length}</span>
      </h2>
      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner label="Loading pending actions…" />
        </div>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>
          Nothing needs attention right now.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
                borderTop: `1px solid ${CARD_BORDER}`,
                paddingTop: "8px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#cccccc", lineHeight: 1.45, flex: 1 }}>
                {item.label}
              </p>
              {item.onAction && item.actionLabel ? (
                <button
                  type="button"
                  style={{ ...needsAttentionButtonStyle(item.id), flexShrink: 0 }}
                  onClick={item.onAction}
                >
                  {item.actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RemindersQuickActionsCard({
  reminderEvent,
  onUseReminderTemplate,
  onNewAnnouncement,
  onAddEvent,
  onInviteMembers,
  onViewReports,
}: {
  reminderEvent: { title: string; dateLine: string } | null;
  onUseReminderTemplate: () => void;
  onNewAnnouncement: () => void;
  onAddEvent: () => void;
  onInviteMembers: () => void;
  onViewReports: () => void;
}) {
  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "10px",
        padding: "16px",
      }}
    >
      <h2 style={{ ...sectionHeading, marginBottom: "12px" }}>Reminders &amp; Quick Actions</h2>
      {reminderEvent ? (
        <div
          style={{
            background: "rgba(255, 196, 41, 0.08)",
            border: `1px solid rgba(255, 196, 41, 0.25)`,
            borderRadius: "8px",
            padding: "12px 14px",
            marginBottom: "12px",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#cccccc", lineHeight: 1.45 }}>
            <strong style={{ color: GOLD }}>{reminderEvent.title}</strong> is coming up on{" "}
            {reminderEvent.dateLine}.
          </p>
          <button type="button" style={noteActionButtonStyle} onClick={onUseReminderTemplate}>
            Use Reminder Template
          </button>
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "8px",
        }}
      >
        <button type="button" style={outlineButtonStyle} onClick={onNewAnnouncement}>
          New Announcement
        </button>
        <button type="button" style={outlineButtonStyle} onClick={onAddEvent}>
          Add Event
        </button>
        <button type="button" style={outlineButtonStyle} onClick={onInviteMembers}>
          Invite Members
        </button>
        <button type="button" style={outlineButtonStyle} onClick={onViewReports}>
          View Reports
        </button>
      </div>
    </section>
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
    topOpenRole: null,
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
  const analyticsPath = `${basePath}/analytics`;
  const setupSettingsPath = resolveClubSetupSettingsPath(settingsPath, club);

  const openSetupSettings = () => navigate(setupSettingsPath);

  useEffect(() => {
    let cancelled = false;

    async function loadHiringSnapshot() {
      setHiringSnapshot((prev) => ({ ...prev, loading: true }));

      const { data: listings, error: listingsError } = await supabase
        .from("hiring_listings")
        .select("id, title, deadline")
        .eq("club_id", clubId)
        .eq("is_open", true);

      if (cancelled) return;

      if (listingsError) {
        console.error("Failed to load hiring listings:", listingsError.message);
        setHiringSnapshot({
          openRolesCount: 0,
          pendingApplicationsCount: 0,
          rolesWithZeroApplicants: 0,
          topOpenRole: null,
          loading: false,
        });
        return;
      }

      const openListings = (listings ?? []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? "Open role",
        deadline: (row.deadline as string | null) ?? null,
      }));
      const listingIds = openListings.map((row) => row.id);
      let pendingApplicationsCount = 0;
      let rolesWithZeroApplicants = listingIds.length;
      let topOpenRole: { id: string; title: string } | null = null;

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

          const rankedListings = [...openListings].sort((left, right) => {
            const leftCount = countsByListing.get(left.id) ?? 0;
            const rightCount = countsByListing.get(right.id) ?? 0;
            if (rightCount !== leftCount) return rightCount - leftCount;

            const leftDeadline = parseListingDeadline(left.deadline);
            const rightDeadline = parseListingDeadline(right.deadline);
            if (leftDeadline && rightDeadline) {
              return leftDeadline.getTime() - rightDeadline.getTime();
            }
            if (leftDeadline) return -1;
            if (rightDeadline) return 1;
            return 0;
          });

          if (rankedListings[0]) {
            topOpenRole = {
              id: rankedListings[0].id,
              title: rankedListings[0].title,
            };
          }
        }
      }

      setHiringSnapshot({
        openRolesCount: listingIds.length,
        pendingApplicationsCount,
        rolesWithZeroApplicants,
        topOpenRole,
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

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.status !== "cancelled"),
    [tasks],
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
  const pendingRequestsTotal = pendingJoinCount + pendingApplicationCount;

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

  const pendingActionsItems = useMemo(() => {
    const items: PendingActionItem[] = [];

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

    for (const task of needsReviewTasks) {
      items.push({
        id: `review-${task.id}`,
        label: `Task awaiting review: ${task.title}`,
        actionLabel: "Review Task",
        onAction: () => onOpenTask(task),
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

    return items.slice(0, 8);
  }, [
    pendingJoinCount,
    pendingApplicationCount,
    profileCompletion,
    profileMissingLabels,
    overdueTasks.length,
    needsReviewTasks,
    previewUpcomingEvents,
    eventRsvpCounts,
    today,
    navigate,
    membersPath,
    recruitingPath,
    tasksPath,
    eventsPath,
    openSetupSettings,
    onOpenTask,
  ]);

  const upcomingReminderEvent = useMemo(() => {
    const eventInThreeDays = upcomingOccurrences.find((event) => {
      const eventDate = startOfDay(new Date(`${event.occurrenceDate}T12:00:00`));
      const diffDays = Math.round(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return diffDays >= 0 && diffDays <= 3;
    });

    if (!eventInThreeDays) return null;

    return {
      title: eventInThreeDays.title,
      dateLine: formatEventDateLine(eventInThreeDays.occurrenceDate, eventInThreeDays.time),
    };
  }, [upcomingOccurrences, today]);

  const pendingActionsLoading = tasksLoading || membersLoading || hiringSnapshot.loading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <ClubIdentityHeader club={club} />

      <section>
        {pendingActionsLoading ? (
          <div className="flex justify-center py-4">
            <Spinner label="Loading command center…" />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
              gap: "12px",
              alignItems: "stretch",
            }}
          >
            <CommandCenterStatCard
              label="Profile"
              value={profileCompletion}
              sublabel={profileCompletion >= 100 ? "Setup complete" : "Completion"}
              icon={<Users size={18} aria-hidden />}
              accentColor={profileCompletion >= 100 ? "#4ade80" : GOLD}
              onClick={openSetupSettings}
            />
            <CommandCenterStatCard
              label="Events"
              value={eventsThisMonthCount}
              sublabel="This month"
              icon={<Calendar size={18} aria-hidden />}
              accentColor={GOLD}
              onClick={() => navigate(eventsPath)}
            />
            <CommandCenterStatCard
              label="Tasks"
              value={openTasks.length}
              sublabel={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "Open tasks"}
              icon={<CheckSquare size={18} aria-hidden />}
              accentColor={overdueTasks.length > 0 ? ACCENT_RED : NEUTRAL_TOP_BORDER}
              onClick={() => navigate(tasksPath)}
            />
            <CommandCenterStatCard
              label="Pending"
              value={pendingRequestsTotal}
              sublabel="Requests & applications"
              icon={<ClipboardList size={18} aria-hidden />}
              accentColor={pendingRequestsTotal > 0 ? ACCENT_RED : NEUTRAL_TOP_BORDER}
              onClick={() =>
                navigate(
                  pendingJoinCount > 0
                    ? `${membersPath}?tab=pending`
                    : `${recruitingPath}?tab=applications`,
                )
              }
            />
          </div>
        )}
      </section>

      <PendingActionsSection items={pendingActionsItems} loading={pendingActionsLoading} />

      <section>
        <h2 style={sectionHeading}>Upcoming Events</h2>
        {eventsLoading ? (
          <div className="flex justify-center py-4">
            <Spinner label="Loading upcoming events…" />
          </div>
        ) : previewUpcomingEvents.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>
            No upcoming events scheduled.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {previewUpcomingEvents.map((event) => {
              const going = eventRsvpCounts[event.id]?.going ?? 0;
              const timeLabel =
                event.time && event.time.trim() && event.time.toUpperCase() !== "TBD"
                  ? formatEventTime12h(event.time)
                  : "Time TBD";
              const locationLabel =
                event.location && !isHiddenLocation(event.location)
                  ? event.location.trim()
                  : "Location TBD";

              return (
                <div
                  key={`${event.id}-${event.occurrenceDate}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 0",
                    borderBottom: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  <CompactEventDateBadge dateStr={event.occurrenceDate} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: "0 0 2px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#ffffff",
                      }}
                    >
                      {event.title}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
                      {timeLabel} · {locationLabel} · {going} going
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`${eventsPath}?manageEvent=${event.id}`)}
                    style={textLinkStyle}
                  >
                    Manage →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "10px",
          padding: "16px",
        }}
      >
        <h2 style={{ ...sectionHeading, marginBottom: "12px" }}>Hiring Snapshot</h2>
        {hiringSnapshot.loading ? (
          <div className="flex justify-center py-4">
            <Spinner label="Loading hiring snapshot…" />
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "flex-start" : "center",
                gap: "20px",
              }}
            >
              <HiringDonutChart
                openRolesCount={hiringSnapshot.openRolesCount}
                rolesWithZeroApplicants={hiringSnapshot.rolesWithZeroApplicants}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                  gap: "16px",
                  flex: 1,
                  width: isMobile ? "100%" : undefined,
                }}
              >
                <HiringMetricLine
                  label="Pending Applications"
                  value={hiringSnapshot.pendingApplicationsCount}
                />
                <HiringMetricLine
                  label="Roles with 0 Applicants"
                  value={hiringSnapshot.rolesWithZeroApplicants}
                />
                <HiringMetricLine label="Total Roles" value={hiringSnapshot.openRolesCount} />
              </div>
            </div>
            {hiringSnapshot.topOpenRole ? (
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "14px",
                  borderTop: `1px solid ${CARD_BORDER}`,
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: "12px",
                    color: "#777777",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Top Open Role
                </p>
                <p style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>
                  {hiringSnapshot.topOpenRole.title}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    type="button"
                    style={outlineButtonStyle}
                    onClick={() => navigate(`${recruitingPath}?tab=applications`)}
                  >
                    Review Applications
                  </button>
                  <button
                    type="button"
                    style={noteActionButtonStyle}
                    onClick={() => navigate(`${recruitingPath}?openCreate=true`)}
                  >
                    Create Role
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  style={noteActionButtonStyle}
                  onClick={() => navigate(`${recruitingPath}?openCreate=true`)}
                >
                  Create Role
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <RemindersQuickActionsCard
        reminderEvent={upcomingReminderEvent}
        onUseReminderTemplate={() => navigate(`${announcementsPath}?openTemplate=true`)}
        onNewAnnouncement={() => navigate(`${announcementsPath}?openCreate=true`)}
        onAddEvent={() => navigate(`${eventsPath}?openCreate=true`)}
        onInviteMembers={() => navigate(membersPath)}
        onViewReports={() => navigate(analyticsPath)}
      />

      <section
        style={{
          background: "#111111",
          border: `1px solid #1f1f1f`,
          borderRadius: "8px",
          padding: "14px 16px",
        }}
      >
        <h2
          style={{
            fontWeight: 500,
            fontSize: "13px",
            color: "#666666",
            margin: "0 0 10px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Recent Club Activity
        </h2>
        {activityLoading ? (
          <div className="flex justify-center py-3">
            <Spinner label="Loading activity…" />
          </div>
        ) : activityItems.length === 0 ? (
          <p style={{ margin: 0, fontSize: "12px", color: "#555555" }}>No recent activity yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {activityItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 0",
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <div style={{ color: "#444444", flexShrink: 0 }}>{item.icon}</div>
                <p
                  style={{
                    margin: 0,
                    flex: 1,
                    minWidth: 0,
                    fontSize: "12px",
                    color: "#888888",
                  }}
                >
                  {item.description}
                </p>
                <span
                  style={{
                    fontSize: "10px",
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
        )}
      </section>
    </div>
  );
}
