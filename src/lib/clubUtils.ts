import type { Club } from "../types";

/** Brand banner fallbacks when no custom banner is uploaded (black, red, gold). */
const CLUB_BANNER_BRAND_BACKGROUNDS = ["#0f0f0f", "#E51937", "#8B6914"] as const;

/** True only for user-uploaded / real banner URLs — not placehold.co or app placeholders. */
export function isUploadedClubBanner(url?: string | null): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (lower.includes("placehold.co")) return false;
  if (lower.includes("placeholder-rect")) return false;
  if (lower.includes("/assets/placeholders/")) return false;

  return true;
}

export function getClubBannerBrandBackground(clubName: string): string {
  const index = clubName.charCodeAt(0) % CLUB_BANNER_BRAND_BACKGROUNDS.length;
  return CLUB_BANNER_BRAND_BACKGROUNDS[index];
}

/** Generate display initials from a club's abbreviation or name. */
export function getClubInitials(club: Pick<Club, "abbreviation" | "name">): string {
  if (club.abbreviation) return club.abbreviation.slice(0, 3).toUpperCase();
  return club.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
