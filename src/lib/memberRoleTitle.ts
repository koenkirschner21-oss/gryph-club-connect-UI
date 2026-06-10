import type { MemberRole } from "../types";

export const ROLE_TITLE_CUSTOM = "__custom__";

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
