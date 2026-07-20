import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, MoreHorizontal, Send, X } from "lucide-react";
import LinkedMeetingCancelledLabel from "./LinkedMeetingCancelledLabel";
import { useIsMobile } from "../../hooks/useWindowWidth";
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

type LinkedSource = {
  fieldLabel: string;
  value: string;
};

function resolveLinkedSource(
  task: Task,
  linkedEventFallback?: string,
): LinkedSource | null {
  if (task.linkedMeetingId) {
    return {
      fieldLabel: "Linked meeting",
      value: task.linkedMeetingTitle ?? "Meeting",
    };
  }
  if (task.taskType === "event" && (task.linkedEventId || linkedEventFallback)) {
    return {
      fieldLabel: "Linked event",
      value: task.linkedEventTitle ?? linkedEventFallback ?? "Event",
    };
  }
  if (task.linkedHiringListingId) {
    return {
      fieldLabel: "Linked role",
      value: task.linkedHiringTitle ?? "Open role",
    };
  }
  return null;
}

function resolveDisplayDescription(task: Task, linkedSource: LinkedSource | null): string | null {
  const description = task.description.trim();
  if (!description) return null;

  if (linkedSource?.fieldLabel === "Linked meeting") {
    const autoDescription = `From meeting: ${linkedSource.value}`;
    if (description === autoDescription) return null;
  }

  if (linkedSource?.fieldLabel === "Linked event") {
    const autoDescription = `From event: ${linkedSource.value}`;
    if (description === autoDescription) return null;
  }

  return description;
}

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
        margin: "0 0 8px",
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

function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: "10px",
          fontWeight: 700,
          color: "#8a8a8a",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <div style={{ fontSize: "13px", color: "#e0e0e0", lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

const primaryButtonStyle: CSSProperties = {
  background: GOLD,
  border: `1px solid ${GOLD}`,
  borderRadius: "6px",
  padding: "9px 18px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#0f0f0f",
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  borderRadius: "6px",
  padding: "9px 16px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#cccccc",
  cursor: "pointer",
  fontFamily: "inherit",
};

const dangerButtonStyle: CSSProperties = {
  background: "rgba(229, 25, 55, 0.08)",
  border: `1px solid ${ACCENT_RED}`,
  borderRadius: "6px",
  padding: "9px 16px",
  fontSize: "12px",
  fontWeight: 600,
  color: ACCENT_RED,
  cursor: "pointer",
  fontFamily: "inherit",
};

const backButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  background: "none",
  border: "none",
  color: "#777777",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  padding: 0,
  fontFamily: "inherit",
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
  clubName?: string;
  onClose: () => void;
  onBack?: () => void;
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
  /** @deprecated Prefer onRequestChangesReview — Send Back and Request Changes were duplicates. */
  onSendBackReview?: (note: string) => void;
  onRequestChangesReview?: (note: string) => void;
}

export default function TaskDetailModal({
  task,
  clubId,
  clubName,
  onClose,
  onBack,
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
  const isMobile = useIsMobile();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const handleBack = onBack ?? onClose;
  const handleRequestChanges = onRequestChangesReview ?? onSendBackReview;

  useEffect(() => {
    const scrollY = window.scrollY;
    const { style } = document.body;
    const previousOverflow = style.overflow;
    const previousPosition = style.position;
    const previousTop = style.top;
    const previousWidth = style.width;

    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";

    return () => {
      style.overflow = previousOverflow;
      style.position = previousPosition;
      style.top = previousTop;
      style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

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
  const linkedSource = resolveLinkedSource(task, linkedEventFallback);
  const displayDescription = resolveDisplayDescription(task, linkedSource);
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

  const contextLine = [
    clubName?.trim() || null,
    assigneeName?.trim() ? `Assigned to ${assigneeName.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
      onClick={handleBack}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "12px" : "24px",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "14px",
          maxWidth: isMobile ? "100%" : "920px",
          width: "100%",
          maxHeight: isMobile ? "92vh" : "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: isMobile ? "14px 16px 0" : "18px 22px 0",
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={handleBack} style={backButtonStyle}>
            <ArrowLeft size={16} aria-hidden />
            Back
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#555555",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "14px 16px 16px" : "16px 22px 20px",
          }}
        >
          <div
            style={{
              paddingBottom: "12px",
              marginBottom: "14px",
              borderBottom: "1px solid #1e1e1e",
            }}
          >
            <h2
              id="task-detail-title"
              style={{
                margin: 0,
                fontSize: isMobile ? "20px" : "22px",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.25,
              }}
            >
              {task.title}
            </h2>
            {contextLine ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "13px",
                  color: "#b0b0b0",
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                {contextLine}
              </p>
            ) : null}
            <LinkedMeetingCancelledLabel task={task} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.45fr) minmax(220px, 1fr)",
              gap: isMobile ? "16px" : "24px",
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              {displayDescription ? (
                <div style={{ marginBottom: "14px" }}>
                  <SectionTitle>Description</SectionTitle>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: "#d0d0d0",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {displayDescription}
                  </p>
                </div>
              ) : null}

              {linkedSource ? (
                <div style={{ marginBottom: "14px" }}>
                  <SectionTitle>{linkedSource.fieldLabel}</SectionTitle>
                  <p style={{ margin: 0, fontSize: "14px", color: "#d0d0d0", fontWeight: 500 }}>
                    {linkedSource.value}
                  </p>
                </div>
              ) : null}

              <div>
                <SectionTitle>Comments ({comments.length})</SectionTitle>
                <div
                  style={{
                    background: "#0f0f0f",
                    border: "1px solid #1e1e1e",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  {loadingComments ? (
                    <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
                      Loading comments…
                    </p>
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
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: comments.length > 0 ? "12px" : 0,
                      }}
                    >
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
            </div>

            <aside
              style={{
                minWidth: 0,
                background: isMobile ? "transparent" : "#111111",
                border: isMobile ? "none" : "1px solid #1e1e1e",
                borderRadius: isMobile ? 0 : "10px",
                padding: isMobile ? 0 : "14px 16px",
              }}
            >
              <MetaField label="Assignee">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <AvatarCircle name={assigneeName} avatarUrl={assigneeAvatarUrl} size={28} />
                  <span style={{ fontWeight: 600, color: "#ffffff" }}>{assigneeName}</span>
                </div>
              </MetaField>

              {task.creatorName ? (
                <MetaField label="Created by">{task.creatorName}</MetaField>
              ) : null}

              <MetaField label="Due date">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: dueUrgency ? "16px" : "14px",
                      fontWeight: dueUrgency ? 800 : 600,
                      color: task.dueDate ? dueColor : "#888888",
                    }}
                  >
                    {task.dueDate ? formatTaskDate(task.dueDate) : "No due date"}
                  </span>
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
              </MetaField>

              <MetaField label="Status">
                <StatusBadge status={task.status} />
              </MetaField>

              <MetaField label="Priority">
                <PriorityPill priority={task.priority} />
              </MetaField>

              <MetaField label="Type">
                <TaskTypeBadge taskType={task.taskType} />
              </MetaField>

              {task.createdAt ? (
                <MetaField label="Created">
                  {new Date(task.createdAt).toLocaleString()}
                </MetaField>
              ) : null}

              {task.completedAt ? (
                <MetaField label="Completed">
                  {new Date(task.completedAt).toLocaleString()}
                </MetaField>
              ) : null}

              {linkedSource ? (
                <MetaField label="Source">{linkedSource.value}</MetaField>
              ) : null}
            </aside>
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid #1e1e1e",
            background: "#121212",
            padding: isMobile ? "12px 16px 16px" : "14px 22px 18px",
          }}
        >
          {isReviewMode ? (
            <div style={{ width: "100%" }}>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Add a note explaining what needs to change…"
                rows={2}
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
                  Approve Task
                </button>
                {handleRequestChanges ? (
                  <button
                    type="button"
                    onClick={() => handleRequestChanges(reviewNote.trim())}
                    style={secondaryButtonStyle}
                  >
                    Request Task Changes
                  </button>
                ) : null}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#888888", lineHeight: 1.4 }}>
                Request Changes returns the task to In Progress with your note.
              </p>
            </div>
          ) : confirmingDelete ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#dddddd" }}>
                Delete this task permanently?
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  style={secondaryButtonStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete();
                  }}
                  style={dangerButtonStyle}
                >
                  Delete Task
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                position: "relative",
              }}
            >
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
              {canEdit ? (
                <button type="button" onClick={onEdit} style={secondaryButtonStyle}>
                  Edit Task
                </button>
              ) : null}
              {canDelete ? (
                <div style={{ position: "relative", marginLeft: "auto" }}>
                  <button
                    type="button"
                    aria-label="More actions"
                    onClick={() => setOverflowOpen((value) => !value)}
                    style={{
                      ...secondaryButtonStyle,
                      padding: "9px 10px",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <MoreHorizontal size={16} aria-hidden />
                  </button>
                  {overflowOpen ? (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        bottom: "calc(100% + 6px)",
                        background: "#161616",
                        border: "1px solid #2a2a2a",
                        borderRadius: "8px",
                        padding: "6px",
                        minWidth: "150px",
                        zIndex: 2,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOverflowOpen(false);
                          setConfirmingDelete(true);
                        }}
                        style={{
                          ...dangerButtonStyle,
                          width: "100%",
                          textAlign: "left",
                        }}
                      >
                        Delete Task
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
