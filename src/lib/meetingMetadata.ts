import type { ClubMember } from "../types";

export type MeetingFormat = "online" | "in_person" | "hybrid";

export type InviteeGroup =
  | "all_executives"
  | "president_team"
  | "all_members"
  | "custom";

export type MeetingType =
  | "general"
  | "executive"
  | "committee"
  | "event_planning"
  | "hiring"
  | "other";

export interface MeetingMetadata {
  format: MeetingFormat;
  inviteeGroup: InviteeGroup;
  customInviteeIds: string[];
  linkedEventId?: string;
  linkedHiringListingId?: string;
  linkedEventTitle?: string;
  linkedHiringTitle?: string;
  preparation?: string;
  decisions?: string;
}

const META_START = "<!--gryph-meeting-meta\n";
const META_END = "\n-->";

export const INVITEE_GROUP_LABELS: Record<InviteeGroup, string> = {
  all_executives: "All Executives",
  president_team: "President Team Only",
  all_members: "All Members",
  custom: "Custom",
};

export const AGENDA_TEMPLATES: Partial<Record<MeetingType, string[]>> = {
  executive: ["Updates", "Blockers", "Decisions", "Next Steps"],
  event_planning: ["Venue", "Promotion", "Volunteers", "Supplies", "RSVPs"],
  hiring: ["Candidates", "Interviews", "Decisions", "Offers"],
};

export const DEFAULT_INVITEE_BY_TYPE: Partial<Record<MeetingType, InviteeGroup>> = {
  executive: "all_executives",
  general: "all_members",
};

export function inferMeetingFormat(
  location: string | null,
  meetingLink: string | null,
): MeetingFormat {
  const hasLink = Boolean(meetingLink?.trim());
  const hasLocation = Boolean(location?.trim());
  if (hasLink && hasLocation) return "hybrid";
  if (hasLink) return "online";
  return "in_person";
}

export function parseAgendaItems(agenda: string | null): string[] {
  if (!agenda?.trim()) return [];
  try {
    const parsed = JSON.parse(agenda) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // fall through to legacy newline format
  }
  return agenda
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function serializeAgendaItems(items: string[]): string | null {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

export function defaultMeetingMetadata(
  location: string | null,
  meetingLink: string | null,
): MeetingMetadata {
  return {
    format: inferMeetingFormat(location, meetingLink),
    inviteeGroup: "all_members",
    customInviteeIds: [],
  };
}

export function parseMeetingNotes(notes: string | null): {
  metadata: MeetingMetadata;
  meetingNotes: string;
} {
  const fallback = {
    metadata: defaultMeetingMetadata(null, null),
    meetingNotes: notes?.trim() ?? "",
  };
  if (!notes?.trim() || !notes.startsWith(META_START)) {
    return fallback;
  }

  const endIndex = notes.indexOf(META_END);
  if (endIndex === -1) return fallback;

  try {
    const json = notes.slice(META_START.length, endIndex);
    const parsed = JSON.parse(json) as Partial<MeetingMetadata>;
    return {
      metadata: {
        format: parsed.format ?? "in_person",
        inviteeGroup: parsed.inviteeGroup ?? "all_members",
        customInviteeIds: parsed.customInviteeIds ?? [],
        linkedEventId: parsed.linkedEventId,
        linkedHiringListingId: parsed.linkedHiringListingId,
        linkedEventTitle: parsed.linkedEventTitle,
        linkedHiringTitle: parsed.linkedHiringTitle,
        preparation: parsed.preparation,
        decisions: parsed.decisions,
      },
      meetingNotes: notes.slice(endIndex + META_END.length).trim(),
    };
  } catch {
    return fallback;
  }
}

export function serializeMeetingNotes(
  metadata: MeetingMetadata,
  meetingNotes: string,
): string | null {
  const metaBlock = `${META_START}${JSON.stringify(metadata)}${META_END}`;
  const body = meetingNotes.trim();
  if (!body) return metaBlock;
  return `${metaBlock}\n${body}`;
}

export function resolveInviteeUserIds(
  group: InviteeGroup,
  members: ClubMember[],
  customInviteeIds: string[],
): string[] {
  const active = members.filter((member) => member.status === "active");
  switch (group) {
    case "all_executives":
      return active
        .filter((member) => member.role === "owner" || member.role === "executive")
        .map((member) => member.userId);
    case "president_team":
      return active
        .filter(
          (member) =>
            member.accessLevel === "president" || member.role === "owner",
        )
        .map((member) => member.userId);
    case "all_members":
      return active.map((member) => member.userId);
    case "custom":
      return customInviteeIds;
    default:
      return [];
  }
}

export function isUserInvitedToMeeting(
  userId: string | undefined,
  members: ClubMember[],
  metadata: MeetingMetadata,
  isPrivileged: boolean,
): boolean {
  if (isPrivileged) return true;
  if (!userId) return false;
  return resolveInviteeUserIds(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds ?? [],
  ).includes(userId);
}

export function inviteeCountLabel(
  group: InviteeGroup,
  members: ClubMember[],
  customInviteeIds: string[],
): string {
  const count = resolveInviteeUserIds(group, members, customInviteeIds).length;
  return `${INVITEE_GROUP_LABELS[group]} · ${count} invited`;
}

export function meetingStatusLabel(
  status: "upcoming" | "completed" | "cancelled",
  dateIso: string,
): "Upcoming" | "Completed" | "Cancelled" {
  if (status === "cancelled") return "Cancelled";
  if (status === "completed") return "Completed";
  if (new Date(dateIso).getTime() < Date.now()) return "Completed";
  return "Upcoming";
}
