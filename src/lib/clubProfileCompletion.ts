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

export type ClubSetupSection = "profile" | "launch";

export type ClubSetupProgressItem = {
  id: string;
  label: string;
  complete: boolean;
  section: ClubSetupSection;
  missingLabel: string;
  fixPath?: string;
  actionLabel?: string;
  instruction?: string;
  templateType?: "announcement" | "event";
};

export type ClubSetupProgress = {
  items: ClubSetupProgressItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
  allComplete: boolean;
  missingLabels: string[];
};

function settingsPathForField(
  clubId: string,
  section: ClubSetupSettingsSection,
  confirmField: string,
  state: SetupFieldState,
): string {
  if (state === "existing_unconfirmed") {
    return buildClubSettingsConfirmPath(clubId, section, confirmField);
  }
  return buildClubSettingsSectionPath(clubId, section);
}

function buildClubSetupProgressItems(
  club: Club,
  postsCount: number,
  eventsCount: number,
): ClubSetupProgressItem[] {
  const logoState = getSetupFieldState(
    clubHasLogoValue(club),
    club.logoConfirmed === true,
  );
  const bannerState = getSetupFieldState(
    clubHasBannerValue(club),
    club.bannerConfirmed === true,
  );
  const descriptionState = getSetupFieldState(
    Boolean(club.shortDescription?.trim()),
    club.descriptionConfirmed === true,
  );
  const contactEmailState = getSetupFieldState(
    Boolean(club.contactEmail?.trim()),
    club.contactEmailConfirmed === true,
  );
  const meetingScheduleState = getSetupFieldState(
    Boolean(club.meetingSchedule?.trim()),
    club.meetingScheduleConfirmed === true,
  );
  const socialLinksState = getSetupFieldState(
    clubHasSocialLinks(club.socialLinks),
    club.socialLinksConfirmed === true,
  );
  const membershipState = getSetupFieldState(
    Boolean(club.membershipType),
    club.membershipConfirmed === true,
  );

  return [
    {
      id: "name",
      label: "Club name confirmed",
      complete: Boolean(club.name?.trim()),
      section: "profile",
      missingLabel: "club name",
    },
    {
      id: "logo",
      label: setupChecklistItemLabel("club logo", logoState),
      complete: logoState === "confirmed",
      section: "profile",
      missingLabel: "club logo",
      fixPath: settingsPathForField(club.id, "branding", "logo", logoState),
      actionLabel: setupChecklistActionLabel(logoState),
      instruction:
        logoState === "existing_unconfirmed"
          ? "Review your club logo and click Save in Settings to confirm it."
          : "Replace the default logo with your club's official logo.",
    },
    {
      id: "banner",
      label: setupChecklistItemLabel("club banner", bannerState),
      complete: bannerState === "confirmed",
      section: "profile",
      missingLabel: "banner",
      fixPath: settingsPathForField(club.id, "branding", "banner", bannerState),
      actionLabel: setupChecklistActionLabel(bannerState),
      instruction:
        bannerState === "existing_unconfirmed"
          ? "Review your club banner and click Save in Settings to confirm it."
          : "Replace the default banner with a real club banner image.",
    },
    {
      id: "short-description",
      label: setupChecklistItemLabel("short description", descriptionState),
      complete: descriptionState === "confirmed",
      section: "profile",
      missingLabel: "short description",
      fixPath: settingsPathForField(
        club.id,
        "profile",
        "short-description",
        descriptionState,
      ),
      actionLabel: setupChecklistActionLabel(descriptionState),
      instruction:
        descriptionState === "existing_unconfirmed"
          ? "Review the description from your club request and click Save to confirm."
          : "Add a short description that accurately represents your club.",
    },
    {
      id: "contact-email",
      label: setupChecklistItemLabel("contact email", contactEmailState),
      complete: contactEmailState === "confirmed",
      section: "profile",
      missingLabel: "contact email",
      fixPath: settingsPathForField(
        club.id,
        "profile",
        "contact-email",
        contactEmailState,
      ),
      actionLabel: setupChecklistActionLabel(contactEmailState),
      instruction:
        contactEmailState === "existing_unconfirmed"
          ? "Review the contact email from your club request and click Save to confirm."
          : "Add a contact email so students can reach your club.",
    },
    {
      id: "meeting-schedule",
      label: setupChecklistItemLabel("meeting schedule", meetingScheduleState),
      complete: meetingScheduleState === "confirmed",
      section: "profile",
      missingLabel: "meeting schedule",
      fixPath: settingsPathForField(
        club.id,
        "profile",
        "meeting-schedule",
        meetingScheduleState,
      ),
      actionLabel: setupChecklistActionLabel(meetingScheduleState),
      instruction:
        meetingScheduleState === "existing_unconfirmed"
          ? "Review the meeting schedule from your club request and click Save to confirm."
          : "Let members know when and where your club meets.",
    },
    {
      id: "social-links",
      label: setupChecklistItemLabel("social links", socialLinksState),
      complete: socialLinksState === "confirmed",
      section: "profile",
      missingLabel: "social links",
      fixPath: settingsPathForField(
        club.id,
        "social",
        "social-links",
        socialLinksState,
      ),
      actionLabel: setupChecklistActionLabel(socialLinksState),
      instruction:
        socialLinksState === "existing_unconfirmed"
          ? "Review your social links and click Save to confirm."
          : "Link your Instagram, website, or other channels.",
    },
    {
      id: "membership-type",
      label: setupChecklistItemLabel("membership rules", membershipState),
      complete: membershipState === "confirmed",
      section: "profile",
      missingLabel: "membership rules",
      fixPath: settingsPathForField(
        club.id,
        "membership",
        "membership-type",
        membershipState,
      ),
      actionLabel: setupChecklistActionLabel(membershipState),
      instruction:
        membershipState === "existing_unconfirmed"
          ? "Review how students can join your club and click Save to confirm."
          : "Choose how students can join your club.",
    },
    {
      id: "announcement",
      label: "Create welcome announcement",
      complete: postsCount > 0,
      section: "launch",
      missingLabel: "announcement",
      fixPath: `/app/clubs/${club.id}/announcements?openCreate=true`,
      actionLabel: "Add →",
      templateType: "announcement",
      instruction:
        "Post a welcome message to introduce your club to new members.",
    },
    {
      id: "event",
      label: "Create first event",
      complete: eventsCount > 0,
      section: "launch",
      missingLabel: "event",
      fixPath: `/app/clubs/${club.id}/events?openCreate=true`,
      actionLabel: "Add →",
      templateType: "event",
      instruction: "Create your first event to start engaging your club community.",
    },
  ];
}

/** Single source of truth for club setup checklist progress and completion state. */
export function computeClubSetupProgress(
  club: Club,
  postsCount: number,
  eventsCount: number,
): ClubSetupProgress {
  const items = buildClubSetupProgressItems(club, postsCount, eventsCount);
  const completedCount = items.filter((item) => item.complete).length;
  const totalCount = items.length;
  const percent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return {
    items,
    completedCount,
    totalCount,
    percent,
    allComplete: completedCount === totalCount,
    missingLabels: items
      .filter((item) => !item.complete)
      .map((item) => item.missingLabel),
  };
}

/** Deep-link to the first incomplete setup step (profile or launch). */
export function resolveClubSetupSettingsPath(
  settingsPath: string,
  club: Club,
  postsCount = 0,
  eventsCount = 0,
): string {
  const { items } = computeClubSetupProgress(club, postsCount, eventsCount);
  const firstIncomplete = items.find((item) => !item.complete && item.fixPath);
  return firstIncomplete?.fixPath ?? `${settingsPath}?section=profile&highlight=profile`;
}
