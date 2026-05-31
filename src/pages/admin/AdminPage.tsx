import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { FileText, X, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import { notifyUsers } from "../../lib/notifyUsers";
import Spinner from "../../components/ui/Spinner";

type AdminTab = "requests" | "users" | "moderation" | "stats" | "bugs";
type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";
type ReportStatusFilter = "all" | "unreviewed" | "resolved";
type BugStatusFilter = "all" | "open" | "in_progress" | "resolved";
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

interface ClubRequestRow {
  id: string;
  submitted_by: string | null;
  name: string;
  short_description: string | null;
  long_description: string | null;
  category: string | null;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  submitterName: string;
  submitterEmail: string;
}

interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
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
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("requests");

  const [requests, setRequests] = useState<ClubRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestFilter, setRequestFilter] = useState<RequestStatusFilter>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<ClubRequestRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

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

  const [showApprovalChecklist, setShowApprovalChecklist] = useState(false);

  const [bugReports, setBugReports] = useState<BugReportRow[]>([]);
  const [bugReportsLoading, setBugReportsLoading] = useState(true);
  const [bugFilter, setBugFilter] = useState<BugStatusFilter>("all");
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

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, created_at")
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

    const { data, error } = await supabase
      .from("bug_reports")
      .select(
        `
        id,
        page,
        description,
        severity,
        status,
        created_at,
        profiles!bug_reports_reported_by_fkey ( full_name )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load bug reports:", error.message);
      setBugReports([]);
      setBugReportsLoading(false);
      return;
    }

    setBugReports(
      (data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const profileRaw = record.profiles as unknown;
        const profile = (
          Array.isArray(profileRaw) ? profileRaw[0] ?? {} : profileRaw ?? {}
        ) as Record<string, unknown>;
        return {
          id: record.id as string,
          page: (record.page as string) ?? null,
          description: (record.description as string) ?? "",
          severity:
            (record.severity as BugReportRow["severity"]) ?? "minor",
          status: (record.status as BugReportRow["status"]) ?? "open",
          created_at: (record.created_at as string) ?? "",
          reporterName: (profile.full_name as string)?.trim() || "Unknown",
        };
      }),
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
    void loadRequests();
  }, [loadRequests]);

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
    if (activeTab === "moderation") void loadReports();
  }, [activeTab, loadReports]);

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

  const filteredBugReports = useMemo(() => {
    if (bugFilter === "all") return bugReports;
    return bugReports.filter((report) => report.status === bugFilter);
  }, [bugReports, bugFilter]);

  const filteredRequests = useMemo(() => {
    if (requestFilter === "all") return requests;
    return requests.filter((request) => request.status === requestFilter);
  }, [requests, requestFilter]);

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

  async function handleApprove(request: ClubRequestRow) {
    if (!user?.id || !request.submitted_by) return;

    setActionLoadingId(request.id);
    setFeedback(null);

    const meta = parseRequestMeta(request.long_description);

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .insert({
        name: request.name,
        slug: meta.slug || generateSlug(request.name),
        description: request.short_description ?? "",
        category: request.category ?? "",
        contact_email: meta.contact_email ?? "",
        meeting_schedule: meta.meeting_schedule ?? "",
        meeting_location: meta.meeting_location ?? "",
        social_links: meta.social_links ?? null,
        created_by: request.submitted_by,
        is_public: true,
      })
      .select("id")
      .single();

    if (clubError || !club) {
      console.error("Failed to create club from request:", clubError?.message);
      setFeedback(
        clubError?.message ??
          "Failed to approve request. Ensure admin database policies are configured.",
      );
      setActionLoadingId(null);
      return;
    }

    const clubId = club.id as string;

    const { error: memberError } = await supabase.from("club_members").insert({
      club_id: clubId,
      user_id: request.submitted_by,
      role: "owner",
      status: "active",
    });

    if (memberError) {
      console.error("Failed to add club owner membership:", memberError.message);
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
      console.error("Failed to update club request:", updateError.message);
      setFeedback("Club was created but the request status could not be updated.");
      setActionLoadingId(null);
      return;
    }

    await notifyUsers([
      {
        user_id: request.submitted_by,
        type: "club_update",
        message: `Your club request for "${request.name}" has been approved!`,
        club_id: clubId,
        reference_id: request.id,
      },
    ]);

    setActionLoadingId(null);
    void loadRequests();
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

    await notifyUsers([
      {
        user_id: rejectTarget.submitted_by,
        type: "club_update",
        message: rejectNote.trim()
          ? `Your club request for "${rejectTarget.name}" was rejected: ${rejectNote.trim()}`
          : `Your club request for "${rejectTarget.name}" was rejected.`,
        reference_id: rejectTarget.id,
      },
    ]);

    setRejectTarget(null);
    setRejectNote("");
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

  const requestFilterPills: { value: RequestStatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const bugFilterPills: { value: BugStatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
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
          padding: "0 40px",
          display: "flex",
          alignItems: "flex-end",
          gap: "4px",
        }}
      >
        <AdminTabButton
          label="Club Requests"
          active={activeTab === "requests"}
          onClick={() => setActiveTab("requests")}
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

      <div style={{ padding: "32px 40px" }}>
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
                {requestFilter === "all"
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
                    {request.status}
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
                </div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#555555",
                    margin: 0,
                    flexShrink: 0,
                    textAlign: "right",
                  }}
                >
                  Joined {formatJoinedDate(row.created_at)}
                </p>
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
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
                label="Total Events"
                value={stats.events}
                accentColor="#747676"
              />
              <AdminStatCard
                label="Total Messages"
                value={stats.messages}
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
                No bug reports yet
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
                    <span
                      style={{
                        background: "#111111",
                        border: "1px solid #333333",
                        color: "#777777",
                        borderRadius: "20px",
                        padding: "2px 8px",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
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

      {rejectTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
          onClick={() => {
            if (!actionLoadingId) setRejectTarget(null);
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
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
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
          onClick={() => setShowApprovalChecklist(false)}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "28px",
              maxWidth: "480px",
              width: "100%",
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
