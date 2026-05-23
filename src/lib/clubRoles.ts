import type { MemberRole } from "../types";

/** Roles that manage club workspace (settings, moderation, announcements, etc.). */
export function isPrivilegedClubRole(
  role: MemberRole | null | undefined,
): boolean {
  return role === "owner" || role === "executive";
}

/** Top moderators protected from role changes / removal by other members. */
export function isTopClubModeratorRole(
  role: MemberRole | null | undefined,
): boolean {
  return role === "owner";
}
