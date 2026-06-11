import type { AccessLevel, MemberRole } from "../types";

export const ROLE_TITLE_CUSTOM = "__custom__";

export const ACCESS_LEVEL_OPTIONS: {
  value: AccessLevel;
  label: string;
  workspaceLabel: string;
}[] = [
  {
    value: "president",
    label: "President / Co-President",
    workspaceLabel: "President",
  },
  {
    value: "managerial_executive",
    label: "Managerial Executive",
    workspaceLabel: "Managerial Executive",
  },
  {
    value: "executive",
    label: "Executive",
    workspaceLabel: "Executive",
  },
  {
    value: "member",
    label: "General Member",
    workspaceLabel: "General Member",
  },
];

export function roleFromAccessLevel(level: AccessLevel): MemberRole {
  if (level === "president") return "owner";
  if (level === "managerial_executive" || level === "executive") return "executive";
  return "member";
}

export function accessLevelFromMember(member: {
  role: MemberRole | string;
  accessLevel?: AccessLevel | null;
}): AccessLevel {
  if (member.accessLevel) return member.accessLevel;
  const role = member.role;
  if (role === "owner") return "president";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

export function accessLevelBadgeLabel(level: AccessLevel): string {
  switch (level) {
    case "president":
      return "President";
    case "managerial_executive":
      return "Managerial Exec";
    case "executive":
      return "Executive";
    default:
      return "Member";
  }
}

export function accessLevelBadgeColor(level: AccessLevel): string {
  if (level === "president") return "#E51937";
  if (level === "managerial_executive" || level === "executive") return "#FFC429";
  return "#555555";
}

export function roleTitleGroupForAccessLevel(level: AccessLevel): string {
  if (level === "president") return "President / Co-President";
  if (level === "managerial_executive") return "Managerial Executive";
  if (level === "executive") return "Executive";
  return "Member";
}

export function roleTitleOptionsForAccessLevel(level: AccessLevel): string[] {
  const groupLabel = roleTitleGroupForAccessLevel(level);
  const group = ROLE_TITLE_GROUPS.find((entry) => entry.label === groupLabel);
  return group?.titles ?? [];
}

export const ROLE_TITLE_GROUPS: {
  label: string;
  roles: MemberRole[];
  titles: string[];
}[] = [
  {
    label: "President / Co-President",
    roles: ["owner"],
    titles: ["President", "Co-President", "Vice President"],
  },
  {
    label: "Managerial Executive",
    roles: ["executive"],
    titles: [
      "VP Events",
      "VP Marketing",
      "VP Finance",
      "VP Operations",
      "Treasurer",
      "Secretary",
      "Director",
    ],
  },
  {
    label: "Executive",
    roles: ["executive"],
    titles: [
      "Events Coordinator",
      "Marketing Coordinator",
      "Social Media Coordinator",
      "First-Year Representative",
      "Photographer",
      "General Executive",
    ],
  },
  {
    label: "Member",
    roles: ["member"],
    titles: ["General Member", "Volunteer", "Committee Member"],
  },
];

export function roleTitleOptionsForRole(role: MemberRole): string[] {
  const titles = new Set<string>();
  for (const group of ROLE_TITLE_GROUPS) {
    if (group.roles.includes(role)) {
      for (const title of group.titles) {
        titles.add(title);
      }
    }
  }
  return Array.from(titles);
}

export function formatMemberDisplayRole(
  role: MemberRole | string,
  roleTitle?: string | null,
): string {
  const trimmed = roleTitle?.trim();
  if (trimmed) return trimmed;
  if (role === "owner") return "Owner";
  if (role === "executive" || role === "exec") return "Executive";
  return "Member";
}

export function formatNameWithRoleTitle(
  name: string,
  roleTitle?: string | null,
): string {
  const trimmed = roleTitle?.trim();
  return trimmed ? `${name} · ${trimmed}` : name;
}

export function resolveRoleTitleSelectionForAccessLevel(
  level: AccessLevel,
  roleTitle?: string | null,
): { selection: string; custom: string } {
  const trimmed = roleTitle?.trim() ?? "";
  if (!trimmed) {
    return { selection: "", custom: "" };
  }
  if (roleTitleOptionsForAccessLevel(level).includes(trimmed)) {
    return { selection: trimmed, custom: "" };
  }
  return { selection: ROLE_TITLE_CUSTOM, custom: trimmed };
}

export function resolveRoleTitleSelection(
  role: MemberRole,
  roleTitle?: string | null,
): { selection: string; custom: string } {
  const trimmed = roleTitle?.trim() ?? "";
  if (!trimmed) {
    return { selection: "", custom: "" };
  }
  if (roleTitleOptionsForRole(role).includes(trimmed)) {
    return { selection: trimmed, custom: "" };
  }
  return { selection: ROLE_TITLE_CUSTOM, custom: trimmed };
}

export function resolveRoleTitleFromSelection(
  selection: string,
  custom: string,
): string {
  if (selection === ROLE_TITLE_CUSTOM) {
    return custom.trim();
  }
  return selection.trim();
}
