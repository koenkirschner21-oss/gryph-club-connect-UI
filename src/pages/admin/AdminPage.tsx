import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { FileText, X, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  notifyClaimRequestApproved,
  notifyClaimRequestMoreInfo,
  notifyClaimRequestRejected,
  notifyClubRequestApproved,
  notifyClubRequestMoreInfo,
  notifyClubRequestRejected,
} from "../../lib/notifications";
import {
  clubReportReasonLabel,
  clubReportStatusBadgeStyle,
  clubReportStatusLabel,
  type ClubReportStatus,
} from "../../lib/clubReportUtils";
import Spinner from "../../components/ui/Spinner";
import { useIsMobile } from "../../hooks/useWindowWidth";

type AdminTab = "requests" | "claims" | "users" | "moderation" | "stats" | "bugs";
type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";
type ReportStatusFilter = "all" | "unreviewed" | "resolved";
type ClubReportStatusFilter = "all" | ClubReportStatus;
type BugStatusFilter = "active" | "resolved";
type ActivityStatus = "active" | "quiet" | "inactive";

interface PostReportRow {
  id: string;
  post_id: string;
  reported_by: string;
  reason: string;
  details: string | null;
  status: "unreviewed" | "resolved" | "dismissed";
  created_at: string;
  postTitle: string;
  postContent: string;
  reporterName: string;
}

interface ClubReportRow {
  id: string;
  club_id: string;
  club_name: string | null;
  reporter_id: string;
  reason: string;
  description: string | null;
  current_url: string | null;
  status: ClubReportStatus;
  created_at: string;
  reporterName: string;
  clubSlug: string | null;
}

interface ClubClaimRequestRow {
  id: string;
  club_id: string;
  submitted_by: string;
  role_in_club: string;
  message: string | null;
  proof_url: string | null;
  contact_email: string | null;
  status: "pending" | "approved" | "rejected" | "more_info";
  review_note: string | null;
  created_at: string;
  clubName: string;
  clubSlug: string;
  submitterName: string;
  submitterEmail: string;
}

interface ClubRequestRow {
  id: string;
  submitted_by: string | null;
  club_id: string | null;
  name: string;
  short_description: string | null;
  long_description: string | null;
  category: string | null;
  requested_at: string;
  status: "pending" | "approved" | "rejected" | "more_info";
  review_note: string | null;
  submitterName: string;
  submitterEmail: string;
}

interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  program: string | null;
  year_of_study: string | null;
  created_at: string;
}

interface AdminStats {
  users: number;
  clubs: number;
  events: number;
  messages: number;
}

interface BugReportRow {
  id: string;
  page: string | null;
  description: string;
  severity: "minor" | "moderate" | "critical";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  reporterName: string;
}

interface ClubActivityRow {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  memberCount: number;
  lastPostAt: string | null;
  activityStatus: ActivityStatus;
}

const PAGE_BG = "#0f0f0f";

const pillButtonStyle = (active: boolean): CSSProperties => ({
  background: active ? "#E51937" : "#1a1a1a",
  border: active ? "1px solid #E51937" : "1px solid #333333",
  color: active ? "#ffffff" : "#777777",
  borderRadius: "20px",
  padding: "6px 16px",
  fontSize: "12px",
  cursor: "pointer",
});

const statusBadgeStyle = (
  status: ClubRequestRow["status"],
): CSSProperties => {
  if (status === "approved") {
    return {
      background: "#0d2b0d",
      color: "#4ade80",
      borderRadius: "20px",
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "capitalize",
    };
  }
  if (status === "rejected") {
    return {
      background: "#1a0505",
      color: "#E51937",
      borderRadius: "20px",
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "capitalize",
    };
  }
  return {
    background: "#2a1f00",
    color: "#FFC429",
    borderRadius: "20px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "capitalize",
  };
};

function clubRequestStatusLabel(status: ClubRequestRow["status"]): string {
  if (status === "pending" || status === "more_info") return "Pending Review";
  return status;
}

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveClubAbbreviation(name: string, maxLen = 2): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

function getActivityStatus(lastPostAt: string | null): ActivityStatus {
  if (!lastPostAt) return "inactive";
  const diffDays =
    (Date.now() - new Date(lastPostAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 14) return "active";
  if (diffDays <= 30) return "quiet";
  return "inactive";
}

function activitySortOrder(status: ActivityStatus): number {
  if (status === "inactive") return 0;
  if (status === "quiet") return 1;
  return 2;
}

function formatLastPostDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function activityBadgeStyle(status: ActivityStatus): CSSProperties {
  if (status === "active") {
    return {
      background: "#0a1a0a",
      border: "1px solid #1a3a1a",
      color: "#4ade80",
      borderRadius: "20px",
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "capitalize",
      display: "inline-block",
    };
  }
  if (status === "quiet") {
    return {
      background: "#1a1500",
      border: "1px solid #3a2f00",
      color: "#FFC429",
      borderRadius: "20px",
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "capitalize",
      display: "inline-block",
    };
  }
  return {
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#555555",
    borderRadius: "20px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "capitalize",
    display: "inline-block",
  };
}

function bugSeverityBorderColor(severity: BugReportRow["severity"]): string {
  if (severity === "critical") return "#E51937";
  if (severity === "moderate") return "#FFC429";
  return "#333333";
}

function bugStatusBadgeStyle(
  status: BugReportRow["status"],
): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "20px",
    padding: "2px 8px",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "capitalize",
  };

  if (status === "in_progress") {
    return {
      ...base,
      border: "1px solid #FFC429",
      color: "#FFC429",
      background: "transparent",
    };
  }

  if (status === "resolved") {
    return {
      ...base,
      border: "1px solid #555",
      color: "#555",
      background: "transparent",
    };
  }

  return {
    ...base,
    background: "#111111",
    border: "1px solid #333333",
    color: "#777777",
  };
}

function parseRequestMeta(longDescription: string | null): {
  slug?: string;
  contact_email?: string;
  meeting_schedule?: string;
  meeting_location?: string;
  social_links?: Record<string, string>;
} {
  if (!longDescription) return {};
  try {
    return JSON.parse(longDescription) as {
      slug?: string;
      contact_email?: string;
      meeting_schedule?: string;
      meeting_location?: string;
      social_links?: Record<string, string>;
    };
  } catch {
    return {};
  }
}

function formatRequestDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function userDisplayName(user: AdminUserRow): string {
  return user.full_name?.trim() || user.email?.trim() || "Unknown user";
}

function userInitials(user: AdminUserRow): string {
  const name = userDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function requestCardAccent(status: ClubRequestRow["status"]): string {
  if (status === "approved") return "#4ade80";
  if (status === "rejected") return "#E51937";
  return "#FFC429";
}

function HeaderQuickStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: "0 20px" }}>
      <p
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: "11px", color: "#555555", margin: "4px 0 0" }}>
        {label}
      </p>
    </div>
  );
}

function AdminTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "14px 20px",
        fontSize: "13px",
        fontWeight: 500,
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid #E51937" : "2px solid transparent",
        color: active ? "#ffffff" : hovered ? "#cccccc" : "#555555",
        cursor: "pointer",
        marginBottom: "-1px",
        transition: "color 0.15s ease",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function AdminStatCard({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: number;
  accentColor: string;
}) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #242424",
        borderRadius: "8px",
        padding: "16px 18px",
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      <p
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 8px",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#747676",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: 0,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function startRolePreview(role: "member" | "executive" | "owner", navigate: (path: string) => void) {
  localStorage.setItem("previewRole", role);
  window.dispatchEvent(new Event("previewrole-change"));
  navigate("/app");
}

export default function AdminPage() {
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>("requests");

  const [requests, setRequests] = useState<ClubRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [claimRequests, setClaimRequests] = useState<ClubClaimRequestRow[]>([]);
  const [claimRequestsLoading, setClaimRequestsLoading] = useState(true);
  const [claimActionLoadingId, setClaimActionLoadingId] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<RequestStatusFilter>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [approvalErrors, setApprovalErrors] = useState<Record<string, string>>(
    {},
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<ClubRequestRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [moreInfoTarget, setMoreInfoTarget] = useState<ClubRequestRow | null>(null);
  const [moreInfoNote, setMoreInfoNote] = useState("");
  const [claimMoreInfoTarget, setClaimMoreInfoTarget] =
    useState<ClubClaimRequestRow | null>(null);
  const [claimMoreInfoNote, setClaimMoreInfoNote] = useState("");
  const [requestSearch, setRequestSearch] = useState("");

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");

  const [stats, setStats] = useState<AdminStats>({
    users: 0,
    clubs: 0,
    events: 0,
    messages: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [reports, setReports] = useState<PostReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<ReportStatusFilter>("all");
  const [reportActionLoadingId, setReportActionLoadingId] = useState<string | null>(null);

  const [clubReports, setClubReports] = useState<ClubReportRow[]>([]);
  const [clubReportsLoading, setClubReportsLoading] = useState(true);
  const [clubReportFilter, setClubReportFilter] =
    useState<ClubReportStatusFilter>("all");
  const [clubReportActionLoadingId, setClubReportActionLoadingId] = useState<
    string | null
  >(null);

  const [showApprovalChecklist, setShowApprovalChecklist] = useState(false);

  const [bugReports, setBugReports] = useState<BugReportRow[]>([]);
  const [bugReportsLoading, setBugReportsLoading] = useState(true);
  const [bugFilter, setBugFilter] = useState<BugStatusFilter>("active");
  const [bugActionLoadingId, setBugActionLoadingId] = useState<string | null>(null);

  const [clubActivity, setClubActivity] = useState<ClubActivityRow[]>([]);
  const [clubActivityLoading, setClubActivityLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);

    const { data, error } = await supabase
      .from("post_reports")
      .select(
        `
        id,
        post_id,
        reported_by,
        reason,
        details,
        status,
        created_at,
        posts ( title, content ),
        profiles!post_reports_reported_by_fkey ( full_name )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load post reports:", error.message);
      setReports([]);
      setReportsLoading(false);
      return;
    }

    setReports(
      (data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const postRaw = record.posts as unknown;
        const post = (
          Array.isArray(postRaw) ? postRaw[0] ?? {} : postRaw ?? {}
        ) as Record<string, unknown>;
        const profileRaw = record.profiles as unknown;
        const profile = (
          Array.isArray(profileRaw) ? profileRaw[0] ?? {} : profileRaw ?? {}
        ) as Record<string, unknown>;
        return {
          id: record.id as string,
          post_id: record.post_id as string,
          reported_by: record.reported_by as string,
          reason: (record.reason as string) ?? "",
          details: (record.details as string) ?? null,
          status: (record.status as PostReportRow["status"]) ?? "unreviewed",
          created_at: (record.created_at as string) ?? "",
          postTitle: (post.title as string) ?? "Untitled post",
          postContent: (post.content as string) ?? "",
          reporterName: (profile.full_name as string)?.trim() || "Unknown",
        };
      }),
    );
    setReportsLoading(false);
  }, []);

  const loadClubReports = useCallback(async () => {
    setClubReportsLoading(true);

    const { data, error } = await supabase
      .from("club_reports")
      .select("id, club_id, club_name, reporter_id, reason, description, current_url, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load club reports:", error.message);
      setClubReports([]);
      setClubReportsLoading(false);
      return;
    }

    const rows = data ?? [];
    const reporterIds = Array.from(
      new Set(rows.map((row) => row.reporter_id as string).filter(Boolean)),
    );
    const clubIds = Array.from(
      new Set(rows.map((row) => row.club_id as string).filter(Boolean)),
    );

    const profileMap = new Map<string, string>();
    const slugMap = new Map<string, string>();

    if (reporterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", reporterIds);

      (profiles ?? []).forEach((profile) => {
        profileMap.set(
          profile.id as string,
          (profile.full_name as string | null)?.trim() || "Unknown",
        );
      });
    }

    if (clubIds.length > 0) {
      const { data: clubs } = await supabase
        .from("clubs")
        .select("id, slug")
        .in("id", clubIds);

      (clubs ?? []).forEach((club) => {
        slugMap.set(club.id as string, (club.slug as string) ?? "");
      });
    }

    setClubReports(
      rows.map((row) => ({
        id: row.id as string,
        club_id: row.club_id as string,
        club_name: (row.club_name as string | null) ?? null,
        reporter_id: row.reporter_id as string,
        reason: (row.reason as string) ?? "",
        description: (row.description as string | null) ?? null,
        current_url: (row.current_url as string | null) ?? null,
        status: (row.status as ClubReportStatus) ?? "open",
        created_at: (row.created_at as string) ?? "",
        reporterName: profileMap.get(row.reporter_id as string) ?? "Unknown",
        clubSlug: slugMap.get(row.club_id as string) ?? null,
      })),
    );
    setClubReportsLoading(false);
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setFeedback(null);

    const { data, error } = await supabase
      .from("club_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Failed to load club requests:", error.message);
      setRequests([]);
      setFeedback("Failed to load club requests.");
      setRequestsLoading(false);
      return;
    }

    const rows = data ?? [];
    const submitterIds = [
      ...new Set(
        rows
          .map((row) => row.submitted_by as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const profileMap = new Map<
      string,
      { full_name: string | null; email: string | null }
    >();

    if (submitterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", submitterIds);

      (profiles ?? []).forEach((profile) => {
        profileMap.set(profile.id as string, {
          full_name: (profile.full_name as string) ?? null,
          email: (profile.email as string) ?? null,
        });
      });
    }

    setRequests(
      rows.map((row) => {
        const submitterId = row.submitted_by as string | null;
        const profile = submitterId ? profileMap.get(submitterId) : undefined;
        return {
          id: row.id as string,
          submitted_by: submitterId,
          club_id: (row.club_id as string | null) ?? null,
          name: (row.name as string) ?? "",
          short_description: (row.short_description as string) ?? null,
          long_description: (row.long_description as string) ?? null,
          category: (row.category as string) ?? null,
          requested_at: (row.requested_at as string) ?? "",
          status: (row.status as ClubRequestRow["status"]) ?? "pending",
          review_note: (row.review_note as string) ?? null,
          submitterName: profile?.full_name?.trim() || "Unknown",
          submitterEmail: profile?.email?.trim() || "",
        };
      }),
    );
    setRequestsLoading(false);
  }, []);

  const loadClaimRequests = useCallback(async () => {
    setClaimRequestsLoading(true);

    const { data, error } = await supabase
      .from("club_claim_requests")
      .select(
        `
        id,
        club_id,
        submitted_by,
        role_in_club,
        message,
        proof_url,
        contact_email,
        status,
        review_note,
        created_at,
        clubs ( name, slug )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load club claim requests:", error.message);
      setClaimRequests([]);
      setClaimRequestsLoading(false);
      return;
    }

    const rows = data ?? [];
    const submitterIds = [
      ...new Set(
        rows
          .map((row) => row.submitted_by as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const profileMap = new Map<
      string,
      { full_name: string | null; email: string | null }
    >();

    if (submitterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", submitterIds);

      (profiles ?? []).forEach((profile) => {
        profileMap.set(profile.id as string, {
          full_name: (profile.full_name as string) ?? null,
          email: (profile.email as string) ?? null,
        });
      });
    }

    setClaimRequests(
      rows.map((row) => {
        const record = row as Record<string, unknown>;
        const clubRaw = record.clubs as unknown;
        const club = (
          Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
        ) as Record<string, unknown>;
        const submitterId = record.submitted_by as string;
        const profile = profileMap.get(submitterId);
        return {
          id: record.id as string,
          club_id: record.club_id as string,
          submitted_by: submitterId,
          role_in_club: (record.role_in_club as string) ?? "",
          message: (record.message as string) ?? null,
          proof_url: (record.proof_url as string) ?? null,
          contact_email: (record.contact_email as string) ?? null,
          status:
            (record.status as ClubClaimRequestRow["status"]) ?? "pending",
          review_note: (record.review_note as string) ?? null,
          created_at: (record.created_at as string) ?? "",
          clubName: (club.name as string) ?? "Unknown club",
          clubSlug: (club.slug as string) ?? "",
          submitterName: profile?.full_name?.trim() || "Unknown",
          submitterEmail: profile?.email?.trim() || "",
        };
      }),
    );
    setClaimRequestsLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, program, year_of_study, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load users:", error.message);
      setUsers([]);
      setUsersLoading(false);
      return;
    }

    setUsers(
      (data ?? []).map((row) => ({
        id: row.id as string,
        full_name: (row.full_name as string) ?? null,
        email: (row.email as string) ?? null,
        avatar_url: (row.avatar_url as string) ?? null,
        program: (row.program as string) ?? null,
        year_of_study: (row.year_of_study as string) ?? null,
        created_at: (row.created_at as string) ?? "",
      })),
    );
    setUsersLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);

    const [usersRes, clubsRes, eventsRes, messagesRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("clubs").select("id", { count: "exact", head: true }),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true }),
    ]);

    setStats({
      users: usersRes.error ? 0 : (usersRes.count ?? 0),
      clubs: clubsRes.error ? 0 : (clubsRes.count ?? 0),
      events: eventsRes.error ? 0 : (eventsRes.count ?? 0),
      messages: messagesRes.error ? 0 : (messagesRes.count ?? 0),
    });
    setStatsLoading(false);
  }, []);

  const loadBugReports = useCallback(async () => {
    setBugReportsLoading(true);

    const { data: reports, error } = await supabase
      .from("bug_reports")
      .select(
        "id, page, description, severity, status, created_at, reported_by",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load bug reports:", error);
      setBugReports([]);
      setBugReportsLoading(false);
      return;
    }

    const reporterIds = (reports ?? [])
      .map((r) => r.reported_by as string | null)
      .filter(Boolean) as string[];

    let profileMap = new Map<string, string>();

    if (reporterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", reporterIds);

      (profiles ?? []).forEach((profile) => {
        profileMap.set(profile.id as string, (profile.full_name as string) ?? "");
      });
    }

    setBugReports(
      (reports ?? []).map((row) => ({
        id: row.id as string,
        page: (row.page as string) ?? null,
        description: (row.description as string) ?? "",
        severity: (row.severity as BugReportRow["severity"]) ?? "minor",
        status: (row.status as BugReportRow["status"]) ?? "open",
        created_at: (row.created_at as string) ?? "",
        reporterName:
          profileMap.get(row.reported_by as string)?.trim() || "Anonymous",
      })),
    );
    setBugReportsLoading(false);
  }, []);

  const loadClubActivity = useCallback(async () => {
    setClubActivityLoading(true);

    const { data: clubsData, error: clubsError } = await supabase
      .from("clubs")
      .select("id, name, abbreviation, logo_url");

    if (clubsError || !clubsData?.length) {
      if (clubsError) {
        console.error("Failed to load clubs for activity:", clubsError.message);
      }
      setClubActivity([]);
      setClubActivityLoading(false);
      return;
    }

    const clubIds = clubsData.map((club) => club.id as string);

    const [membersRes, postsRes] = await Promise.all([
      supabase
        .from("club_members")
        .select("club_id")
        .eq("status", "active")
        .in("club_id", clubIds),
      supabase
        .from("posts")
        .select("club_id, created_at")
        .in("club_id", clubIds)
        .order("created_at", { ascending: false }),
    ]);

    const memberCounts: Record<string, number> = {};
    (membersRes.data ?? []).forEach((row) => {
      const clubId = row.club_id as string;
      memberCounts[clubId] = (memberCounts[clubId] ?? 0) + 1;
    });

    const lastPostByClub: Record<string, string> = {};
    (postsRes.data ?? []).forEach((row) => {
      const clubId = row.club_id as string;
      if (!lastPostByClub[clubId]) {
        lastPostByClub[clubId] = row.created_at as string;
      }
    });

    const rows: ClubActivityRow[] = clubsData.map((club) => {
      const id = club.id as string;
      const lastPostAt = lastPostByClub[id] ?? null;
      const activityStatus = getActivityStatus(lastPostAt);
      return {
        id,
        name: (club.name as string) ?? "",
        abbreviation: (club.abbreviation as string) ?? null,
        logoUrl: (club.logo_url as string) ?? null,
        memberCount: memberCounts[id] ?? 0,
        lastPostAt,
        activityStatus,
      };
    });

    rows.sort(
      (a, b) =>
        activitySortOrder(a.activityStatus) - activitySortOrder(b.activityStatus),
    );

    setClubActivity(rows);
    setClubActivityLoading(false);
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab === "requests" ||
      tab === "claims" ||
      tab === "users" ||
      tab === "moderation" ||
      tab === "stats" ||
      tab === "bugs"
    ) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadRequests();
    void loadClaimRequests();
  }, [loadRequests, loadClaimRequests]);

  useEffect(() => {
    if (activeTab === "claims") void loadClaimRequests();
  }, [activeTab, loadClaimRequests]);

  useEffect(() => {
    if (activeTab === "users") void loadUsers();
  }, [activeTab, loadUsers]);

  useEffect(() => {
    if (activeTab === "stats") {
      void loadStats();
      void loadClubActivity();
    }
  }, [activeTab, loadStats, loadClubActivity]);

  useEffect(() => {
    if (activeTab === "moderation") {
      void loadReports();
      void loadClubReports();
    }
  }, [activeTab, loadReports, loadClubReports]);

  useEffect(() => {
    if (activeTab === "bugs") void loadBugReports();
  }, [activeTab, loadBugReports]);

  const filteredReports = useMemo(() => {
    if (reportFilter === "unreviewed") {
      return reports.filter((report) => report.status === "unreviewed");
    }
    if (reportFilter === "resolved") {
      return reports.filter(
        (report) => report.status === "resolved" || report.status === "dismissed",
      );
    }
    return reports;
  }, [reports, reportFilter]);

  const filteredClubReports = useMemo(() => {
    if (clubReportFilter === "all") return clubReports;
    return clubReports.filter((report) => report.status === clubReportFilter);
  }, [clubReports, clubReportFilter]);

  const filteredBugReports = useMemo(() => {
    if (bugFilter === "resolved") {
      return bugReports.filter((report) => report.status === "resolved");
    }
    return bugReports.filter((report) => report.status !== "resolved");
  }, [bugReports, bugFilter]);

  const filteredRequests = useMemo(() => {
    const statusFiltered =
      requestFilter === "all"
        ? requests
        : requests.filter((request) => request.status === requestFilter);
    const query = requestSearch.trim().toLowerCase();
    if (!query) return statusFiltered;

    return statusFiltered.filter((request) => {
      const clubName = request.name.toLowerCase();
      const submitterName = request.submitterName.toLowerCase();
      const submitterEmail = request.submitterEmail.toLowerCase();
      return (
        clubName.includes(query) ||
        submitterName.includes(query) ||
        submitterEmail.includes(query)
      );
    });
  }, [requests, requestFilter, requestSearch]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((row) => {
      const name = row.full_name?.toLowerCase() ?? "";
      const email = row.email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [users, userSearch]);

  const emptyRequestMessage = useMemo(() => {
    if (requestFilter === "pending") return "No pending requests";
    if (requestFilter === "approved") return "No approved requests";
    if (requestFilter === "rejected") return "No rejected requests";
    return "No club requests";
  }, [requestFilter]);

  const activeClaimRequests = useMemo(
    () =>
      claimRequests.filter(
        (request) => request.status === "pending" || request.status === "more_info",
      ),
    [claimRequests],
  );

  async function handleApproveClaim(request: ClubClaimRequestRow) {
    if (!user?.id) return;

    setClaimActionLoadingId(request.id);
    setFeedback(null);

    const { error: memberError } = await supabase.from("club_members").upsert(
      {
        club_id: request.club_id,
        user_id: request.submitted_by,
        role: "owner",
        status: "active",
        title: request.role_in_club,
      },
      { onConflict: "club_id,user_id" },
    );

    if (memberError) {
      console.error("Failed to create owner membership:", memberError.message);
      setFeedback("Failed to approve claim — could not add owner membership.");
      setClaimActionLoadingId(null);
      return;
    }

    const { error: clubError } = await supabase
      .from("clubs")
      .update({ claim_status: "claimed" })
      .eq("id", request.club_id);

    if (clubError) {
      console.error("Failed to update club claim status:", clubError.message);
      setFeedback("Owner added but club status could not be updated.");
      setClaimActionLoadingId(null);
      return;
    }

    const { error: requestError } = await supabase
      .from("club_claim_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestError) {
      console.error("Failed to update claim request:", requestError.message);
      setFeedback("Claim approved but request status could not be saved.");
      setClaimActionLoadingId(null);
      return;
    }

    await notifyClaimRequestApproved(supabase, {
      clubId: request.club_id,
      clubName: request.clubName,
      submitterUserId: request.submitted_by,
      claimRequestId: request.id,
    });

    setClaimActionLoadingId(null);
    await loadClaimRequests();
  }

  async function handleRejectClaim(request: ClubClaimRequestRow) {
    if (!user?.id) return;

    setClaimActionLoadingId(request.id);
    setFeedback(null);

    const { error: requestError } = await supabase
      .from("club_claim_requests")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestError) {
      console.error("Failed to reject claim request:", requestError.message);
      setFeedback("Failed to reject claim request.");
      setClaimActionLoadingId(null);
      return;
    }

    await supabase
      .from("clubs")
      .update({ claim_status: "unclaimed" })
      .eq("id", request.club_id)
      .eq("claim_status", "claim_pending");

    await notifyClaimRequestRejected(supabase, {
      clubId: request.club_id,
      clubName: request.clubName,
      clubSlug: request.clubSlug,
      submitterUserId: request.submitted_by,
      claimRequestId: request.id,
    });

    setClaimActionLoadingId(null);
    await loadClaimRequests();
  }

  async function handleRequestClaimMoreInfo() {
    if (!user?.id || !claimMoreInfoTarget) return;

    const note = claimMoreInfoNote.trim();
    if (!note) {
      setFeedback("Please enter a message for the claimant.");
      return;
    }

    setClaimActionLoadingId(claimMoreInfoTarget.id);
    setFeedback(null);

    const { error: updateError } = await supabase
      .from("club_claim_requests")
      .update({
        status: "more_info",
        review_note: note,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claimMoreInfoTarget.id);

    if (updateError) {
      console.error("Failed to save claim more-info request:", updateError.message);
      setFeedback("Failed to save your message.");
      setClaimActionLoadingId(null);
      return;
    }

    await notifyClaimRequestMoreInfo(supabase, {
      clubId: claimMoreInfoTarget.club_id,
      clubName: claimMoreInfoTarget.clubName,
      clubSlug: claimMoreInfoTarget.clubSlug,
      submitterUserId: claimMoreInfoTarget.submitted_by,
      claimRequestId: claimMoreInfoTarget.id,
      note,
    });

    setClaimMoreInfoTarget(null);
    setClaimMoreInfoNote("");
    setClaimActionLoadingId(null);
    void loadClaimRequests();
  }

  async function handleApprove(request: ClubRequestRow) {
    if (!user?.id) return;

    setActionLoadingId(request.id);
    setFeedback(null);
    setApprovalErrors((prev) => {
      const next = { ...prev };
      delete next[request.id];
      return next;
    });

    let clubId = request.club_id;
    const meta = parseRequestMeta(request.long_description);
    const slug = meta.slug || generateSlug(request.name);

    if (!clubId && request.submitted_by) {
      const { data: clubRow } = await supabase
        .from("clubs")
        .select("id")
        .eq("created_by", request.submitted_by)
        .eq("slug", slug)
        .maybeSingle();

      clubId = (clubRow?.id as string | undefined) ?? null;
    }

    if (!clubId) {
      if (!request.submitted_by) {
        const message = "Request has no submitter — cannot create a club.";
        console.error("Approval error:", message);
        setApprovalErrors((prev) => ({ ...prev, [request.id]: message }));
        setActionLoadingId(null);
        return;
      }

      const { data: createdClub, error: createError } = await supabase
        .from("clubs")
        .insert({
          name: request.name,
          slug,
          short_description: request.short_description,
          long_description: request.long_description,
          description: request.short_description || "",
          category: request.category || "",
          contact_email: meta.contact_email || "",
          meeting_schedule: meta.meeting_schedule || "",
          meeting_location: meta.meeting_location || null,
          abbreviation: deriveClubAbbreviation(request.name),
          is_public: true,
          created_by: request.submitted_by,
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Approval error:", createError);
        const message =
          createError.message || "Failed to create club from request.";
        setApprovalErrors((prev) => ({ ...prev, [request.id]: message }));
        setActionLoadingId(null);
        return;
      }

      clubId = (createdClub?.id as string | undefined) ?? null;
    }

    if (!clubId) {
      const message = "No club found or created for this request.";
      console.error("Approval error:", message);
      setApprovalErrors((prev) => ({ ...prev, [request.id]: message }));
      setActionLoadingId(null);
      return;
    }

    const { error } = await supabase
      .from("clubs")
      .update({ is_public: true })
      .eq("id", clubId);

    if (error) {
      console.error("Approval error:", error);
      const message = error.message || "Failed to approve club.";
      setApprovalErrors((prev) => ({ ...prev, [request.id]: message }));
      setActionLoadingId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("club_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (updateError) {
      console.error("Approval error:", updateError);
      const message =
        updateError.message ||
        "Club was approved but the request status could not be updated.";
      setApprovalErrors((prev) => ({ ...prev, [request.id]: message }));
      setActionLoadingId(null);
      return;
    }

    if (request.submitted_by) {
      await notifyClubRequestApproved(supabase, {
        clubId,
        clubName: request.name,
        submitterUserId: request.submitted_by,
        clubRequestId: request.id,
      });
    }

    setActionLoadingId(null);
    await loadRequests();
    setShowApprovalChecklist(true);
  }

  async function handleReject() {
    if (!user?.id || !rejectTarget?.submitted_by) return;

    setActionLoadingId(rejectTarget.id);
    setFeedback(null);

    const { error: updateError } = await supabase
      .from("club_requests")
      .update({
        status: "rejected",
        review_note: rejectNote.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", rejectTarget.id);

    if (updateError) {
      console.error("Failed to reject club request:", updateError.message);
      setFeedback("Failed to reject request.");
      setActionLoadingId(null);
      return;
    }

    await notifyClubRequestRejected(supabase, {
      clubName: rejectTarget.name,
      submitterUserId: rejectTarget.submitted_by,
      clubRequestId: rejectTarget.id,
      reviewNote: rejectNote.trim() || null,
    });

    setRejectTarget(null);
    setRejectNote("");
    setActionLoadingId(null);
    void loadRequests();
  }

  async function handleRequestMoreInfo() {
    if (!user?.id || !moreInfoTarget?.submitted_by) return;

    const note = moreInfoNote.trim();
    if (!note) {
      setFeedback("Please enter a message for the submitter.");
      return;
    }

    setActionLoadingId(moreInfoTarget.id);
    setFeedback(null);

    const { error: updateError } = await supabase
      .from("club_requests")
      .update({ review_note: note })
      .eq("id", moreInfoTarget.id);

    if (updateError) {
      console.error("Failed to save more info request:", updateError.message);
      setFeedback("Failed to save your message.");
      setActionLoadingId(null);
      return;
    }

    await notifyClubRequestMoreInfo(supabase, {
      clubName: moreInfoTarget.name,
      submitterUserId: moreInfoTarget.submitted_by,
      clubRequestId: moreInfoTarget.id,
      note,
    });

    setMoreInfoTarget(null);
    setMoreInfoNote("");
    setActionLoadingId(null);
    void loadRequests();
  }

  async function handleRemoveReportedPost(report: PostReportRow) {
    setReportActionLoadingId(report.id);
    setFeedback(null);

    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", report.post_id);

    if (deleteError) {
      console.error("Failed to delete post:", deleteError.message);
      setFeedback("Failed to remove post.");
      setReportActionLoadingId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("post_reports")
      .update({ status: "resolved" })
      .eq("id", report.id);

    if (updateError) {
      console.error("Failed to update report:", updateError.message);
      setFeedback("Post removed but report status could not be updated.");
    }

    setReportActionLoadingId(null);
    void loadReports();
  }

  async function handleDismissReport(report: PostReportRow) {
    setReportActionLoadingId(report.id);
    setFeedback(null);

    const { error } = await supabase
      .from("post_reports")
      .update({ status: "dismissed" })
      .eq("id", report.id);

    if (error) {
      console.error("Failed to dismiss report:", error.message);
      setFeedback("Failed to dismiss report.");
      setReportActionLoadingId(null);
      return;
    }

    setReportActionLoadingId(null);
    void loadReports();
  }

  async function handleClubReportStatusUpdate(
    report: ClubReportRow,
    status: ClubReportStatus,
  ) {
    if (!user?.id) return;

    setClubReportActionLoadingId(report.id);
    setFeedback(null);

    const { error } = await supabase
      .from("club_reports")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (error) {
      console.error("Failed to update club report:", error.message);
      setFeedback("Failed to update club report status.");
      setClubReportActionLoadingId(null);
      return;
    }

    setClubReportActionLoadingId(null);
    void loadClubReports();
  }

  async function handleBugStatusUpdate(
    reportId: string,
    status: BugReportRow["status"],
  ) {
    setBugActionLoadingId(reportId);
    setFeedback(null);

    const { error } = await supabase
      .from("bug_reports")
      .update({ status })
      .eq("id", reportId);

    if (error) {
      console.error("Failed to update bug report:", error.message);
      setFeedback("Failed to update bug report status.");
      setBugActionLoadingId(null);
      return;
    }

    setBugActionLoadingId(null);
    void loadBugReports();
  }

  const reportFilterPills: { value: ReportStatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unreviewed", label: "Unreviewed" },
    { value: "resolved", label: "Resolved" },
  ];

  const clubReportFilterPills: { value: ClubReportStatusFilter; label: string }[] =
    [
      { value: "all", label: "All" },
      { value: "open", label: "Open" },
      { value: "in_review", label: "In Review" },
      { value: "resolved", label: "Resolved" },
      { value: "dismissed", label: "Dismissed" },
    ];

  const requestFilterPills: { value: RequestStatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const bugFilterPills: { value: BugStatusFilter; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "resolved", label: "Resolved" },
  ];

  const pendingRequestCount = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests],
  );

  const headerQuickStats = [
    { label: "Total Users", value: stats.users },
    { label: "Total Clubs", value: stats.clubs },
    { label: "Total Requests", value: requests.length },
    { label: "Pending Review", value: pendingRequestCount },
  ];

  return (
    <div style={{ background: PAGE_BG, minHeight: "calc(100vh - 4rem)" }}>
      <header
        style={{
          background:
            "linear-gradient(135deg, #1a0505 0%, #2d0808 60%, #1a0505 100%)",
          borderBottom: "1px solid #3a1010",
          padding: "32px 40px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Admin Panel
          <span
            style={{
              display: "inline-block",
              background: "#E51937",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "4px",
              padding: "3px 8px",
              letterSpacing: "0.1em",
              verticalAlign: "middle",
              marginLeft: "12px",
            }}
          >
            ADMIN
          </span>
        </h1>
        <p style={{ fontSize: "13px", color: "#555555", margin: "4px 0 0" }}>
          GryphClubConnect Administration
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: "24px",
          }}
        >
          {headerQuickStats.map((item, index) => (
            <div
              key={item.label}
              style={{ display: "flex", alignItems: "center" }}
            >
              {index > 0 ? (
                <div
                  aria-hidden
                  style={{
                    width: "1px",
                    height: "36px",
                    background: "#3a1010",
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <HeaderQuickStat label={item.label} value={item.value} />
            </div>
          ))}
        </div>
      </header>

      <div style={{ padding: "20px 40px 0" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #1a1500, #2a2000)",
            border: "1px solid #3a2f00",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "24px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px" }}>
            Role Preview Mode
          </h2>
          <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 14px" }}>
            See the app exactly as a member, executive, or president would
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {(
              [
                { role: "member" as const, label: "View as Member" },
                { role: "executive" as const, label: "View as Executive" },
                { role: "owner" as const, label: "View as President" },
              ]
            ).map((item) => (
              <button
                key={item.role}
                type="button"
                onClick={() => startRolePreview(item.role, navigate)}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333333",
                  color: "#cccccc",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#111111",
          borderBottom: "1px solid #1e1e1e",
          padding: isMobile ? "0 16px" : "0 40px",
          display: "flex",
          alignItems: "flex-end",
          gap: "4px",
          overflowX: isMobile ? "auto" : undefined,
          flexWrap: isMobile ? "nowrap" : undefined,
        }}
      >
        <div style={{ display: "flex", flexWrap: isMobile ? "nowrap" : undefined, flexShrink: isMobile ? 0 : undefined }}>
        <AdminTabButton
          label="Club Requests"
          active={activeTab === "requests"}
          onClick={() => setActiveTab("requests")}
        />
        <AdminTabButton
          label="Club Claims"
          active={activeTab === "claims"}
          onClick={() => setActiveTab("claims")}
        />
        <AdminTabButton
          label="Users"
          active={activeTab === "users"}
          onClick={() => setActiveTab("users")}
        />
        <AdminTabButton
          label="Moderation"
          active={activeTab === "moderation"}
          onClick={() => setActiveTab("moderation")}
        />
        <AdminTabButton
          label="Stats"
          active={activeTab === "stats"}
          onClick={() => setActiveTab("stats")}
        />
        <AdminTabButton
          label="Bug Reports"
          active={activeTab === "bugs"}
          onClick={() => setActiveTab("bugs")}
        />
        </div>
      </div>

      <div style={{ padding: isMobile ? "24px 16px" : "32px 40px" }}>
        {feedback ? (
          <p
            role="alert"
            style={{
              fontSize: "13px",
              color: "#E51937",
              margin: "0 0 20px",
            }}
          >
            {feedback}
          </p>
        ) : null}

      {activeTab === "requests" ? (
        <section>
          <input
            type="search"
            placeholder="Search by club name or submitter…"
            value={requestSearch}
            onChange={(e) => setRequestSearch(e.target.value)}
            style={{
              width: "100%",
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: "14px",
              marginBottom: "16px",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {requestFilterPills.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setRequestFilter(pill.value)}
                style={pillButtonStyle(requestFilter === pill.value)}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {requestsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner label="Loading club requests…" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <FileText
                size={32}
                color="#333333"
                style={{ margin: "0 auto 12px", display: "block" }}
                aria-hidden
              />
              <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                {requestSearch.trim()
                  ? "No club requests match your search"
                  : requestFilter === "all"
                    ? "No club requests yet"
                    : emptyRequestMessage}
              </p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <article
                key={request.id}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderLeft: `3px solid ${requestCardAccent(request.status)}`,
                  borderRadius: "10px",
                  padding: "20px",
                  marginBottom: "12px",
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
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#ffffff",
                        margin: "0 0 6px",
                      }}
                    >
                      {request.name}
                    </h3>
                    <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
                      Submitted by {request.submitterName}
                      {request.submitterEmail
                        ? ` · ${request.submitterEmail}`
                        : ""}
                      {" · "}
                      {formatRequestDate(request.requested_at)}
                    </p>
                    {request.category ? (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "10px",
                          background: "#111111",
                          border: "1px solid #222222",
                          color: "#747676",
                          borderRadius: "20px",
                          padding: "3px 10px",
                          fontSize: "11px",
                        }}
                      >
                        {request.category}
                      </span>
                    ) : null}
                    {request.short_description ? (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#777777",
                          margin: "8px 0 0",
                          lineHeight: 1.45,
                        }}
                      >
                        {request.short_description}
                      </p>
                    ) : null}
                    {request.status === "rejected" && request.review_note ? (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#E51937",
                          margin: "8px 0 0",
                        }}
                      >
                        Rejection note: {request.review_note}
                      </p>
                    ) : null}
                  </div>
                  <span style={statusBadgeStyle(request.status)}>
                    {clubRequestStatusLabel(request.status)}
                  </span>
                </div>

                {request.status === "pending" ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                      gap: "10px",
                      marginTop: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        disabled={actionLoadingId === request.id}
                        onClick={() => void handleApprove(request)}
                        style={{
                          background: "#0d2b0d",
                          border: "1px solid #4ade80",
                          color: "#4ade80",
                          borderRadius: "6px",
                          padding: "8px 20px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor:
                            actionLoadingId === request.id
                              ? "not-allowed"
                              : "pointer",
                          opacity: actionLoadingId === request.id ? 0.6 : 1,
                        }}
                      >
                        {actionLoadingId === request.id ? "Working…" : "Approve"}
                      </button>
                      {approvalErrors[request.id] ? (
                        <p
                          style={{
                            color: "#E51937",
                            fontSize: 12,
                            marginTop: 4,
                            maxWidth: "280px",
                            textAlign: "right",
                          }}
                        >
                          {approvalErrors[request.id]}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={actionLoadingId === request.id}
                      onClick={() => {
                        setMoreInfoTarget(request);
                        setMoreInfoNote(request.review_note ?? "");
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid #FFC429",
                        color: "#FFC429",
                        borderRadius: "6px",
                        padding: "8px 20px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor:
                          actionLoadingId === request.id
                            ? "not-allowed"
                            : "pointer",
                        opacity: actionLoadingId === request.id ? 0.6 : 1,
                      }}
                    >
                      Request More Info
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === request.id}
                      onClick={() => {
                        setRejectTarget(request);
                        setRejectNote("");
                      }}
                      style={{
                        background: "#1a0505",
                        border: "1px solid #E51937",
                        color: "#E51937",
                        borderRadius: "6px",
                        padding: "8px 20px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor:
                          actionLoadingId === request.id
                            ? "not-allowed"
                            : "pointer",
                        opacity: actionLoadingId === request.id ? 0.6 : 1,
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </section>
      ) : null}

      {activeTab === "moderation" ? (
        <section>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 12px",
            }}
          >
            Club Reports
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {clubReportFilterPills.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setClubReportFilter(pill.value)}
                style={pillButtonStyle(clubReportFilter === pill.value)}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {clubReportsLoading ? (
            <div className="flex justify-center py-10">
              <Spinner label="Loading club reports…" />
            </div>
          ) : filteredClubReports.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: "#555555",
                fontSize: "14px",
                padding: "32px 0",
                margin: "0 0 32px",
              }}
            >
              No reports to review
            </p>
          ) : (
            <div style={{ marginBottom: "36px" }}>
              {filteredClubReports.map((report) => {
                const badge = clubReportStatusBadgeStyle(report.status);
                const isActionable =
                  report.status === "open" || report.status === "in_review";

                return (
                  <article
                    key={report.id}
                    style={{
                      background: "#1a1a1a",
                      border: "1px solid #242424",
                      borderLeft: `4px solid ${
                        report.status === "open" ? "#E51937" : "#333333"
                      }`,
                      borderRadius: "10px",
                      padding: "20px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "flex-start",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#777777",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            margin: "0 0 6px",
                          }}
                        >
                          Club Report
                        </p>
                        <h3
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "#ffffff",
                            margin: 0,
                          }}
                        >
                          {report.club_name ?? "Unknown club"}
                        </h3>
                      </div>
                      <span
                        style={{
                          ...badge,
                          borderRadius: "20px",
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {clubReportStatusLabel(report.status)}
                      </span>
                    </div>

                    <p style={{ fontSize: "13px", color: "#cccccc", margin: "0 0 8px" }}>
                      Reason: {clubReportReasonLabel(report.reason)}
                    </p>

                    {report.description ? (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#777777",
                          margin: "0 0 10px",
                          lineHeight: 1.5,
                        }}
                      >
                        {report.description}
                      </p>
                    ) : null}

                    <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 4px" }}>
                      Reported by {report.reporterName}
                    </p>
                    <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 14px" }}>
                      {formatRequestDate(report.created_at)}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {report.clubSlug ? (
                        <a
                          href={`/clubs/${report.clubSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: "transparent",
                            color: "#cccccc",
                            border: "1px solid #333333",
                            borderRadius: "6px",
                            padding: "8px 16px",
                            fontSize: "13px",
                            fontWeight: 500,
                            textDecoration: "none",
                          }}
                        >
                          View Club
                        </a>
                      ) : null}
                      {isActionable ? (
                        <>
                          {report.status === "open" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleClubReportStatusUpdate(
                                  report,
                                  "in_review",
                                )
                              }
                              disabled={clubReportActionLoadingId === report.id}
                              style={{
                                background: "#FFC429",
                                color: "#111111",
                                border: "none",
                                borderRadius: "6px",
                                padding: "8px 16px",
                                fontSize: "13px",
                                fontWeight: 600,
                                cursor:
                                  clubReportActionLoadingId === report.id
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  clubReportActionLoadingId === report.id
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              Mark In Review
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              void handleClubReportStatusUpdate(
                                report,
                                "resolved",
                              )
                            }
                            disabled={clubReportActionLoadingId === report.id}
                            style={{
                              background: "#E51937",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "8px 16px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor:
                                clubReportActionLoadingId === report.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                clubReportActionLoadingId === report.id ? 0.6 : 1,
                            }}
                          >
                            Mark Resolved
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleClubReportStatusUpdate(
                                report,
                                "dismissed",
                              )
                            }
                            disabled={clubReportActionLoadingId === report.id}
                            style={{
                              background: "transparent",
                              color: "#cccccc",
                              border: "1px solid #333333",
                              borderRadius: "6px",
                              padding: "8px 16px",
                              fontSize: "13px",
                              fontWeight: 500,
                              cursor:
                                clubReportActionLoadingId === report.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                clubReportActionLoadingId === report.id ? 0.6 : 1,
                            }}
                          >
                            Dismiss
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <h2
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 12px",
            }}
          >
            Post Reports
          </h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {reportFilterPills.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setReportFilter(pill.value)}
                style={pillButtonStyle(reportFilter === pill.value)}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {reportsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner label="Loading reports…" />
            </div>
          ) : filteredReports.length === 0 ? (
            <p style={{ textAlign: "center", color: "#555555", fontSize: "14px", padding: "48px 0" }}>
              No reports yet
            </p>
          ) : (
            filteredReports.map((report) => {
              const isUnreviewed = report.status === "unreviewed";
              return (
                <article
                  key={report.id}
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #242424",
                    borderLeft: `4px solid ${isUnreviewed ? "#E51937" : "#333333"}`,
                    borderRadius: "10px",
                    padding: "20px",
                    marginBottom: "12px",
                  }}
                >
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", margin: "0 0 8px" }}>
                    {report.postTitle}
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#777777",
                      margin: "0 0 10px",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {report.postContent}
                  </p>
                  <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 4px" }}>
                    Reported by {report.reporterName} · {report.reason}
                  </p>
                  <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 14px" }}>
                    {formatRequestDate(report.created_at)}
                  </p>
                  {isUnreviewed ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      <button
                        type="button"
                        onClick={() => void handleRemoveReportedPost(report)}
                        disabled={reportActionLoadingId === report.id}
                        style={{
                          background: "#E51937",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "8px 16px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: reportActionLoadingId === report.id ? "not-allowed" : "pointer",
                          opacity: reportActionLoadingId === report.id ? 0.6 : 1,
                        }}
                      >
                        Remove Post
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDismissReport(report)}
                        disabled={reportActionLoadingId === report.id}
                        style={{
                          background: "transparent",
                          color: "#cccccc",
                          border: "1px solid #333333",
                          borderRadius: "6px",
                          padding: "8px 16px",
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: reportActionLoadingId === report.id ? "not-allowed" : "pointer",
                          opacity: reportActionLoadingId === report.id ? 0.6 : 1,
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: "12px", color: "#777777", margin: 0, textTransform: "capitalize" }}>
                      Status: {report.status}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </section>
      ) : null}

      {activeTab === "users" ? (
        <section>
          <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 16px" }}>
            {users.length} user{users.length === 1 ? "" : "s"} total
          </p>
          <input
            type="search"
            placeholder="Search by name or email…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            style={{
              width: "100%",
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: "14px",
              marginBottom: "20px",
              boxSizing: "border-box",
            }}
          />

          {usersLoading ? (
            <div className="flex justify-center py-16">
              <Spinner label="Loading users…" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
              No users match your search.
            </p>
          ) : (
            filteredUsers.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "8px",
                }}
              >
                {row.avatar_url ? (
                  <img
                    src={row.avatar_url}
                    alt=""
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#2a2a2a",
                      color: "#888888",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {userInitials(row)}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#ffffff",
                      margin: "0 0 2px",
                    }}
                  >
                    {userDisplayName(row)}
                  </p>
                  <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
                    {row.email ?? "No email"}
                  </p>
                  {row.program || row.year_of_study ? (
                    <p style={{ fontSize: "12px", color: "#666666", margin: "4px 0 0" }}>
                      {[row.program, row.year_of_study].filter(Boolean).join(" · ")}
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
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#555555",
                      margin: 0,
                      textAlign: "right",
                    }}
                  >
                    Joined {formatJoinedDate(row.created_at)}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/profile/${row.id}`)}
                    style={{
                      background: "transparent",
                      border: "1px solid #333333",
                      color: "#cccccc",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <section>
          {statsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner label="Loading stats…" />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(4, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <AdminStatCard
                label="Total Users"
                value={stats.users}
                accentColor="#E51937"
              />
              <AdminStatCard
                label="Total Clubs"
                value={stats.clubs}
                accentColor="#FFC429"
              />
              <AdminStatCard
                label="Pending Claims"
                value={activeClaimRequests.length}
                accentColor="#747676"
              />
              <AdminStatCard
                label="Pending Club Requests"
                value={pendingRequestCount}
                accentColor="#6b7cff"
              />
            </div>
          )}

          <div style={{ marginTop: "40px" }}>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              Club Activity Monitor
            </h3>

            {clubActivityLoading ? (
              <div className="flex justify-center py-12">
                <Spinner label="Loading club activity…" />
              </div>
            ) : clubActivity.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                No clubs found
              </p>
            ) : isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {clubActivity.map((club) => (
                  <div
                    key={club.id}
                    style={{
                      background: "#1a1a1a",
                      border: "1px solid #242424",
                      borderRadius: "10px",
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "12px",
                        minWidth: 0,
                      }}
                    >
                      {club.logoUrl ? (
                        <img
                          src={club.logoUrl}
                          alt=""
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            border: "1px solid #2a2a2a",
                            background: "#2a2a2a",
                            color: "#888888",
                            fontSize: "12px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {deriveClubAbbreviation(club.abbreviation ?? club.name)}
                        </div>
                      )}
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#ffffff",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {club.name}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px 12px",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: "0 0 2px",
                            color: "#555555",
                            fontSize: "10px",
                            textTransform: "uppercase",
                          }}
                        >
                          Members
                        </p>
                        <p style={{ margin: 0, color: "#cccccc", fontSize: "13px" }}>
                          {club.memberCount}
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            margin: "0 0 2px",
                            color: "#555555",
                            fontSize: "10px",
                            textTransform: "uppercase",
                          }}
                        >
                          Last Post
                        </p>
                        <p style={{ margin: 0, color: "#777777", fontSize: "13px" }}>
                          {formatLastPostDate(club.lastPostAt)}
                        </p>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <span style={activityBadgeStyle(club.activityStatus)}>
                          {club.activityStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #242424",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    gap: 0,
                    padding: "12px 16px",
                    background: "#111111",
                  }}
                >
                  {["Club", "Members", "Last Post", "Status"].map((heading) => (
                    <span
                      key={heading}
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        color: "#555555",
                        letterSpacing: "0.06em",
                        fontWeight: 600,
                      }}
                    >
                      {heading}
                    </span>
                  ))}
                </div>
                {clubActivity.map((club, index) => (
                  <div
                    key={club.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr",
                      gap: 0,
                      padding: "12px 16px",
                      alignItems: "center",
                      background: index % 2 === 0 ? "#111111" : "#1a1a1a",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        minWidth: 0,
                      }}
                    >
                      {club.logoUrl ? (
                        <img
                          src={club.logoUrl}
                          alt=""
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            border: "1px solid #2a2a2a",
                            background: "#2a2a2a",
                            color: "#888888",
                            fontSize: "12px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {deriveClubAbbreviation(
                            club.abbreviation ?? club.name,
                          )}
                        </div>
                      )}
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#ffffff",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {club.name}
                      </span>
                    </div>
                    <span style={{ fontSize: "13px", color: "#cccccc" }}>
                      {club.memberCount}
                    </span>
                    <span style={{ fontSize: "13px", color: "#777777" }}>
                      {formatLastPostDate(club.lastPostAt)}
                    </span>
                    <span style={activityBadgeStyle(club.activityStatus)}>
                      {club.activityStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "claims" ? (
        <section>
          {claimRequestsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner label="Loading club claims…" />
            </div>
          ) : activeClaimRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                No active club claims
              </p>
            </div>
          ) : (
            activeClaimRequests.map((request) => (
              <article
                key={request.id}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderLeft: "3px solid #FFC429",
                  borderRadius: "10px",
                  padding: "20px",
                  marginBottom: "12px",
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
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#ffffff",
                        margin: "0 0 6px",
                      }}
                    >
                      {request.clubName}
                    </h3>
                    {request.status === "more_info" ? (
                      <span
                        style={{
                          display: "inline-block",
                          marginBottom: "8px",
                          border: "1px solid #FFC429",
                          color: "#FFC429",
                          background: "transparent",
                          borderRadius: "20px",
                          padding: "2px 8px",
                          fontSize: "10px",
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        More info requested
                      </span>
                    ) : null}
                    <p style={{ fontSize: "13px", color: "#777777", margin: "0 0 4px" }}>
                      Submitted by {request.submitterName}
                      {request.submitterEmail ? ` · ${request.submitterEmail}` : ""}
                    </p>
                    <p style={{ fontSize: "13px", color: "#aaaaaa", margin: "0 0 4px" }}>
                      Role: {request.role_in_club}
                    </p>
                    <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
                      {new Date(request.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    {request.message ? (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#cccccc",
                          margin: "12px 0 0",
                          lineHeight: 1.5,
                        }}
                      >
                        {request.message}
                      </p>
                    ) : null}
                    {request.proof_url ? (
                      <p style={{ fontSize: "12px", color: "#777777", margin: "8px 0 0" }}>
                        Proof:{" "}
                        <a
                          href={request.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#E51937" }}
                        >
                          {request.proof_url}
                        </a>
                      </p>
                    ) : null}
                    {request.contact_email ? (
                      <p style={{ fontSize: "12px", color: "#777777", margin: "4px 0 0" }}>
                        Contact: {request.contact_email}
                      </p>
                    ) : null}
                    {request.status === "more_info" && request.review_note ? (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#FFC429",
                          margin: "8px 0 0",
                          lineHeight: 1.5,
                        }}
                      >
                        Admin note: {request.review_note}
                      </p>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button
                      type="button"
                      disabled={claimActionLoadingId === request.id}
                      onClick={() => void handleApproveClaim(request)}
                      style={{
                        background: "#E51937",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={claimActionLoadingId === request.id}
                      onClick={() => {
                        setClaimMoreInfoTarget(request);
                        setClaimMoreInfoNote(request.review_note ?? "");
                      }}
                      style={{
                        background: "transparent",
                        color: "#FFC429",
                        border: "1px solid #FFC429",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Request More Info
                    </button>
                    <button
                      type="button"
                      disabled={claimActionLoadingId === request.id}
                      onClick={() => void handleRejectClaim(request)}
                      style={{
                        background: "transparent",
                        color: "#cccccc",
                        border: "1px solid #333333",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {activeTab === "bugs" ? (
        <section>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {bugFilterPills.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setBugFilter(pill.value)}
                style={pillButtonStyle(bugFilter === pill.value)}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {bugReportsLoading ? (
            <div className="flex justify-center py-16">
              <Spinner label="Loading bug reports…" />
            </div>
          ) : filteredBugReports.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
                {bugFilter === "resolved"
                  ? "No resolved bug reports yet"
                  : "No active bug reports"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredBugReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #242424",
                    borderRadius: "10px",
                    padding: "20px",
                    borderLeft: `3px solid ${bugSeverityBorderColor(report.severity)}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#777777",
                        fontFamily: "monospace",
                      }}
                    >
                      {report.page || "Unknown page"}
                    </span>
                    <span
                      style={{
                        background: "#111111",
                        border: "1px solid #333333",
                        color: "#cccccc",
                        borderRadius: "20px",
                        padding: "2px 8px",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {report.severity}
                    </span>
                    <span style={bugStatusBadgeStyle(report.status)}>
                      {report.status.replace("_", " ")}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#ffffff",
                      margin: "0 0 10px",
                      lineHeight: 1.5,
                    }}
                  >
                    {report.description}
                  </p>
                  <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 14px" }}>
                    Reported by {report.reporterName} ·{" "}
                    {new Date(report.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  {report.status !== "in_progress" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleBugStatusUpdate(report.id, "in_progress")
                      }
                      disabled={bugActionLoadingId === report.id}
                      style={{
                        background: "#111111",
                        border: "1px solid #333333",
                        color: "#cccccc",
                        borderRadius: "6px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        cursor: "pointer",
                        marginRight: "8px",
                      }}
                    >
                      Mark In Progress
                    </button>
                  ) : null}
                  {report.status !== "resolved" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleBugStatusUpdate(report.id, "resolved")
                      }
                      disabled={bugActionLoadingId === report.id}
                      style={{
                        background: "#111111",
                        border: "1px solid #333333",
                        color: "#cccccc",
                        borderRadius: "6px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Mark Resolved
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
      </div>

      {moreInfoTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: isMobile ? "#1a1a1a" : "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: isMobile ? "stretch" : "center",
            zIndex: 50,
            padding: isMobile ? 0 : "16px",
          }}
          onClick={() => {
            if (!actionLoadingId) setMoreInfoTarget(null);
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#1a1a1a",
              border: isMobile ? "none" : "1px solid #242424",
              borderRadius: isMobile ? 0 : "12px",
              padding: isMobile ? "24px 16px" : "24px",
              maxWidth: isMobile ? "none" : "420px",
              width: "100%",
              minHeight: isMobile ? "100%" : undefined,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setMoreInfoTarget(null)}
              disabled={Boolean(actionLoadingId)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
              }}
            >
              <X size={18} aria-hidden />
            </button>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 8px",
              }}
            >
              Request more info for &ldquo;{moreInfoTarget.name}&rdquo;
            </h3>
            <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 16px" }}>
              Message for the submitter:
            </p>
            <textarea
              value={moreInfoNote}
              onChange={(e) => setMoreInfoNote(e.target.value)}
              rows={4}
              placeholder="What additional details do you need?"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#ffffff",
                fontSize: "14px",
                marginBottom: "16px",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={() => void handleRequestMoreInfo()}
              disabled={Boolean(actionLoadingId)}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid #FFC429",
                color: "#FFC429",
                borderRadius: "6px",
                padding: "10px 24px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: actionLoadingId ? "not-allowed" : "pointer",
                opacity: actionLoadingId ? 0.6 : 1,
              }}
            >
              {actionLoadingId ? "Sending…" : "Send Request"}
            </button>
          </div>
        </div>
      ) : null}

      {claimMoreInfoTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: isMobile ? "#1a1a1a" : "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: isMobile ? "stretch" : "center",
            zIndex: 50,
            padding: isMobile ? 0 : "16px",
          }}
          onClick={() => {
            if (!claimActionLoadingId) setClaimMoreInfoTarget(null);
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#1a1a1a",
              border: isMobile ? "none" : "1px solid #242424",
              borderRadius: isMobile ? 0 : "12px",
              padding: isMobile ? "24px 16px" : "24px",
              maxWidth: isMobile ? "none" : "420px",
              width: "100%",
              minHeight: isMobile ? "100%" : undefined,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setClaimMoreInfoTarget(null)}
              disabled={Boolean(claimActionLoadingId)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={20} />
            </button>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 8px",
              }}
            >
              Request more info for &ldquo;{claimMoreInfoTarget.clubName}&rdquo;
            </h3>
            <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 16px" }}>
              Message for the claimant:
            </p>
            <textarea
              value={claimMoreInfoNote}
              onChange={(e) => setClaimMoreInfoNote(e.target.value)}
              rows={4}
              placeholder="What additional details do you need?"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#ffffff",
                fontSize: "14px",
                marginBottom: "16px",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={() => void handleRequestClaimMoreInfo()}
              disabled={Boolean(claimActionLoadingId)}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid #FFC429",
                color: "#FFC429",
                borderRadius: "6px",
                padding: "10px 24px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: claimActionLoadingId ? "not-allowed" : "pointer",
                opacity: claimActionLoadingId ? 0.6 : 1,
              }}
            >
              {claimActionLoadingId ? "Sending…" : "Send Request"}
            </button>
          </div>
        </div>
      ) : null}

      {rejectTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: isMobile ? "#1a1a1a" : "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: isMobile ? "stretch" : "center",
            zIndex: 50,
            padding: isMobile ? 0 : "16px",
          }}
          onClick={() => {
            if (!actionLoadingId) setRejectTarget(null);
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#1a1a1a",
              border: isMobile ? "none" : "1px solid #242424",
              borderRadius: isMobile ? 0 : "12px",
              padding: isMobile ? "24px 16px" : "24px",
              maxWidth: isMobile ? "none" : "420px",
              width: "100%",
              minHeight: isMobile ? "100%" : undefined,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setRejectTarget(null)}
              disabled={Boolean(actionLoadingId)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
              }}
            >
              <X size={18} aria-hidden />
            </button>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 8px",
              }}
            >
              Reject &ldquo;{rejectTarget.name}&rdquo;?
            </h3>
            <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 16px" }}>
              Optional note for the submitter:
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              placeholder="Reason for rejection…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#ffffff",
                fontSize: "14px",
                marginBottom: "16px",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={Boolean(actionLoadingId)}
              style={{
                width: "100%",
                background: "#1a0505",
                border: "1px solid #E51937",
                color: "#E51937",
                borderRadius: "6px",
                padding: "10px 24px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: actionLoadingId ? "not-allowed" : "pointer",
                opacity: actionLoadingId ? 0.6 : 1,
              }}
            >
              {actionLoadingId ? "Rejecting…" : "Confirm Reject"}
            </button>
          </div>
        </div>
      ) : null}

      {showApprovalChecklist ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: isMobile ? "#1a1a1a" : "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: isMobile ? "stretch" : "center",
            zIndex: 50,
            padding: isMobile ? 0 : "16px",
          }}
          onClick={() => setShowApprovalChecklist(false)}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: isMobile ? "none" : "1px solid #242424",
              borderRadius: isMobile ? 0 : "12px",
              padding: isMobile ? "28px 16px" : "28px",
              maxWidth: isMobile ? "none" : "480px",
              width: "100%",
              minHeight: isMobile ? "100%" : undefined,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 20px",
              }}
            >
              Club approved — here&apos;s what happens next
            </h3>
            <ul
              style={{
                listStyle: "none",
                margin: "0 0 24px",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {[
                { done: true, label: "Club workspace created" },
                { done: true, label: "Creator assigned as President" },
                { done: false, label: "Club adds description and logo" },
                { done: false, label: "Club creates first announcement" },
                { done: false, label: "Club invites first member" },
              ].map((item) => (
                <li
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "14px",
                    color: item.done ? "#ffffff" : "#777777",
                  }}
                >
                  {item.done ? (
                    <Check size={16} color="#E51937" aria-hidden />
                  ) : (
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: "2px solid #333333",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowApprovalChecklist(false)}
              style={{
                width: "100%",
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
