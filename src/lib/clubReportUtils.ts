export type ClubReportReason =
  | "incorrect_information"
  | "duplicate_club"
  | "no_longer_active"
  | "inappropriate_content"
  | "fake_unauthorized"
  | "wrong_contact_links"
  | "other";

export type ClubReportStatus = "open" | "in_review" | "resolved" | "dismissed";

export const CLUB_REPORT_REASONS: { value: ClubReportReason; label: string }[] = [
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "duplicate_club", label: "Duplicate club" },
  { value: "no_longer_active", label: "No longer active" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "fake_unauthorized", label: "Fake or unauthorized club" },
  { value: "wrong_contact_links", label: "Wrong contact or links" },
  { value: "other", label: "Other" },
];

export function clubReportReasonLabel(reason: string): string {
  return (
    CLUB_REPORT_REASONS.find((option) => option.value === reason)?.label ??
    reason.replace(/_/g, " ")
  );
}

export function clubReportStatusBadgeStyle(status: ClubReportStatus): {
  background: string;
  color: string;
  border: string;
} {
  switch (status) {
    case "open":
      return {
        background: "#1a0505",
        color: "#E51937",
        border: "1px solid #E51937",
      };
    case "in_review":
      return {
        background: "#1a1500",
        color: "#FFC429",
        border: "1px solid #FFC429",
      };
    case "resolved":
      return {
        background: "#1a1a1a",
        color: "#555555",
        border: "1px solid #555555",
      };
    case "dismissed":
    default:
      return {
        background: "#141414",
        color: "#333333",
        border: "1px solid #333333",
      };
  }
}

export function clubReportStatusLabel(status: ClubReportStatus): string {
  if (status === "in_review") return "In Review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
