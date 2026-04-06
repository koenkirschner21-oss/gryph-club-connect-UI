import type { ReactNode } from "react";

interface CardProps {
  className?: string;
  children: ReactNode;
}

export default function Card({ className = "", children }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {children}
    </div>
  );
}
