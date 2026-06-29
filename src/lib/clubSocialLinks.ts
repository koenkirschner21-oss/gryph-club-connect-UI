import type { Club } from "../types";

export type SocialLinksRecord = Record<string, string | undefined>;

/** Map request/settings social link keys to dedicated clubs table columns. */
export function socialLinksToClubColumns(
  links: SocialLinksRecord | null | undefined,
): Record<string, string | null> {
  if (!links) return {};

  const pick = (key: string) => {
    const value = links[key]?.trim();
    return value ? value : null;
  };

  const columns: Record<string, string | null> = {};
  const website = pick("website");
  const instagram = pick("instagram");
  const linkedin = pick("linkedin");
  const twitter = pick("twitter");
  const discord = pick("discord");

  if (website !== null) columns.website_url = website;
  if (instagram !== null) columns.instagram_url = instagram;
  if (linkedin !== null) columns.linkedin_url = linkedin;
  if (twitter !== null) columns.twitter_url = twitter;
  if (discord !== null) columns.discord_invite = discord;

  return columns;
}

/** Read social links from dedicated clubs URL columns (production schema). */
export function readSocialLinksFromClubRow(
  row: Record<string, unknown>,
): Club["socialLinks"] | undefined {
  const links: NonNullable<Club["socialLinks"]> = {};
  const website = (row.website_url as string | undefined)?.trim();
  const instagram = (row.instagram_url as string | undefined)?.trim();
  const discord = (row.discord_invite as string | undefined)?.trim();

  if (website) links.website = website;
  if (instagram) links.instagram = instagram;
  if (discord) links.discord = discord;

  return Object.keys(links).length > 0 ? links : undefined;
}

/** Apply social link object onto an insert/update payload (never social_links jsonb). */
export function applySocialLinksToClubPayload(
  payload: Record<string, unknown>,
  links: SocialLinksRecord | null | undefined,
): void {
  Object.assign(payload, socialLinksToClubColumns(links));
}
