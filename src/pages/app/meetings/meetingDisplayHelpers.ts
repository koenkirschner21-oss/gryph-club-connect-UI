import { parseAgendaItems, parseMeetingNotes, type MeetingFormat } from "../../../lib/meetingMetadata";
import type { ClubMeeting } from "./meetingTypes";
import { isMeetingPast } from "./meetingUtils";

export function meetingNeedsRecap(meeting: ClubMeeting): boolean {
  if (meeting.status === "cancelled" || !isMeetingPast(meeting)) return false;
  const { meetingNotes, metadata } = parseMeetingNotes(meeting.notes);
  return !meetingNotes.trim() && !metadata.decisions?.trim();
}

export function meetingPrepStatus(meeting: ClubMeeting): string {
  const { metadata } = parseMeetingNotes(meeting.notes);
  const agendaCount = parseAgendaItems(meeting.agenda).filter((item) => item.trim()).length;
  if (metadata.preparation?.trim()) return "Prep notes ready";
  if (agendaCount > 0) return "Agenda set";
  return "Needs prep";
}

export function formatLinkLocationStatus(
  meeting: ClubMeeting,
  format: MeetingFormat,
): string {
  const hasLocation = Boolean(meeting.location?.trim());
  const hasLink = Boolean(meeting.meetingLink?.trim());

  if (format === "online") {
    return hasLink ? "Meeting link set" : "Meeting link missing";
  }
  if (format === "in_person") {
    return hasLocation ? "Location set" : "Location missing";
  }
  const locationLabel = hasLocation ? "Location set" : "Location missing";
  const linkLabel = hasLink ? "Link set" : "Link missing";
  return `${locationLabel} · ${linkLabel}`;
}

export function canJoinMeeting(
  meeting: ClubMeeting,
  format: MeetingFormat,
): boolean {
  if (isMeetingPast(meeting) || meeting.status === "cancelled") return false;
  if (format === "in_person") return false;
  return Boolean(meeting.meetingLink?.trim());
}
