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
  | "delete_club";

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
    executive: true,
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
