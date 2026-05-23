import type { ReactNode } from "react";

export type IconProps = {
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
};

function SvgIcon({
  size = 16,
  strokeWidth = 2,
  children,
  "aria-hidden": ariaHidden = true,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      {children}
    </svg>
  );
}

export function LayoutDashboard({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </SvgIcon>
  );
}

export function Megaphone({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11 13v8a1 1 0 0 1-1.447.894L6 20v-7" />
    </SvgIcon>
  );
}

export function MessageSquare({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </SvgIcon>
  );
}

export function CheckSquare({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5" />
      <path d="m9 11 2 2 4-4" />
    </SvgIcon>
  );
}

export function Calendar({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </SvgIcon>
  );
}

export function Users({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </SvgIcon>
  );
}

export function BarChart2({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </SvgIcon>
  );
}

export function Settings({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  );
}

export function ExternalLink({ size, strokeWidth, "aria-hidden": ariaHidden }: IconProps) {
  return (
    <SvgIcon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </SvgIcon>
  );
}
