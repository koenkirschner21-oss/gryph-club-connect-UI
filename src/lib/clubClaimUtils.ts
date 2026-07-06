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

/** Owners in club_members override stale claim_status on imported clubs. */
export function resolveEffectiveClaimStatus(
  claimStatus: ClaimStatus,
  activeOwnerCount: number,
): ClaimStatus {
  if (activeOwnerCount > 0) {
    return claimStatus === "active" ? "active" : "claimed";
  }
  return claimStatus;
}

/** Align claim_status with open club_claim_requests (public profile / claim page). */
export function resolveElevatedClaimStatus(
  claimStatus: ClaimStatus,
  hasOpenClubClaimRequests: boolean,
  userHasOpenClaimRequest: boolean,
): ClaimStatus {
  let status = claimStatus;

  if (status === "unclaimed" && hasOpenClubClaimRequests) {
    status = "claim_pending";
  }

  if (
    userHasOpenClaimRequest &&
    status !== "claimed" &&
    status !== "active"
  ) {
    status = "claim_pending";
  }

  return status;
}

export type ExploreClubClaimState =
  | "claimable"
  | "claimed"
  | "pending"
  | "user_pending"
  | "loading";

/** Definitive states from club.claim_status only; otherwise neutral loading. */
export function resolveExploreClubClaimStatePreMeta(
  claimStatus: ClaimStatus,
): ExploreClubClaimState {
  if (claimStatus === "claimed" || claimStatus === "active") {
    return "claimed";
  }
  if (claimStatus === "claim_pending") {
    return "pending";
  }
  return "loading";
}

export function resolveExploreClubClaimState(
  claimStatus: ClaimStatus,
  activeOwnerCount: number,
  hasPendingClubClaim: boolean,
  userSubmittedPendingClaim: boolean,
): ExploreClubClaimState {
  const effective = resolveEffectiveClaimStatus(claimStatus, activeOwnerCount);

  if (effective === "claimed" || effective === "active") {
    return "claimed";
  }
  if (userSubmittedPendingClaim) {
    return "user_pending";
  }
  if (effective === "claim_pending" || hasPendingClubClaim) {
    return "pending";
  }
  if (effective === "unclaimed") {
    return "claimable";
  }
  return "claimed";
}
