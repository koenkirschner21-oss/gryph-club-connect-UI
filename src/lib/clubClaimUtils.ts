import type { ClaimStatus } from "../types";

export function normalizeClaimStatus(value: unknown): ClaimStatus {
  if (
    value === "claim_pending" ||
    value === "claimed" ||
    value === "active"
  ) {
    return value;
  }
  return "unclaimed";
}

export const CLAIM_ROLE_OPTIONS = [
  "President",
  "Co-President",
  "Vice President",
  "Executive",
  "General Member",
  "Other",
] as const;

export type ClaimRoleOption = (typeof CLAIM_ROLE_OPTIONS)[number];

const INELIGIBLE_CLAIM_ROLES = new Set<ClaimRoleOption>([
  "General Member",
  "Other",
]);

export function canSubmitClubClaim(role: ClaimRoleOption): boolean {
  return !INELIGIBLE_CLAIM_ROLES.has(role);
}

/** True only when the club is imported/unclaimed and has no active owners yet. */
export function isClubClaimable(
  claimStatus: ClaimStatus,
  activeOwnerCount: number,
): boolean {
  return claimStatus === "unclaimed" && activeOwnerCount === 0;
}
