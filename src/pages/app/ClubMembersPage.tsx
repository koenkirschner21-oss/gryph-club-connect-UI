import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMembers } from "../../hooks/useClubMembers";
import { supabase } from "../../lib/supabaseClient";
import { normalizeJoinType } from "../../lib/clubJoinUtils";
import { notifyUsers } from "../../lib/notifyUsers";
import type { ClubJoinType, ClubMember, JoinAnswer, MemberRole } from "../../types";
import {
  isPrivilegedClubRole,
  isTopClubModeratorRole,
} from "../../lib/clubRoles";
import Button from "../../components/ui/Button";
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
const inviteCardStyle: CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "8px",
  padding: "16px",
};

const memberCardStyle: CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "8px",
  padding: "14px 16px",
};

function roleBadgeStyle(role: MemberRole | string): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    textTransform: "capitalize",
    flexShrink: 0,
  };
  switch (role) {
    case "owner":
      return {
        ...base,
        backgroundColor: "#2a1500",
        color: "#FFC429",
        border: "1px solid #3a2500",
      };
    case "executive":
      return {
        ...base,
        background: "#1a1a2a",
        color: "#6b7cff",
        border: "1px solid #2a2a3a",
      };
    default:
      return {
        ...base,
        backgroundColor: "#111111",
        color: "#555555",
        border: "1px solid #222222",
      };
  }
}

function normalizeMemberRole(role: string): MemberRole {
  if (role === "executive" || role === "exec") return "executive";
  if (role === "owner") return "owner";
  return "member";
}

function formatRoleLabel(role: MemberRole | string): string {
  if (role === "executive" || role === "exec") return "Executive";
  if (role === "owner") return "Owner";
  return "Member";
}

function roleBadgeLabel(role: MemberRole, title?: string | null): string {
  const label = formatRoleLabel(role);
  if (role === "executive" && title?.trim()) {
    return `${label} · ${title.trim()}`;
  }
  return label;
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
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
        backgroundColor: "#1f1f1f",
        color: "#E51937",
        fontSize: size <= 36 ? "12px" : "14px",
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

const orgCardBase: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "10px",
  padding: "16px 12px",
  textAlign: "center",
  minWidth: "140px",
  maxWidth: "160px",
  boxSizing: "border-box",
};

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
  const [hovered, setHovered] = useState(false);
  const displayName = member.fullName || "Unknown";

  if (tier === "president") {
    return (
      <div
        style={{
          ...orgCardBase,
          borderColor: hovered ? "#333" : "#242424",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="mb-2 flex justify-center">
          <MemberAvatar
            avatarUrl={member.avatarUrl}
            name={displayName}
            size={60}
            borderWidth={3}
            borderColor="#E51937"
          />
        </div>
        <MemberNameLink userId={member.userId}>
          {displayName}
        </MemberNameLink>
        <span style={roleBadgeStyle("owner")}>President</span>
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
      <div
        style={{
          ...orgCardBase,
          borderColor: hovered ? "#333" : "#242424",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="mb-2 flex justify-center">
          <MemberAvatar
            avatarUrl={member.avatarUrl}
            name={displayName}
            size={48}
            borderWidth={2}
            borderColor="#6b7cff"
          />
        </div>
        <MemberNameLink userId={member.userId}>
          {displayName}
        </MemberNameLink>
        <span style={roleBadgeStyle("executive")}>Executive</span>
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
    <div
      style={{
        ...orgCardBase,
        minWidth: "120px",
        maxWidth: "140px",
        padding: "12px 10px",
        borderColor: hovered ? "#333" : "#242424",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mb-2 flex justify-center">
        <MemberAvatar
          avatarUrl={member.avatarUrl}
          name={displayName}
          size={36}
          borderWidth={1}
          borderColor="#333"
        />
      </div>
      <MemberNameLink
        userId={member.userId}
        className="block"
        style={{ fontSize: "12px", color: "#cccccc", margin: "0 0 4px", fontWeight: 500 }}
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
  const { user } = useAuthContext();
  const { getClubById, getUserRole } = useClubContext();
  const club = getClubById(clubId ?? "");

  const role = getUserRole(clubId ?? "");
  const isOwner = role === "owner";
  /** Admin or owner may change member roles / remove members; exec sees queue only. */
  const canReorderRoster = isTopClubModeratorRole(role);
  const canUseMembershipQueue = isPrivilegedClubRole(role);

  const { members, pendingMembers, loading, removeMember, approveRequest, rejectRequest, refresh } =
    useClubMembers(clubId);

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
  const [copied, setCopied] = useState(false);

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
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setFeedback({ type: "error", text: "Failed to copy to clipboard." });
      },
    );
  }

  function renderAdminActions(
    member: ClubMember,
  ) {
    const memberRole = member.role;
    const memberId = member.id;
    const memberUserId = member.userId;
    const isOwner = role === "owner";
    const isSelf = memberUserId === user?.id;
    const isOtherOwner = memberRole === "owner";

    if (isSelf) {
      return null;
    }

    if (!canReorderRoster && !isOwner) {
      return null;
    }

    const busy = actionLoading === memberId;
    const canEditRole = isOwner && !isOtherOwner;
    const canRemove =
      canReorderRoster && !isTopClubModeratorRole(memberRole);

    if (!canEditRole && !canRemove) {
      return null;
    }

    return (
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
        {canEditRole ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => openEditRole(member)}
            style={{
              background: "transparent",
              border: "1px solid #333333",
              color: "#888888",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Edit Role
          </button>
        ) : null}
        {canRemove ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            className="text-red-400 hover:text-red-300"
            onClick={() => handleRemove(memberId)}
          >
            Remove
          </Button>
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
    <div className="p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff",
            }}
          >
            Members
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#555555",
            }}
          >
            {members.length} member{members.length !== 1 ? "s" : ""} in{" "}
            {club?.name ?? "this club"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {viewToggleButton("list", "List")}
          {viewToggleButton("orgChart", "Org Chart")}
          {canUseMembershipQueue && joinType !== "open"
            ? viewToggleButton("applications", "Applications")
            : null}
        </div>
      </div>

      {/* Join code section */}
      {club?.joinCode && (
        <div className="mb-6" style={inviteCardStyle}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#ffffff",
                }}
              >
                Invite Code
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "#555555",
                }}
              >
                Share this code to invite new members
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#FFC429",
                  letterSpacing: "0.15em",
                }}
              >
                {club.joinCode}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="cursor-pointer border-none transition-colors hover:bg-[#cc0020]"
                style={{
                  backgroundColor: "#E51937",
                  color: "#ffffff",
                  borderRadius: "6px",
                  padding: "7px 16px",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
                title="Copy to clipboard"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback message */}
      {feedback && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          {feedback.text}
        </div>
      )}

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

      {/* Org chart */}
      {viewMode === "orgChart" ? (
        orgChartLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Spinner label="Loading org chart…" />
          </div>
        ) : (
          <OrgChartView members={orgChartMembers} />
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
                            background: "#0a1a0a",
                            border: "1px solid #1a3a1a",
                            color: "#4ade80",
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

                    {application.status === "pending" && joinType === "application" && isOwner ? (
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
                              background: myVote === "yes" ? "#0a1a0a" : "transparent",
                              border: "1px solid #4ade80",
                              color: "#4ade80",
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

      {/* Members list */}
      {viewMode === "list" && sortedMembers.length === 0 ? (
        <div
          className="p-8 text-center"
          style={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: "8px",
          }}
        >
          <p style={{ fontSize: "14px", color: "#555555" }}>
            No members yet. Share the join code to invite people.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {sortedMembers.map((member) => {
            const memberTitle = memberTitles[member.id] ?? null;
            const normalizedRole = normalizeMemberRole(member.role);
            const isEditing = editingMemberId === member.id;

            return (
            <div key={member.id} style={memberCardStyle}>
              <div className="flex items-center gap-3">
                <MemberAvatar
                  avatarUrl={member.avatarUrl}
                  name={member.fullName ?? member.email ?? "U"}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <MemberNameLink
                      userId={member.userId}
                      className="truncate"
                    >
                      {member.fullName ?? "Unknown"}
                    </MemberNameLink>
                    <span style={roleBadgeStyle(normalizedRole)}>
                      {roleBadgeLabel(normalizedRole, memberTitle)}
                    </span>
                  </div>
                  {memberTitle ? (
                    <p
                      className="truncate"
                      style={{
                        fontSize: "11px",
                        color: "#747676",
                        fontStyle: "italic",
                        marginTop: "2px",
                        marginBottom: 0,
                      }}
                    >
                      {memberTitle}
                    </p>
                  ) : null}
                  <p
                    className="truncate"
                    style={{
                      fontSize: "12px",
                      color: "#555555",
                      marginTop: memberTitle ? "4px" : "2px",
                    }}
                  >
                    {member.email}
                  </p>
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

                {renderAdminActions(member) ?? (
                  <span
                    className="ml-auto shrink-0 text-right"
                    style={{
                      fontSize: "11px",
                      color: "#555555",
                    }}
                  >
                    Joined{" "}
                    {new Date(member.joinedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>

              {isEditing ? (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "16px",
                    background: "#111111",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
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
    </div>
  );
}
