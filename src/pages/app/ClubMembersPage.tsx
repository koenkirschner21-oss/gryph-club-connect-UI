import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMembers } from "../../hooks/useClubMembers";
import type { MemberRole } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

export default function ClubMembersPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getClubById, getUserRole } = useClubContext();
  const club = getClubById(clubId ?? "");

  const role = getUserRole(clubId ?? "");
  const isAdmin = role === "admin";

  const { members, loading, updateRole, removeMember } = useClubMembers(clubId);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const roleOrder = { admin: 0, exec: 1, member: 2 } as const;
  const sortedMembers = [...members].sort(
    (a, b) => roleOrder[a.role] - roleOrder[b.role],
  );

  const roleColors: Record<string, string> = {
    admin: "bg-primary/10 text-primary",
    exec: "bg-yellow-500/10 text-yellow-400",
    member: "bg-surface-alt text-muted",
  };

  async function handlePromote(memberId: string) {
    setActionLoading(memberId);
    await updateRole(memberId, "exec");
    setActionLoading(null);
  }

  async function handleDemote(memberId: string) {
    setActionLoading(memberId);
    await updateRole(memberId, "member");
    setActionLoading(null);
  }

  async function handleRemove(memberId: string) {
    setActionLoading(memberId);
    await removeMember(memberId);
    setActionLoading(null);
  }

  function renderAdminActions(
    memberRole: MemberRole,
    memberId: string,
    memberUserId: string,
  ) {
    // Admins cannot modify themselves or other admins
    if (!isAdmin || memberRole === "admin" || memberUserId === user?.id) {
      return null;
    }

    const busy = actionLoading === memberId;

    return (
      <div className="flex flex-shrink-0 gap-2">
        {memberRole === "member" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handlePromote(memberId)}
          >
            Promote
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => handleDemote(memberId)}
          >
            Demote
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Members</h1>
        <p className="text-sm text-muted">
          {members.length} member{members.length !== 1 ? "s" : ""} in{" "}
          {club?.name ?? "this club"}
        </p>
      </div>

      {/* Join code section */}
      {club?.joinCode && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Invite Code
              </h3>
              <p className="text-xs text-muted">
                Share this code to invite new members
              </p>
            </div>
            <div className="rounded-lg bg-surface-alt px-4 py-2 font-mono text-lg font-bold tracking-widest text-white">
              {club.joinCode}
            </div>
          </div>
        </Card>
      )}

      {/* Members list */}
      {sortedMembers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            No members yet. Share the join code to invite people.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedMembers.map((member) => (
            <Card key={member.id} className="p-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(member.fullName ?? member.email ?? "U")[0].toUpperCase()}
                  </div>
                )}

                {/* Member info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-white">
                      {member.fullName ?? "Unknown"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[member.role]}`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted">{member.email}</p>
                  {member.program && (
                    <p className="truncate text-xs text-muted">
                      {member.program}
                    </p>
                  )}
                </div>

                {/* Admin actions or join date */}
                {renderAdminActions(member.role, member.id, member.userId) ?? (
                  <span className="flex-shrink-0 text-xs text-muted">
                    Joined{" "}
                    {new Date(member.joinedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
