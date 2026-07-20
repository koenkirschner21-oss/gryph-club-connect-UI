import type { AccessLevel, MemberRole, Visibility } from "../types";

export function normalizeVisibility(
  value: string | null | undefined,
  fallback: Visibility = "members_only",
): Visibility {
  if (
    value === "public" ||
    value === "members_only" ||
    value === "executives_only" ||
    value === "selected"
  ) {
    return value;
  }
  if (value === "featured") {
    return "public";
  }
  return fallback;
}

export function canViewContent(
  visibility: Visibility | undefined,
  context: {
    isMember: boolean;
    isPrivileged: boolean;
    userId?: string | null;
    accessLevel?: AccessLevel | null;
    role?: MemberRole | string | null;
  },
  targets?: {
    visibilityRoles?: AccessLevel[];
    visibilityUserIds?: string[];
  },
): boolean {
  const level = visibility ?? "members_only";
  if (level === "public") return true;
  if (level === "executives_only") return context.isPrivileged;
  if (level === "selected") {
    if (!context.isMember) return false;

    const selectedUserIds = targets?.visibilityUserIds ?? [];
    if (context.userId && selectedUserIds.includes(context.userId)) {
      return true;
    }

    const selectedRoles = targets?.visibilityRoles ?? [];
    const viewerRole = resolveViewerAccessLevel(context.accessLevel, context.role);
    return Boolean(viewerRole && selectedRoles.includes(viewerRole));
  }
  return context.isMember;
}

export function filterByVisibility<
  T extends {
    visibility?: Visibility;
    visibilityRoles?: AccessLevel[];
    visibilityUserIds?: string[];
  },
>(
  items: T[],
  context: {
    isMember: boolean;
    isPrivileged: boolean;
    userId?: string | null;
    accessLevel?: AccessLevel | null;
    role?: MemberRole | string | null;
  },
): T[] {
  return items.filter((item) =>
    canViewContent(item.visibility, context, {
      visibilityRoles: item.visibilityRoles,
      visibilityUserIds: item.visibilityUserIds,
    }),
  );
}

function resolveViewerAccessLevel(
  accessLevel: AccessLevel | null | undefined,
  role: MemberRole | string | null | undefined,
): AccessLevel | null {
  if (
    accessLevel === "president" ||
    accessLevel === "managerial_executive" ||
    accessLevel === "executive" ||
    accessLevel === "member"
  ) {
    return accessLevel;
  }
  if (role === "owner" || role === "admin") return "president";
  if (role === "executive" || role === "exec") return "executive";
  if (role === "member") return "member";
  return null;
}

export const STANDARD_VISIBILITY_OPTIONS: {
  value: Exclude<Visibility, "selected">;
  label: string;
  description: string;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can see this, including non-members.",
  },
  {
    value: "members_only",
    label: "Members Only",
    description: "Only active club members can see this.",
  },
  {
    value: "executives_only",
    label: "Executives Only",
    description: "Only executives and presidents can see this.",
  },
];

export type StandardVisibility = (typeof STANDARD_VISIBILITY_OPTIONS)[number]["value"];

/** @deprecated Prefer STANDARD_VISIBILITY_OPTIONS + ContentVisibilityDropdown. Kept for legacy Selected data. */
export const VISIBILITY_OPTIONS: {
  value: Visibility;
  emoji: string;
  label: string;
  description: string;
}[] = [
  {
    value: "public",
    emoji: "🌐",
    label: "Public",
    description: "Anyone can see this",
  },
  {
    value: "members_only",
    emoji: "👥",
    label: "Members Only",
    description: "Only club members",
  },
  {
    value: "executives_only",
    emoji: "🔒",
    label: "Executives Only",
    description: "Only executives and above",
  },
  {
    value: "selected",
    emoji: "🎯",
    label: "Selected",
    description: "Specific roles or members",
  },
];

export function toStandardVisibility(
  value: Visibility | null | undefined,
  fallback: StandardVisibility = "members_only",
): StandardVisibility {
  if (value === "public" || value === "members_only" || value === "executives_only") {
    return value;
  }
  return fallback;
}
