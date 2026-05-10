import type { MemberRole } from "../types";

/** Roles that manage club workspace (settings, moderation, announcements, etc.). */
export function isPrivilegedClubRole(
  role: MemberRole | null | undefined,
): boolean {
  return role === "owner" || role === "admin" || role === "exec";
}

/** Owner or admin — top moderators protected from junior admins / exec actions. */
export function isTopClubModeratorRole(
  role: MemberRole | null | undefined,
): boolean {
  return role === "owner" || role === "admin";
}
