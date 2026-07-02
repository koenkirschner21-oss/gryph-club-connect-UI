import { useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { notifyReportSubmitted } from "../../lib/notifications";
import { CLUB_REPORT_REASONS, type ClubReportReason } from "../../lib/clubReportUtils";
import { modalOverlayStyle } from "../../pages/app/HiringBoardPage";

const panelStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "480px",
  width: "100%",
  position: "relative",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#777777",
  marginBottom: "6px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#111111",
  border: "1px solid #333333",
  borderRadius: "6px",
  padding: "10px 12px",
  fontSize: "13px",
  color: "#ffffff",
  boxSizing: "border-box",
};

interface ReportClubModalProps {
  clubId: string;
  clubName: string;
  reporterId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReportClubModal({
  clubId,
  clubName,
  reporterId,
  onClose,
  onSubmitted,
}: ReportClubModalProps) {
  const [reason, setReason] = useState<ClubReportReason>("incorrect_information");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const { data: inserted, error: insertError } = await supabase
      .from("club_reports")
      .insert({
        club_id: clubId,
        club_name: clubName,
        reporter_id: reporterId,
        reason,
        description: description.trim() || null,
        current_url: window.location.href,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      console.error("Failed to submit club report:", insertError?.message);
      setError("Could not submit your report. Please try again.");
      setSubmitting(false);
      return;
    }

    void notifyReportSubmitted(supabase, {
      reportId: inserted.id as string,
      reportKind: "club",
      summary: `Club report for ${clubName} (${reason.replaceAll("_", " ")}).`,
      adminPath: "/app/admin?tab=reports",
    });

    setSubmitting(false);
    onSubmitted();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-club-title"
      style={modalOverlayStyle}
      onClick={onClose}
    >
      <div style={panelStyle} onClick={(e) => e.stopPropagation()} role="presentation">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "#777777",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <X size={18} aria-hidden />
        </button>

        <h2
          id="report-club-title"
          style={{
            margin: "0 0 16px",
            fontSize: "18px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          Report Club
        </h2>

        <label style={labelStyle} htmlFor="report-club-reason">
          Reason
        </label>
        <select
          id="report-club-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as ClubReportReason)}
          style={{ ...inputStyle, marginBottom: "14px" }}
        >
          {CLUB_REPORT_REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label style={labelStyle} htmlFor="report-club-description">
          Description
        </label>
        <textarea
          id="report-club-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell us what looks wrong or concerning."
          rows={5}
          style={{ ...inputStyle, marginBottom: "16px", resize: "vertical" }}
        />

        {error ? (
          <p style={{ color: "#E51937", fontSize: "12px", margin: "0 0 12px" }}>
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          style={{
            width: "100%",
            background: "#E51937",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
      </div>
    </div>
  );
}
