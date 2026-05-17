import type { CSSProperties, InputHTMLAttributes } from "react";

export const AUTH_PAGE_BG = "#0f0f0f";
export const AUTH_RED = "#E51937";
export const AUTH_RED_HOVER = "#cc0020";
export const AUTH_MUTED = "#555555";

export const pageStyle: CSSProperties = {
  backgroundColor: AUTH_PAGE_BG,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};

export const cardStyle: CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #242424",
  borderTop: `3px solid ${AUTH_RED}`,
  borderRadius: "12px",
  padding: "40px",
  maxWidth: "420px",
  width: "100%",
};

export const headingStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: "24px",
  color: "#ffffff",
  textAlign: "center",
  margin: "0 0 8px",
};

export const subtitleStyle: CSSProperties = {
  fontSize: "13px",
  color: AUTH_MUTED,
  textAlign: "center",
  margin: "0 0 24px",
};

export const labelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "#888888",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: "6px",
};

export const inputStyle: CSSProperties = {
  backgroundColor: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

export const primaryButtonStyle: CSSProperties = {
  backgroundColor: AUTH_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "12px",
  width: "100%",
  fontWeight: 600,
  fontSize: "15px",
  cursor: "pointer",
};

export const footerTextStyle: CSSProperties = {
  color: AUTH_MUTED,
  fontSize: "13px",
  textAlign: "center",
  margin: 0,
};

export const linkClassName =
  "font-medium text-[#E51937] no-underline hover:underline";

export const errorBoxStyle: CSSProperties = {
  backgroundColor: "#2a0a0a",
  border: "1px solid #3a1a1a",
  color: "#ff6b6b",
  borderRadius: "6px",
  padding: "10px 14px",
  fontSize: "13px",
  marginBottom: "16px",
};

export function setInputFocus(el: HTMLInputElement, focused: boolean) {
  el.style.borderColor = focused ? AUTH_RED : "#2a2a2a";
}

export function AuthField({
  label,
  id,
  hint,
  ...inputProps
}: {
  label: string;
  id: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        className="placeholder:text-[#444444]"
        style={inputStyle}
        onFocus={(e) => setInputFocus(e.currentTarget, true)}
        onBlur={(e) => setInputFocus(e.currentTarget, false)}
        {...inputProps}
      />
      {hint && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: AUTH_MUTED }}>
          {hint}
        </p>
      )}
    </div>
  );
}
