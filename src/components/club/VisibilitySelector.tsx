import type { CSSProperties } from "react";
import type { Visibility } from "../../types";
import { VISIBILITY_OPTIONS } from "../../lib/contentVisibility";

const pillBase: CSSProperties = {
  borderRadius: "20px",
  padding: "8px 14px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
  flex: "1 1 140px",
  minWidth: 0,
};

function pillStyle(active: boolean): CSSProperties {
  return active
    ? {
        ...pillBase,
        background: "#E51937",
        border: "1px solid #E51937",
        color: "#ffffff",
      }
    : {
        ...pillBase,
        background: "transparent",
        border: "1px solid #333333",
        color: "#999999",
      };
}

export default function VisibilitySelector({
  value,
  onChange,
  label = "Who can see this?",
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  label?: string;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          margin: "0 0 10px",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {VISIBILITY_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={pillStyle(active)}
            >
              <span style={{ display: "block" }}>
                {option.emoji} {option.label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 500,
                  marginTop: "2px",
                  color: active ? "#ffffff" : "#777777",
                }}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
