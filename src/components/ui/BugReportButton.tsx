import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Bug, X } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import { showToast } from "./Toast";

type Severity = "minor" | "moderate" | "critical";

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "critical", label: "Critical" },
];

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9100,
  padding: "16px",
};

const modalStyle: CSSProperties = {
  position: "relative",
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "440px",
  width: "100%",
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

export default function BugReportButton() {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const [hovered, setHovered] = useState(false);

  const syncPreviewRole = useCallback(() => {
    setPreviewActive(Boolean(localStorage.getItem("previewRole")));
  }, []);

  useEffect(() => {
    syncPreviewRole();
    window.addEventListener("storage", syncPreviewRole);
    window.addEventListener("previewrole-change", syncPreviewRole);
    return () => {
      window.removeEventListener("storage", syncPreviewRole);
      window.removeEventListener("previewrole-change", syncPreviewRole);
    };
  }, [syncPreviewRole]);

  function handleOpen() {
    setPage(window.location.pathname);
    setDescription("");
    setSeverity("minor");
    setSubmitError(null);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!user?.id) return;
    const trimmed = description.trim();
    if (!trimmed) {
      setSubmitError("Please describe what went wrong.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const { error } = await supabase.from("bug_reports").insert({
      reported_by: user.id,
      page: page.trim() || window.location.pathname,
      description: trimmed,
      severity,
    });

    setSubmitting(false);

    if (error) {
      console.error("Failed to submit bug report:", error.message, error);
      setSubmitError(
        error.message || "Failed to submit bug report. Please try again.",
      );
      return;
    }

    showToast("Bug report submitted", "success");
    setOpen(false);
  }

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Report a bug"
        onClick={handleOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "fixed",
          bottom: previewActive ? "72px" : "24px",
          right: "24px",
          zIndex: 9000,
          background: "#1a1a1a",
          border: "1px solid #333333",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Bug
          size={18}
          color={hovered ? "#ffffff" : "#747676"}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bug-report-title"
          style={overlayStyle}
          onClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              disabled={submitting}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
              }}
            >
              <X size={18} aria-hidden />
            </button>

            <h2
              id="bug-report-title"
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 20px",
              }}
            >
              Report a Bug
            </h2>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="bug-report-page" style={labelStyle}>
                Where did this happen?
              </label>
              <input
                id="bug-report-page"
                type="text"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="bug-report-description" style={labelStyle}>
                What went wrong?
              </label>
              <textarea
                id="bug-report-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened and what you expected to happen"
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: "96px",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <span style={labelStyle}>Severity</span>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {SEVERITIES.map((item) => {
                  const active = severity === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSeverity(item.value)}
                      style={{
                        background: active ? "#E51937" : "#111111",
                        border: active ? "1px solid #E51937" : "1px solid #333333",
                        color: active ? "#ffffff" : "#777777",
                        borderRadius: "20px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError ? (
              <p
                style={{
                  color: "#E51937",
                  fontSize: "13px",
                  marginBottom: "12px",
                }}
              >
                {submitError}
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
                borderRadius: "6px",
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
