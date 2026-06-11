import type { Visibility } from "../types";

export function normalizeVisibility(
  value: string | null | undefined,
  fallback: Visibility = "members_only",
): Visibility {
  if (
    value === "public" ||
    value === "members_only" ||
    value === "executives_only"
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
  context: { isMember: boolean; isPrivileged: boolean },
): boolean {
  const level = visibility ?? "members_only";
  if (level === "public") return true;
  if (level === "executives_only") return context.isPrivileged;
  return context.isMember;
}

export function filterByVisibility<T extends { visibility?: Visibility }>(
  items: T[],
  context: { isMember: boolean; isPrivileged: boolean },
): T[] {
  return items.filter((item) => canViewContent(item.visibility, context));
}

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
];
