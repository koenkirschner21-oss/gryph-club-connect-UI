import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import type { ClubMember } from "../../types";
import Card from "../../components/ui/Card";

export default function ClubMembersPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");

  // Placeholder members — in production these come from club_members + profiles
  const members: ClubMember[] = user
    ? [
        {
          id: "mem-1",
          clubId: clubId ?? "",
          userId: user.id,
          role: "admin",
          status: "active",
          joinedAt: new Date().toISOString(),
          fullName: user.email?.split("@")[0] ?? "You",
          email: user.email ?? "",
        },
      ]
    : [];

  const roleOrder = { admin: 0, exec: 1, member: 2 } as const;
  const sortedMembers = [...members].sort(
    (a, b) => roleOrder[a.role] - roleOrder[b.role],
  );

  const roleColors: Record<string, string> = {
    admin: "bg-primary/10 text-primary",
    exec: "bg-yellow-100 text-yellow-800",
    member: "bg-surface-alt text-muted",
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-accent">Members</h1>
        <p className="text-sm text-muted">
          {club?.memberCount ?? members.length} member
          {(club?.memberCount ?? members.length) !== 1 ? "s" : ""} in{" "}
          {club?.name ?? "this club"}
        </p>
      </div>

      {/* Join code section */}
      {club?.joinCode && (
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-accent">
                Invite Code
              </h3>
              <p className="text-xs text-muted">
                Share this code to invite new members
              </p>
            </div>
            <div className="rounded-lg bg-surface-alt px-4 py-2 font-mono text-lg font-bold tracking-widest text-accent">
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
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(member.fullName ?? member.email ?? "U")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-accent">
                      {member.fullName ?? "Unknown"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[member.role]}`}
                    >
                      {member.role}
                    </span>
                    {member.status === "pending" && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted">{member.email}</p>
                </div>
                <span className="text-xs text-muted">
                  Joined{" "}
                  {new Date(member.joinedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
