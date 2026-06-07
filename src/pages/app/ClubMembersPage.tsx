import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import { normalizeJoinType } from "../../lib/clubJoinUtils";
import { notifyUsers } from "../../lib/notifyUsers";
import type { ClubJoinType, ClubMember, JoinAnswer, MemberRole } from "../../types";
import {
  isPrivilegedClubRole,
  isTopClubModeratorRole,
} from "../../lib/clubRoles";
import Button from "../../components/ui/Button";
import ClubInviteModal from "../../components/club/ClubInviteModal";
import Spinner from "../../components/ui/Spinner";

const memberProfileLinkStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "14px",
  color: "#ffffff",
  textDecoration: "none",
};

function MemberNameLink({
  userId,
  children,
  className,
  style,
}: {
  userId: string;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link
      to={`/app/profile/${userId}`}
      className={className}
      style={{ ...memberProfileLinkStyle, ...style }}
    >
      {children}
    </Link>
  );
}
type MemberRoleFilter = "all" | "executives" | "members";

const MEMBER_FILTER_OPTIONS: { value: MemberRoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "executives", label: "Executives" },
  { value: "members", label: "Members" },
];

const memberListCardStyle: CSSProperties = {
  background: "#141414",
  borderTop: "1px solid #2a2a2a",
  borderRight: "1px solid #2a2a2a",
  borderBottom: "1px solid #2a2a2a",
  borderLeft: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "14px 20px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginBottom: "8px",
};

const memberCardStyle: CSSProperties = {
  backgroundColor: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "14px 16px",
};

function avatarFallbackBackground(name: string): string {
  const palette = ["#1a0505", "#1a1200", "#1a1a1a", "#1a0a14"];
  const code = name.trim().charCodeAt(0) || 65;
  return palette[code % palette.length];
}

function roleBadgeStyle(role: MemberRole | string): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 600,
    flexShrink: 0,
    display: "inline-block",
  };
  switch (role) {
    case "owner":
      return {
        ...base,
        background: "#1a1200",
        border: "1px solid #FFC429",
        color: "#FFC429",
      };
    case "executive":
      return {
        ...base,
        background: "#1a0505",
        border: "1px solid #E51937",
        color: "#E51937",
      };
    default:
      return {
        ...base,
        background: "#1a1a1a",
        border: "1px solid #333333",
        color: "#555555",
      };
  }
}

function StatCard({
  label,
  value,
  topColor,
  valueColor = "#ffffff",
}: {
  label: string;
  value: number;
  topColor: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: "#141414",
        borderRadius: "12px",
        padding: "16px 20px",
        flex: 1,
        minWidth: 0,
        borderTop: `3px solid ${topColor}`,
        borderRight: "1px solid #2a2a2a",
        borderBottom: "1px solid #2a2a2a",
        borderLeft: "1px solid #2a2a2a",
      }}
    >
      <p
        style={{
          fontSize: "24px",
          fontWeight: 800,
          color: valueColor,
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#555555",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginTop: "4px",
          marginBottom: 0,
        }}
      >
        {label}
      </p>
    </div>
  );
}

const outlineActionButtonStyle = (hovered: boolean): CSSProperties => ({
  background: "transparent",
  border: `1px solid ${hovered ? "#555555" : "#2a2a2a"}`,
  color: hovered ? "#aaaaaa" : "#555555",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  cursor: "pointer",
  transition: "border-color 0.15s ease, color 0.15s ease",
});

const removeActionButtonStyle = (hovered: boolean): CSSProperties => ({
  background: "transparent",
  border: `1px solid ${hovered ? "#E51937" : "#2a2a2a"}`,
  color: hovered ? "#E51937" : "#555555",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  cursor: "pointer",
  transition: "border-color 0.15s ease, color 0.15s ease",
});

function normalizeMemberRole(role: string): MemberRole {
  if (role === "executive" || role === "exec") return "executive";
  if (role === "owner") return "owner";
  return "member";
}

function formatRoleLabel(role: MemberRole | string): string {
  if (role === "executive" || role === "exec") return "Executive";
  if (role === "owner") return "President";
  return "Member";
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "owner", label: "President" },
  { value: "executive", label: "Executive" },
  { value: "member", label: "Member" },
];

const roleOptionCardBase: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: 600,
  color: "#ffffff",
};

function roleOptionCardSelected(base: CSSProperties): CSSProperties {
  return {
    ...base,
    border: "1px solid #E51937",
    background: "#1f0a0a",
  };
}

function RoleSelector({
  value,
  onChange,
}: {
  value: MemberRole;
  onChange: (value: MemberRole) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {ROLE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          style={
            value === option.value
              ? roleOptionCardSelected(roleOptionCardBase)
              : roleOptionCardBase
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MemberAvatar({
  avatarUrl,
  name,
  size = 40,
  borderWidth = 2,
  borderColor = "#2a2a2a",
}: {
  avatarUrl?: string | null;
  name: string;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
}) {
  const style: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    border: `${borderWidth}px solid ${borderColor}`,
  };
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 object-cover"
        style={style}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold"
      style={{
        ...style,
        backgroundColor: avatarFallbackBackground(name),
        color: "#ffffff",
        fontSize: size <= 36 ? "12px" : "14px",
        fontWeight: 700,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

type ViewMode = "list" | "orgChart" | "applications";
type ApplicationFilter = "pending" | "approved" | "rejected";

interface JoinApplicationRow {
  id: string;
  applicantId: string;
  answers: JoinAnswer[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  fullName: string;
  avatarUrl?: string;
}

interface JoinVoteRow {
  applicantId: string;
  voterId: string;
  vote: "yes" | "no";
}

interface OrgChartMember {
  id: string;
  userId: string;
  role: MemberRole;
  title: string | null;
  reportsTo: string | null;
  fullName: string;
  avatarUrl?: string | null;
}

function orgCardStyle(leadership: boolean): CSSProperties {
  return {
    background: "#141414",
    borderTop: "1px solid #2a2a2a",
    borderRight: "1px solid #2a2a2a",
    borderBottom: "1px solid #2a2a2a",
    borderLeft: leadership ? "3px solid #E51937" : "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "16px 20px",
    textAlign: "center",
    minWidth: "160px",
    maxWidth: "180px",
    boxSizing: "border-box",
  };
}

const connectorLine: CSSProperties = {
  width: "1px",
  background: "#333",
  height: "32px",
};

function OrgChartCard({
  member,
  tier,
}: {
  member: OrgChartMember;
  tier: "president" | "executive" | "team";
}) {
  const displayName = member.fullName || "Unknown";

  if (tier === "president") {
    return (
      <div style={orgCardStyle(true)}>
        <div className="mb-2 flex justify-center">
          <MemberAvatar
            avatarUrl={member.avatarUrl}
            name={displayName}
            size={60}
            borderWidth={3}
            borderColor="#E51937"
          />
        </div>
        <MemberNameLink
          userId={member.userId}
          style={{ fontSize: "14px", fontWeight: 700, marginTop: "8px", display: "block" }}
        >
          {displayName}
        </MemberNameLink>
        <span style={{ ...roleBadgeStyle("owner"), marginTop: "6px" }}>President</span>
        {member.title ? (
          <p
            style={{
              fontSize: "11px",
              color: "#747676",
              fontStyle: "italic",
              margin: "8px 0 0",
            }}
          >
            {member.title}
          </p>
        ) : null}
      </div>
    );
  }

  if (tier === "executive") {
    return (
      <div style={orgCardStyle(true)}>
        <div className="mb-2 flex justify-center">
          <MemberAvatar
            avatarUrl={member.avatarUrl}
            name={displayName}
            size={48}
            borderWidth={2}
            borderColor="#E51937"
          />
        </div>
        <MemberNameLink
          userId={member.userId}
          style={{ fontSize: "14px", fontWeight: 700, marginTop: "8px", display: "block" }}
        >
          {displayName}
        </MemberNameLink>
        <span style={{ ...roleBadgeStyle("executive"), marginTop: "6px" }}>Executive</span>
        {member.title ? (
          <p
            style={{
              fontSize: "11px",
              color: "#747676",
              fontStyle: "italic",
              margin: "8px 0 0",
            }}
          >
            {member.title}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={orgCardStyle(false)}>
      <div className="mb-2 flex justify-center">
        <MemberAvatar
          avatarUrl={member.avatarUrl}
          name={displayName}
          size={36}
          borderWidth={1}
          borderColor="#333333"
        />
      </div>
      <MemberNameLink
        userId={member.userId}
        className="block"
        style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", marginTop: "8px" }}
      >
        {displayName}
      </MemberNameLink>
      {member.title ? (
        <p
          style={{
            fontSize: "11px",
            color: "#747676",
            margin: 0,
          }}
        >
          {member.title}
        </p>
      ) : null}
    </div>
  );
}

function OrgChartView({ members }: { members: OrgChartMember[] }) {
  const presidents = members.filter((m) => m.role === "owner");
  const executives = members.filter((m) => m.role === "executive");
  const leaderIds = new Set([
    ...presidents.map((m) => m.userId),
    ...executives.map((m) => m.userId),
  ]);

  const teamMembers = members.filter(
    (m) =>
      m.role !== "owner" &&
      m.role !== "executive" &&
      m.reportsTo &&
      leaderIds.has(m.reportsTo),
  );

  const teamByLeader = new Map<string, OrgChartMember[]>();
  for (const member of teamMembers) {
    if (!member.reportsTo) continue;
    const list = teamByLeader.get(member.reportsTo) ?? [];
    list.push(member);
    teamByLeader.set(member.reportsTo, list);
  }

  const hasChart =
    presidents.length > 0 || executives.length > 0 || teamMembers.length > 0;

  if (!hasChart) {
    return (
      <div
        className="p-8 text-center"
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "8px",
        }}
      >
        <p style={{ fontSize: "14px", color: "#555555" }}>
          No org chart to display yet. Assign presidents and executives, then
          set &quot;Reports To&quot; for team members.
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "24px" }}>
      {presidents.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            {presidents.map((president) => {
              const directReports = teamByLeader.get(president.userId) ?? [];
              return (
                <div
                  key={president.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <OrgChartCard member={president} tier="president" />
                  {directReports.length > 0 ? (
                    <>
                      <div style={connectorLine} />
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "center",
                          gap: "12px",
                        }}
                      >
                        {directReports.map((m) => (
                          <OrgChartCard key={m.id} member={m} tier="team" />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
          {executives.length > 0 ? <div style={connectorLine} /> : null}
        </div>
      ) : null}

      {executives.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: presidents.length > 0 ? 0 : undefined,
          }}
        >
          {!presidents.length ? null : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            {executives.map((executive) => {
              const directReports = teamByLeader.get(executive.userId) ?? [];
              return (
                <div
                  key={executive.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <OrgChartCard member={executive} tier="executive" />
                  {directReports.length > 0 ? (
                    <>
                      <div style={connectorLine} />
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "center",
                          gap: "12px",
                        }}
                      >
                        {directReports.map((m) => (
                          <OrgChartCard key={m.id} member={m} tier="team" />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ClubMembersPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { getClubById, getUserRole, updateClub } = useClubContext();
  const club = getClubById(clubId ?? "");

  const role = getUserRole(clubId ?? "");
  const isOwner = role === "owner";
  const isExecutive = role === "executive";
  /** Admin or owner may change member roles / remove members; exec sees queue only. */
  const canReorderRoster = isTopClubModeratorRole(role);
  const canUseMembershipQueue = isPrivilegedClubRole(role);

  const { members, pendingMembers, loading, removeMember, approveRequest, rejectRequest, refresh } =
    useClubMembers(clubId);
  const isMobile = useIsMobile();

  const [viewMode, setViewMode] = useState<ViewMode>("orgChart");
  const [orgChartMembers, setOrgChartMembers] = useState<OrgChartMember[]>([]);
  const [orgChartLoading, setOrgChartLoading] = useState(true);
  const [memberTitles, setMemberTitles] = useState<Record<string, string | null>>({});
  const [memberReportsTo, setMemberReportsTo] = useState<
    Record<string, string | null>
  >({});
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<MemberRole>("member");
  const [editTitle, setEditTitle] = useState("");
  const [editReportsTo, setEditReportsTo] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [memberRoleFilter, setMemberRoleFilter] = useState<MemberRoleFilter>("all");
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [joinType, setJoinType] = useState<ClubJoinType>("open");
  const [applications, setApplications] = useState<JoinApplicationRow[]>([]);
  const [applicationVotes, setApplicationVotes] = useState<JoinVoteRow[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState<ApplicationFilter>("pending");
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);

  const roleOrder: Record<MemberRole, number> = {
    owner: 0,
    executive: 1,
    member: 2,
  };
  const sortedMembers = [...members].sort(
    (a, b) =>
      (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99),
  );

  const memberStats = useMemo(() => {
    const executives = members.filter(
      (m) => m.role === "owner" || m.role === "executive",
    ).length;
    const generalMembers = members.filter((m) => m.role === "member").length;
    return {
      total: members.length,
      executives,
      generalMembers,
      pendingInvites: pendingInviteCount,
    };
  }, [members, pendingInviteCount]);

  const filteredMembers = useMemo(() => {
    let result = sortedMembers;
    if (memberRoleFilter === "executives") {
      result = result.filter(
        (m) => m.role === "owner" || m.role === "executive",
      );
    } else if (memberRoleFilter === "members") {
      result = result.filter((m) => m.role === "member");
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (m) =>
          (m.fullName?.toLowerCase().includes(query) ?? false) ||
          (m.email?.toLowerCase().includes(query) ?? false) ||
          (m.program?.toLowerCase().includes(query) ?? false),
      );
    }
    return result;
  }, [sortedMembers, memberRoleFilter, searchQuery]);

  const loadMemberMeta = useCallback(async () => {
    if (!clubId) return;
    const { data, error } = await supabase
      .from("club_members")
      .select("id, title, reports_to")
      .eq("club_id", clubId);

    if (error) {
      console.error("Failed to load member metadata:", error.message);
      return;
    }

    const titleMap: Record<string, string | null> = {};
    const reportsMap: Record<string, string | null> = {};
    (data ?? []).forEach((row) => {
      const id = row.id as string;
      titleMap[id] = (row.title as string | null) ?? null;
      reportsMap[id] = (row.reports_to as string | null) ?? null;
    });
    setMemberTitles(titleMap);
    setMemberReportsTo(reportsMap);
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    if (club?.joinType) {
      setJoinType(club.joinType);
      return;
    }
    supabase
      .from("clubs")
      .select("join_type")
      .eq("id", clubId)
      .maybeSingle()
      .then(({ data }) => {
        setJoinType(normalizeJoinType(data?.join_type));
      });
  }, [clubId, club?.joinType]);

  useEffect(() => {
    if (!clubId) return;
    void (async () => {
      const { count, error } = await supabase
        .from("club_invites")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("status", "pending");

      if (error) {
        console.error("Failed to load pending invites:", error.message);
        setPendingInviteCount(0);
        return;
      }
      setPendingInviteCount(count ?? 0);
    })();
  }, [clubId, showInviteModal]);

  const loadApplications = useCallback(async () => {
    if (!clubId) return;
    setApplicationsLoading(true);

    const { data, error } = await supabase
      .from("club_join_applications")
      .select("id, applicant_id, answers, status, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load join applications:", error.message);
      setApplications([]);
      setApplicationVotes([]);
      setApplicationsLoading(false);
      return;
    }

    const applicantIds = [
      ...new Set((data ?? []).map((row) => row.applicant_id as string)),
    ];

    let profileMap: Record<string, { fullName: string; avatarUrl?: string }> =
      {};
    if (applicantIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", applicantIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map((row) => [
          row.id as string,
          {
            fullName: (row.full_name as string)?.trim() || "Unknown",
            avatarUrl: (row.avatar_url as string) ?? undefined,
          },
        ]),
      );
    }

    const mapped: JoinApplicationRow[] = (data ?? []).map((row) => {
      const applicantId = row.applicant_id as string;
      const profile = profileMap[applicantId];
      const answersRaw = row.answers;
      const answers = Array.isArray(answersRaw)
        ? (answersRaw as JoinAnswer[])
        : [];
      return {
        id: row.id as string,
        applicantId,
        answers,
        status: row.status as JoinApplicationRow["status"],
        createdAt: row.created_at as string,
        fullName: profile?.fullName ?? "Unknown",
        avatarUrl: profile?.avatarUrl,
      };
    });

    setApplications(mapped);

    if (joinType === "vote" && applicantIds.length > 0) {
      const { data: votes } = await supabase
        .from("club_join_votes")
        .select("applicant_id, voter_id, vote")
        .eq("club_id", clubId)
        .in("applicant_id", applicantIds);

      setApplicationVotes(
        (votes ?? []).map((row) => ({
          applicantId: row.applicant_id as string,
          voterId: row.voter_id as string,
          vote: row.vote as "yes" | "no",
        })),
      );
    } else {
      setApplicationVotes([]);
    }

    setApplicationsLoading(false);
  }, [clubId, joinType]);

  useEffect(() => {
    if (viewMode === "applications" && joinType !== "open") {
      void loadApplications();
    }
  }, [viewMode, joinType, loadApplications]);

  const eligibleVoters = members.filter(
    (m) =>
      m.status === "active" &&
      (m.role === "owner" || m.role === "executive"),
  );

  const filteredApplications = applications.filter(
    (app) => app.status === applicationFilter,
  );

  async function admitApplicant(application: JoinApplicationRow) {
    if (!clubId || !club) return;

    const { error: memberError } = await supabase.from("club_members").upsert(
      {
        club_id: clubId,
        user_id: application.applicantId,
        role: "member",
        status: "active",
      },
      { onConflict: "club_id,user_id" },
    );

    if (memberError) {
      console.error("Failed to admit member:", memberError.message);
      setFeedback({ type: "error", text: "Failed to admit member." });
      return;
    }

    const { error: updateError } = await supabase
      .from("club_join_applications")
      .update({ status: "approved" })
      .eq("id", application.id);

    if (updateError) {
      console.error("Failed to update application:", updateError.message);
    }

    await notifyUsers([
      {
        user_id: application.applicantId,
        type: "join_approved",
        message: `Your application to join ${club.name} has been approved! Welcome aboard.`,
        club_id: clubId,
        reference_id: application.id,
      },
    ]);

    void refresh();
    void loadApplications();
  }

  async function rejectApplication(application: JoinApplicationRow) {
    if (!clubId || !club) return;

    const { error } = await supabase
      .from("club_join_applications")
      .update({ status: "rejected" })
      .eq("id", application.id);

    if (error) {
      console.error("Failed to reject application:", error.message);
      setFeedback({ type: "error", text: "Failed to decline application." });
      return;
    }

    await notifyUsers([
      {
        user_id: application.applicantId,
        type: "club_update",
        message: `Your application to join ${club.name} was not approved at this time.`,
        club_id: clubId,
        reference_id: application.id,
      },
    ]);

    void loadApplications();
  }

  async function handleCastVote(
    application: JoinApplicationRow,
    vote: "yes" | "no",
  ) {
    if (!clubId || !user?.id) return;
    setActionLoading(application.id);

    const { error } = await supabase.from("club_join_votes").upsert(
      {
        club_id: clubId,
        applicant_id: application.applicantId,
        voter_id: user.id,
        vote,
      },
      { onConflict: "club_id,applicant_id,voter_id" },
    );

    if (error) {
      console.error("Failed to cast vote:", error.message);
      setFeedback({ type: "error", text: "Failed to submit vote." });
      setActionLoading(null);
      return;
    }

    const updatedVotes = [
      ...applicationVotes.filter(
        (v) =>
          !(
            v.applicantId === application.applicantId &&
            v.voterId === user.id
          ),
      ),
      { applicantId: application.applicantId, voterId: user.id, vote },
    ];
    setApplicationVotes(updatedVotes);

    const appVotes = updatedVotes.filter(
      (v) => v.applicantId === application.applicantId,
    );
    const yesCount = appVotes.filter((v) => v.vote === "yes").length;
    const noCount = appVotes.filter((v) => v.vote === "no").length;
    const threshold = Math.ceil(eligibleVoters.length / 2);

    if (yesCount >= threshold && yesCount > noCount) {
      await admitApplicant(application);
    } else if (noCount >= threshold && noCount > yesCount) {
      await rejectApplication(application);
    }

    setActionLoading(null);
    void loadApplications();
  }

  const loadOrgChartMembers = useCallback(async () => {
    if (!clubId) return;
    setOrgChartLoading(true);
    const { data, error } = await supabase
      .from("club_members")
      .select(
        `
          id,
          user_id,
          role,
          title,
          reports_to,
          member_profile:profiles!club_members_user_profile_fkey (
            full_name,
            avatar_url
          )
        `,
      )
      .eq("club_id", clubId)
      .eq("status", "active");

    if (error) {
      console.error("Failed to load org chart:", error.message);
      setOrgChartMembers([]);
      setOrgChartLoading(false);
      return;
    }

    const mapped: OrgChartMember[] = [];
    for (const row of data ?? []) {
      const rawProfile = row.member_profile;
      const profile = (
        Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
      ) as Record<string, unknown> | null | undefined;
      const normalizedRole = normalizeMemberRole(row.role as string);
      const reportsTo = (row.reports_to as string | null) ?? null;
      if (normalizedRole === "member" && !reportsTo) {
        continue;
      }
      mapped.push({
        id: row.id as string,
        userId: row.user_id as string,
        role: normalizedRole,
        title: (row.title as string | null) ?? null,
        reportsTo,
        fullName: (profile?.full_name as string) ?? "Unknown",
        avatarUrl: (profile?.avatar_url as string | null) ?? null,
      });
    }

    setOrgChartMembers(mapped);
    setOrgChartLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (!loading) {
      void loadMemberMeta();
      void loadOrgChartMembers();
    }
  }, [loading, members, loadMemberMeta, loadOrgChartMembers]);

  const reportsToOptions = members.filter(
    (m) =>
      m.status === "active" &&
      (normalizeMemberRole(m.role) === "owner" ||
        normalizeMemberRole(m.role) === "executive"),
  );

  function openEditRole(member: ClubMember) {
    setEditingMemberId(member.id);
    setEditRole(normalizeMemberRole(member.role));
    setEditTitle(memberTitles[member.id] ?? "");
    setEditReportsTo(memberReportsTo[member.id] ?? "");
  }

  function closeEditRole() {
    setEditingMemberId(null);
    setEditTitle("");
    setEditReportsTo("");
  }

  async function handleSaveRoleAndTitle(memberId: string) {
    setActionLoading(memberId);
    setFeedback(null);

    const trimmedTitle = editTitle.trim();
    const updatePayload: {
      role: MemberRole;
      title: string | null;
      reports_to?: string | null;
    } = {
      role: editRole,
      title: trimmedTitle || null,
    };

    if (
      isOwner &&
      (editRole === "member" || editRole === "executive")
    ) {
      updatePayload.reports_to = editReportsTo.trim() || null;
    }

    const { error } = await supabase
      .from("club_members")
      .update(updatePayload)
      .eq("id", memberId);

    if (error) {
      console.error("Failed to update member:", error.message);
      setFeedback({ type: "error", text: "Failed to update member role and title." });
      setActionLoading(null);
      return;
    }

    setMemberTitles((prev) => ({
      ...prev,
      [memberId]: trimmedTitle || null,
    }));
    if (isOwner && (editRole === "member" || editRole === "executive")) {
      setMemberReportsTo((prev) => ({
        ...prev,
        [memberId]: editReportsTo.trim() || null,
      }));
    }
    closeEditRole();
    refresh();
    void loadOrgChartMembers();
    setFeedback({
      type: "success",
      text: `Updated to ${formatRoleLabel(editRole)}${trimmedTitle ? ` · ${trimmedTitle}` : ""}.`,
    });
    setActionLoading(null);
  }

  async function handleRemove(memberId: string) {
    if (!window.confirm("Remove this member from the club?")) return;
    setActionLoading(memberId);
    setFeedback(null);
    const ok = await removeMember(memberId);
    if (ok) {
      setFeedback({ type: "success", text: "Member removed." });
    } else {
      setFeedback({ type: "error", text: "Failed to remove member." });
    }
    setActionLoading(null);
  }

  async function handleApprove(memberId: string) {
    setActionLoading(memberId);
    setFeedback(null);
    const ok = await approveRequest(memberId);
    if (ok) {
      setFeedback({ type: "success", text: "Request approved." });
    } else {
      setFeedback({ type: "error", text: "Failed to approve request." });
    }
    setActionLoading(null);
  }

  async function handleReject(memberId: string) {
    if (!window.confirm("Reject this join request?")) return;
    setActionLoading(memberId);
    setFeedback(null);
    const ok = await rejectRequest(memberId);
    if (ok) {
      setFeedback({ type: "success", text: "Request rejected." });
    } else {
      setFeedback({ type: "error", text: "Failed to reject request." });
    }
    setActionLoading(null);
  }

  function handleCopyCode() {
    if (!club?.joinCode) return;
    navigator.clipboard.writeText(club.joinCode).then(
      () => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      },
      () => {
        setFeedback({ type: "error", text: "Failed to copy to clipboard." });
      },
    );
  }

  function handleCopyLink() {
    if (!club?.joinCode) return;
    const link = `${window.location.origin}/join/${club.joinCode}`;
    navigator.clipboard.writeText(link).then(
      () => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      },
      () => {
        setFeedback({ type: "error", text: "Failed to copy link." });
      },
    );
  }

  async function handleRegenerateCode() {
    if (!clubId || !isOwner) return;
    if (!window.confirm("Regenerate invite code? The old code will stop working.")) {
      return;
    }
    setRegeneratingCode(true);
    setFeedback(null);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const randomValues = crypto.getRandomValues(new Uint8Array(6));
    const newCode = Array.from(randomValues, (v) => chars[v % chars.length]).join("");
    const ok = await updateClub(clubId, { joinCode: newCode });
    setRegeneratingCode(false);
    if (ok) {
      setFeedback({ type: "success", text: "Invite code regenerated." });
    } else {
      setFeedback({ type: "error", text: "Failed to regenerate invite code." });
    }
  }

  function MemberRowActions({ member }: { member: ClubMember }) {
    const [messageHovered, setMessageHovered] = useState(false);
    const [roleHovered, setRoleHovered] = useState(false);
    const [removeHovered, setRemoveHovered] = useState(false);

    const memberRole = member.role;
    const memberId = member.id;
    const memberUserId = member.userId;
    const isSelf = memberUserId === user?.id;
    const isOtherOwner = memberRole === "owner";
    const busy = actionLoading === memberId;
    const canEditRole = isOwner && !isOtherOwner && !isSelf;
    const canRemove =
      canReorderRoster && !isTopClubModeratorRole(memberRole) && !isSelf;
    const canMessage = !isSelf && Boolean(clubId);

    if (isSelf && !canMessage) {
      return null;
    }

    return (
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {canMessage ? (
          <button
            type="button"
            onClick={() => navigate(`/app/clubs/${clubId}/chat?dm=${memberUserId}`)}
            onMouseEnter={() => setMessageHovered(true)}
            onMouseLeave={() => setMessageHovered(false)}
            style={outlineActionButtonStyle(messageHovered)}
          >
            Message
          </button>
        ) : null}
        {canEditRole ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => openEditRole(member)}
            onMouseEnter={() => setRoleHovered(true)}
            onMouseLeave={() => setRoleHovered(false)}
            style={{
              ...outlineActionButtonStyle(roleHovered),
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            Change Role
          </button>
        ) : null}
        {canRemove ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRemove(memberId)}
            onMouseEnter={() => setRemoveHovered(true)}
            onMouseLeave={() => setRemoveHovered(false)}
            style={{
              ...removeActionButtonStyle(removeHovered),
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading members…" />
      </div>
    );
  }

  const viewToggleButton = (mode: ViewMode, label: string) => {
    const active = viewMode === mode;
    return (
      <button
        type="button"
        onClick={() => setViewMode(mode)}
        style={{
          background: active ? "#E51937" : "#1a1a1a",
          border: active ? "1px solid #E51937" : "1px solid #333",
          color: active ? "#ffffff" : "#777777",
          borderRadius: "6px",
          padding: "6px 16px",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        backgroundColor: "#0f0f0f",
        padding: isMobile ? "16px" : "24px",
      }}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "28px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Members
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#555555",
              marginTop: "4px",
              marginBottom: 0,
            }}
          >
            Manage club members, roles, and team access.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {isOwner ? (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              style={{
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "9px 20px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Invite Member
            </button>
          ) : null}
          {viewToggleButton("list", "List")}
          {viewToggleButton("orgChart", "Org Chart")}
          {canUseMembershipQueue && joinType !== "open"
            ? viewToggleButton("applications", "Applications")
            : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <StatCard label="Total Members" value={memberStats.total} topColor="#777777" />
        <StatCard label="Executives" value={memberStats.executives} topColor="#E51937" />
        <StatCard
          label="General Members"
          value={memberStats.generalMembers}
          topColor="#777777"
        />
        <StatCard
          label="Pending Invites"
          value={memberStats.pendingInvites}
          topColor="#FFC429"
          valueColor="#FFC429"
        />
      </div>

      {club?.joinCode ? (
        <div
          style={{
            background: "#141414",
            borderTop: "1px solid #2a2a2a",
            borderRight: "1px solid #2a2a2a",
            borderBottom: "1px solid #2a2a2a",
            borderLeft: "3px solid #FFC429",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#ffffff",
                margin: 0,
              }}
            >
              Invite Code
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "#555555",
                marginTop: "2px",
                marginBottom: 0,
              }}
            >
              Share this code or link to invite new members.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#FFC429",
                letterSpacing: "0.12em",
              }}
            >
              {club.joinCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                background: "#1a1200",
                border: "1px solid #FFC429",
                color: "#FFC429",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copiedCode ? "Copied" : "Copy Code"}
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: "#777777",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "12px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#555555";
                e.currentTarget.style.color = "#aaaaaa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#2a2a2a";
                e.currentTarget.style.color = "#777777";
              }}
            >
              {copiedLink ? "Copied" : "Copy Link"}
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={() => void handleRegenerateCode()}
                disabled={regeneratingCode}
                style={{
                  background: "none",
                  border: "none",
                  color: "#444444",
                  fontSize: "12px",
                  cursor: regeneratingCode ? "not-allowed" : "pointer",
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  if (!regeneratingCode) e.currentTarget.style.color = "#777777";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#444444";
                }}
              >
                {regeneratingCode ? "Regenerating…" : "Regenerate"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            border:
              feedback.type === "success"
                ? "1px solid #3a2a00"
                : "1px solid #3a1a1a",
            background: feedback.type === "success" ? "#1a1500" : "#1a0505",
            color: feedback.type === "success" ? "#FFC429" : "#E51937",
          }}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Pending requests section — admin/exec only */}
      {canUseMembershipQueue && pendingMembers.length > 0 && (
        <div className="mb-6">
          <h2
            className="mb-3"
            style={{
              fontWeight: 600,
              fontSize: "15px",
              color: "#ffffff",
            }}
          >
            Pending Requests ({pendingMembers.length})
          </h2>
          <div className="space-y-2">
            {pendingMembers.map((member) => (
              <div key={member.id} style={memberCardStyle}>
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    avatarUrl={member.avatarUrl}
                    name={member.fullName ?? member.email ?? "U"}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className="block truncate"
                      style={{
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "#ffffff",
                      }}
                    >
                      {member.fullName ?? "Unknown"}
                    </span>
                    {member.program && (
                      <p
                        className="truncate"
                        style={{
                          fontSize: "12px",
                          color: "#747676",
                        }}
                      >
                        {member.program}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button
                      size="sm"
                      disabled={actionLoading === member.id}
                      onClick={() => handleApprove(member.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionLoading === member.id}
                      className="text-red-400 hover:text-red-300"
                      onClick={() => handleReject(member.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "list" ? (
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <Search
              size={15}
              color="#555555"
              aria-hidden
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by name, email, or program…"
              style={{
                width: "100%",
                height: "40px",
                background: "#111111",
                border: `1px solid ${searchFocused ? "#E51937" : "#2a2a2a"}`,
                borderRadius: "8px",
                padding: "0 16px 0 40px",
                fontSize: "14px",
                color: "#ffffff",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {MEMBER_FILTER_OPTIONS.map((option) => {
              const active = memberRoleFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMemberRoleFilter(option.value)}
                  style={{
                    background: active ? "#E51937" : "transparent",
                    color: active ? "#ffffff" : "#777777",
                    border: active ? "none" : "1px solid #333333",
                    borderRadius: "20px",
                    padding: "5px 14px",
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
      ) : null}

      {/* Org chart */}
      {viewMode === "orgChart" ? (
        orgChartLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Spinner label="Loading org chart…" />
          </div>
        ) : (
          <>
            <OrgChartView members={orgChartMembers} />
            {members.length === 1 ? (
              <div style={{ textAlign: "center", padding: "32px 24px", color: "#333333" }}>
                <Users
                  size={32}
                  color="#2a2a2a"
                  aria-hidden
                  style={{ marginBottom: "10px" }}
                />
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#333333", margin: 0 }}>
                  Your org chart is just getting started
                </p>
                <p style={{ fontSize: "12px", color: "#444444", marginTop: "4px", marginBottom: 0 }}>
                  Invite executives, coordinators, and team leads to build out your club
                  structure.
                </p>
              </div>
            ) : null}
          </>
        )
      ) : null}

      {viewMode === "applications" ? (
        <div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {(
              [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ] as const
            ).map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setApplicationFilter(pill.value)}
                style={{
                  background:
                    applicationFilter === pill.value ? "#E51937" : "#1a1a1a",
                  border:
                    applicationFilter === pill.value
                      ? "1px solid #E51937"
                      : "1px solid #333333",
                  color: applicationFilter === pill.value ? "#ffffff" : "#777777",
                  borderRadius: "20px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {applicationsLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner label="Loading applications…" />
            </div>
          ) : filteredApplications.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 16px",
                background: "#1a1a1a",
                border: "1px solid #242424",
                borderRadius: "10px",
              }}
            >
              <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
                {joinType === "vote"
                  ? "No pending membership requests"
                  : "No applications yet"}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredApplications.map((application) => {
                const appVotes = applicationVotes.filter(
                  (v) => v.applicantId === application.applicantId,
                );
                const yesCount = appVotes.filter((v) => v.vote === "yes").length;
                const noCount = appVotes.filter((v) => v.vote === "no").length;
                const myVote = appVotes.find((v) => v.voterId === user?.id)?.vote;
                const expanded = expandedApplicationId === application.id;
                const threshold = Math.ceil(eligibleVoters.length / 2);
                const admitted =
                  application.status === "approved" ||
                  (yesCount >= threshold && yesCount > noCount);
                const declined =
                  application.status === "rejected" ||
                  (noCount >= threshold && noCount > yesCount);

                return (
                  <div
                    key={application.id}
                    style={{
                      background: "#1a1a1a",
                      border: "1px solid #242424",
                      borderRadius: "10px",
                      padding: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      {application.avatarUrl ? (
                        <img
                          src={application.avatarUrl}
                          alt=""
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background: "#2a2a2a",
                            color: "#888888",
                            fontSize: "13px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {application.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#ffffff",
                          }}
                        >
                          {application.fullName}
                        </p>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "12px",
                            color: "#555555",
                          }}
                        >
                          Applied{" "}
                          {new Date(application.createdAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </p>
                      </div>
                      {admitted && application.status === "approved" ? (
                        <span
                          style={{
                            background: "#1a1200",
                            border: "1px solid #FFC429",
                            color: "#FFC429",
                            borderRadius: "20px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          Admitted
                        </span>
                      ) : null}
                      {declined && application.status === "rejected" ? (
                        <span
                          style={{
                            background: "#1a1a1a",
                            border: "1px solid #333333",
                            color: "#747676",
                            borderRadius: "20px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          Declined
                        </span>
                      ) : null}
                    </div>

                    {application.answers.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedApplicationId(
                            expanded ? null : application.id,
                          )
                        }
                        style={{
                          marginTop: "12px",
                          background: "transparent",
                          border: "none",
                          color: "#777777",
                          fontSize: "12px",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {expanded ? "Hide answers" : "Show answers"}
                      </button>
                    ) : null}

                    {expanded && application.answers.length > 0 ? (
                      <div style={{ marginTop: "12px" }}>
                        {application.answers.map((answer, index) => (
                          <div key={`${application.id}-${index}`} style={{ marginBottom: "10px" }}>
                            <p
                              style={{
                                margin: "0 0 4px",
                                fontSize: "12px",
                                color: "#777777",
                              }}
                            >
                              {answer.question}
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "14px",
                                color: "#ffffff",
                                lineHeight: 1.5,
                              }}
                            >
                              {answer.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {application.status === "pending" && joinType === "application" && (isOwner || isExecutive) ? (
                      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                        <button
                          type="button"
                          disabled={actionLoading === application.id}
                          onClick={() => void admitApplicant(application)}
                          style={{
                            background: "#E51937",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "7px 18px",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading === application.id}
                          onClick={() => void rejectApplication(application)}
                          style={{
                            background: "#1a1a1a",
                            border: "1px solid #333333",
                            color: "#747676",
                            borderRadius: "6px",
                            padding: "7px 18px",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}

                    {application.status === "pending" && joinType === "vote" && canUseMembershipQueue ? (
                      <div style={{ marginTop: "16px" }}>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#ffffff",
                            margin: "0 0 10px",
                          }}
                        >
                          Vote to Admit
                        </p>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            disabled={Boolean(myVote) || actionLoading === application.id}
                            onClick={() => void handleCastVote(application, "yes")}
                            style={{
                              background: myVote === "yes" ? "#1a1200" : "transparent",
                              border: "1px solid #FFC429",
                              color: "#FFC429",
                              borderRadius: "6px",
                              padding: "7px 18px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: myVote ? "default" : "pointer",
                              opacity: myVote && myVote !== "yes" ? 0.5 : 1,
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(myVote) || actionLoading === application.id}
                            onClick={() => void handleCastVote(application, "no")}
                            style={{
                              background: myVote === "no" ? "#1a0505" : "transparent",
                              border: "1px solid #E51937",
                              color: "#E51937",
                              borderRadius: "6px",
                              padding: "7px 18px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: myVote ? "default" : "pointer",
                              opacity: myVote && myVote !== "no" ? 0.5 : 1,
                            }}
                          >
                            No
                          </button>
                        </div>
                        <p
                          style={{
                            margin: "10px 0 0",
                            fontSize: "12px",
                            color: "#555555",
                          }}
                        >
                          {yesCount} yes · {noCount} no
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {viewMode === "list" && sortedMembers.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
          }}
        >
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            No members yet. Share the join code to invite people.
          </p>
        </div>
      ) : viewMode === "list" && filteredMembers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#333333", margin: 0 }}>
            No members match your search
          </p>
          <p style={{ fontSize: "13px", color: "#444444", marginTop: "4px" }}>
            Try a different filter or search term.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div>
          {filteredMembers.map((member) => {
            const memberTitle = memberTitles[member.id] ?? null;
            const normalizedRole = normalizeMemberRole(member.role);
            const isEditing = editingMemberId === member.id;
            const joinedLabel = new Date(member.joinedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
            <div key={member.id}>
            <div
              style={{
                ...memberListCardStyle,
                flexWrap: isMobile ? "wrap" : "nowrap",
                marginBottom: isEditing ? 0 : "8px",
              }}
            >
              <MemberAvatar
                avatarUrl={member.avatarUrl}
                name={member.fullName ?? member.email ?? "U"}
                size={40}
              />

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                  <MemberNameLink
                    userId={member.userId}
                    style={{ fontSize: "15px", fontWeight: 700 }}
                  >
                    {member.fullName ?? "Unknown"}
                  </MemberNameLink>
                  <span style={roleBadgeStyle(normalizedRole)}>
                    {formatRoleLabel(normalizedRole)}
                  </span>
                </div>
                {memberTitle ? (
                  <p style={{ fontSize: "12px", color: "#555555", margin: "2px 0 0", fontStyle: "italic" }}>
                    {memberTitle}
                  </p>
                ) : null}
                <p style={{ fontSize: "12px", color: "#555555", marginTop: "2px", marginBottom: 0 }}>
                  {member.email}
                </p>
                {member.program ? (
                  <p style={{ fontSize: "12px", color: "#444444", margin: "2px 0 0" }}>
                    {member.program}
                  </p>
                ) : null}
              </div>

              <div style={{ flexShrink: 0, textAlign: "right", width: isMobile ? "100%" : "auto" }}>
                <p style={{ fontSize: "11px", color: "#444444", margin: "0 0 8px" }}>
                  Joined {joinedLabel}
                </p>
                <MemberRowActions member={member} />
              </div>
            </div>

              {isEditing ? (
                <div
                  style={{
                    marginTop: 0,
                    marginBottom: "8px",
                    padding: "16px 20px",
                    background: "#111111",
                    border: "1px solid #2a2a2a",
                    borderRadius: "0 0 10px 10px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#ffffff",
                      margin: "0 0 10px",
                    }}
                  >
                    Role
                  </p>
                  <RoleSelector value={editRole} onChange={setEditRole} />
                  <label
                    htmlFor={`member-title-${member.id}`}
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#ffffff",
                      margin: "14px 0 8px",
                    }}
                  >
                    Title
                  </label>
                  <input
                    id={`member-title-${member.id}`}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Marketing Manager, Events Lead"
                    style={{
                      width: "100%",
                      background: "#111111",
                      border: "1px solid #2a2a2a",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "#ffffff",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                  {isOwner &&
                  (editRole === "member" || editRole === "executive") ? (
                    <>
                      <label
                        htmlFor={`member-reports-to-${member.id}`}
                        style={{
                          display: "block",
                          fontSize: "12px",
                          color: "#888888",
                          margin: "14px 0 8px",
                        }}
                      >
                        Reports To (optional)
                      </label>
                      <select
                        id={`member-reports-to-${member.id}`}
                        value={editReportsTo}
                        onChange={(e) => setEditReportsTo(e.target.value)}
                        style={{
                          width: "100%",
                          background: "#111111",
                          border: "1px solid #2a2a2a",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          color: "#ffffff",
                          fontSize: "13px",
                          boxSizing: "border-box",
                        }}
                      >
                        <option value="">No manager</option>
                        {reportsToOptions.map((leader) => (
                          <option key={leader.userId} value={leader.userId}>
                            {leader.fullName ?? leader.email ?? "Unknown"} —{" "}
                            {formatRoleLabel(normalizeMemberRole(leader.role))}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "10px",
                      marginTop: "14px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={closeEditRole}
                      disabled={actionLoading === member.id}
                      style={{
                        background: "transparent",
                        border: "1px solid #333333",
                        color: "#888888",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveRoleAndTitle(member.id)}
                      disabled={actionLoading === member.id}
                      style={{
                        background: "#E51937",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {actionLoading === member.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      ) : null}

      {clubId ? (
        <ClubInviteModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          clubId={clubId}
          joinCode={club?.joinCode}
        />
      ) : null}
    </div>
  );
}
