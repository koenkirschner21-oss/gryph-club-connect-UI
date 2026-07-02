import type { Club } from "../types";

export type ClubSetupSettingsSection =
  | "profile"
  | "branding"
  | "social"
  | "membership";

const SETUP_SECTIONS = new Set<ClubSetupSettingsSection>([
  "profile",
  "branding",
  "social",
  "membership",
]);

export function buildClubSettingsSectionPath(
  clubId: string,
  section: ClubSetupSettingsSection,
): string {
  return `/app/clubs/${clubId}/settings?section=${section}&highlight=${section}`;
}

export function buildClubSettingsConfirmPath(
  clubId: string,
  section: ClubSetupSettingsSection,
  confirmField: string,
): string {
  return `/app/clubs/${clubId}/settings?section=${section}&highlight=${confirmField}&confirm=${confirmField}`;
}

export type SetupFieldState = "missing" | "existing_unconfirmed" | "confirmed";

export function getSetupFieldState(
  hasValue: boolean,
  isConfirmed: boolean,
): SetupFieldState {
  if (isConfirmed) return "confirmed";
  if (hasValue) return "existing_unconfirmed";
  return "missing";
}

export function setupChecklistItemLabel(
  fieldLabel: string,
  state: SetupFieldState,
): string {
  if (state === "confirmed") {
    return `${fieldLabel} confirmed`;
  }
  if (state === "existing_unconfirmed") {
    return `Confirm ${fieldLabel}`;
  }
  return `Add ${fieldLabel}`;
}

export function setupChecklistActionLabel(state: SetupFieldState): string {
  if (state === "confirmed") return "";
  if (state === "existing_unconfirmed") return "Confirm →";
  return "Add →";
}

export function isPlaceholderClubImageUrl(url: string | undefined | null): boolean {
  const normalized = (url ?? "").trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes("ui-avatars") ||
    normalized.includes("placeholder") ||
    normalized.includes("default") ||
    normalized.includes("initials")
  );
}

export function clubHasLogoValue(club: Club): boolean {
  return Boolean(club.logoUrl?.trim()) && !isPlaceholderClubImageUrl(club.logoUrl);
}

export function clubHasBannerValue(club: Club): boolean {
  return Boolean(club.bannerUrl?.trim()) && !isPlaceholderClubImageUrl(club.bannerUrl);
}

export function isClubSetupSettingsDeepLink(
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  const section = searchParams.get("section");
  return SETUP_SECTIONS.has(section as ClubSetupSettingsSection);
}

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

/** Deep-link to the first incomplete settings section for Command Center setup actions. */
export function resolveClubSetupSettingsPath(
  settingsPath: string,
  club: Club,
): string {
  if (!club.logoUrl?.trim() || !club.bannerUrl?.trim()) {
    return `${settingsPath}?section=branding&highlight=branding`;
  }

  if (
    !club.contactEmail?.trim() ||
    !club.shortDescription?.trim() ||
    !club.meetingSchedule?.trim()
  ) {
    return `${settingsPath}?section=profile&highlight=profile`;
  }

  if (!hasSocialLinks(club.socialLinks)) {
    return `${settingsPath}?section=social&highlight=social`;
  }

  return `${settingsPath}?section=profile&highlight=profile`;
}
