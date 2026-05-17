import { useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMembers } from "../../hooks/useClubMembers";
import type { MemberRole } from "../../types";
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
    case "admin":
      return {
        ...base,
        backgroundColor: "#2a0a0a",
        color: "#E51937",
        border: "1px solid #3a1a1a",
      };
    case "exec":
      return {
        ...base,
        backgroundColor: "#1a1a2a",
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

  const { members, pendingMembers, loading, updateRole, removeMember, approveRequest, rejectRequest } = useClubMembers(clubId);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const roleOrder = { owner: 0, admin: 1, exec: 2, member: 3 } as const;
  const sortedMembers = [...members].sort(
    (a, b) => roleOrder[a.role] - roleOrder[b.role],
  );

  async function handlePromote(memberId: string) {
    setActionLoading(memberId);
    setFeedback(null);
    const ok = await updateRole(memberId, "exec");
    if (ok) {
      setFeedback({ type: "success", text: "Member promoted to exec." });
    } else {
      setFeedback({ type: "error", text: "Failed to promote member." });
    }
    setActionLoading(null);
  }

  async function handleDemote(memberId: string) {
    setActionLoading(memberId);
    setFeedback(null);
    const ok = await updateRole(memberId, "member");
    if (ok) {
      setFeedback({ type: "success", text: "Member demoted to regular member." });
    } else {
      setFeedback({ type: "error", text: "Failed to demote member." });
    }
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
    memberRole: MemberRole,
    memberId: string,
    memberUserId: string,
  ) {
    // Owners/admins cannot modify themselves or other top moderators (owner/admin).
    if (
      !canReorderRoster
      || isTopClubModeratorRole(memberRole)
      || memberUserId === user?.id
    ) {
      return null;
    }

    const busy = actionLoading === memberId;

    return (
      <div className="flex flex-shrink-0 flex-wrap gap-2">
        {memberRole === "member" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handlePromote(memberId)}
          >
            Promote to Exec
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handleDemote(memberId)}
          >
            Demote to Member
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          className="text-red-400 hover:text-red-300"
          onClick={() => handleRemove(memberId)}
        >
          Remove
        </Button>
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
          {sortedMembers.map((member) => (
            <div key={member.id} style={memberCardStyle}>
              <div className="flex items-center gap-3">
                <MemberAvatar
                  avatarUrl={member.avatarUrl}
                  name={member.fullName ?? member.email ?? "U"}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
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
                    <span style={roleBadgeStyle(member.role)}>{member.role}</span>
                  </div>
                  <p
                    className="truncate"
                    style={{
                      fontSize: "12px",
                      color: "#555555",
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

                {renderAdminActions(member.role, member.id, member.userId) ?? (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
