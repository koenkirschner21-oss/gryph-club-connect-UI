import { useRef, type InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional helper text shown below the input */
  hint?: string;
  /** Optional validation message */
  error?: string;
}

function isDateTimeType(type: string | undefined): boolean {
  return type === "date" || type === "time" || type === "datetime-local";
}

function openNativePicker(input: HTMLInputElement | null) {
  if (!input || input.disabled || input.readOnly) return;
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch {
    // Unsupported or blocked showPicker — fall through to focus.
  }
  input.focus();
}

export default function FormInput({
  label,
  id,
  className = "",
  hint,
  error,
  type,
  onClick,
  ...props
}: FormInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dateTime = isDateTimeType(type);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-white"
      >
        {label}
        {props.required && (
          <span className="ml-1 text-primary" aria-label="required">*</span>
        )}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        className={`w-full rounded-lg border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors datetime-field-input ${
          error ? "border-red-500" : "border-border"
        } ${dateTime ? "cursor-pointer pr-10" : ""} ${className}`}
        style={dateTime ? { colorScheme: "dark" } : undefined}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          if (dateTime) openNativePicker(inputRef.current);
        }}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
