import { Globe, Lock } from "lucide-react";
import type { CSSProperties } from "react";
import type { Visibility } from "../../types";
import { normalizeVisibility } from "../../lib/contentVisibility";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "11px",
  borderRadius: "12px",
  padding: "3px 8px",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

export default function VisibilityBadge({
  visibility,
}: {
  visibility?: Visibility | string | null;
}) {
  const level = normalizeVisibility(visibility);

  if (level === "executives_only") {
    return (
      <span
        style={{
          ...badgeStyle,
          color: ACCENT_RED,
          border: `1px solid ${ACCENT_RED}`,
          background: "rgba(229,25,55,0.1)",
        }}
      >
        <Lock size={12} aria-hidden />
        Executives Only
      </span>
    );
  }

  if (level === "members_only") {
    return (
      <span
        style={{
          ...badgeStyle,
          color: GOLD,
          border: `1px solid ${GOLD}`,
          background: "rgba(255,196,41,0.1)",
        }}
      >
        <Lock size={12} aria-hidden />
        Members Only
      </span>
    );
  }

  return (
    <span
      style={{
        ...badgeStyle,
        color: "#555555",
        border: "1px solid #333333",
      }}
    >
      <Globe size={12} aria-hidden />
      Public
    </span>
  );
}
