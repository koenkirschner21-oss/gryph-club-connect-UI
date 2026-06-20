import type { InviteeGroup, MeetingFormat, MeetingType } from "../../../lib/meetingMetadata";

export type MeetingStatus = "upcoming" | "completed" | "cancelled";
export type RecurrencePattern = "weekly" | "biweekly" | "monthly";
export type ActionItemStatus = "pending" | "completed";

export interface ClubMeeting {
  id: string;
  clubId: string;
  title: string;
  meetingType: MeetingType;
  date: string;
  location: string | null;
  meetingLink: string | null;
  agenda: string | null;
  notes: string | null;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | null;
  status: MeetingStatus;
  createdBy: string | null;
  createdAt: string;
  actionItemCount: number;
}

export interface MeetingActionItem {
  id: string;
  meetingId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  linkedTaskId: string | null;
  createdAt: string;
  meetingTitle?: string;
}

export interface DraftActionItem {
  title: string;
  assigneeId: string;
  dueDate: string;
}

export interface MeetingCreateFormState {
  title: string;
  meetingType: MeetingType;
  date: string;
  time: string;
  format: MeetingFormat;
  location: string;
  meetingLink: string;
  inviteeGroup: InviteeGroup;
  customInviteeIds: string[];
  linkedEventId: string;
  linkedHiringListingId: string;
  agendaItems: string[];
  preparation: string;
  actionItems: DraftActionItem[];
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | "";
}

export const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "executive", label: "Executive" },
  { value: "committee", label: "Committee" },
  { value: "event_planning", label: "Event Planning" },
  { value: "hiring", label: "Hiring" },
  { value: "other", label: "Other" },
];

export const MEETING_TYPE_COLORS: Record<
  MeetingType,
  { bg: string; border: string; color: string }
> = {
  general: { bg: "#1a1a1a", border: "#555555", color: "#999999" },
  executive: { bg: "rgba(255,196,41,0.12)", border: "#FFC429", color: "#FFC429" },
  committee: { bg: "#1a1a1a", border: "#555555", color: "#888888" },
  event_planning: { bg: "rgba(229,25,55,0.12)", border: "#E51937", color: "#E51937" },
  hiring: { bg: "rgba(255,196,41,0.06)", border: "#666666", color: "#888888" },
  other: { bg: "#1a1a1a", border: "#444444", color: "#777777" },
};
