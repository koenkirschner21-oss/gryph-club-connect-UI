import type { CSSProperties } from "react";
import type { MeetingPrepItem } from "../../hooks/useMeetingPrepChecklist";
import Spinner from "../ui/Spinner";

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const ACCENT_RED = "#E51937";

const textLinkStyle: CSSProperties = {
  color: ACCENT_RED,
  fontSize: "12px",
  fontWeight: 600,
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

export default function PrepareForMeetingSection({
  items,
  loading,
  onToggle,
  onConvertToTask,
}: {
  items: MeetingPrepItem[];
  loading: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
  onConvertToTask: (item: MeetingPrepItem) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner label="Loading meeting prep…" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: "8px" }}>
      <h2
        style={{
          fontWeight: 600,
          fontSize: "16px",
          color: "#ffffff",
          margin: "0 0 8px",
        }}
      >
        Prepare for Meeting
      </h2>
      <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#777777" }}>
        Private checklist for your next meeting — only you can see this.
      </p>
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "10px",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              borderTop: `1px solid ${CARD_BORDER}`,
              paddingTop: "10px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                flex: 1,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={item.isChecked}
                onChange={(event) => onToggle(item.id, event.target.checked)}
                style={{ marginTop: "2px", accentColor: ACCENT_RED }}
              />
              <span
                style={{
                  fontSize: "13px",
                  color: item.isChecked ? "#777777" : "#cccccc",
                  textDecoration: item.isChecked ? "line-through" : "none",
                  lineHeight: 1.45,
                }}
              >
                {item.label}
              </span>
            </label>
            {item.convertedTaskId ? (
              <span style={{ fontSize: "11px", color: "#555555", flexShrink: 0 }}>
                Added as task
              </span>
            ) : (
              <button
                type="button"
                style={textLinkStyle}
                onClick={() => onConvertToTask(item)}
              >
                Make task
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
