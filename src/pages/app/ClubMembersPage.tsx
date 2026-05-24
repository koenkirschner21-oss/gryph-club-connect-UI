import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMembers } from "../../hooks/useClubMembers";
import { supabase } from "../../lib/supabaseClient";
import type { ClubMember, MemberRole } from "../../types";
import {
  isPrivilegedClubRole,
  isTopClubModeratorRole,
} from "../../lib/clubRoles";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

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

const avatarStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  border: "2px solid #2a2a2a",
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
}: {
  avatarUrl?: string | null;
  name: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 object-cover"
        style={avatarStyle}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center text-sm font-bold"
      style={{
        ...avatarStyle,
        backgroundColor: "#1f1f1f",
        color: "#E51937",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ClubMembersPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getClubById, getUserRole } = useClubContext();
  const club = getClubById(clubId ?? "");

  const role = getUserRole(clubId ?? "");
  /** Admin or owner may change member roles / remove members; exec sees queue only. */
  const canReorderRoster = isTopClubModeratorRole(role);
  const canUseMembershipQueue = isPrivilegedClubRole(role);

  const { members, pendingMembers, loading, removeMember, approveRequest, rejectRequest, refresh } =
    useClubMembers(clubId);

  const [memberTitles, setMemberTitles] = useState<Record<string, string | null>>({});
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<MemberRole>("member");
  const [editTitle, setEditTitle] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const roleOrder: Record<MemberRole, number> = {
    owner: 0,
    executive: 1,
    member: 2,
  };
  const sortedMembers = [...members].sort(
    (a, b) =>
      (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99),
  );

  const loadMemberTitles = useCallback(async () => {
    if (!clubId) return;
    const { data, error } = await supabase
      .from("club_members")
      .select("id, title")
      .eq("club_id", clubId);

    if (error) {
      console.error("Failed to load member titles:", error.message);
      return;
    }

    const map: Record<string, string | null> = {};
    (data ?? []).forEach((row) => {
      map[row.id as string] = (row.title as string | null) ?? null;
    });
    setMemberTitles(map);
  }, [clubId]);

  useEffect(() => {
    if (!loading) {
      loadMemberTitles();
    }
  }, [loading, members, loadMemberTitles]);

  function openEditRole(member: ClubMember) {
    setEditingMemberId(member.id);
    setEditRole(normalizeMemberRole(member.role));
    setEditTitle(memberTitles[member.id] ?? "");
  }

  function closeEditRole() {
    setEditingMemberId(null);
    setEditTitle("");
  }

  async function handleSaveRoleAndTitle(memberId: string) {
    setActionLoading(memberId);
    setFeedback(null);

    const trimmedTitle = editTitle.trim();
    const { error } = await supabase
      .from("club_members")
      .update({
        role: editRole,
        title: trimmedTitle || null,
      })
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
    closeEditRole();
    refresh();
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

  return (
    <div className="p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <div className="mb-6">
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

      {/* Members list */}
      {sortedMembers.length === 0 ? (
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
      ) : (
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
                    <span
                      className="truncate"
                      style={{
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "#ffffff",
                      }}
                    >
                      {member.fullName ?? "Unknown"}
                    </span>
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
      )}
    </div>
  );
}
