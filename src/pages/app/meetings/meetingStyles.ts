import type { CSSProperties } from "react";

export const CARD_BG = "#141414";
export const CARD_BORDER = "#2a2a2a";

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#ffffff",
  fontSize: "13px",
  boxSizing: "border-box",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "#888888",
  marginBottom: "6px",
};

export const primaryButtonStyle: CSSProperties = {
  background: "#E51937",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

export const outlineButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  color: "#cccccc",
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
};

export const sectionHeadingStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "14px",
  fontWeight: 700,
  color: "#ffffff",
};

export const sectionCardStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "10px",
  padding: "16px",
  marginBottom: "16px",
};
