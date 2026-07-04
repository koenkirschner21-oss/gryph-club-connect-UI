import type { AccessLevel, ClubMember } from "../types";
import { accessLevelFromMember } from "./memberRoleTitle";

export interface SelectedVisibilityTargets {
  visibilityRoles: AccessLevel[];
  visibilityUserIds: string[];
}

export const EMPTY_SELECTED_VISIBILITY: SelectedVisibilityTargets = {
  visibilityRoles: [],
  visibilityUserIds: [],
};

export function normalizeAccessLevelArray(raw: unknown): AccessLevel[] {
  if (!Array.isArray(raw)) return [];
  const values = raw.filter((value): value is AccessLevel =>
    value === "president" ||
    value === "managerial_executive" ||
    value === "executive" ||
    value === "member",
  );
  return Array.from(new Set(values));
}

export function normalizeUuidArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.filter((value): value is string => typeof value === "string")),
  );
}

export function selectedVisibilityPayload(
  visibilityRoles: AccessLevel[],
  visibilityUserIds: string[],
): SelectedVisibilityTargets {
  return {
    visibilityRoles: normalizeAccessLevelArray(visibilityRoles),
    visibilityUserIds: normalizeUuidArray(visibilityUserIds),
  };
}

export function hasSelectedVisibilityTargets({
  visibilityRoles,
  visibilityUserIds,
}: SelectedVisibilityTargets): boolean {
  return visibilityRoles.length > 0 || visibilityUserIds.length > 0;
}

export function activeMembersForSelectedVisibility(
  members: ClubMember[],
): ClubMember[] {
  return members
    .filter((member) => member.status === "active")
    .sort((a, b) =>
      (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""),
    );
}

export function selectedVisibilityMemberAccessLevel(
  member: ClubMember,
): AccessLevel {
  return accessLevelFromMember(member);
}
