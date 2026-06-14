import type { Club } from "../types";

function hasSocialLinks(links: Club["socialLinks"]): boolean {
  if (!links) return false;
  return Object.values(links).some((value) => Boolean(value && value.trim() !== ""));
}

export function clubHasSocialLinks(links: Club["socialLinks"]): boolean {
  return hasSocialLinks(links);
}

export function getClubProfileMissingLabels(
  club: Club,
  hasAnnouncement: boolean,
  hasEvent: boolean,
): string[] {
  const missing: string[] = [];
  if (!club.logoUrl?.trim()) missing.push("logo");
  if (!club.bannerUrl?.trim()) missing.push("banner");
  if (!club.contactEmail?.trim()) missing.push("contact email");
  if (!hasSocialLinks(club.socialLinks)) missing.push("social links");
  if (!club.shortDescription?.trim()) missing.push("short description");
  if (!club.meetingSchedule?.trim()) missing.push("meeting schedule");
  if (!hasAnnouncement) missing.push("announcement");
  if (!hasEvent) missing.push("event");
  return missing;
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
