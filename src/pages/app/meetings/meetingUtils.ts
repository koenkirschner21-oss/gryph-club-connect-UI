import type { ClubMeeting, MeetingCreateFormState } from "./meetingTypes";
import type { MeetingType } from "../../../lib/meetingMetadata";
import {
  AGENDA_TEMPLATES,
  DEFAULT_INVITEE_BY_TYPE,
  parseAgendaItems,
  parseMeetingNotes,
  serializeAgendaItems,
  serializeMeetingNotes,
  type MeetingMetadata,
} from "../../../lib/meetingMetadata";

export function meetingTypeLabel(type: MeetingType): string {
  const labels: Record<MeetingType, string> = {
    general: "General",
    executive: "Executive",
    committee: "Committee",
    event_planning: "Event Planning",
    hiring: "Hiring",
    other: "Other",
  };
  return labels[type] ?? "General";
}

export function formatMeetingDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function splitDateTime(iso: string): { date: string; time: string } {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "", time: "18:00" };
  }
  const date = parsed.toISOString().slice(0, 10);
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return { date, time: `${hours}:${minutes}` };
}

export function combineDateTime(date: string, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setHours(hours || 0, minutes || 0, 0, 0);
  return parsed.toISOString();
}

export function meetingLinkButtonLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("teams.microsoft.com") || lower.includes("teams.live.com")) {
    return "Open in Teams";
  }
  if (lower.includes("zoom.us")) return "Open in Zoom";
  if (lower.includes("meet.google.com")) return "Open in Google Meet";
  return "Open Meeting Link";
}

export function isMeetingPast(meeting: ClubMeeting): boolean {
  if (meeting.status === "completed" || meeting.status === "cancelled") return true;
  return new Date(meeting.date).getTime() < Date.now();
}

export function emptyCreateForm(presetType?: MeetingType): MeetingCreateFormState {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const meetingType = presetType ?? "general";
  return {
    title: "",
    meetingType,
    date: tomorrow.toISOString().slice(0, 10),
    time: "18:00",
    format: "in_person",
    location: "",
    meetingLink: "",
    inviteeGroup: DEFAULT_INVITEE_BY_TYPE[meetingType] ?? "all_members",
    customInviteeIds: [],
    linkedEventId: "",
    linkedHiringListingId: "",
    agendaItems: AGENDA_TEMPLATES[meetingType] ? [...AGENDA_TEMPLATES[meetingType]!] : [""],
    preparation: "",
    actionItems: [],
    isRecurring: false,
    recurrencePattern: "",
  };
}

export function mapMeetingRow(
  row: Record<string, unknown>,
  actionItemCount = 0,
  openActionItemCount = actionItemCount,
): ClubMeeting {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    meetingType: (row.meeting_type as MeetingType) ?? "general",
    date: row.date as string,
    location: (row.location as string | null) ?? null,
    meetingLink: (row.meeting_link as string | null) ?? null,
    agenda: (row.agenda as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    isRecurring: Boolean(row.is_recurring),
    recurrencePattern: (row.recurrence_pattern as ClubMeeting["recurrencePattern"]) ?? null,
    status: (row.status as ClubMeeting["status"]) ?? "upcoming",
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
    actionItemCount,
    openActionItemCount,
  };
}

export function mapActionItemRow(row: Record<string, unknown>): import("./meetingTypes").MeetingActionItem {
  const profileRaw = row.assignee;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
  const meetingRaw = row.meeting;
  const meeting = Array.isArray(meetingRaw) ? meetingRaw[0] : meetingRaw;
  const priorityRaw = (row.priority as string | null) ?? "medium";
  const priority =
    priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";
  return {
    id: row.id as string,
    meetingId: row.meeting_id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string | null) ?? "",
    priority,
    assigneeId: (row.assignee_id as string | null) ?? null,
    assigneeName: ((profile as { full_name?: string } | null)?.full_name ?? null),
    dueDate: (row.due_date as string | null) ?? null,
    status: (row.status as import("./meetingTypes").ActionItemStatus) ?? "pending",
    linkedTaskId: (row.linked_task_id as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
    meetingTitle: ((meeting as { title?: string } | null)?.title ?? undefined),
  };
}

export function buildNotesPayload(
  form: MeetingCreateFormState,
  eventTitle?: string,
  hiringTitle?: string,
): string | null {
  const metadata: MeetingMetadata = {
    format: form.format,
    inviteeGroup: form.inviteeGroup,
    customInviteeIds: form.customInviteeIds,
    linkedEventId: form.linkedEventId || undefined,
    linkedHiringListingId: form.linkedHiringListingId || undefined,
    linkedEventTitle: eventTitle,
    linkedHiringTitle: hiringTitle,
    preparation: form.preparation.trim() || undefined,
  };
  return serializeMeetingNotes(metadata, "");
}

export function createFormFromMeeting(meeting: ClubMeeting): MeetingCreateFormState {
  const { date, time } = splitDateTime(meeting.date);
  const { metadata } = parseMeetingNotes(meeting.notes);
  const agendaItems = parseAgendaItems(meeting.agenda);
  return {
    title: meeting.title,
    meetingType: meeting.meetingType,
    date,
    time,
    format: metadata.format,
    location: meeting.location ?? "",
    meetingLink: meeting.meetingLink ?? "",
    inviteeGroup: metadata.inviteeGroup,
    customInviteeIds: metadata.customInviteeIds,
    linkedEventId: metadata.linkedEventId ?? "",
    linkedHiringListingId: metadata.linkedHiringListingId ?? "",
    agendaItems: agendaItems.length > 0 ? agendaItems : [""],
    preparation: metadata.preparation ?? "",
    actionItems: [],
    isRecurring: meeting.isRecurring,
    recurrencePattern: meeting.recurrencePattern ?? "weekly",
  };
}

export function buildMeetingUpdatePayload(
  form: MeetingCreateFormState,
  eventTitle?: string,
  hiringTitle?: string,
) {
  const location =
    form.format === "online" ? null : form.location.trim() || null;
  const meetingLink =
    form.format === "in_person" ? null : form.meetingLink.trim() || null;

  return {
    title: form.title.trim(),
    meeting_type: form.meetingType,
    date: combineDateTime(form.date, form.time),
    location,
    meeting_link: meetingLink,
    agenda: serializeAgendaItems(form.agendaItems),
    notes: buildNotesPayload(form, eventTitle, hiringTitle),
    is_recurring: form.isRecurring,
    recurrence_pattern: form.isRecurring ? form.recurrencePattern || null : null,
  };
}
