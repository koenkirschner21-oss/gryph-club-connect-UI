import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Briefcase,
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  FileUp,
  Link2,
  Megaphone,
  UserPlus,
} from "lucide-react";

const GOLD = "#FFC429";
const CARD_BORDER = "#2a2a2a";

export type CreateMenuActionId =
  | "announcement"
  | "event"
  | "task"
  | "meeting"
  | "hiring"
  | "upload_file"
  | "add_resource"
  | "invite_members"
  | "invite_executive";

export type CreateMenuAction = {
  id: CreateMenuActionId;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
};

const DEFAULT_ICONS: Record<CreateMenuActionId, ReactNode> = {
  announcement: <Megaphone size={14} aria-hidden />,
  event: <Calendar size={14} aria-hidden />,
  task: <CheckSquare size={14} aria-hidden />,
  meeting: <CalendarClock size={14} aria-hidden />,
  hiring: <Briefcase size={14} aria-hidden />,
  upload_file: <FileUp size={14} aria-hidden />,
  add_resource: <Link2 size={14} aria-hidden />,
  invite_members: <UserPlus size={14} aria-hidden />,
  invite_executive: <UserPlus size={14} aria-hidden />,
};

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: GOLD,
  color: "#0f0f0f",
  border: `1px solid ${GOLD}`,
  borderRadius: "8px",
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  minWidth: "220px",
  background: "#161616",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "10px",
  padding: "6px",
  zIndex: 40,
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
};

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  borderRadius: "7px",
  padding: "9px 10px",
  color: "#dddddd",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

export function CommandCenterCreateMenu({
  actions,
}: {
  actions: CreateMenuAction[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" style={triggerStyle} onClick={() => setOpen((value) => !value)}>
        Create
        <ChevronDown size={14} aria-hidden />
      </button>
      {open ? (
        <div role="menu" style={menuStyle}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              style={itemStyle}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#1f1f1f";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              <span style={{ color: GOLD, display: "inline-flex" }}>
                {action.icon ?? DEFAULT_ICONS[action.id]}
              </span>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
