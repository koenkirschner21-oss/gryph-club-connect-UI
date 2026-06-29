import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import {
  mapEventReviewRow,
  type EventReview,
  type EventReviewStatus,
} from "../../lib/eventReview";
import type { ClubEvent } from "../../types";

const inputStyle = {
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

function Field({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: "14px" }}>
      <span
        style={{
          display: "block",
          marginBottom: "6px",
          fontSize: "11px",
          fontWeight: 700,
          color: "#555555",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{ ...inputStyle, resize: "vertical", minHeight: `${rows * 22}px` }}
      />
    </label>
  );
}

export default function EventReviewModal({
  event,
  clubId,
  attendanceCount,
  feedbackScore,
  feedbackCount,
  onClose,
  onSaved,
}: {
  event: ClubEvent;
  clubId: string;
  attendanceCount: number;
  feedbackScore: number | null;
  feedbackCount: number;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [wentWell, setWentWell] = useState("");
  const [needsImprovement, setNeedsImprovement] = useState("");
  const [issues, setIssues] = useState("");
  const [attendanceSummary, setAttendanceSummary] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [followUpTasks, setFollowUpTasks] = useState("");
  const [reviewStatus, setReviewStatus] = useState<EventReviewStatus>("draft");
  const [feedbackFormEnabled, setFeedbackFormEnabled] = useState(false);

  const applyReview = useCallback((review: EventReview) => {
    setReviewId(review.id);
    setWentWell(review.wentWell);
    setNeedsImprovement(review.needsImprovement);
    setIssues(review.issues);
    setAttendanceSummary(review.attendanceSummary);
    setInternalNotes(review.internalNotes);
    setFollowUpTasks(review.followUpTasks);
    setReviewStatus(review.reviewStatus);
    setFeedbackFormEnabled(review.feedbackFormEnabled);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data, error } = await supabase
        .from("event_reviews")
        .select("*")
        .eq("event_id", event.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to load event review:", error.message);
      } else if (data) {
        applyReview(mapEventReviewRow(data as Record<string, unknown>));
      } else {
        setAttendanceSummary(
          `${attendanceCount} member${attendanceCount === 1 ? "" : "s"} marked going.`,
        );
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyReview, attendanceCount, event.id]);

  async function handleSave(nextStatus?: EventReviewStatus) {
    setSaving(true);
    const payload = {
      event_id: event.id,
      club_id: clubId,
      went_well: wentWell,
      needs_improvement: needsImprovement,
      issues,
      attendance_summary: attendanceSummary,
      internal_notes: internalNotes,
      follow_up_tasks: followUpTasks,
      review_status: nextStatus ?? reviewStatus,
      feedback_form_enabled: feedbackFormEnabled,
      updated_at: new Date().toISOString(),
    };

    if (reviewId) {
      const { error } = await supabase.from("event_reviews").update(payload).eq("id", reviewId);
      if (error) {
        console.error("Failed to update event review:", error.message);
        setSaving(false);
        return;
      }
      if (nextStatus) setReviewStatus(nextStatus);
    } else {
      const { data, error } = await supabase
        .from("event_reviews")
        .insert(payload)
        .select("*")
        .single();
      if (error || !data) {
        console.error("Failed to create event review:", error?.message);
        setSaving(false);
        return;
      }
      applyReview(mapEventReviewRow(data as Record<string, unknown>));
      if (nextStatus) setReviewStatus(nextStatus);
    }

    setSaving(false);
    onSaved?.();
  }

  const formattedDate = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-review-title"
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
          width: "min(760px, 100%)",
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
          Post-event review · exec only
        </p>
        <h2
          id="event-review-title"
          style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800, color: "#ffffff" }}
        >
          {event.title}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#777777" }}>{formattedDate}</p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
            fontSize: "12px",
            color: "#aaaaaa",
          }}
        >
          <span>Attendance: {attendanceCount}</span>
          <span>
            Feedback: {feedbackScore != null ? `${feedbackScore}/5` : "—"}
            {feedbackCount > 0 ? ` (${feedbackCount} responses)` : ""}
          </span>
          <span>Status: {reviewStatus === "complete" ? "Complete" : "Draft"}</span>
        </div>

        {loading ? (
          <p style={{ color: "#555555", fontSize: "13px" }}>Loading review…</p>
        ) : (
          <>
            <Field
              label="What went well"
              value={wentWell}
              onChange={setWentWell}
              placeholder="Highlights, wins, strong turnout moments…"
            />
            <Field
              label="What needs improvement"
              value={needsImprovement}
              onChange={setNeedsImprovement}
              placeholder="Process gaps, timing issues, communication…"
            />
            <Field
              label="Issues"
              value={issues}
              onChange={setIssues}
              placeholder="Problems that came up during or after the event…"
            />
            <Field
              label="Attendance / RSVP results"
              value={attendanceSummary}
              onChange={setAttendanceSummary}
              rows={2}
            />
            <Field
              label="Internal notes"
              value={internalNotes}
              onChange={setInternalNotes}
              placeholder="Notes for the exec team only…"
            />
            <Field
              label="Follow-up tasks"
              value={followUpTasks}
              onChange={setFollowUpTasks}
              placeholder="Action items for next time…"
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "18px",
                fontSize: "13px",
                color: "#cccccc",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={feedbackFormEnabled}
                onChange={(event) => setFeedbackFormEnabled(event.target.checked)}
              />
              Enable anonymous member feedback form
            </label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave("draft")}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#cccccc",
                  cursor: "pointer",
                }}
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave("complete")}
                style={{
                  background: "#FFC429",
                  border: "1px solid #FFC429",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0f0f0f",
                  cursor: "pointer",
                }}
              >
                Mark review complete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
