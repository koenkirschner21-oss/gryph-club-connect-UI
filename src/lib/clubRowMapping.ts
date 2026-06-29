import {
  formatPublicProfileField,
  isDisplayablePlainText,
  parseClubRequestMetadata,
  type ClubRequestMetadata,
} from "./publicClubProfileDisplay";

export const CLUB_LONG_DESCRIPTION_PLACEHOLDER =
  "Add your club's full description here. Explain what your club does, who it is for, and what members can expect.";

/** Strip legacy request-metadata JSON blobs from stored long_description values. */
export function normalizeStoredLongDescription(
  value: string | null | undefined,
): string {
  const raw = formatPublicProfileField(value);
  if (!raw || !isDisplayablePlainText(raw)) return "";
  return raw;
}

export function extractEmbeddedRequestMetadata(
  row: Record<string, unknown>,
): ClubRequestMetadata | null {
  return (
    parseClubRequestMetadata(formatPublicProfileField(row.long_description)) ??
    parseClubRequestMetadata(formatPublicProfileField(row.short_description))
  );
}

export function readClubLongDescriptionFromRow(
  row: Record<string, unknown>,
): string | undefined {
  const normalized = normalizeStoredLongDescription(
    row.long_description as string | null | undefined,
  );
  return normalized || undefined;
}

export function readClubContactEmailFromRow(
  row: Record<string, unknown>,
  embeddedMeta?: ClubRequestMetadata | null,
): string {
  const meta = embeddedMeta ?? extractEmbeddedRequestMetadata(row);
  return (
    formatPublicProfileField(row.contact_email) || meta?.contact_email || ""
  );
}

export function readClubMeetingScheduleFromRow(
  row: Record<string, unknown>,
  embeddedMeta?: ClubRequestMetadata | null,
): string {
  const meta = embeddedMeta ?? extractEmbeddedRequestMetadata(row);
  return (
    formatPublicProfileField(row.meeting_schedule) ||
    meta?.meeting_schedule ||
    ""
  );
}

export function readClubMeetingLocationFromRow(
  row: Record<string, unknown>,
  embeddedMeta?: ClubRequestMetadata | null,
): string | undefined {
  const meta = embeddedMeta ?? extractEmbeddedRequestMetadata(row);
  const fromRow = formatPublicProfileField(row.meeting_location);
  if (fromRow) return fromRow;
  return meta?.meeting_location || undefined;
}

/** Sanitize user input before persisting long_description. */
export function sanitizeLongDescriptionForSave(
  value: string,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return isDisplayablePlainText(trimmed) ? trimmed : undefined;
}
