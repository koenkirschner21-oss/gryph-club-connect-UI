export type PermissionRole =
  | "president"
  | "managerial_executive"
  | "executive"
  | "member";

export type PermissionKey =
  | "create_events"
  | "post_announcements"
  | "approve_members"
  | "manage_documents"
  | "manage_hiring"
  | "invite_members"
  | "assign_tasks"
  | "manage_roles"
  | "edit_club_settings"
  | "delete_club"
  | "view_analytics"
  | "manage_meetings";

/** Maps canonical RLS capability keys to stored custom_permissions row ids. */
export const PERMISSION_CAPABILITY_ALIASES: Record<string, PermissionKey[]> = {
  manage_members: ["approve_members", "invite_members"],
  manage_hiring: ["manage_hiring"],
  view_analytics: ["view_analytics"],
  manage_club_settings: ["edit_club_settings", "manage_roles", "delete_club"],
  manage_tasks: ["assign_tasks"],
  manage_events: ["create_events"],
  manage_meetings: ["manage_meetings"],
  manage_documents: ["manage_documents"],
  manage_announcements: ["post_announcements"],
};

export type ClubPermissions = Record<
  PermissionKey,
  Record<PermissionRole, boolean>
>;

export const PERMISSION_ROLE_COLUMNS: {
  key: PermissionRole;
  label: string;
  locked: boolean;
}[] = [
  { key: "president", label: "President / Co-President", locked: true },
  { key: "managerial_executive", label: "Managerial Executive", locked: false },
  { key: "executive", label: "Executive", locked: false },
  { key: "member", label: "General Member", locked: true },
];

export const PERMISSION_ROW_DEFINITIONS: {
  id: PermissionKey;
  label: string;
}[] = [
  { id: "create_events", label: "Create events" },
  { id: "post_announcements", label: "Post announcements" },
  { id: "approve_members", label: "Approve members" },
  { id: "manage_documents", label: "Manage documents" },
  { id: "manage_hiring", label: "Manage hiring" },
  { id: "invite_members", label: "Invite members" },
  { id: "assign_tasks", label: "Assign tasks" },
  { id: "manage_roles", label: "Manage roles" },
  { id: "edit_club_settings", label: "Edit club settings" },
  { id: "delete_club", label: "Delete club" },
  { id: "view_analytics", label: "View analytics" },
  { id: "manage_meetings", label: "Manage meetings" },
];

export const defaultPermissions: ClubPermissions = {
  create_events: {
    president: true,
    managerial_executive: true,
    executive: true,
    member: false,
  },
  post_announcements: {
    president: true,
    managerial_executive: true,
    executive: true,
    member: false,
  },
  approve_members: {
    president: true,
    managerial_executive: true,
    executive: false,
    member: false,
  },
  manage_documents: {
    president: true,
    managerial_executive: true,
    executive: false,
    member: false,
  },
  manage_hiring: {
    president: true,
    managerial_executive: true,
    executive: false,
    member: false,
  },
  invite_members: {
    president: true,
    managerial_executive: true,
    executive: false,
    member: false,
  },
  assign_tasks: {
    president: true,
    managerial_executive: true,
    executive: true,
    member: false,
  },
  manage_roles: {
    president: true,
    managerial_executive: false,
    executive: false,
    member: false,
  },
  edit_club_settings: {
    president: true,
    managerial_executive: true,
    executive: false,
    member: false,
  },
  delete_club: {
    president: true,
    managerial_executive: false,
    executive: false,
    member: false,
  },
  view_analytics: {
    president: true,
    managerial_executive: true,
    executive: false,
    member: false,
  },
  manage_meetings: {
    president: true,
    managerial_executive: true,
    executive: true,
    member: false,
  },
};

function clonePermissions(source: ClubPermissions): ClubPermissions {
  return JSON.parse(JSON.stringify(source)) as ClubPermissions;
}

export function cloneDefaultPermissions(): ClubPermissions {
  return clonePermissions(defaultPermissions);
}

export function normalizeClubPermissions(
  permissions: ClubPermissions,
): ClubPermissions {
  const normalized = clonePermissions(permissions);

  for (const row of PERMISSION_ROW_DEFINITIONS) {
    if (!normalized[row.id]) {
      normalized[row.id] = { ...defaultPermissions[row.id] };
    }

    normalized[row.id].president = true;
    normalized[row.id].member = false;
  }

  return normalized;
}

export function parseClubPermissions(raw: unknown): ClubPermissions {
  const merged = cloneDefaultPermissions();

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return merged;
  }

  const record = raw as Record<string, unknown>;

  for (const row of PERMISSION_ROW_DEFINITIONS) {
    const actionRaw = record[row.id];
    if (!actionRaw || typeof actionRaw !== "object" || Array.isArray(actionRaw)) {
      continue;
    }

    const actionRecord = actionRaw as Record<string, unknown>;
    for (const role of PERMISSION_ROLE_COLUMNS) {
      if (typeof actionRecord[role.key] === "boolean") {
        merged[row.id][role.key] = actionRecord[role.key] as boolean;
      }
    }
  }

  return normalizeClubPermissions(merged);
}

export function permissionsEqual(
  left: ClubPermissions,
  right: ClubPermissions,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isPermissionCellChanged(
  permissions: ClubPermissions,
  savedPermissions: ClubPermissions,
  actionId: PermissionKey,
  role: PermissionRole,
): boolean {
  return permissions[actionId][role] !== savedPermissions[actionId][role];
}

export function resolvePermissionRole(
  accessLevel: PermissionRole | null | undefined,
  memberRole: string | null | undefined,
): PermissionRole {
  if (memberRole === "owner" || memberRole === "admin") return "president";
  if (
    accessLevel === "president" ||
    accessLevel === "managerial_executive" ||
    accessLevel === "executive" ||
    accessLevel === "member"
  ) {
    return accessLevel;
  }
  if (memberRole === "executive" || memberRole === "exec") return "executive";
  return "member";
}

export function isExecutiveAccessLevel(
  accessLevel: PermissionRole | null | undefined,
  memberRole: string | null | undefined,
): boolean {
  if (
    accessLevel === "president" ||
    accessLevel === "managerial_executive" ||
    accessLevel === "executive"
  ) {
    return true;
  }
  return memberRole === "owner" || memberRole === "executive" || memberRole === "exec";
}

export function isPresidentAccess(
  accessLevel: PermissionRole | null | undefined,
  memberRole: string | null | undefined,
): boolean {
  return resolvePermissionRole(accessLevel, memberRole) === "president";
}

export function hasPermissionKey(
  permissions: ClubPermissions,
  accessLevel: PermissionRole | null | undefined,
  memberRole: string | null | undefined,
  key: PermissionKey,
): boolean {
  const role = resolvePermissionRole(accessLevel, memberRole);
  if (role === "president") return true;
  if (role === "member") return false;
  return permissions[key][role];
}

export function hasClubPermission(
  permissions: ClubPermissions,
  accessLevel: PermissionRole | null | undefined,
  memberRole: string | null | undefined,
  capability: keyof typeof PERMISSION_CAPABILITY_ALIASES,
): boolean {
  const role = resolvePermissionRole(accessLevel, memberRole);
  if (role === "president") return true;
  if (role === "member") return false;

  const aliasKeys = PERMISSION_CAPABILITY_ALIASES[capability] ?? [];
  if (aliasKeys.length === 0) return false;

  if (capability === "manage_members") {
    return aliasKeys.some((key) => permissions[key][role]);
  }

  if (capability === "manage_club_settings") {
    return permissions.edit_club_settings[role];
  }

  const primary = aliasKeys[0];
  return permissions[primary][role];
}
