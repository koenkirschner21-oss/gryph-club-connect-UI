import type { InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function FormInput({
  label,
  id,
  className = "",
  ...props
}: FormInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-white"
      >
        {label}
      </label>
      <input
        id={id}
        className={`w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors ${className}`}
        {...props}
      />
    </div>
  );
}
