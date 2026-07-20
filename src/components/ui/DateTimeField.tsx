import {
  useId,
  useRef,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";
import { Calendar, Clock } from "lucide-react";

type DateTimeInputType = "date" | "time" | "datetime-local";

export interface DateTimeFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  type?: DateTimeInputType;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  /** When set with a counterpart max/min, shows a range validation message. */
  rangeError?: string;
  className?: string;
  inputClassName?: string;
  /** Inline style override for the native input (club dark forms). */
  inputStyle?: CSSProperties;
  /** Visual surface: dark (default app) or light. */
  appearance?: "dark" | "light";
}

const DARK_INPUT: CSSProperties = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #2a2a2a",
  background: "#1a1a1a",
  color: "#ffffff",
  padding: "10px 40px 10px 12px",
  fontSize: "14px",
  fontFamily: "inherit",
  colorScheme: "dark",
  cursor: "pointer",
};

const LIGHT_INPUT: CSSProperties = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #d4d4d4",
  background: "#ffffff",
  color: "#111111",
  padding: "10px 40px 10px 12px",
  fontSize: "14px",
  fontFamily: "inherit",
  colorScheme: "light",
  cursor: "pointer",
};

function openNativePicker(input: HTMLInputElement | null) {
  if (!input || input.disabled || input.readOnly) return;
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch {
    // Some browsers throw if showPicker is called without a user gesture or support.
  }
  input.focus();
  input.click();
}

/**
 * Shared date/time control for Events, Meetings, Tasks, Hiring, and filters.
 * Clicking the field or icon opens the native picker where supported.
 */
export default function DateTimeField({
  type = "date",
  label,
  id,
  value,
  onChange,
  hint,
  error,
  rangeError,
  className = "",
  inputClassName = "",
  inputStyle,
  appearance = "dark",
  required,
  disabled,
  ...props
}: DateTimeFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = type === "time" ? Clock : Calendar;
  const displayError = error || rangeError;
  const baseStyle = appearance === "light" ? LIGHT_INPUT : DARK_INPUT;
  const borderColor = displayError
    ? "#E51937"
    : appearance === "light"
      ? "#d4d4d4"
      : "#2a2a2a";
  const iconColor = disabled
    ? appearance === "light"
      ? "#a3a3a3"
      : "#555555"
    : appearance === "light"
      ? "#525252"
      : "#aaaaaa";

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-white"
          style={
            appearance === "light"
              ? { color: "#111111", marginBottom: "6px", display: "block", fontSize: "13px" }
              : undefined
          }
        >
          {label}
          {required ? (
            <span className="ml-1 text-primary" aria-label="required">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <div style={{ position: "relative" }}>
        <input
          {...props}
          ref={inputRef}
          id={inputId}
          type={type}
          value={value}
          disabled={disabled}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          onClick={() => openNativePicker(inputRef.current)}
          onFocus={(event) => {
            props.onFocus?.(event);
          }}
          className={`datetime-field-input datetime-field-with-icon ${inputClassName}`.trim()}
          style={{
            ...baseStyle,
            border: `1px solid ${borderColor}`,
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
            ...inputStyle,
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          disabled={disabled}
          onClick={() => openNativePicker(inputRef.current)}
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2px",
            border: "none",
            background: "transparent",
            color: iconColor,
            cursor: disabled ? "not-allowed" : "pointer",
            pointerEvents: "none",
          }}
        >
          <Icon size={16} aria-hidden strokeWidth={2} />
        </button>
      </div>
      {displayError ? (
        <p
          role="alert"
          style={{
            margin: "6px 0 0",
            fontSize: "12px",
            color: "#E51937",
          }}
        >
          {displayError}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
