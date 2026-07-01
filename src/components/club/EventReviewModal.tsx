import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import {
  mapEventReviewRow,
  type EventReview,
  type EventReviewStatus,
} from "../../lib/eventReview";
import type { ClubEvent } from "../../types";

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0f0f0f",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "13px",
  color: "#ffffff",
  fontFamily: "inherit",
};

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        background: "#111111",
        border: "1px solid #2a2a2a",
        borderRadius: "999px",
        padding: "6px 12px",
        fontSize: "12px",
        color: "#cccccc",
      }}
    >
      <span style={{ color: "#666666" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#ffffff" }}>{value}</span>
    </span>
  );
}

function ReviewSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "#111111",
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "14px",
      }}
    >
      <h3
        style={{
          margin: "0 0 4px",
          fontSize: "13px",
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        {title}
      </h3>
      {subtitle ? (
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#666666", lineHeight: 1.45 }}>
          {subtitle}
        </p>
      ) : (
        <div style={{ marginBottom: "12px" }} />
      )}
      {children}
    </section>
  );
}

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
    <label style={{ display: "block", marginBottom: "12px" }}>
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

  const statusLabel = reviewStatus === "complete" ? "Complete" : "Draft";
  const feedbackLabel =
    feedbackScore != null
      ? `${feedbackScore}/5${feedbackCount > 0 ? ` (${feedbackCount})` : ""}`
      : feedbackCount > 0
        ? `${feedbackCount} responses`
        : "—";

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
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "#141414",
            borderBottom: "1px solid #2a2a2a",
            padding: "20px 24px 16px",
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

          <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#555555" }}>
            Post-event review · Exec only
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              paddingRight: "28px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                id="event-review-title"
                style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800, color: "#ffffff" }}
              >
                {event.title}
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>{formattedDate}</p>
            </div>
            <span
              style={{
                background: reviewStatus === "complete" ? "#1a2a1a" : "#1a1a1a",
                border: `1px solid ${reviewStatus === "complete" ? "#2a4a2a" : "#333333"}`,
                color: reviewStatus === "complete" ? "#4ade80" : "#aaaaaa",
                borderRadius: "999px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}
            >
              {statusLabel}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "14px",
            }}
          >
            <StatPill label="Attendance" value={String(attendanceCount)} />
            <StatPill label="Feedback" value={feedbackLabel} />
            <StatPill label="Status" value={statusLabel} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 8px" }}>
          {loading ? (
            <p style={{ color: "#555555", fontSize: "13px" }}>Loading review…</p>
          ) : (
            <>
              <ReviewSection title="Event Recap">
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
              </ReviewSection>

              <ReviewSection title="Results">
                <Field
                  label="Attendance / RSVP results"
                  value={attendanceSummary}
                  onChange={setAttendanceSummary}
                  rows={3}
                />
              </ReviewSection>

              <ReviewSection
                title="Internal Notes"
                subtitle="Visible to executives only — not shared with members."
              >
                <Field
                  label="Internal notes"
                  value={internalNotes}
                  onChange={setInternalNotes}
                  placeholder="Notes for the exec team only…"
                />
              </ReviewSection>

              <ReviewSection title="Follow-Up">
                <Field
                  label="Follow-up tasks / action items"
                  value={followUpTasks}
                  onChange={setFollowUpTasks}
                  placeholder="Action items for next time…"
                />
              </ReviewSection>

              <ReviewSection title="Member Feedback">
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#aaaaaa", lineHeight: 1.5 }}>
                  Enable a feedback form for members after this event. Responses will be summarized
                  without showing names.
                </p>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    fontSize: "13px",
                    color: "#cccccc",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={feedbackFormEnabled}
                    onChange={(event) => setFeedbackFormEnabled(event.target.checked)}
                    style={{ marginTop: "3px" }}
                  />
                  <span>Enable anonymous member feedback form</span>
                </label>
              </ReviewSection>
            </>
          )}
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 2,
            background: "#141414",
            borderTop: "1px solid #2a2a2a",
            padding: "14px 24px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSave("draft")}
            style={{
              background: "transparent",
              border: "1px solid #333333",
              borderRadius: "6px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#cccccc",
              cursor: saving || loading ? "not-allowed" : "pointer",
            }}
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSave("complete")}
            style={{
              background: "#FFC429",
              border: "1px solid #FFC429",
              borderRadius: "6px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#0f0f0f",
              cursor: saving || loading ? "not-allowed" : "pointer",
            }}
          >
            Mark Review Complete
          </button>
        </div>
      </div>
    </div>
  );
}
