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
  general: { bg: "rgba(59,130,246,0.12)", border: "#3b82f6", color: "#60a5fa" },
  executive: { bg: "rgba(229,25,55,0.12)", border: "#E51937", color: "#E51937" },
  committee: { bg: "rgba(255,196,41,0.12)", border: "#FFC429", color: "#FFC429" },
  event_planning: {
    bg: "rgba(168,85,247,0.12)",
    border: "#a855f7",
    color: "#c084fc",
  },
  hiring: { bg: "rgba(34,197,94,0.12)", border: "#22c55e", color: "#4ade80" },
  other: { bg: "rgba(119,119,119,0.12)", border: "#555555", color: "#999999" },
};
