import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { CSSProperties } from "react";

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "transparent",
  border: "none",
  color: "#777777",
  cursor: "pointer",
  fontSize: "13px",
  padding: 0,
  marginBottom: "16px",
};

export default function PublicDetailBackButton({
  fallbackTo = "/explore",
  label = "Back",
}: {
  fallbackTo?: string;
  label?: string;
}) {
  const navigate = useNavigate();

  function handleBack() {
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIdx === "number" && historyIdx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  }

  return (
    <button type="button" onClick={handleBack} style={buttonStyle}>
      <ArrowLeft size={16} aria-hidden />
      {label}
    </button>
  );
}
