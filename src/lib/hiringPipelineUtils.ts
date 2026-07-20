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

/** UI filter values (mapped safely onto backend sub_status). */
export type ApplicantPipelineFilter =
  | "all"
  | "new"
  | "in_review"
  | "interview"
  | "offered"
  | "accepted"
  | "rejected";

export type ApplicantSort = "newest" | "oldest" | "recently_updated";

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
  { value: "all", label: "All Applicants" },
  { value: "new", label: "New" },
  { value: "in_review", label: "In Review" },
  { value: "interview", label: "Interview" },
  { value: "offered", label: "Offered" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

export const APPLICANT_SORT_OPTIONS: { value: ApplicantSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "recently_updated", label: "Recently Updated" },
];

const NEW_SUB_STATUSES = new Set<HiringSubStatus>(["submitted", "viewed"]);

const IN_REVIEW_SUB_STATUSES = new Set<HiringSubStatus>(["reviewed", "notes_added"]);

const INTERVIEW_SUB_STATUSES = new Set<HiringSubStatus>([
  "interview_invite_sent",
  "interview_scheduled",
  "interview_completed",
]);

const OFFER_SENT_SUB_STATUSES = new Set<HiringSubStatus>(["offer_sent"]);

const REJECTED_SUB_STATUSES = new Set<HiringSubStatus>([
  "rejected",
  "withdrawn",
  "offer_declined",
]);

export type ApplicantPipelineStage =
  | "new"
  | "in_review"
  | "interview"
  | "offered"
  | "accepted"
  | "rejected";

export function isApplicantPipelineAccepted(subStatus: string): boolean {
  return normalizeSubStatus(subStatus) === "offer_accepted";
}

/** True when an offer was accepted and the applicant is an active club member. */
export function isApplicantHireConverted(
  subStatus: string,
  applicantId: string | null | undefined,
  activeClubMemberIds: ReadonlySet<string>,
): boolean {
  if (!applicantId) return false;
  return (
    isApplicantPipelineAccepted(subStatus) && activeClubMemberIds.has(applicantId)
  );
}

/** Pending review queue: New + In Review stages (matches Recruiting pendingCount). */
export function isHiringApplicationPendingReview(subStatus: string): boolean {
  const stage = resolveApplicantPipelineStage(subStatus);
  return stage === "new" || stage === "in_review";
}

export function resolveApplicantPipelineStage(
  subStatus: string,
  options?: {
    applicantId?: string | null;
    activeClubMemberIds?: ReadonlySet<string>;
  },
): ApplicantPipelineStage {
  const normalized = normalizeSubStatus(subStatus);

  if (REJECTED_SUB_STATUSES.has(normalized)) return "rejected";

  if (isApplicantPipelineAccepted(normalized)) {
    const memberIds = options?.activeClubMemberIds;
    if (memberIds && options?.applicantId) {
      return isApplicantHireConverted(normalized, options.applicantId, memberIds)
        ? "accepted"
        : "offered";
    }
    return "accepted";
  }

  if (OFFER_SENT_SUB_STATUSES.has(normalized)) return "offered";
  if (INTERVIEW_SUB_STATUSES.has(normalized)) return "interview";
  if (IN_REVIEW_SUB_STATUSES.has(normalized)) return "in_review";
  return "new";
}

export function normalizeSubStatus(value: string | null | undefined): HiringSubStatus {
  const normalized = (value ?? "submitted") as HiringSubStatus;
  return normalized || "submitted";
}

/** Coarse stage label for list UI (New / In Review / …). */
export function applicantStageDisplayLabel(subStatus: string): string {
  return applicantPipelineStageLabel(resolveApplicantPipelineStage(subStatus));
}

/** Granular backend labels — prefer applicantStageDisplayLabel for list cards. */
export function subStatusLabel(subStatus: string): string {
  return applicantStageDisplayLabel(subStatus);
}

export function subStatusColor(subStatus: string): string {
  return applicantPipelineStageColor(resolveApplicantPipelineStage(subStatus));
}

export function subStatusPillStyle(subStatus: string): CSSProperties {
  const color = subStatusColor(subStatus);
  const stage = resolveApplicantPipelineStage(subStatus);
  return {
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 600,
    flexShrink: 0,
    background:
      stage === "accepted"
        ? "#1a1200"
        : stage === "offered"
          ? "#1a1500"
          : stage === "rejected"
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
  subStatus: string,
): ApplicantMoveStatusAction[] {
  const normalized = normalizeSubStatus(subStatus);

  if (REJECTED_SUB_STATUSES.has(normalized) || normalized === "offer_accepted") {
    return [];
  }

  if (normalized === "offer_sent") {
    return ["send_update"];
  }

  if (INTERVIEW_SUB_STATUSES.has(normalized)) {
    return ["accept", "reject", "send_update"];
  }

  if (IN_REVIEW_SUB_STATUSES.has(normalized)) {
    return ["schedule", "accept", "reject"];
  }

  return ["mark_reviewed", "schedule"];
}

export function matchesApplicantPipelineFilter(
  subStatus: string,
  filter: ApplicantPipelineFilter,
): boolean {
  const normalizedSubStatus = normalizeSubStatus(subStatus);

  switch (filter) {
    case "new":
      return NEW_SUB_STATUSES.has(normalizedSubStatus);
    case "in_review":
      return IN_REVIEW_SUB_STATUSES.has(normalizedSubStatus);
    case "interview":
      return INTERVIEW_SUB_STATUSES.has(normalizedSubStatus);
    case "offered":
      return OFFER_SENT_SUB_STATUSES.has(normalizedSubStatus);
    case "accepted":
      return isApplicantPipelineAccepted(subStatus);
    case "rejected":
      return REJECTED_SUB_STATUSES.has(normalizedSubStatus);
    default:
      return true;
  }
}

export function applicantPipelineStageLabel(stage: ApplicantPipelineStage): string {
  switch (stage) {
    case "new":
      return "New";
    case "in_review":
      return "In Review";
    case "interview":
      return "Interview";
    case "offered":
      return "Offered";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
  }
}

export function applicantPipelineStageColor(stage: ApplicantPipelineStage): string {
  switch (stage) {
    case "new":
      return "#a0a0a0";
    case "in_review":
      return "#FFC429";
    case "interview":
      return "#6b7cff";
    case "offered":
      return "#d4a017";
    case "accepted":
      return "#FFC429";
    case "rejected":
      return "#E51937";
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
