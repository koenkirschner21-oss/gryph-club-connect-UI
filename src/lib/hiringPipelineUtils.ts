import type { CSSProperties } from "react";

export type HiringSubStatus =
  | "submitted"
  | "viewed"
  | "reviewed"
  | "notes_added"
  | "interview_invite_sent"
  | "interview_scheduled"
  | "interview_completed"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "rejected"
  | "withdrawn";

export type ApplicantPipelineFilter =
  | "all"
  | "pending"
  | "reviewed"
  | "interview"
  | "accepted"
  | "rejected";

export type InterviewType = "online" | "in_person" | "phone";
export type PositionHandling = "keep_open" | "close_after_accept" | "close_now";

export interface ApplicationNoteRow {
  id: string;
  applicationId: string;
  authorId: string;
  authorName: string;
  authorRoleTitle?: string;
  note: string;
  createdAt: string;
}

export const APPLICANT_PIPELINE_FILTER_OPTIONS: {
  value: ApplicantPipelineFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "interview", label: "Interview" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const PENDING_SUB_STATUSES = new Set<HiringSubStatus>([
  "submitted",
  "viewed",
  "notes_added",
]);

const REVIEWED_SUB_STATUSES = new Set<HiringSubStatus>(["reviewed"]);

const INTERVIEW_SUB_STATUSES = new Set<HiringSubStatus>([
  "interview_invite_sent",
  "interview_scheduled",
  "interview_completed",
]);

const ACCEPTED_SUB_STATUSES = new Set<HiringSubStatus>([
  "offer_sent",
  "offer_accepted",
]);

const REJECTED_SUB_STATUSES = new Set<HiringSubStatus>([
  "rejected",
  "withdrawn",
  "offer_declined",
]);

export function normalizeSubStatus(value: string | null | undefined): HiringSubStatus {
  const normalized = (value ?? "submitted") as HiringSubStatus;
  return normalized || "submitted";
}

export function subStatusLabel(subStatus: string): string {
  switch (subStatus) {
    case "submitted":
      return "Submitted";
    case "viewed":
      return "Viewed";
    case "reviewed":
      return "Reviewed";
    case "notes_added":
      return "Notes Added";
    case "interview_invite_sent":
      return "Interview Invite Sent";
    case "interview_scheduled":
      return "Interview Scheduled";
    case "interview_completed":
      return "Interview Completed";
    case "offer_sent":
      return "Offer Sent";
    case "offer_accepted":
      return "Offer Accepted";
    case "offer_declined":
      return "Offer Declined";
    case "rejected":
      return "Rejected";
    case "withdrawn":
      return "Withdrawn";
    default:
      return subStatus.charAt(0).toUpperCase() + subStatus.slice(1);
  }
}

export function subStatusColor(subStatus: string): string {
  if (ACCEPTED_SUB_STATUSES.has(subStatus as HiringSubStatus)) return "#FFC429";
  if (REJECTED_SUB_STATUSES.has(subStatus as HiringSubStatus)) return "#E51937";
  if (INTERVIEW_SUB_STATUSES.has(subStatus as HiringSubStatus)) return "#6b7cff";
  if (REVIEWED_SUB_STATUSES.has(subStatus as HiringSubStatus)) return "#FFC429";
  return "#747676";
}

export function subStatusPillStyle(subStatus: string): CSSProperties {
  const color = subStatusColor(subStatus);
  return {
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 600,
    flexShrink: 0,
    background:
      ACCEPTED_SUB_STATUSES.has(subStatus as HiringSubStatus)
        ? "#1a1200"
        : REJECTED_SUB_STATUSES.has(subStatus as HiringSubStatus)
          ? "#1a0505"
          : "#1a1a1a",
    color,
    border: `1px solid ${color}`,
    display: "inline-block",
  };
}

export type ApplicantMoveStatusAction =
  | "mark_reviewed"
  | "schedule"
  | "accept"
  | "reject"
  | "send_update";

export function applicantMoveStatusActions(
  status: string,
  subStatus: string,
): ApplicantMoveStatusAction[] {
  const normalized = normalizeSubStatus(subStatus);

  if (
    status === "rejected" ||
    status === "accepted" ||
    REJECTED_SUB_STATUSES.has(normalized) ||
    normalized === "offer_accepted"
  ) {
    return [];
  }

  if (normalized === "offer_sent") {
    return ["send_update"];
  }

  if (INTERVIEW_SUB_STATUSES.has(normalized)) {
    return ["accept", "reject", "send_update"];
  }

  if (REVIEWED_SUB_STATUSES.has(normalized) || status === "reviewed") {
    return ["schedule", "accept", "reject"];
  }

  return ["mark_reviewed", "schedule"];
}

export function matchesApplicantPipelineFilter(
  status: string,
  subStatus: string,
  filter: ApplicantPipelineFilter,
): boolean {
  const normalizedSubStatus = normalizeSubStatus(subStatus);

  switch (filter) {
    case "pending":
      return (
        status === "pending" ||
        PENDING_SUB_STATUSES.has(normalizedSubStatus)
      );
    case "reviewed":
      return (
        status === "reviewed" ||
        REVIEWED_SUB_STATUSES.has(normalizedSubStatus)
      );
    case "interview":
      return INTERVIEW_SUB_STATUSES.has(normalizedSubStatus);
    case "accepted":
      return (
        status === "accepted" ||
        ACCEPTED_SUB_STATUSES.has(normalizedSubStatus)
      );
    case "rejected":
      return (
        status === "rejected" ||
        REJECTED_SUB_STATUSES.has(normalizedSubStatus)
      );
    default:
      return true;
  }
}

export function parseInterviewTimes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export const SEND_UPDATE_TEMPLATES = [
  {
    id: "still_reviewing",
    label: "Still reviewing",
    message:
      "Thank you for your application. Our team is still reviewing candidates and will be in touch soon.",
  },
  {
    id: "next_steps",
    label: "Next steps coming",
    message:
      "Thank you for applying. We will reach out with next steps shortly.",
  },
  {
    id: "more_info",
    label: "Request more info",
    message:
      "Thank you for applying. Could you share any additional experience relevant to this role?",
  },
] as const;

export const REJECT_TEMPLATES = [
  {
    id: "default",
    label: "Standard rejection",
    message:
      "Thank you for applying. We have decided not to move forward with your application at this time.",
  },
  {
    id: "competitive",
    label: "Competitive pool",
    message:
      "Thank you for your interest. We received many strong applications and will not be moving forward with yours at this time.",
  },
] as const;

export const ACCESS_LEVEL_OPTIONS = [
  { value: "president", label: "President / Co-President" },
  { value: "managerial_executive", label: "Managerial Executive" },
  { value: "executive", label: "Executive" },
  { value: "member", label: "General Member" },
] as const;

export const POSITION_HANDLING_OPTIONS = [
  { value: "keep_open", label: "Keep open" },
  { value: "close_after_accept", label: "Close after accept" },
  { value: "close_now", label: "Close now" },
] as const;
