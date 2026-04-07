import type { InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional helper text shown below the input */
  hint?: string;
}

export default function FormInput({
  label,
  id,
  className = "",
  hint,
  ...props
}: FormInputProps) {
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
        id={id}
        className={`w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors ${className}`}
        {...props}
      />
      {hint && (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}
