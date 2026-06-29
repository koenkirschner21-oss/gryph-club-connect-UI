export type EventReviewStatus = "draft" | "complete";

export interface EventReview {
  id: string;
  eventId: string;
  clubId: string;
  wentWell: string;
  needsImprovement: string;
  issues: string;
  attendanceSummary: string;
  internalNotes: string;
  followUpTasks: string;
  reviewStatus: EventReviewStatus;
  feedbackFormEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventFeedbackResponse {
  overallRating: number;
  engagementRating: number;
  organizationRating: number;
  liked: string;
  improve: string;
  wouldAttendAgain: boolean | null;
  otherFeedback: string;
}

export interface EventFeedbackSummary {
  responseCount: number;
  averageScore: number | null;
}

export function mapEventReviewRow(row: Record<string, unknown>): EventReview {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    clubId: row.club_id as string,
    wentWell: (row.went_well as string) ?? "",
    needsImprovement: (row.needs_improvement as string) ?? "",
    issues: (row.issues as string) ?? "",
    attendanceSummary: (row.attendance_summary as string) ?? "",
    internalNotes: (row.internal_notes as string) ?? "",
    followUpTasks: (row.follow_up_tasks as string) ?? "",
    reviewStatus: (row.review_status as EventReviewStatus) ?? "draft",
    feedbackFormEnabled: Boolean(row.feedback_form_enabled),
    createdAt: (row.created_at as string) ?? undefined,
    updatedAt: (row.updated_at as string) ?? undefined,
  };
}

export function averageFeedbackScore(
  overall: number,
  engagement: number,
  organization: number,
): number {
  return Math.round(((overall + engagement + organization) / 3) * 10) / 10;
}

export function summarizeFeedbackRows(
  rows: Array<{
    overall_rating: number;
    engagement_rating: number;
    organization_rating: number;
  }>,
): EventFeedbackSummary {
  if (rows.length === 0) {
    return { responseCount: 0, averageScore: null };
  }

  const total = rows.reduce(
    (sum, row) =>
      sum +
      averageFeedbackScore(
        row.overall_rating,
        row.engagement_rating,
        row.organization_rating,
      ),
    0,
  );

  return {
    responseCount: rows.length,
    averageScore: Math.round((total / rows.length) * 10) / 10,
  };
}
