import type { CSSProperties } from "react";
import type { Visibility } from "../../types";
import {
  STANDARD_VISIBILITY_OPTIONS,
  type StandardVisibility,
} from "../../lib/contentVisibility";

const labelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#9a9a9a",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0 0 8px",
};

const selectStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0f0f0f",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#ffffff",
  fontFamily: "inherit",
};

/**
 * Shared Public / Members Only / Executives Only visibility control.
 * No Selected option, no emoji/icon cards.
 */
export default function ContentVisibilityDropdown({
  value,
  onChange,
  label = "Visibility",
  allowedValues,
  disabled = false,
}: {
  value: Visibility;
  onChange: (value: StandardVisibility) => void;
  label?: string;
  /** If set, only these options appear (permission-aware). */
  allowedValues?: StandardVisibility[];
  disabled?: boolean;
}) {
  const options = STANDARD_VISIBILITY_OPTIONS.filter((option) =>
    allowedValues ? allowedValues.includes(option.value) : true,
  );

  const normalized: StandardVisibility =
    value === "public" || value === "members_only" || value === "executives_only"
      ? value
      : "members_only";

  const selected =
    options.find((option) => option.value === normalized) ?? options[0] ?? null;

  return (
    <div>
      <p style={labelStyle}>{label}</p>
      <select
        value={selected?.value ?? "members_only"}
        disabled={disabled || options.length === 0}
        onChange={(event) => onChange(event.target.value as StandardVisibility)}
        style={selectStyle}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {selected ? (
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#a8a8a8", lineHeight: 1.4 }}>
          {selected.description}
        </p>
      ) : null}
    </div>
  );
}
