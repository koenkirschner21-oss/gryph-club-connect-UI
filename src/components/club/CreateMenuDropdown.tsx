import { useEffect, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";

const ACCENT_RED = "#E51937";
const CARD_BORDER = "#2a2a2a";

const actionButtonStyle: CSSProperties = {
  background: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

export type CreateMenuOption = {
  label: string;
  onClick: () => void;
};

export default function CreateMenuDropdown({
  options,
  buttonLabel = "Create",
  buttonPadding = "10px 16px",
  buttonFontSize = "13px",
}: {
  options: CreateMenuOption[];
  buttonLabel?: string;
  buttonPadding?: string;
  buttonFontSize?: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!createOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-create-menu]")) {
        setCreateOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [createOpen]);

  if (options.length === 0) return null;

  return (
    <div style={{ position: "relative" }} data-create-menu>
      <button
        type="button"
        onClick={() => setCreateOpen((open) => !open)}
        style={{
          ...actionButtonStyle,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: buttonPadding,
          fontSize: buttonFontSize,
        }}
      >
        {buttonLabel}
        <ChevronDown size={16} aria-hidden />
      </button>
      {createOpen ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: "180px",
            background: "#151515",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            overflow: "hidden",
            zIndex: 20,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setCreateOpen(false);
                option.onClick();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "#cccccc",
                padding: "10px 14px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
