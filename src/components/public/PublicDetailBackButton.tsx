import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { CSSProperties } from "react";

const baseButtonStyle: CSSProperties = {
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

const overlayButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  position: "absolute",
  top: "16px",
  left: "16px",
  zIndex: 20,
  marginBottom: 0,
  background: "rgba(0, 0, 0, 0.55)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "8px",
  color: "#ffffff",
  padding: "8px 12px",
};

export default function PublicDetailBackButton({
  fallbackTo = "/explore",
  label = "Back",
  overlay = false,
  onBack,
  style,
}: {
  fallbackTo?: string;
  label?: string;
  overlay?: boolean;
  onBack?: () => void;
  style?: CSSProperties;
}) {
  const navigate = useNavigate();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIdx === "number" && historyIdx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      style={{
        ...(overlay ? overlayButtonStyle : baseButtonStyle),
        ...style,
      }}
    >
      <ArrowLeft size={16} aria-hidden />
      {label}
    </button>
  );
}
