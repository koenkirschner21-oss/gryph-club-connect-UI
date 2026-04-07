import type { Club } from "../types";

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
