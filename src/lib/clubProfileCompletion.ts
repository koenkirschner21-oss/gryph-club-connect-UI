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

/** @deprecated Skip buttons removed; kept for reading legacy skipped arrays. */
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
  highlight?: string,
): string {
  const params = new URLSearchParams({ section });
  if (highlight) params.set("highlight", highlight);
  return `/app/clubs/${clubId}/settings?${params.toString()}`;
}

export function buildClubSettingsConfirmPath(
  clubId: string,
  section: ClubSetupSettingsSection,
  confirmField: string,
): string {
  return `/app/clubs/${clubId}/settings?section=${section}&highlight=${confirmField}&confirm=${confirmField}`;
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

export type ClubSetupMilestoneGroup = "required" | "recommended";

export type ClubSetupFieldCheck = {
  id: string;
  label: string;
  complete: boolean;
  fixPath?: string;
  actionLabel?: string;
};

export type ClubSetupMilestone = {
  id: string;
  title: string;
  group: ClubSetupMilestoneGroup;
  complete: boolean;
  description?: string;
  actionLabel: string;
  fixPath: string;
  fields: ClubSetupFieldCheck[];
  templateType?: "announcement" | "event";
};

export type ClubSetupProgressCounts = {
  postsCount: number;
  eventsCount: number;
  documentsCount?: number;
  activeMemberCount?: number;
  pendingInviteCount?: number;
};

export type ClubSetupProgress = {
  milestones: ClubSetupMilestone[];
  requiredMilestones: ClubSetupMilestone[];
  recommendedMilestones: ClubSetupMilestone[];
  requiredCompletedCount: number;
  requiredTotalCount: number;
  recommendedCompletedCount: number;
  recommendedTotalCount: number;
  /** Publication progress — required milestones only. */
  percent: number;
  allRequiredComplete: boolean;
  canPreviewPublicProfile: boolean;
  nextRequiredMilestone: ClubSetupMilestone | null;
  missingLabels: string[];
  /** Flat field-compatible view for older callers. */
  items: ClubSetupProgressItem[];
  requiredItems: ClubSetupProgressItem[];
  optionalItems: ClubSetupProgressItem[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
};

/** Legacy flat item shape retained for gradual migration. */
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
};

function fieldComplete(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

function buildMilestones(
  club: Club,
  counts: ClubSetupProgressCounts,
): ClubSetupMilestone[] {
  const {
    postsCount,
    eventsCount,
    documentsCount = 0,
    activeMemberCount = 1,
    pendingInviteCount = 0,
  } = counts;

  const nameOk = fieldComplete(club.name);
  const logoOk = clubHasLogoValue(club);
  const bannerOk = clubHasBannerValue(club);
  const descriptionOk = fieldComplete(club.shortDescription);
  const categoryOk = fieldComplete(club.category);
  const contactOk = fieldComplete(club.contactEmail);
  const meetsRegularlyAnswered = club.meetsRegularly === true || club.meetsRegularly === false;
  const scheduleOk =
    club.meetsRegularly !== true || fieldComplete(club.meetingSchedule);
  const locationOk =
    club.meetsRegularly !== true || fieldComplete(club.meetingLocation);
  const membershipOk = Boolean(club.membershipType);

  const profileFields: ClubSetupFieldCheck[] = [
    {
      id: "name",
      label: "Club name",
      complete: nameOk,
      fixPath: buildClubSettingsSectionPath(club.id, "profile", "profile"),
      actionLabel: "Edit Profile",
    },
    {
      id: "logo",
      label: "Logo",
      complete: logoOk,
      fixPath: buildClubSettingsSectionPath(club.id, "branding", "logo"),
      actionLabel: "Edit Profile",
    },
    {
      id: "banner",
      label: "Banner",
      complete: bannerOk,
      fixPath: buildClubSettingsSectionPath(club.id, "branding", "banner"),
      actionLabel: "Edit Profile",
    },
    {
      id: "short-description",
      label: "Short description",
      complete: descriptionOk,
      fixPath: buildClubSettingsSectionPath(club.id, "profile", "short-description"),
      actionLabel: "Edit Profile",
    },
    {
      id: "category",
      label: "Category",
      complete: categoryOk,
      fixPath: buildClubSettingsSectionPath(club.id, "profile", "category"),
      actionLabel: "Edit Profile",
    },
  ];

  const contactFields: ClubSetupFieldCheck[] = [
    {
      id: "contact-email",
      label: "Contact email",
      complete: contactOk,
      fixPath: buildClubSettingsSectionPath(club.id, "profile", "contact-email"),
      actionLabel: "Add Contact",
    },
    {
      id: "meets-regularly",
      label: "Meets regularly?",
      complete: meetsRegularlyAnswered,
      fixPath: buildClubSettingsSectionPath(club.id, "profile", "meets-regularly"),
      actionLabel: "Set Schedule",
    },
  ];

  if (club.meetsRegularly === true) {
    contactFields.push(
      {
        id: "meeting-schedule",
        label: "Meeting schedule",
        complete: fieldComplete(club.meetingSchedule),
        fixPath: buildClubSettingsSectionPath(club.id, "profile", "meeting-schedule"),
        actionLabel: "Set Schedule",
      },
      {
        id: "meeting-location",
        label: "Meeting location",
        complete: fieldComplete(club.meetingLocation),
        fixPath: buildClubSettingsSectionPath(club.id, "profile", "meeting-location"),
        actionLabel: "Set Meeting Location",
      },
    );
  }

  const membershipFields: ClubSetupFieldCheck[] = [
    {
      id: "membership-type",
      label: "Join method",
      complete: membershipOk,
      fixPath: buildClubSettingsSectionPath(club.id, "membership", "membership-type"),
      actionLabel: "Set Membership Rules",
    },
  ];

  const profileComplete = profileFields.every((field) => field.complete);
  const contactComplete =
    contactOk && meetsRegularlyAnswered && scheduleOk && locationOk;
  const membershipComplete = membershipOk;

  const firstIncompleteContact = contactFields.find((field) => !field.complete);

  return [
    {
      id: "complete-club-profile",
      title: "Complete Club Profile",
      group: "required",
      complete: profileComplete,
      description: "Name, logo, banner, short description, and category.",
      actionLabel: "Edit Profile",
      fixPath: buildClubSettingsSectionPath(
        club.id,
        profileComplete ? "profile" : logoOk && bannerOk ? "profile" : "branding",
        !logoOk ? "logo" : !bannerOk ? "banner" : !descriptionOk ? "short-description" : !categoryOk ? "category" : "profile",
      ),
      fields: profileFields,
    },
    {
      id: "contact-and-meeting",
      title: "Add Contact and Meeting Details",
      group: "required",
      complete: contactComplete,
      description: club.meetsRegularly === false
        ? "Contact email on file. This club does not meet regularly."
        : "Contact email, and meeting details when you meet regularly.",
      actionLabel: firstIncompleteContact?.actionLabel ?? "Add Contact",
      fixPath:
        firstIncompleteContact?.fixPath ??
        buildClubSettingsSectionPath(club.id, "profile", "contact-email"),
      fields: contactFields,
    },
    {
      id: "membership-rules",
      title: "Set Membership Rules",
      group: "required",
      complete: membershipComplete,
      description: "Choose how students can join your club.",
      actionLabel: "Set Membership Rules",
      fixPath: buildClubSettingsSectionPath(club.id, "membership", "membership-type"),
      fields: membershipFields,
    },
    {
      id: "welcome-announcement",
      title: "Create Welcome Announcement",
      group: "recommended",
      complete: postsCount > 0,
      description: "Introduce your club to new members.",
      actionLabel: "Create Announcement",
      fixPath: `/app/clubs/${club.id}/announcements?openTemplate=true`,
      fields: [],
      templateType: "announcement",
    },
    {
      id: "first-event",
      title: "Create First Event",
      group: "recommended",
      complete: eventsCount > 0,
      description: "Share something happening soon.",
      actionLabel: "Create Event",
      fixPath: `/app/clubs/${club.id}/events?openTemplate=true`,
      fields: [],
      templateType: "event",
    },
    {
      id: "invite-people",
      title: "Invite Executives or Members",
      group: "recommended",
      complete: activeMemberCount > 1 || pendingInviteCount > 0,
      description: "Bring your team into the workspace.",
      actionLabel: "Invite People",
      fixPath: `/app/clubs/${club.id}/members?openInvite=true`,
      fields: [],
    },
    {
      id: "social-links",
      title: "Add Social Links",
      group: "recommended",
      complete: clubHasSocialLinks(club.socialLinks),
      description: "Link Instagram, website, or other channels.",
      actionLabel: "Add Social Links",
      fixPath: buildClubSettingsSectionPath(club.id, "social", "social-links"),
      fields: [],
    },
    {
      id: "documents",
      title: "Add Documents or Resources",
      group: "recommended",
      complete: documentsCount > 0,
      description: "Upload bylaws, guides, or shared files.",
      actionLabel: "Add Resources",
      fixPath: `/app/clubs/${club.id}/documents?openUpload=true`,
      fields: [],
    },
    {
      id: "visibility-defaults",
      title: "Review Visibility Defaults",
      group: "recommended",
      complete: club.contentVisibilityDefaultsConfirmed === true,
      description: "Confirm who can see announcements, events, and documents.",
      actionLabel: "Review Visibility",
      fixPath: buildClubSettingsSectionPath(club.id, "profile", "visibility-defaults"),
      fields: [],
    },
  ];
}

function milestonesToLegacyItems(
  milestones: ClubSetupMilestone[],
): ClubSetupProgressItem[] {
  return milestones.map((milestone) => ({
    id: milestone.id,
    label: milestone.title,
    complete: milestone.complete,
    section:
      milestone.group === "required"
        ? milestone.id === "welcome-announcement" || milestone.id === "first-event"
          ? "launch"
          : "profile"
        : "recommended",
    required: milestone.group === "required",
    optional: milestone.group === "recommended",
    missingLabel: milestone.title.toLowerCase(),
    fixPath: milestone.fixPath,
    actionLabel: milestone.actionLabel,
    instruction: milestone.description,
    templateType: milestone.templateType,
  }));
}

/** Single source of truth for club setup checklist progress and completion state. */
export function computeClubSetupProgress(
  club: Club,
  counts: ClubSetupProgressCounts,
): ClubSetupProgress {
  const milestones = buildMilestones(club, counts);
  const requiredMilestones = milestones.filter((item) => item.group === "required");
  const recommendedMilestones = milestones.filter(
    (item) => item.group === "recommended",
  );
  const requiredCompletedCount = requiredMilestones.filter((item) => item.complete).length;
  const requiredTotalCount = requiredMilestones.length;
  const recommendedCompletedCount = recommendedMilestones.filter(
    (item) => item.complete,
  ).length;
  const recommendedTotalCount = recommendedMilestones.length;
  const percent =
    requiredTotalCount === 0
      ? 0
      : Math.round((requiredCompletedCount / requiredTotalCount) * 100);
  const allRequiredComplete = requiredCompletedCount === requiredTotalCount;
  const nextRequiredMilestone =
    requiredMilestones.find((item) => !item.complete) ?? null;
  const profileMilestone = requiredMilestones.find(
    (item) => item.id === "complete-club-profile",
  );
  const items = milestonesToLegacyItems(milestones);
  const requiredItems = items.filter((item) => item.required);
  const optionalItems = items.filter((item) => item.optional);

  return {
    milestones,
    requiredMilestones,
    recommendedMilestones,
    requiredCompletedCount,
    requiredTotalCount,
    recommendedCompletedCount,
    recommendedTotalCount,
    percent,
    allRequiredComplete,
    canPreviewPublicProfile: profileMilestone?.complete === true,
    nextRequiredMilestone,
    missingLabels: requiredMilestones
      .filter((item) => !item.complete)
      .map((item) => item.title),
    items,
    requiredItems,
    optionalItems,
    completedCount: requiredCompletedCount,
    totalCount: requiredTotalCount,
    allComplete: allRequiredComplete,
  };
}

/**
 * Whether the Command Center / home setup banner should appear.
 * Published clubs never show it.
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
  const { nextRequiredMilestone } = computeClubSetupProgress(club, counts);
  return (
    nextRequiredMilestone?.fixPath ??
    `${settingsPath}?section=profile&highlight=profile`
  );
}

export function resolveNextSetupActionPath(
  club: Club,
  counts: ClubSetupProgressCounts,
): string {
  return resolveClubSetupSettingsPath(
    `/app/clubs/${club.id}/settings`,
    club,
    counts,
  );
}
