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

export const OPTIONAL_SETUP_ITEM_IDS = [
  "social-links",
  "invite-members",
  "documents",
  "visibility-defaults",
] as const;

export type OptionalSetupItemId = (typeof OPTIONAL_SETUP_ITEM_IDS)[number];

export function parseSetupSkippedItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

export function isClubSetupItemSkipped(club: Club, itemId: string): boolean {
  return (club.setupSkippedItems ?? []).includes(itemId);
}

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

export type ClubSetupSection = "profile" | "launch" | "recommended";

export type ClubSetupProgressItem = {
  id: string;
  label: string;
  complete: boolean;
  section: ClubSetupSection;
  required: boolean;
  missingLabel: string;
  fixPath?: string;
  actionLabel?: string;
  instruction?: string;
  templateType?: "announcement" | "event";
  optional?: boolean;
  skipped?: boolean;
  canSkip?: boolean;
};

export type ClubSetupProgressCounts = {
  postsCount: number;
  eventsCount: number;
  documentsCount?: number;
  activeMemberCount?: number;
  pendingInviteCount?: number;
};

export type ClubSetupProgress = {
  items: ClubSetupProgressItem[];
  requiredItems: ClubSetupProgressItem[];
  optionalItems: ClubSetupProgressItem[];
  completedCount: number;
  totalCount: number;
  requiredCompletedCount: number;
  requiredTotalCount: number;
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

function optionalItemComplete(
  club: Club,
  itemId: OptionalSetupItemId,
  doneWithoutSkip: boolean,
): { complete: boolean; skipped: boolean } {
  const skipped = isClubSetupItemSkipped(club, itemId);
  return { complete: doneWithoutSkip || skipped, skipped: skipped && !doneWithoutSkip };
}

function buildClubSetupProgressItems(
  club: Club,
  counts: ClubSetupProgressCounts,
): ClubSetupProgressItem[] {
  const {
    postsCount,
    eventsCount,
    documentsCount = 0,
    activeMemberCount = 1,
    pendingInviteCount = 0,
  } = counts;

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
  const categoryState = getSetupFieldState(
    Boolean(club.category?.trim()),
    club.categoryConfirmed === true,
  );
  const meetingLocationState = getSetupFieldState(
    Boolean(club.meetingLocation?.trim()),
    club.meetingLocationConfirmed === true,
  );
  const membershipState = getSetupFieldState(
    Boolean(club.membershipType),
    club.membershipConfirmed === true,
  );
  const socialLinksState = getSetupFieldState(
    clubHasSocialLinks(club.socialLinks),
    club.socialLinksConfirmed === true,
  );

  const socialOptional = optionalItemComplete(
    club,
    "social-links",
    socialLinksState === "confirmed",
  );
  const inviteOptional = optionalItemComplete(
    club,
    "invite-members",
    activeMemberCount > 1 || pendingInviteCount > 0,
  );
  const documentsOptional = optionalItemComplete(
    club,
    "documents",
    documentsCount > 0,
  );
  const visibilityOptional = optionalItemComplete(
    club,
    "visibility-defaults",
    club.contentVisibilityDefaultsConfirmed === true,
  );

  return [
    {
      id: "name",
      label: "Club name confirmed",
      complete: Boolean(club.name?.trim()),
      section: "profile",
      required: true,
      missingLabel: "club name",
    },
    {
      id: "logo",
      label: setupChecklistItemLabel("club logo", logoState),
      complete: logoState === "confirmed",
      section: "profile",
      required: true,
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
      required: true,
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
      required: true,
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
      required: true,
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
      required: true,
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
      id: "category",
      label: setupChecklistItemLabel("category", categoryState),
      complete: categoryState === "confirmed",
      section: "profile",
      required: true,
      missingLabel: "category",
      fixPath: settingsPathForField(club.id, "profile", "category", categoryState),
      actionLabel: setupChecklistActionLabel(categoryState),
      instruction:
        categoryState === "existing_unconfirmed"
          ? "Review your club category and click Save in Settings to confirm it."
          : "Choose the category that best describes your club.",
    },
    {
      id: "meeting-location",
      label: setupChecklistItemLabel("meeting location", meetingLocationState),
      complete: meetingLocationState === "confirmed",
      section: "profile",
      required: true,
      missingLabel: "meeting location",
      fixPath: settingsPathForField(
        club.id,
        "profile",
        "meeting-location",
        meetingLocationState,
      ),
      actionLabel: setupChecklistActionLabel(meetingLocationState),
      instruction:
        meetingLocationState === "existing_unconfirmed"
          ? "Review your meeting location and click Save in Settings to confirm it."
          : "Add where your club usually meets on campus.",
    },
    {
      id: "membership-type",
      label: setupChecklistItemLabel("membership rules", membershipState),
      complete: membershipState === "confirmed",
      section: "profile",
      required: true,
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
      required: true,
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
      required: true,
      missingLabel: "event",
      fixPath: `/app/clubs/${club.id}/events?openCreate=true`,
      actionLabel: "Add →",
      templateType: "event",
      instruction: "Create your first event to start engaging your club community.",
    },
    {
      id: "social-links",
      label: setupChecklistItemLabel("social links", socialLinksState),
      complete: socialOptional.complete,
      section: "recommended",
      required: false,
      optional: true,
      skipped: socialOptional.skipped,
      canSkip: true,
      missingLabel: "social links",
      fixPath: settingsPathForField(
        club.id,
        "social",
        "social-links",
        socialLinksState,
      ),
      actionLabel: setupChecklistActionLabel(socialLinksState),
      instruction:
        "Recommended: link your Instagram, website, or other channels so students can follow your club.",
    },
    {
      id: "invite-members",
      label: "Invite executives or members",
      complete: inviteOptional.complete,
      section: "recommended",
      required: false,
      optional: true,
      skipped: inviteOptional.skipped,
      canSkip: true,
      missingLabel: "team invites",
      fixPath: `/app/clubs/${club.id}/members?openInvite=true`,
      actionLabel: "Invite →",
      instruction:
        "Recommended: invite your exec team or early members to help run the club.",
    },
    {
      id: "documents",
      label: "Add documents or resources",
      complete: documentsOptional.complete,
      section: "recommended",
      required: false,
      optional: true,
      skipped: documentsOptional.skipped,
      canSkip: true,
      missingLabel: "documents",
      fixPath: `/app/clubs/${club.id}/documents?openUpload=true`,
      actionLabel: "Add →",
      instruction:
        "Recommended: upload bylaws, onboarding docs, or other resources for your team.",
    },
    {
      id: "visibility-defaults",
      label: "Review content visibility defaults",
      complete: visibilityOptional.complete,
      section: "recommended",
      required: false,
      optional: true,
      skipped: visibilityOptional.skipped,
      canSkip: true,
      missingLabel: "visibility defaults",
      fixPath: buildClubSettingsConfirmPath(
        club.id,
        "profile",
        "visibility-defaults",
      ),
      actionLabel: "Review →",
      instruction:
        "Recommended: confirm who can see announcements, events, and documents by default.",
    },
  ];
}

/** Single source of truth for club setup checklist progress and completion state. */
export function computeClubSetupProgress(
  club: Club,
  counts: ClubSetupProgressCounts,
): ClubSetupProgress {
  const items = buildClubSetupProgressItems(club, counts);
  const requiredItems = items.filter((item) => item.required);
  const optionalItems = items.filter((item) => item.optional);
  const requiredCompletedCount = requiredItems.filter((item) => item.complete).length;
  const requiredTotalCount = requiredItems.length;
  const percent =
    requiredTotalCount === 0
      ? 0
      : Math.round((requiredCompletedCount / requiredTotalCount) * 100);

  return {
    items,
    requiredItems,
    optionalItems,
    completedCount: requiredCompletedCount,
    totalCount: requiredTotalCount,
    requiredCompletedCount,
    requiredTotalCount,
    percent,
    allComplete: requiredCompletedCount === requiredTotalCount,
    missingLabels: requiredItems
      .filter((item) => !item.complete)
      .map((item) => item.missingLabel),
  };
}

/**
 * Whether the Command Center profile setup banner should appear.
 * Published clubs never show it — live checklist math must not resurrect it
 * if launch content is deleted after publish.
 */
export function shouldShowProfileSetupBanner(
  club: Pick<Club, "setupCompleted" | "isPublished" | "claimStatus">,
): boolean {
  if (club.setupCompleted === true && club.isPublished === true) {
    return false;
  }

  return club.claimStatus === "claimed" && club.setupCompleted !== true;
}

/** Deep-link to the first incomplete required setup step. */
export function resolveClubSetupSettingsPath(
  settingsPath: string,
  club: Club,
  counts: ClubSetupProgressCounts,
): string {
  const { requiredItems } = computeClubSetupProgress(club, counts);
  const firstIncomplete = requiredItems.find((item) => !item.complete && item.fixPath);
  return firstIncomplete?.fixPath ?? `${settingsPath}?section=profile&highlight=profile`;
}
