import type { Club } from "../types";

function hasSocialLinks(links: Club["socialLinks"]): boolean {
  if (!links) return false;
  return Object.values(links).some((value) => Boolean(value && value.trim() !== ""));
}

export function computeClubProfileCompletionPercent(
  club: Club,
  hasAnnouncement: boolean,
  hasEvent: boolean,
): number {
  const checks = [
    Boolean(club.name && club.name.trim() !== ""),
    Boolean(club.shortDescription && club.shortDescription.trim() !== ""),
    Boolean(club.logoUrl && club.logoUrl.trim() !== ""),
    Boolean(club.bannerUrl && club.bannerUrl.trim() !== ""),
    Boolean(club.contactEmail && club.contactEmail.trim() !== ""),
    Boolean(club.meetingSchedule && club.meetingSchedule.trim() !== ""),
    hasSocialLinks(club.socialLinks),
    true,
    hasAnnouncement,
    hasEvent,
  ];

  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}
