import type { CSSProperties } from "react";
import type { ClubMeeting } from "./meetingTypes";

export type MeetingCancelOption = "meeting_only" | "meeting_and_tasks" | "keep";

const cardBase: CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "14px 16px",
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
  fontFamily: "inherit",
};

interface MeetingCancelConfirmModalProps {
  meeting: ClubMeeting;
  linkedTaskCount: number;
  selectedOption: MeetingCancelOption;
  applying: boolean;
  onSelectOption: (option: MeetingCancelOption) => void;
  onConfirm: () => void;
  onGoBack: () => void;
}

export function MeetingCancelConfirmModal({
  meeting,
  linkedTaskCount,
  selectedOption,
  applying,
  onSelectOption,
  onConfirm,
  onGoBack,
}: MeetingCancelConfirmModalProps) {
  const options: {
    id: MeetingCancelOption;
    title: string;
    description: string;
  }[] = [
    {
      id: "meeting_only",
      title: "Cancel meeting only",
      description:
        "Meeting is cancelled. Linked tasks stay active but will show a note that their linked meeting was cancelled.",
    },
    {
      id: "meeting_and_tasks",
      title: "Cancel meeting and linked tasks",
      description:
        "Meeting is cancelled. All incomplete linked tasks will be marked as cancelled.",
    },
    {
      id: "keep",
      title: "Keep meeting",
      description: "Go back without making changes.",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meeting-cancel-title"
      onClick={onGoBack}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#0f0f0f",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          padding: "24px",
          width: "100%",
          maxWidth: "520px",
        }}
      >
        <h2
          id="meeting-cancel-title"
          style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "#ffffff" }}
        >
          Cancel this meeting?
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#777777", lineHeight: 1.5 }}>
          This meeting has {linkedTaskCount} linked task{linkedTaskCount === 1 ? "" : "s"}. What
          would you like to do with them?
        </p>
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#555555" }}>
          Meeting: <span style={{ color: "#cccccc" }}>{meeting.title}</span>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {options.map((option) => {
            const selected = selectedOption === option.id;
            return (
              <OptionCard
                key={option.id}
                selected={selected}
                title={option.title}
                description={option.description}
                onClick={() => onSelectOption(option.id)}
              />
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onGoBack}
            disabled={applying}
            style={{
              background: "transparent",
              border: "1px solid #333333",
              borderRadius: "8px",
              color: "#cccccc",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: applying ? "not-allowed" : "pointer",
              opacity: applying ? 0.6 : 1,
            }}
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={applying || selectedOption === "keep"}
            style={{
              background: "#E51937",
              border: "none",
              borderRadius: "8px",
              color: "#ffffff",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: applying || selectedOption === "keep" ? "not-allowed" : "pointer",
              opacity: applying || selectedOption === "keep" ? 0.6 : 1,
            }}
          >
            {applying ? "Applying…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...cardBase,
        border: selected ? "1px solid #E51937" : cardBase.border,
        background: selected ? "#1a1214" : cardBase.background,
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: "13px", color: "#777777", lineHeight: 1.45 }}>
        {description}
      </p>
    </button>
  );
}
