import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { MessageSquare, MoreHorizontal, Send, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubTasks } from "../../hooks/useClubTasks";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import {
  formatTaskDate,
  getTaskDueUrgency,
  taskDueDateColor,
} from "../../lib/taskDueUrgency";
import type { MemberRole, Task, TaskStatus, TaskPriority } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const statusAccent: Record<TaskStatus, string> = {
  todo: "#747676",
  in_progress: "#FFC429",
  done: "#E51937",
};

const BOARD_COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

const columnEmptyMessage: Record<TaskStatus, string> = {
  todo: "No tasks to do",
  in_progress: "Nothing in progress",
  done: "No completed tasks yet",
};

type ViewMode = "board" | "list";

const viewModeLabels: Record<ViewMode, string> = {
  board: "Board",
  list: "List",
};

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

const highImportanceBadgeStyle: CSSProperties = {
  background: "#1a0505",
  border: "1px solid #E51937",
  color: "#E51937",
  borderRadius: "20px",
  padding: "2px 8px",
  fontSize: "10px",
  fontWeight: 700,
  flexShrink: 0,
  lineHeight: 1.2,
};

function HighImportanceBadge() {
  return <span style={highImportanceBadgeStyle}>!</span>;
}

function deriveAbbreviation(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function statusBadgeStyle(status: TaskStatus): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    flexShrink: 0,
  };
  if (status === "todo") {
    return { ...base, backgroundColor: "#1a1a1a", color: "#747676", border: "1px solid #2a2a2a" };
  }
  if (status === "in_progress") {
    return { ...base, backgroundColor: "#2a1f00", color: "#FFC429", border: "1px solid #3a2f00" };
  }
  return { ...base, backgroundColor: "#2a1518", color: "#E51937", border: "1px solid #3a1a1a" };
}

function nextStatus(status: TaskStatus): TaskStatus | null {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
  return null;
}

function prevStatus(status: TaskStatus): TaskStatus | null {
  if (status === "in_progress") return "todo";
  if (status === "done") return "in_progress";
  return null;
}

const kanbanForwardButtonStyle: CSSProperties = {
  fontSize: "11px",
  borderRadius: "20px",
  padding: "4px 10px",
  background: "#E51937",
  color: "#ffffff",
  border: "none",
  cursor: "pointer",
};

const kanbanBackButtonStyle: CSSProperties = {
  fontSize: "11px",
  borderRadius: "20px",
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid #333333",
  color: "#777777",
  cursor: "pointer",
};

function kanbanForwardLabel(status: TaskStatus): string | null {
  if (status === "todo") return "Start Task →";
  if (status === "in_progress") return "Mark Done →";
  return null;
}

function kanbanBackLabel(status: TaskStatus): string | null {
  if (status === "in_progress") return "← Back to To Do";
  if (status === "done") return "← Back to In Progress";
  return null;
}

function listQuickActionLabel(status: TaskStatus): string | null {
  if (status === "todo") return "Mark In Progress";
  if (status === "in_progress") return "Mark Done";
  return null;
}

function dueDateColor(dueDate: string | undefined, status: TaskStatus): string {
  return taskDueDateColor(getTaskDueUrgency(dueDate, status));
}

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

function ClubLogoMark({
  name,
  abbreviation,
  logoUrl,
  size = 32,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  size?: number;
}) {
  const abbr = abbreviation?.trim() || deriveAbbreviation(name);
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "6px",
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
        borderRadius: "6px",
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: "11px",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {abbr}
    </div>
  );
}

function TaskCommentsSection({
  taskId,
  userId,
  expanded,
  onToggle,
  commentCount,
  onCommentCountChange,
  canComment,
  canDeleteAnyComment,
}: {
  taskId: string;
  userId?: string;
  expanded: boolean;
  onToggle: () => void;
  commentCount: number;
  onCommentCountChange: (taskId: string, count: number) => void;
  canComment: boolean;
  canDeleteAnyComment: boolean;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const loaded = await fetchCommentsForTask(taskId);
    setComments(loaded);
    onCommentCountChange(taskId, loaded.length);
    setLoadingComments(false);
  }, [taskId, onCommentCountChange]);

  useEffect(() => {
    if (!expanded) return;
    void loadComments();
  }, [expanded, loadComments]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || !userId || sending || !canComment) return;

    setSending(true);
    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
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
      authorName: (profile?.full_name as string) ?? "Member",
      avatarUrl: (profile?.avatar_url as string) ?? undefined,
    };

    setComments((prev) => {
      const next = [...prev, newComment];
      onCommentCountChange(taskId, next.length);
      return next;
    });
    setDraft("");
  }

  async function handleDelete(commentId: string) {
    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error("Failed to delete comment:", error.message);
      return;
    }

    setComments((prev) => {
      const next = prev.filter((comment) => comment.id !== commentId);
      onCommentCountChange(taskId, next.length);
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="mt-3 flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 transition-colors hover:text-[#888888]"
        style={{ color: "#555555", fontSize: "11px" }}
      >
        <MessageSquare size={12} strokeWidth={2} aria-hidden />
        {commentCount}
      </button>

      {expanded ? (
        <div
          style={{
            background: "#111111",
            borderTop: "1px solid #1e1e1e",
            padding: "12px 16px",
            marginTop: "12px",
            marginLeft: "-16px",
            marginRight: "-16px",
            marginBottom: "-16px",
            borderBottomLeftRadius: "8px",
            borderBottomRightRadius: "8px",
          }}
        >
          {loadingComments ? (
            <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
              Loading comments…
            </p>
          ) : comments.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
              No comments yet.
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <AvatarCircle name={comment.authorName} avatarUrl={comment.avatarUrl} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#cccccc",
                      }}
                    >
                      {comment.authorName}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#555555",
                        marginLeft: "auto",
                      }}
                    >
                      {formatCommentTime(comment.createdAt)}
                    </span>
                    {canDeleteAnyComment || comment.userId === userId ? (
                      <button
                        type="button"
                        title="Delete comment"
                        aria-label="Delete comment"
                        onClick={() => handleDelete(comment.id)}
                        onMouseEnter={() => setHoveredDeleteId(comment.id)}
                        onMouseLeave={() => setHoveredDeleteId(null)}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color:
                            hoveredDeleteId === comment.id ? "#E51937" : "#555555",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <X size={14} strokeWidth={2} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#aaaaaa",
                      marginTop: "2px",
                      marginBottom: 0,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {comment.content}
                  </p>
                </div>
              </div>
            ))
          )}

          {canComment ? (
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                marginTop: "8px",
              }}
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Add a comment..."
                disabled={!userId || sending}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "20px",
                  padding: "8px 14px",
                  color: "#ffffff",
                  fontSize: "13px",
                  flex: 1,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!draft.trim() || !userId || sending}
                title="Send comment"
                aria-label="Send comment"
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor:
                    !draft.trim() || !userId || sending ? "not-allowed" : "pointer",
                  opacity: !draft.trim() || !userId || sending ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                <Send size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Task view"
      style={{ display: "flex", gap: "6px" }}
    >
      {(["board", "list"] as const).map((option) => {
        const active = mode === option;
        const label = viewModeLabels[option];
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            aria-label={`${label} view`}
            style={{
              background: active ? "#E51937" : "#1a1a1a",
              color: active ? "#ffffff" : "#777777",
              border: active ? "none" : "1px solid #333333",
              borderRadius: "6px",
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function ClubTasksPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getClubById } = useClubContext();
  const {
    tasks,
    loading,
    error: loadError,
    createTask,
    updateTask,
    deleteTask,
  } = useClubTasks(clubId);
  const { members } = useClubMembers(clubId);

  const club = clubId ? getClubById(clubId) : undefined;
  const isMobile = useIsMobile();

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";

  useEffect(() => {
    const previewRole = localStorage.getItem("previewRole");
    if (previewRole) {
      setUserRole(previewRole as MemberRole);
      return;
    }
    const fetchRole = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (data?.role) {
        setUserRole(normalizeUserRole(data.role));
      }
    };
    fetchRole();
  }, [clubId, user?.id]);

  const visibleTasks = useMemo(() => {
    if (isPrivileged) return tasks;
    return tasks.filter((t) => t.assignedTo === user?.id);
  }, [tasks, isPrivileged, user?.id]);

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [statusAnimatingId, setStatusAnimatingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [highImportance, setHighImportance] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const handleCommentCountChange = useCallback((taskId: string, count: number) => {
    setCommentCounts((prev) => ({ ...prev, [taskId]: count }));
  }, []);

  useEffect(() => {
    if (visibleTasks.length === 0) {
      setCommentCounts({});
      return;
    }

    let cancelled = false;
    const taskIds = visibleTasks.map((task) => task.id);

    supabase
      .from("task_comments")
      .select("task_id")
      .in("task_id", taskIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load comment counts:", error.message);
          return;
        }
        const counts: Record<string, number> = {};
        taskIds.forEach((id) => {
          counts[id] = 0;
        });
        (data ?? []).forEach((row) => {
          const taskId = row.task_id as string;
          counts[taskId] = (counts[taskId] ?? 0) + 1;
        });
        setCommentCounts(counts);
      });

    return () => {
      cancelled = true;
    };
  }, [visibleTasks]);

  const todoCt = visibleTasks.filter((t) => t.status === "todo").length;
  const inProgressCt = visibleTasks.filter((t) => t.status === "in_progress").length;
  const doneCt = visibleTasks.filter((t) => t.status === "done").length;
  const totalCount = visibleTasks.length;
  const progressFillPercent =
    totalCount === 0 ? 0 : (doneCt / totalCount) * 100;

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of visibleTasks) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [visibleTasks]);

  const activeListTasks = useMemo(
    () =>
      visibleTasks.filter((t) => t.status === "todo" || t.status === "in_progress"),
    [visibleTasks],
  );
  const completedListTasks = useMemo(
    () => visibleTasks.filter((t) => t.status === "done"),
    [visibleTasks],
  );

  const delegatedByAssignee = useMemo(() => {
    if (!isPrivileged || !user?.id) return [];

    const delegated = tasks.filter(
      (t) =>
        t.createdBy === user.id &&
        t.assignedTo &&
        t.assignedTo !== user.id,
    );

    const byAssignee = new Map<string, Task[]>();
    for (const task of delegated) {
      const assigneeId = task.assignedTo as string;
      const existing = byAssignee.get(assigneeId) ?? [];
      existing.push(task);
      byAssignee.set(assigneeId, existing);
    }

    return [...byAssignee.entries()]
      .map(([assigneeId, assigneeTasks]) => {
        const done = assigneeTasks.filter((t) => t.status === "done").length;
        const total = assigneeTasks.length;
        const member = members.find((m) => m.userId === assigneeId);
        const name =
          assigneeTasks[0]?.assigneeName ??
          member?.fullName ??
          member?.email ??
          "Unknown";
        const avatarUrl =
          assigneeTasks[0]?.assigneeAvatar ?? member?.avatarUrl;

        return {
          assigneeId,
          name,
          avatarUrl,
          tasks: assigneeTasks,
          done,
          total,
          allDone: total > 0 && done === total,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, isPrivileged, user?.id, members]);

  function toggleComments(taskId: string) {
    setExpandedComments((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setHighImportance(false);
    setAssignedTo("");
    setDueDate("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setHighImportance(task.priority === "high");
    setAssignedTo(task.assignedTo ?? "");
    setDueDate(task.dueDate ?? "");
    setShowForm(true);
    setOpenMenuTaskId(null);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    setFeedback(null);

    const priority: TaskPriority = highImportance ? "high" : "medium";

    let ok: boolean;
    if (editingId) {
      ok = await updateTask(editingId, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
      });
    } else {
      ok = await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined,
      });
    }

    setSaving(false);
    if (ok) {
      setFeedback({
        type: "success",
        text: editingId ? "Task updated." : "Task created.",
      });
    } else {
      setFeedback({ type: "error", text: "Failed to save task." });
    }
    resetForm();
  }

  async function handleDelete(taskId: string) {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    setFeedback(null);
    setOpenMenuTaskId(null);
    const ok = await deleteTask(taskId);
    if (ok) {
      setFeedback({ type: "success", text: "Task deleted." });
    } else {
      setFeedback({ type: "error", text: "Failed to delete task." });
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setStatusAnimatingId(taskId);
    const ok = await updateTask(taskId, { status: newStatus });
    window.setTimeout(() => setStatusAnimatingId(null), 280);
    if (!ok) {
      setFeedback({ type: "error", text: "Failed to update status." });
    }
  }

  function assigneeAvatarFor(task: Task): string | undefined {
    if (task.assigneeAvatar) return task.assigneeAvatar;
    const member = members.find((m) => m.userId === task.assignedTo);
    return member?.avatarUrl;
  }

  function renderTaskMenu(task: Task) {
    if (!isPrivileged) return null;
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          aria-label="Task options"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuTaskId((prev) => (prev === task.id ? null : task.id));
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#555555",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
          }}
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
        {openMenuTaskId === task.id ? (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              marginTop: "4px",
              background: "#151515",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              minWidth: "120px",
              zIndex: 20,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startEdit(task);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "#cccccc",
                padding: "9px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(task.id);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "#E51937",
                padding: "9px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderDelegatedTaskCard(task: Task) {
    return (
      <div
        key={task.id}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderLeft: `3px solid ${statusAccent[task.status]}`,
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {task.title}
          </span>
          {task.priority === "high" ? <HighImportanceBadge /> : null}
        </span>
        <span style={statusBadgeStyle(task.status)}>{statusLabels[task.status]}</span>
      </div>
    );
  }

  function renderBoardCard(task: Task) {
    const isDone = task.status === "done";
    const isHovered = hoveredTaskId === task.id;
    const canChangeStatus = isPrivileged || task.assignedTo === user?.id;
    const canViewComments = isPrivileged || task.assignedTo === user?.id;
    const canComment = isPrivileged || task.assignedTo === user?.id;
    const backTarget = prevStatus(task.status);
    const forwardTarget = nextStatus(task.status);
    const backLabel = kanbanBackLabel(task.status);
    const forwardLabel = kanbanForwardLabel(task.status);
    const assigneeName = task.assigneeName ?? "Unassigned";
    const commentCount = commentCounts[task.id] ?? 0;
    const isAnimating = statusAnimatingId === task.id;

    return (
      <div
        key={`${task.id}-${task.status}`}
        onMouseEnter={() => setHoveredTaskId(task.id)}
        onMouseLeave={() => {
          setHoveredTaskId((prev) => (prev === task.id ? null : prev));
          if (openMenuTaskId === task.id) setOpenMenuTaskId(null);
        }}
        style={{
          background: "#1a1a1a",
          border: `1px solid ${isHovered ? "#333333" : "#242424"}`,
          borderLeft: `3px solid ${statusAccent[task.status]}`,
          borderRadius: "8px",
          padding: "14px 16px",
          marginBottom: "8px",
          cursor: "pointer",
          opacity: isAnimating ? 0.5 : 1,
          transform: isHovered ? "translateY(-1px)" : undefined,
          transition: "border-color 0.15s ease, transform 0.15s ease, opacity 0.2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flex: 1,
              minWidth: 0,
            }}
          >
            <p
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#ffffff",
                textDecoration: isDone ? "line-through" : "none",
                margin: 0,
                minWidth: 0,
              }}
            >
              {task.title}
            </p>
            {task.priority === "high" ? <HighImportanceBadge /> : null}
          </div>
          {isHovered ? renderTaskMenu(task) : null}
        </div>

        {task.description ? (
          <p
            style={{
              fontSize: "12px",
              color: "#555555",
              margin: "6px 0 0",
              lineHeight: 1.4,
            }}
          >
            {task.description}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "10px",
          }}
        >
          <AvatarCircle
            name={assigneeName}
            avatarUrl={assigneeAvatarFor(task)}
            size={20}
          />
          <span style={{ fontSize: "12px", color: "#555555" }}>
            {task.assignedTo ? (
              <Link
                to={`/app/profile/${task.assignedTo}`}
                style={{ color: "#555555", textDecoration: "none" }}
                onClick={(e) => e.stopPropagation()}
              >
                {assigneeName}
              </Link>
            ) : (
              assigneeName
            )}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "8px",
            gap: "8px",
          }}
        >
          {task.dueDate ? (
            <span
              style={{
                fontSize: "11px",
                color: dueDateColor(task.dueDate, task.status),
              }}
            >
              Due {formatTaskDate(task.dueDate)}
            </span>
          ) : (
            <span />
          )}
          {canViewComments ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleComments(task.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "#555555",
                fontSize: "11px",
              }}
            >
              <MessageSquare size={12} strokeWidth={2} aria-hidden />
              {commentCount}
            </button>
          ) : null}
        </div>

        {isHovered && canChangeStatus && (backTarget || forwardTarget) ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "10px",
            }}
          >
            {backTarget && backLabel ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleStatusChange(task.id, backTarget);
                }}
                style={kanbanBackButtonStyle}
              >
                {backLabel}
              </button>
            ) : null}
            {forwardTarget && forwardLabel ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleStatusChange(task.id, forwardTarget);
                }}
                style={kanbanForwardButtonStyle}
              >
                {forwardLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        {canViewComments && expandedComments[task.id] ? (
          <div onClick={(e) => e.stopPropagation()}>
            <TaskCommentsSection
              taskId={task.id}
              userId={user?.id}
              expanded
              onToggle={() => toggleComments(task.id)}
              commentCount={commentCount}
              onCommentCountChange={handleCommentCountChange}
              canComment={canComment}
              canDeleteAnyComment={isPrivileged}
            />
          </div>
        ) : null}
      </div>
    );
  }

  function renderListCard(task: Task, completed = false) {
    const isHovered = hoveredTaskId === task.id;
    const canChangeStatus = isPrivileged || task.assignedTo === user?.id;
    const canViewComments = isPrivileged || task.assignedTo === user?.id;
    const canComment = isPrivileged || task.assignedTo === user?.id;
    const next = nextStatus(task.status);
    const assigneeName = task.assigneeName ?? "Unassigned";
    const commentCount = commentCounts[task.id] ?? 0;
    const listAction = listQuickActionLabel(task.status);

    return (
      <div
        key={task.id}
        onMouseEnter={() => setHoveredTaskId(task.id)}
        onMouseLeave={() => {
          setHoveredTaskId((prev) => (prev === task.id ? null : prev));
          if (openMenuTaskId === task.id) setOpenMenuTaskId(null);
        }}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "14px",
          background: "#1a1a1a",
          borderTop: `1px solid ${isHovered ? "#333333" : "#242424"}`,
          borderRight: `1px solid ${isHovered ? "#333333" : "#242424"}`,
          borderBottom: `1px solid ${isHovered ? "#333333" : "#242424"}`,
          borderLeft: `4px solid ${statusAccent[task.status]}`,
          borderRadius: "8px",
          padding: "14px 16px 14px 14px",
          marginBottom: "8px",
          opacity: completed ? 0.75 : 1,
          transform: isHovered ? "translateY(-1px)" : undefined,
          transition: "all 0.15s ease",
        }}
      >
        {club ? (
          <ClubLogoMark
            name={club.name}
            abbreviation={club.abbreviation}
            logoUrl={club.imageUrl}
            size={32}
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              margin: "0 0 6px",
            }}
          >
            <p
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: completed ? "#777777" : "#ffffff",
                margin: 0,
                textDecoration: completed ? "line-through" : "none",
              }}
            >
              {task.title}
            </p>
            {task.priority === "high" ? <HighImportanceBadge /> : null}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            <AvatarCircle
              name={assigneeName}
              avatarUrl={assigneeAvatarFor(task)}
              size={20}
            />
            <span style={{ fontSize: "12px", color: "#555555" }}>
              {task.assignedTo ? (
                <Link
                  to={`/app/profile/${task.assignedTo}`}
                  style={{ color: "#555555", textDecoration: "none" }}
                >
                  {assigneeName}
                </Link>
              ) : (
                assigneeName
              )}
            </span>
            {task.dueDate ? (
              <span
                style={{
                  fontSize: "12px",
                  color: dueDateColor(task.dueDate, task.status),
                }}
              >
                · Due {formatTaskDate(task.dueDate)}
              </span>
            ) : null}
            {canViewComments ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#555555",
                }}
              >
                · <MessageSquare size={11} strokeWidth={2} aria-hidden /> {commentCount}
              </span>
            ) : null}
          </div>
          {canViewComments ? (
            <TaskCommentsSection
              taskId={task.id}
              userId={user?.id}
              expanded={!!expandedComments[task.id]}
              onToggle={() => toggleComments(task.id)}
              commentCount={commentCount}
              onCommentCountChange={handleCommentCountChange}
              canComment={canComment}
              canDeleteAnyComment={isPrivileged}
            />
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={statusBadgeStyle(task.status)}>{statusLabels[task.status]}</span>
            {isHovered ? renderTaskMenu(task) : null}
          </div>
          {canChangeStatus && listAction && !completed ? (
            <button
              type="button"
              onClick={() => {
                const target = next;
                if (target) void handleStatusChange(task.id, target);
              }}
              style={{
                background: "transparent",
                border: "1px solid #E51937",
                borderRadius: "20px",
                padding: "5px 12px",
                fontSize: "11px",
                color: "#E51937",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {listAction}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading tasks…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-sm text-red-400">
            Failed to load tasks. Please try again.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Tasks
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#555555",
              margin: "6px 0 10px",
            }}
          >
            {todoCt} to do · {inProgressCt} in progress · {doneCt} done
          </p>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: "#1e1e1e",
              overflow: "hidden",
              maxWidth: "320px",
            }}
          >
            {progressFillPercent > 0 ? (
              <div
                style={{
                  height: "100%",
                  width: `${progressFillPercent}%`,
                  minWidth: 0,
                  maxWidth: "100%",
                  background: "#E51937",
                  borderRadius: "2px",
                  transition: "width 0.25s ease",
                }}
              />
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          {isPrivileged ? (
            <button
              type="button"
              onClick={() => {
                if (showForm) resetForm();
                else setShowForm(true);
              }}
              style={{
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "9px 18px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {showForm ? "Cancel" : "+ New Task"}
            </button>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {showForm && isPrivileged ? (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 font-semibold text-white">
            {editingId ? "Edit Task" : "Create New Task"}
          </h3>
          <div className="space-y-3">
            <FormInput
              id="taskTitle"
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Update club website"
              required
            />
            <div>
              <label
                htmlFor="taskDesc"
                className="mb-1 block text-sm font-medium text-white"
              >
                Description
              </label>
              <textarea
                id="taskDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Add details…"
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
              />
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={highImportance}
                onClick={() => setHighImportance((prev) => !prev)}
                style={{
                  width: "40px",
                  height: "22px",
                  borderRadius: "11px",
                  border: "none",
                  background: highImportance ? "#E51937" : "#333333",
                  position: "relative",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "background 0.15s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: highImportance ? "21px" : "3px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    transition: "left 0.15s ease",
                  }}
                />
              </button>
              <span style={{ fontSize: "13px", color: "#cccccc" }}>
                High Importance
              </span>
            </label>
            <FormInput
              id="taskDueDate"
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <div>
              <label
                htmlFor="taskAssignee"
                className="mb-1 block text-sm font-medium text-white"
              >
                Assigned To
              </label>
              <select
                id="taskAssignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName ?? m.email ?? "Unknown"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              {editingId ? (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel Edit
                </Button>
              ) : null}
              <Button onClick={handleSubmit} disabled={!title.trim() || saving}>
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save Changes"
                    : "Create Task"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {visibleTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 text-3xl">📋</div>
          <p className="font-medium text-white">No tasks yet</p>
          <p className="mt-1 text-sm text-muted">
            {isPrivileged
              ? "Create a task to get your team organized."
              : "You have no tasks assigned to you yet."}
          </p>
        </Card>
      ) : viewMode === "board" ? (
        <div
          style={
            isMobile
              ? {
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  paddingBottom: "8px",
                  WebkitOverflowScrolling: "touch",
                }
              : {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "12px",
                  alignItems: "stretch",
                }
          }
        >
          {BOARD_COLUMNS.map((columnStatus) => (
            <div
              key={columnStatus}
              style={{
                background: "#111111",
                borderRadius: "10px",
                padding: "12px",
                minHeight: isMobile ? "calc(100vh - 280px)" : "calc(100vh - 280px)",
                display: "flex",
                flexDirection: "column",
                ...(isMobile
                  ? {
                      minWidth: "260px",
                      flexShrink: 0,
                      width: "260px",
                    }
                  : {}),
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: statusAccent[columnStatus],
                  }}
                >
                  {statusLabels[columnStatus]}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#555555",
                    background: "#1a1a1a",
                    borderRadius: "20px",
                    padding: "2px 8px",
                  }}
                >
                  {tasksByStatus[columnStatus].length}
                </span>
              </div>
              {tasksByStatus[columnStatus].length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "24px 12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#444444",
                      margin: 0,
                    }}
                  >
                    {columnEmptyMessage[columnStatus]}
                  </p>
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  {tasksByStatus[columnStatus].map((task) => renderBoardCard(task))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div>
          {(["todo", "in_progress"] as const).map((sectionStatus) => {
            const sectionTasks = activeListTasks.filter(
              (t) => t.status === sectionStatus,
            );
            if (sectionTasks.length === 0) return null;
            return (
              <div key={sectionStatus} style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: statusAccent[sectionStatus],
                    margin: "0 0 10px",
                  }}
                >
                  {statusLabels[sectionStatus]}
                </p>
                {sectionTasks.map((task) => renderListCard(task))}
              </div>
            );
          })}

          {completedListTasks.length > 0 ? (
            <div style={{ marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setShowCompleted((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#555555",
                  fontSize: "13px",
                  cursor: "pointer",
                  padding: "0 0 12px",
                }}
              >
                {showCompleted
                  ? "Hide completed tasks"
                  : `Show ${completedListTasks.length} completed task${completedListTasks.length === 1 ? "" : "s"}`}
              </button>
              {showCompleted
                ? completedListTasks.map((task) => renderListCard(task, true))
                : null}
            </div>
          ) : null}
        </div>
      )}

      {isPrivileged ? (
        <section
          aria-labelledby="team-tasks-heading"
          style={{ marginTop: "40px" }}
        >
          <h2
            id="team-tasks-heading"
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
            }}
          >
            Team Tasks
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "#555555",
              margin: "6px 0 16px",
            }}
          >
            Track progress on tasks you&apos;ve assigned
          </p>

          {delegatedByAssignee.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
              You haven&apos;t delegated any tasks yet.
            </p>
          ) : (
            delegatedByAssignee.map((group) => {
              const progressPercent =
                group.total === 0 ? 0 : (group.done / group.total) * 100;

              return (
                <div key={group.assigneeId} style={{ marginBottom: "24px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      marginBottom: "10px",
                    }}
                  >
                    <AvatarCircle
                      name={group.name}
                      avatarUrl={group.avatarUrl}
                      size={32}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                          marginBottom: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#ffffff",
                          }}
                        >
                          {group.name}
                        </span>
                        {group.allDone ? (
                          <span
                            style={{
                              background: "#2a1f00",
                              color: "#FFC429",
                              border: "1px solid #3a2f00",
                              borderRadius: "20px",
                              padding: "2px 8px",
                              fontSize: "11px",
                              fontWeight: 500,
                            }}
                          >
                            ✓ All done
                          </span>
                        ) : null}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: "4px",
                            borderRadius: "2px",
                            background: "#1e1e1e",
                            overflow: "hidden",
                            minWidth: "80px",
                          }}
                        >
                          {progressPercent > 0 ? (
                            <div
                              style={{
                                height: "100%",
                                width: `${progressPercent}%`,
                                background: "#E51937",
                                borderRadius: "2px",
                              }}
                            />
                          ) : null}
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#555555",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {group.done}/{group.total} tasks
                        </span>
                      </div>
                    </div>
                  </div>
                  {group.tasks.map((task) => renderDelegatedTaskCard(task))}
                </div>
              );
            })
          )}
        </section>
      ) : null}
    </div>
  );
}
