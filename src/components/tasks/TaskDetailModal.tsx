import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Send, X } from "lucide-react";
import LinkedMeetingCancelledLabel from "./LinkedMeetingCancelledLabel";
import { formatTaskDate, getTaskDueUrgency, taskDueBadgeConfig, taskDueDateColor } from "../../lib/taskDueUrgency";
import { shouldSubmitTaskForReview } from "../../lib/taskCompletion";
import { TASK_STATUS_LABELS } from "../../lib/taskStatusActions";
import { TASK_TYPE_BADGE_LABELS } from "../../lib/taskTypes";
import { supabase } from "../../lib/supabaseClient";
import { notifyUsers } from "../../lib/notifyUsers";
import type { Task, TaskStatus } from "../../types";

const GOLD = "#FFC429";
const ACCENT_RED = "#E51937";

const statusLabels = TASK_STATUS_LABELS;

function StatusBadge({ status }: { status: TaskStatus }) {
  const config = {
    todo: { border: "#444444", color: "#999999", bg: "transparent" },
    in_progress: { border: GOLD, color: GOLD, bg: "rgba(255, 196, 41, 0.08)" },
    done: { border: "#3d6b3d", color: "#7ecf7e", bg: "rgba(60, 120, 60, 0.1)" },
    pending_review: { border: GOLD, color: GOLD, bg: "rgba(255, 196, 41, 0.08)" },
    cancelled: { border: "#444444", color: "#666666", bg: "transparent" },
  }[status];

  return (
    <span
      style={{
        border: `1px solid ${config.border}`,
        background: config.bg,
        color: config.color,
        borderRadius: "4px",
        padding: "3px 10px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {statusLabels[status]}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 10px",
        fontSize: "10px",
        fontWeight: 700,
        color: "#555555",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </p>
  );
}

const primaryButtonStyle: CSSProperties = {
  background: GOLD,
  border: `1px solid ${GOLD}`,
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#0f0f0f",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#cccccc",
  cursor: "pointer",
};

const managementButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "11px",
  fontWeight: 600,
  color: "#777777",
  cursor: "pointer",
};

interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string;
  avatarUrl?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatCommentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fetchCommentsForTask(taskId: string): Promise<TaskComment[]> {
  const { data: rows, error } = await supabase
    .from("task_comments")
    .select("id, task_id, user_id, content, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error || !rows?.length) {
    if (error) console.error("Failed to load task comments:", error.message);
    return [];
  }

  const userIds = [...new Set(rows.map((row) => row.user_id as string))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      {
        fullName: (profile.full_name as string) ?? "Member",
        avatarUrl: (profile.avatar_url as string) ?? undefined,
      },
    ]),
  );

  return rows.map((row) => {
    const profile = profileMap.get(row.user_id as string);
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      userId: row.user_id as string,
      content: (row.content as string) ?? "",
      createdAt: (row.created_at as string) ?? "",
      authorName: profile?.fullName ?? "Member",
      avatarUrl: profile?.avatarUrl,
    };
  });
}

function AvatarCircle({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl?: string;
  size: number;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#2a2a2a",
        fontSize: size <= 20 ? "9px" : "11px",
        color: "#cccccc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontWeight: 600,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function PriorityPill({ priority }: { priority: Task["priority"] }) {
  const config = {
    high: { border: ACCENT_RED, color: ACCENT_RED, label: "High" },
    medium: { border: GOLD, color: GOLD, label: "Medium" },
    low: { border: "#555555", color: "#555555", label: "Low" },
  }[priority];

  return (
    <span
      style={{
        border: `1px solid ${config.border}`,
        color: config.color,
        borderRadius: "4px",
        padding: "2px 8px",
        fontSize: "10px",
        fontWeight: 600,
      }}
    >
      {config.label}
    </span>
  );
}

function TaskTypeBadge({ taskType }: { taskType: Task["taskType"] }) {
  return (
    <span
      style={{
        background: "transparent",
        border: "1px solid #333333",
        color: "#777777",
        borderRadius: "4px",
        padding: "2px 8px",
        fontSize: "10px",
        fontWeight: 600,
      }}
    >
      {TASK_TYPE_BADGE_LABELS[taskType ?? "general"]}
    </span>
  );
}

export interface TaskDetailModalProps {
  task: Task;
  clubId: string;
  onClose: () => void;
  assigneeName: string;
  assigneeAvatarUrl?: string;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canComment: boolean;
  commenterName: string;
  userId?: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  linkedEventFallback?: string;
  isReviewMode?: boolean;
  onApproveReview?: () => void;
  onSendBackReview?: (note: string) => void;
  onRequestChangesReview?: (note: string) => void;
}

export default function TaskDetailModal({
  task,
  clubId,
  onClose,
  assigneeName,
  assigneeAvatarUrl,
  canEdit,
  canDelete,
  canChangeStatus,
  canComment,
  commenterName,
  userId,
  onEdit,
  onDelete,
  onStatusChange,
  linkedEventFallback,
  isReviewMode = false,
  onApproveReview,
  onSendBackReview,
  onRequestChangesReview,
}: TaskDetailModalProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const loaded = await fetchCommentsForTask(task.id);
    setComments(loaded);
    setLoadingComments(false);
  }, [task.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handleSendComment() {
    const content = draft.trim();
    if (!content || !userId || sending || !canComment) return;

    setSending(true);
    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: task.id,
        user_id: userId,
        content,
      })
      .select("id, task_id, user_id, content, created_at")
      .single();

    setSending(false);

    if (error || !data) {
      console.error("Failed to add comment:", error?.message);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const newComment: TaskComment = {
      id: data.id as string,
      taskId: data.task_id as string,
      userId: data.user_id as string,
      content: data.content as string,
      createdAt: (data.created_at as string) ?? new Date().toISOString(),
      authorName: (profile?.full_name as string) ?? commenterName,
      avatarUrl: (profile?.avatar_url as string) ?? undefined,
    };

    setComments((prev) => [...prev, newComment]);
    setDraft("");

    if (task.assignedTo && task.assignedTo !== userId) {
      void notifyUsers([
        {
          user_id: task.assignedTo,
          type: "task_assigned",
          message: `${commenterName} commented on "${task.title}"`,
          club_id: clubId,
          reference_id: task.id,
        },
      ]);
    }
  }

  const dueUrgency = getTaskDueUrgency(task.dueDate, task.status);
  const dueColor = taskDueDateColor(dueUrgency);
  const dueBadge = taskDueBadgeConfig(dueUrgency);
  const canMarkComplete =
    canChangeStatus &&
    !isReviewMode &&
    (task.status === "todo" || task.status === "in_progress");
  const canMoveToTodo =
    canChangeStatus &&
    !isReviewMode &&
    task.status !== "todo" &&
    task.status !== "done" &&
    task.status !== "pending_review";
  const completeLabel =
    userId && shouldSubmitTaskForReview(task, userId)
      ? "Submit for Review"
      : "Mark Complete";

  const metadataFooter = [
    task.createdAt
      ? `Created ${new Date(task.createdAt).toLocaleString()}`
      : null,
    task.completedAt
      ? `Completed ${new Date(task.completedAt).toLocaleString()}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
      onClick={onClose}
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
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "14px",
          maxWidth: "580px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "28px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "#555555",
            cursor: "pointer",
          }}
        >
          <X size={20} />
        </button>

        <div
          style={{
            paddingBottom: "16px",
            marginBottom: "20px",
            borderBottom: "1px solid #1e1e1e",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <StatusBadge status={task.status} />
            <PriorityPill priority={task.priority} />
            <TaskTypeBadge taskType={task.taskType} />
          </div>

          <h2
            id="task-detail-title"
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.25,
              paddingRight: "28px",
            }}
          >
            {task.title}
          </h2>
          <LinkedMeetingCancelledLabel task={task} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <SectionTitle>Assignment</SectionTitle>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px",
              background: "#111111",
              border: "1px solid #1e1e1e",
              borderRadius: "8px",
            }}
          >
            <AvatarCircle name={assigneeName} avatarUrl={assigneeAvatarUrl} size={36} />
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                {assigneeName}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#555555" }}>
                Assigned to
              </p>
            </div>
          </div>
          {task.creatorName ? (
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#555555" }}>
              Created by {task.creatorName}
            </p>
          ) : null}
        </div>

        <div style={{ marginBottom: "20px" }}>
          <SectionTitle>Timeline</SectionTitle>
          <div
            style={{
              padding: "14px 16px",
              background: dueUrgency ? "rgba(229, 25, 55, 0.06)" : "#111111",
              border: `1px solid ${dueUrgency === "overdue" ? ACCENT_RED : dueUrgency ? GOLD : "#1e1e1e"}`,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#555555" }}>Due date</p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: dueUrgency ? "18px" : "15px",
                  fontWeight: dueUrgency ? 800 : 600,
                  color: task.dueDate ? dueColor : "#555555",
                }}
              >
                {task.dueDate ? formatTaskDate(task.dueDate) : "No due date"}
              </p>
            </div>
            {dueBadge ? (
              <span style={dueBadge.style}>{dueBadge.label}</span>
            ) : dueUrgency === "due_soon" ? (
              <span
                style={{
                  background: "#1a1500",
                  border: "1px solid #FFC429",
                  color: "#FFC429",
                  borderRadius: "4px",
                  padding: "1px 6px",
                  fontSize: "9px",
                  fontWeight: 700,
                }}
              >
                DUE SOON
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <SectionTitle>Details</SectionTitle>
          {task.taskType === "event" && (task.linkedEventId || linkedEventFallback) ? (
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#777777" }}>
              Linked event: {task.linkedEventTitle ?? linkedEventFallback ?? "Event"}
            </p>
          ) : null}
          {task.taskType === "meeting" && task.linkedMeetingId ? (
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#777777" }}>
              Linked meeting: {task.linkedMeetingTitle ?? "Meeting"}
            </p>
          ) : null}
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#cccccc",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {task.description.trim() || "No description provided."}
          </p>
        </div>

        <div
          style={{
            marginBottom: "20px",
            paddingTop: "4px",
            borderTop: "1px solid #1e1e1e",
          }}
        >
          <SectionTitle>Comments ({comments.length})</SectionTitle>
          <div
            style={{
              background: "#0f0f0f",
              border: "1px solid #1e1e1e",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            {loadingComments ? (
              <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>Loading comments…</p>
            ) : comments.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "10px",
                    paddingBottom: "10px",
                    borderBottom: "1px solid #1a1a1a",
                  }}
                >
                  <AvatarCircle
                    name={comment.authorName}
                    avatarUrl={comment.avatarUrl}
                    size={28}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#cccccc" }}>
                        {comment.authorName}
                      </span>
                      <span style={{ fontSize: "11px", color: "#555555", marginLeft: "auto" }}>
                        {formatCommentTime(comment.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#aaaaaa" }}>
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))
            )}

            {canComment && userId ? (
              <div style={{ display: "flex", gap: "8px", marginTop: comments.length > 0 ? "12px" : 0 }}>
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleSendComment();
                  }}
                  placeholder="Add a comment…"
                  style={{
                    flex: 1,
                    background: "#0f0f0f",
                    border: "1px solid #2a2a2a",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    color: "#ffffff",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSendComment()}
                  disabled={sending || !draft.trim()}
                  style={{
                    ...secondaryButtonStyle,
                    padding: "8px 12px",
                    opacity: sending || !draft.trim() ? 0.6 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Send size={14} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            paddingTop: "16px",
            borderTop: "1px solid #1e1e1e",
          }}
        >
          <SectionTitle>Actions</SectionTitle>
          {isReviewMode ? (
            <div style={{ width: "100%" }}>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional note for send-back or change request…"
                rows={3}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "13px",
                  color: "#ffffff",
                  marginBottom: "10px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => onApproveReview?.()}
                  style={primaryButtonStyle}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onSendBackReview?.(reviewNote.trim())}
                  style={secondaryButtonStyle}
                >
                  Send Back
                </button>
                <button
                  type="button"
                  onClick={() => onRequestChangesReview?.(reviewNote.trim())}
                  style={secondaryButtonStyle}
                >
                  Request Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                {canMarkComplete ? (
                  <button
                    type="button"
                    onClick={() => onStatusChange("done")}
                    style={primaryButtonStyle}
                  >
                    {completeLabel}
                  </button>
                ) : null}
                {canMoveToTodo ? (
                  <button
                    type="button"
                    onClick={() => onStatusChange("todo")}
                    style={secondaryButtonStyle}
                  >
                    Move to To Do
                  </button>
                ) : null}
              </div>
              {(canEdit || canDelete) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    paddingTop: "8px",
                    borderTop: "1px solid #1a1a1a",
                  }}
                >
                  {canEdit ? (
                    <button type="button" onClick={onEdit} style={managementButtonStyle}>
                      Edit
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={onDelete}
                      style={{
                        ...managementButtonStyle,
                        borderColor: "rgba(229, 25, 55, 0.4)",
                        color: ACCENT_RED,
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        {metadataFooter ? (
          <p
            style={{
              margin: "16px 0 0",
              fontSize: "10px",
              color: "#444444",
              lineHeight: 1.5,
            }}
          >
            {metadataFooter}
          </p>
        ) : null}
      </div>
    </div>
  );
}
