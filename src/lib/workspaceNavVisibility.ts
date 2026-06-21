import type { ClubMember } from "../types";
import {
  hasClubPermission,
  isPresidentAccess,
  resolvePermissionRole,
  type ClubPermissions,
  type PermissionRole,
  PERMISSION_CAPABILITY_ALIASES,
} from "./clubPermissions";
import { parseMeetingNotes, resolveInviteeUserIds } from "./meetingMetadata";
import { canViewContent, normalizeVisibility } from "./contentVisibility";

export type WorkspaceNavKey =
  | "dashboard"
  | "announcements"
  | "chat"
  | "tasks"
  | "events"
  | "meetings"
  | "documents"
  | "members"
  | "recruiting";

export interface WorkspaceNavFlags {
  hasChat: boolean;
  hasAssignedTasks: boolean;
  hasMeetingInvite: boolean;
  hasMemberDocuments: boolean;
  hasActiveHiring: boolean;
  isHiringReviewer: boolean;
}

export interface WorkspaceNavContext {
  permissionRole: PermissionRole;
  isPresident: boolean;
  permissions: ClubPermissions;
  accessLevel: PermissionRole | null | undefined;
  memberRole: string | null | undefined;
  flags: WorkspaceNavFlags;
}

export function shouldShowWorkspaceNavLink(
  key: WorkspaceNavKey,
  ctx: WorkspaceNavContext,
): boolean {
  const can = (capability: keyof typeof PERMISSION_CAPABILITY_ALIASES) =>
    hasClubPermission(ctx.permissions, ctx.accessLevel, ctx.memberRole, capability);

  if (
    key === "dashboard" ||
    key === "announcements" ||
    key === "events" ||
    key === "members"
  ) {
    return true;
  }

  if (ctx.isPresident) {
    if (key === "chat") return ctx.flags.hasChat;
    return true;
  }

  if (ctx.permissionRole === "member") {
    switch (key) {
      case "chat":
        return ctx.flags.hasChat;
      case "tasks":
        return ctx.flags.hasAssignedTasks;
      case "meetings":
        return ctx.flags.hasMeetingInvite;
      case "documents":
        return ctx.flags.hasMemberDocuments;
      case "recruiting":
        return ctx.flags.hasActiveHiring;
      default:
        return false;
    }
  }

  switch (key) {
    case "chat":
      return ctx.flags.hasChat;
    case "tasks":
      return can("manage_tasks") || ctx.flags.hasAssignedTasks;
    case "meetings":
      return can("manage_meetings") || ctx.flags.hasMeetingInvite;
    case "documents":
      return can("manage_documents") || ctx.flags.hasMemberDocuments;
    case "recruiting":
      return can("manage_hiring") || ctx.flags.isHiringReviewer;
    default:
      return false;
  }
}

export function shouldShowAnalyticsNav(ctx: WorkspaceNavContext): boolean {
  if (ctx.isPresident) return true;
  return hasClubPermission(
    ctx.permissions,
    ctx.accessLevel,
    ctx.memberRole,
    "view_analytics",
  );
}

export function userHasMeetingInvite(
  userId: string,
  members: ClubMember[],
  meetingNotes: string | null,
): boolean {
  const { metadata } = parseMeetingNotes(meetingNotes);
  return resolveInviteeUserIds(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds ?? [],
  ).includes(userId);
}

export function documentVisibleToMember(visibility: string | null | undefined): boolean {
  return canViewContent(normalizeVisibility(visibility), {
    isMember: true,
    isPrivileged: false,
  });
}

export function buildWorkspaceNavContext(
  accessLevel: PermissionRole | null | undefined,
  memberRole: string | null | undefined,
  permissions: ClubPermissions,
  flags: WorkspaceNavFlags,
): WorkspaceNavContext {
  return {
    permissionRole: resolvePermissionRole(accessLevel, memberRole),
    isPresident: isPresidentAccess(accessLevel, memberRole),
    permissions,
    accessLevel,
    memberRole,
    flags,
  };
}
