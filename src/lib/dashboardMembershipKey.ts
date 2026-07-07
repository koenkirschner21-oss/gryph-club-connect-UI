import type { MemberRole } from "../types";

/**
 * Stable dependency key for dashboard content queries. Changes when the user's
 * active club memberships or per-club roles change (join/leave/approve/promote/demote).
 */
export function dashboardMembershipAccessKey(
  joinedClubIds: string[],
  userRoles: Record<string, MemberRole>,
): string {
  const clubPart = [...joinedClubIds].sort().join(",");
  const rolePart = Object.entries(userRoles)
    .sort(([leftClubId], [rightClubId]) => leftClubId.localeCompare(rightClubId))
    .map(([clubId, role]) => `${clubId}:${role}`)
    .join("|");
  return `${clubPart}::${rolePart}`;
}
