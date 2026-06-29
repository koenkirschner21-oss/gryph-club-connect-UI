import type { CSSProperties } from "react";
import type { Task } from "../../types";
import Spinner from "../ui/Spinner";

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const ACCENT_RED = "#E51937";

const outlineButtonStyle: CSSProperties = {
  background: "transparent",
  color: "#cccccc",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  flexShrink: 0,
};

function formatCompletedAt(iso?: string): string {
  if (!iso) return "Recently completed";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently completed";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NeedsReviewSection({
  tasks,
  loading,
  onReviewTask,
}: {
  tasks: Task[];
  loading?: boolean;
  onReviewTask: (task: Task) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner label="Loading tasks to review…" />
      </div>
    );
  }

  if (tasks.length === 0) return null;

  return (
    <div style={{ marginBottom: "8px" }}>
      <h2
        style={{
          fontWeight: 600,
          fontSize: "16px",
          color: "#ffffff",
          margin: "0 0 16px",
        }}
      >
        Needs Review
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderLeft: `3px solid ${ACCENT_RED}`,
              borderRadius: "8px",
              padding: "14px 16px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {task.title}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
                {task.assigneeName ?? "Assignee"} · Completed{" "}
                {formatCompletedAt(task.completedAt ?? task.createdAt)}
              </p>
            </div>
            <button
              type="button"
              style={outlineButtonStyle}
              onClick={() => onReviewTask(task)}
            >
              Review Task
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
