export interface ClubRequestMetadata {
  slug?: string;
  contact_email?: string;
  meeting_schedule?: string;
  meeting_location?: string;
  social_links?: Record<string, string>;
}

export interface PublicClubSocialLinks {
  website?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  discord?: string;
}

export interface PublicClubDisplayFields {
  shortDescription: string;
  longDescription: string;
  aboutText: string;
  contactEmail: string;
  meetingSchedule: string;
  meetingLocation: string;
  socialLinks: PublicClubSocialLinks;
}

export const PUBLIC_PROFILE_EMPTY_ABOUT =
  "This club profile is still being set up. Check back soon for more details.";

export const PUBLIC_PROFILE_EMPTY_EVENTS = "No upcoming events yet.";

export const PUBLIC_PROFILE_EMPTY_ANNOUNCEMENTS = "No announcements yet.";

export const PUBLIC_PROFILE_EMPTY_RESOURCES =
  "No resources have been added yet.";

const REQUEST_METADATA_KEYS = new Set([
  "slug",
  "contact_email",
  "meeting_schedule",
  "meeting_location",
  "social_links",
]);

export function formatPublicProfileField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function isJsonLikeObjectString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export function parseClubRequestMetadata(
  value: string | null | undefined,
): ClubRequestMetadata | null {
  const trimmed = formatPublicProfileField(value);
  if (!trimmed || !isJsonLikeObjectString(trimmed)) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const hasRequestKeys = Object.keys(parsed).some((key) =>
      REQUEST_METADATA_KEYS.has(key),
    );
    if (!hasRequestKeys) return null;

    const socialRaw = parsed.social_links;
    let social_links: Record<string, string> | undefined;
    if (socialRaw && typeof socialRaw === "object" && !Array.isArray(socialRaw)) {
      social_links = {};
      for (const [key, entry] of Object.entries(socialRaw)) {
        const formatted = formatPublicProfileField(entry);
        if (formatted) social_links[key] = formatted;
      }
      if (Object.keys(social_links).length === 0) {
        social_links = undefined;
      }
    }

    return {
      slug: formatPublicProfileField(parsed.slug) || undefined,
      contact_email: formatPublicProfileField(parsed.contact_email) || undefined,
      meeting_schedule: formatPublicProfileField(parsed.meeting_schedule) || undefined,
      meeting_location: formatPublicProfileField(parsed.meeting_location) || undefined,
      social_links,
    };
  } catch {
    return null;
  }
}

export function isDisplayablePlainText(value: string | null | undefined): boolean {
  const trimmed = formatPublicProfileField(value);
  if (!trimmed) return false;
  if (parseClubRequestMetadata(trimmed)) return false;
  if (isJsonLikeObjectString(trimmed)) return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      JSON.parse(trimmed);
      return false;
    } catch {
      return true;
    }
  }
  return true;
}

export function resolvePublicClubAboutText(input: {
  shortDescription?: string | null;
  longDescription?: string | null;
  description?: string | null;
}): string {
  for (const candidate of [
    input.shortDescription,
    input.description,
    input.longDescription,
  ]) {
    if (isDisplayablePlainText(candidate)) {
      return formatPublicProfileField(candidate);
    }
  }
  return "";
}

function pickUrl(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const value = formatPublicProfileField(candidate);
    if (value) return value;
  }
  return undefined;
}

function readSocialLinksRecord(
  value: unknown,
): PublicClubSocialLinks | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const links: PublicClubSocialLinks = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const formatted = formatPublicProfileField(entry);
    if (!formatted) continue;
    if (key === "website") links.website = formatted;
    if (key === "instagram") links.instagram = formatted;
    if (key === "linkedin") links.linkedin = formatted;
    if (key === "twitter") links.twitter = formatted;
    if (key === "discord") links.discord = formatted;
  }

  return Object.keys(links).length > 0 ? links : undefined;
}

export function mergePublicClubSocialLinks(
  ...sources: Array<PublicClubSocialLinks | undefined>
): PublicClubSocialLinks {
  const merged: PublicClubSocialLinks = {};
  for (const source of sources) {
    if (!source) continue;
    if (source.website) merged.website = source.website;
    if (source.instagram) merged.instagram = source.instagram;
    if (source.linkedin) merged.linkedin = source.linkedin;
    if (source.twitter) merged.twitter = source.twitter;
    if (source.discord) merged.discord = source.discord;
  }
  return merged;
}

export function clubHasPublicSocialLinks(links: PublicClubSocialLinks): boolean {
  return Object.values(links).some((value) => Boolean(value?.trim()));
}

export function mapClubRowToPublicDisplayFields(
  row: Record<string, unknown>,
): PublicClubDisplayFields {
  const shortDescription = formatPublicProfileField(row.short_description);
  const description = formatPublicProfileField(row.description);
  const rawLongDescription = formatPublicProfileField(row.long_description);

  const embeddedMeta =
    parseClubRequestMetadata(rawLongDescription) ??
    parseClubRequestMetadata(shortDescription);

  const aboutText = resolvePublicClubAboutText({
    shortDescription,
    longDescription: rawLongDescription,
    description,
  });

  const socialLinks = mergePublicClubSocialLinks(
    readSocialLinksRecord(embeddedMeta?.social_links),
    {
      website: pickUrl(row.website_url),
      instagram: pickUrl(row.instagram_url),
      linkedin: pickUrl(row.linkedin_url),
      twitter: pickUrl(row.twitter_url),
      discord: pickUrl(row.discord_invite),
    },
  );

  return {
    shortDescription: isDisplayablePlainText(shortDescription) ? shortDescription : "",
    longDescription: isDisplayablePlainText(rawLongDescription) ? rawLongDescription : "",
    aboutText,
    contactEmail:
      formatPublicProfileField(row.contact_email) ||
      embeddedMeta?.contact_email ||
      "",
    meetingSchedule:
      formatPublicProfileField(row.meeting_schedule) ||
      embeddedMeta?.meeting_schedule ||
      "",
    meetingLocation:
      formatPublicProfileField(row.meeting_location) ||
      embeddedMeta?.meeting_location ||
      "",
    socialLinks,
  };
}

export function resolvePublicClubDisplayFromClub(club: {
  shortDescription?: string | null;
  longDescription?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  meetingSchedule?: string | null;
  meetingLocation?: string | null;
  socialLinks?: PublicClubSocialLinks | null;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
}): PublicClubDisplayFields {
  const aboutText = resolvePublicClubAboutText({
    shortDescription: club.shortDescription,
    longDescription: club.longDescription,
    description: club.description,
  });

  return {
    shortDescription: isDisplayablePlainText(club.shortDescription)
      ? formatPublicProfileField(club.shortDescription)
      : "",
    longDescription: isDisplayablePlainText(club.longDescription)
      ? formatPublicProfileField(club.longDescription)
      : "",
    aboutText,
    contactEmail: formatPublicProfileField(club.contactEmail),
    meetingSchedule: formatPublicProfileField(club.meetingSchedule),
    meetingLocation: formatPublicProfileField(club.meetingLocation),
    socialLinks: mergePublicClubSocialLinks(club.socialLinks ?? undefined, {
      website: club.websiteUrl,
      instagram: club.instagramUrl,
      linkedin: club.linkedinUrl,
      twitter: club.twitterUrl,
    }),
  };
}
