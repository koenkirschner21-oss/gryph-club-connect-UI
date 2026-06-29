import type { ClubEvent } from "../../types";
import type { EventReviewStatus } from "../../lib/eventReview";

export default function CompletedEventCard({
  event,
  attendanceCount,
  feedbackScore,
  reviewStatus,
  feedbackFormEnabled,
  canManage,
  onReview,
  onFeedback,
}: {
  event: ClubEvent;
  attendanceCount: number;
  feedbackScore: number | null;
  reviewStatus: EventReviewStatus | null;
  feedbackFormEnabled: boolean;
  canManage: boolean;
  onReview: () => void;
  onFeedback: () => void;
}) {
  const formattedDate = new Date(event.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
          {event.title}
        </h3>
        <p style={{ margin: 0, fontSize: "12px", color: "#555555" }}>{formattedDate}</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "10px",
          fontSize: "11px",
          color: "#777777",
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#555555" }}>Attendance</p>
          <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            {attendanceCount}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, color: "#555555" }}>Feedback</p>
          <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            {feedbackScore != null ? `${feedbackScore}/5` : "—"}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, color: "#555555" }}>Review</p>
          <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            {reviewStatus === "complete" ? "Complete" : reviewStatus ? "Draft" : "Not started"}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {canManage ? (
          <button
            type="button"
            onClick={onReview}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Review Event
          </button>
        ) : null}
        {!canManage && feedbackFormEnabled ? (
          <button
            type="button"
            onClick={onFeedback}
            style={{
              background: "transparent",
              color: "#FFC429",
              border: "1px solid #FFC429",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Share Feedback
          </button>
        ) : null}
      </div>
    </div>
  );
}
