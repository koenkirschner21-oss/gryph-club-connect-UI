import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import type { ClubEvent } from "../../types";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: "#0f0f0f",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "13px",
  color: "#ffffff",
  fontFamily: "inherit",
};

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#cccccc" }}>{label}</p>
      <div style={{ display: "flex", gap: "8px" }}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: active ? "1px solid #FFC429" : "1px solid #333333",
                background: active ? "rgba(255, 196, 41, 0.12)" : "transparent",
                color: active ? "#FFC429" : "#777777",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function EventMemberFeedbackModal({
  event,
  clubId,
  onClose,
  onSubmitted,
}: {
  event: ClubEvent;
  clubId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [overallRating, setOverallRating] = useState(0);
  const [engagementRating, setEngagementRating] = useState(0);
  const [organizationRating, setOrganizationRating] = useState(0);
  const [liked, setLiked] = useState("");
  const [improve, setImprove] = useState("");
  const [wouldAttendAgain, setWouldAttendAgain] = useState<boolean | null>(null);
  const [otherFeedback, setOtherFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (overallRating < 1 || engagementRating < 1 || organizationRating < 1) return;

    setSubmitting(true);
    const { error } = await supabase.from("event_feedback_responses").insert({
      event_id: event.id,
      club_id: clubId,
      overall_rating: overallRating,
      engagement_rating: engagementRating,
      organization_rating: organizationRating,
      liked: liked.trim(),
      improve: improve.trim(),
      would_attend_again: wouldAttendAgain,
      other_feedback: otherFeedback.trim(),
    });

    setSubmitting(false);

    if (error) {
      console.error("Failed to submit feedback:", error.message);
      return;
    }

    setSubmitted(true);
    onSubmitted?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-feedback-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(eventClick) => eventClick.stopPropagation()}
        style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "14px",
          width: "min(560px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "#555555",
            cursor: "pointer",
          }}
        >
          <X size={20} />
        </button>

        <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#555555" }}>
          Anonymous feedback
        </p>
        <h2
          id="event-feedback-title"
          style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "#ffffff" }}
        >
          {event.title}
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: "12px", color: "#666666", lineHeight: 1.5 }}>
          Your responses are anonymous — we do not store who submitted this form.
        </p>

        {submitted ? (
          <p style={{ fontSize: "14px", color: "#cccccc" }}>
            Thank you for your feedback.
          </p>
        ) : (
          <>
            <RatingRow label="Overall rating" value={overallRating} onChange={setOverallRating} />
            <RatingRow
              label="Engagement rating"
              value={engagementRating}
              onChange={setEngagementRating}
            />
            <RatingRow
              label="Organization rating"
              value={organizationRating}
              onChange={setOrganizationRating}
            />

            <label style={{ display: "block", marginBottom: "12px" }}>
              <span style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: "#cccccc" }}>
                What did you like?
              </span>
              <textarea
                value={liked}
                onChange={(event) => setLiked(event.target.value)}
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: "12px" }}>
              <span style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: "#cccccc" }}>
                What could be improved?
              </span>
              <textarea
                value={improve}
                onChange={(event) => setImprove(event.target.value)}
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </label>

            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#cccccc" }}>
              Would you attend again?
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              {[
                { label: "Yes", value: true },
                { label: "No", value: false },
                { label: "Not sure", value: null },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setWouldAttendAgain(option.value)}
                  style={{
                    borderRadius: "20px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    border:
                      wouldAttendAgain === option.value
                        ? "1px solid #FFC429"
                        : "1px solid #333333",
                    background:
                      wouldAttendAgain === option.value
                        ? "rgba(255, 196, 41, 0.12)"
                        : "transparent",
                    color: wouldAttendAgain === option.value ? "#FFC429" : "#777777",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label style={{ display: "block", marginBottom: "16px" }}>
              <span style={{ display: "block", marginBottom: "6px", fontSize: "13px", color: "#cccccc" }}>
                Other feedback
              </span>
              <textarea
                value={otherFeedback}
                onChange={(event) => setOtherFeedback(event.target.value)}
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </label>

            <button
              type="button"
              disabled={
                submitting ||
                overallRating < 1 ||
                engagementRating < 1 ||
                organizationRating < 1
              }
              onClick={() => void handleSubmit()}
              style={{
                background: "#E51937",
                border: "none",
                borderRadius: "6px",
                padding: "9px 16px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
                opacity:
                  submitting ||
                  overallRating < 1 ||
                  engagementRating < 1 ||
                  organizationRating < 1
                    ? 0.6
                    : 1,
              }}
            >
              Submit anonymously
            </button>
          </>
        )}
      </div>
    </div>
  );
}
