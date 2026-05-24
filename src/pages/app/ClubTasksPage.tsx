import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubTasks } from "../../hooks/useClubTasks";
import { useClubMembers } from "../../hooks/useClubMembers";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole, Task, TaskStatus, TaskPriority } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";


const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done" };

const statusAccent: Record<TaskStatus, string> = {
  todo: "#747676",
  in_progress: "#FFC429",
  done: "#22c55e" };

function priorityBadgeStyle(priority: TaskPriority): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    textTransform: "capitalize" };
  if (priority === "high") {
    return {
      ...base,
      backgroundColor: "#2a0a0a",
      color: "#E51937",
      border: "1px solid #3a1a1a" };
  }
  if (priority === "low") {
    return {
      ...base,
      backgroundColor: "#111111",
      color: "#555555",
      border: "1px solid #222222" };
  }
  return {
    ...base,
    backgroundColor: "#2a1f00",
    color: "#FFC429",
    border: "1px solid #3a2f00" };
}

function statusBadgeStyle(status: TaskStatus): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px" };
  if (status === "todo") {
    return {
      ...base,
      backgroundColor: "#1a1a2a",
      color: "#6b7cff",
      border: "1px solid #2a2a3a" };
  }
  if (status === "in_progress") {
    return {
      ...base,
      backgroundColor: "#2a1f00",
      color: "#FFC429",
      border: "1px solid #3a2f00" };
  }
  return {
    ...base,
    backgroundColor: "#0d2b0d",
    color: "#4ade80",
    border: "1px solid #1a4a1a" };
}

function filterTabClass(isActive: boolean) {
  const base =
    "cursor-pointer rounded-md border px-[14px] py-1.5 text-[13px] transition-colors";
  if (isActive) {
    return `${base} border-[#E51937] bg-[#E51937] text-white`;
  }
  return `${base} border-[#222222] bg-[#1a1a1a] text-[#777777] hover:bg-[#242424] hover:text-[#cccccc]`;
}

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
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

function CommentAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: "28px",
          height: "28px",
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
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        background: "#2a2a2a",
        fontSize: "11px",
        color: "#cccccc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
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
        style={{ color: "#555555", fontSize: "12px" }}
      >
        <MessageSquare size={14} strokeWidth={2} aria-hidden />
        Comments
        <span style={{ fontSize: "12px", color: "#555555" }}>({commentCount})</span>
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
                <CommentAvatar
                  name={comment.authorName}
                  avatarUrl={comment.avatarUrl}
                />
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

export default function ClubTasksPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const {
    tasks,
    loading,
    error: loadError,
    createTask,
    updateTask,
    deleteTask } = useClubTasks(clubId);
  const { members } = useClubMembers(clubId);

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";

  useEffect(() => {
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

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  // Form state for create / edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>(
    {},
  );
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

  function toggleComments(taskId: string) {
    setExpandedComments((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssignedTo("");
    setDueDate("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setAssignedTo(task.assignedTo ?? "");
    setDueDate(task.dueDate ?? "");
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    setFeedback(null);

    let ok: boolean;
    if (editingId) {
      ok = await updateTask(editingId, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null });
    } else {
      ok = await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined });
    }

    setSaving(false);
    if (ok) {
      setFeedback({
        type: "success",
        text: editingId ? "Task updated." : "Task created." });
    } else {
      setFeedback({ type: "error", text: "Failed to save task." });
    }
    resetForm();
  }

  async function handleDelete(taskId: string) {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    setFeedback(null);
    const ok = await deleteTask(taskId);
    if (ok) {
      setFeedback({ type: "success", text: "Task deleted." });
    } else {
      setFeedback({ type: "error", text: "Failed to delete task." });
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    const ok = await updateTask(taskId, { status: newStatus });
    if (!ok) {
      setFeedback({ type: "error", text: "Failed to update status." });
    }
  }

  const filteredTasks =
    filter === "all"
      ? visibleTasks
      : visibleTasks.filter((t) => t.status === filter);

  const todoCt = visibleTasks.filter((t) => t.status === "todo").length;
  const inProgressCt = visibleTasks.filter((t) => t.status === "in_progress").length;
  const doneCt = visibleTasks.filter((t) => t.status === "done").length;

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff" }}
          >
            Tasks
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#555555" }}
          >
            {todoCt} to do · {inProgressCt} in progress · {doneCt} done
          </p>
        </div>
        {isPrivileged && (
          <Button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="!border-0 !bg-[#E51937] !px-[18px] !py-[9px] !text-[13px] !font-medium !text-white hover:!bg-[#cc0020]"
            style={{ borderRadius: "6px" }}
          >
            {showForm ? "Cancel" : "+ New Task"}
          </Button>
        )}
      </div>

      {/* Feedback message */}
      {feedback && (
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
      )}

      {/* Create / edit form — admin/exec only */}
      {showForm && isPrivileged && (
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
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="flex-1">
                <label
                  htmlFor="taskPriority"
                  className="mb-1 block text-sm font-medium text-white"
                >
                  Priority
                </label>
                <select
                  id="taskPriority"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as TaskPriority)
                  }
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex-1">
                <FormInput
                  id="taskDueDate"
                  label="Due Date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
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
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || saving}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save Changes"
                    : "Create Task"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "todo", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={filterTabClass(filter === s)}
            style={{ }}
          >
            {s === "all"
              ? `All (${visibleTasks.length})`
              : `${statusLabels[s]} (${visibleTasks.filter((t) => t.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 text-3xl">📋</div>
          <p className="font-medium text-white">
            {visibleTasks.length === 0
              ? "No tasks yet"
              : "No tasks match this filter"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {visibleTasks.length === 0
              ? isPrivileged
                ? "Create a task to get your team organized."
                : "You have no tasks assigned to you yet."
              : "Try a different filter to see more tasks."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isOverdue =
              task.dueDate &&
              task.status !== "done" &&
              new Date(task.dueDate) < new Date();
            const canChangeStatus =
              isPrivileged || task.assignedTo === user?.id;
            const canViewComments =
              isPrivileged || task.assignedTo === user?.id;
            const canComment =
              isPrivileged || task.assignedTo === user?.id;

            return (
              <div
                key={task.id}
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "8px",
                  padding: "16px",
                  borderLeft: `3px solid ${statusAccent[task.status]}` }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={task.status === "done" ? "line-through" : ""}
                        style={{
                          fontWeight: 500,
                          fontSize: "14px",
                          color: task.status === "done" ? "#555555" : "#ffffff" }}
                      >
                        {task.title}
                      </h3>
                      <span style={priorityBadgeStyle(task.priority)}>
                        {task.priority}
                      </span>
                      <span style={statusBadgeStyle(task.status)}>
                        {statusLabels[task.status]}
                      </span>
                    </div>
                    {task.description && (
                      <p
                        className="mt-1"
                        style={{
                          fontSize: "13px",
                          color: "#777777",
                          lineHeight: 1.5 }}
                      >
                        {task.description}
                      </p>
                    )}
                    <div
                      className="mt-2 flex flex-wrap items-center gap-3 text-xs"
                      style={{ color: "#555555" }}
                    >
                      {task.assigneeName && (
                        <span>👤 {task.assigneeName}</span>
                      )}
                      {task.dueDate && (
                        <span className={isOverdue ? "text-red-400" : ""}>
                          📅{" "}
                          {new Date(task.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric" })}
                          {isOverdue && " (overdue)"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canChangeStatus ? (
                      <select
                        value={task.status}
                        onChange={(e) =>
                          handleStatusChange(
                            task.id,
                            e.target.value as TaskStatus,
                          )
                        }
                        className="cursor-pointer rounded-md border"
                        style={{
                          backgroundColor: "#111111",
                          borderColor: "#333333",
                          color: "#cccccc",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "12px" }}
                        aria-label="Change task status"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    ) : null}
                    {isPrivileged && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(task)}
                          className="cursor-pointer rounded-md border bg-transparent transition-colors hover:text-[#cccccc]"
                          style={{
                            borderColor: "#333333",
                            color: "#888888",
                            padding: "5px 12px",
                            fontSize: "12px" }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="cursor-pointer rounded-md border bg-transparent transition-colors hover:bg-[#2a0a0a]"
                          style={{
                            borderColor: "#3a1a1a",
                            color: "#E51937",
                            padding: "5px 12px",
                            fontSize: "12px" }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {canViewComments ? (
                <TaskCommentsSection
                  taskId={task.id}
                  userId={user?.id}
                  expanded={!!expandedComments[task.id]}
                  onToggle={() => toggleComments(task.id)}
                  commentCount={commentCounts[task.id] ?? 0}
                  onCommentCountChange={handleCommentCountChange}
                  canComment={canComment}
                  canDeleteAnyComment={isPrivileged}
                />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
