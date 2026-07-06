import { normalizeClaimStatus } from "./clubClaimUtils";
import type { Club } from "../types";

export function isClubPubliclyDiscoverable(
  club: Pick<Club, "isPublished" | "setupCompleted" | "claimStatus">,
): boolean {
  return (
    club.isPublished === true &&
    club.setupCompleted === true &&
    normalizeClaimStatus(club.claimStatus) === "active"
  );
}

export function isClubPubliclyDiscoverableRow(row: Record<string, unknown>): boolean {
  return (
    row.is_published === true &&
    row.setup_completed === true &&
    normalizeClaimStatus(row.claim_status) === "active"
  );
}

export function canBypassPublicClubVisibility(membership: {
  status?: string | null;
} | null): boolean {
  return membership?.status === "active" || membership?.status === "pending";
}
