import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MessageSquare,
  MoreHorizontal,
  Send,
  X,
  Calendar,
  User,
  Circle,
  CheckCircle,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubTasks } from "../../hooks/useClubTasks";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import { notifyUsers } from "../../lib/notifyUsers";
import { formatNameWithRoleTitle } from "../../lib/memberRoleTitle";
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
import TemplatePickerModal from "../../components/club/TemplatePickerModal";

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const boardColumnHeaderColor: Record<TaskStatus, string> = {
  todo: "#777777",
  in_progress: "#FFC429",
  done: "#777777",
};

const BOARD_COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

type ViewMode = "board" | "list";

type TaskFilterChip =
  | "all"
  | "assigned_to_me"
  | "assigned_by_me"
  | "overdue"
  | "high_priority"
  | "completed";

const privilegedFilterChips: { id: TaskFilterChip; label: string }[] = [
  { id: "all", label: "All Tasks" },
  { id: "assigned_to_me", label: "Assigned to Me" },
  { id: "assigned_by_me", label: "Assigned by Me" },
  { id: "overdue", label: "Overdue" },
  { id: "high_priority", label: "High Priority" },
  { id: "completed", label: "Completed" },
];

const memberFilterChips: { id: TaskFilterChip; label: string }[] = [
  { id: "all", label: "All Tasks" },
  { id: "overdue", label: "Overdue" },
  { id: "high_priority", label: "High Priority" },
  { id: "completed", label: "Completed" },
];

const viewModeLabels: Record<ViewMode, string> = {
  board: "Board",
  list: "List",
};

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function PriorityPill({
  priority,
  muted = false,
}: {
  priority: TaskPriority;
  muted?: boolean;
}) {
  const config: Record<
    TaskPriority,
    { border: string; color: string; label: string }
  > = {
    high: { border: "#E51937", color: "#E51937", label: "High Priority" },
    medium: { border: "#FFC429", color: "#FFC429", label: "Medium Priority" },
    low: { border: "#555", color: "#555", label: "Low Priority" },
  };
  const { border, color, label } = muted
    ? { border: "#555", color: "#555", label: config[priority].label }
    : config[priority];
  return (
    <span
      style={{
        background: "transparent",
        border: `1px solid ${border}`,
        color,
        borderRadius: "4px",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 500,
        flexShrink: 0,
        lineHeight: 1.2,
      }}
    >
      {label}
    </span>
  );
}

function listRowLeftBorder(status: TaskStatus): string {
  if (status === "in_progress") return "#FFC429";
  if (status === "done") return "#2a2a2a";
  return "#333333";
}

function parseTaskDueDay(dueDate: string): Date | null {
  const trimmed = dueDate.trim();
  if (!trimmed) return null;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  return due;
}

function getSectionNextDue(
  tasks: Task[],
): { label: string; isOverdue: boolean } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dated = tasks
    .map((task) => {
      if (!task.dueDate?.trim()) return null;
      const dueDay = parseTaskDueDay(task.dueDate);
      if (!dueDay) return null;
      return { task, dueDay };
    })
    .filter((entry): entry is { task: Task; dueDay: Date } => entry !== null)
    .sort((a, b) => a.dueDay.getTime() - b.dueDay.getTime());

  if (dated.length === 0) return null;

  const nearest = dated[0];
  return {
    label: formatTaskDate(nearest.task.dueDate!),
    isOverdue: nearest.dueDay.getTime() < today.getTime(),
  };
}

const sectionLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#555555",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 8px",
};

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
  fontSize: "12px",
  borderRadius: "6px",
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid #333333",
  color: "#777777",
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
  if (status === "todo") return "Start Task";
  if (status === "in_progress") return "Mark Done";
  return null;
}

const startTaskButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #FFC429",
  color: "#FFC429",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
};

const markDoneButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #E51937",
  color: "#E51937",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
};

const viewDetailsPlainStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#555555",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  padding: 0,
  fontFamily: "inherit",
};

const viewDetailsLinkStyle: CSSProperties = {
  ...viewDetailsPlainStyle,
  marginTop: "8px",
};

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

function TaskCommentsSection({
  taskId,
  taskTitle,
  assigneeId,
  clubId,
  commenterName,
  userId,
  expanded,
  onToggle,
  commentCount,
  onCommentCountChange,
  canComment,
  canDeleteAnyComment,
}: {
  taskId: string;
  taskTitle: string;
  assigneeId?: string;
  clubId?: string;
  commenterName: string;
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

    if (assigneeId && assigneeId !== userId && clubId) {
      void notifyUsers([
        {
          user_id: assigneeId,
          type: "task_assigned",
          message: `${commenterName} commented on "${taskTitle}"`,
          club_id: clubId,
          reference_id: taskId,
        },
      ]);
    }
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

function TaskFilterChipBar({
  chips,
  active,
  onChange,
}: {
  chips: { id: TaskFilterChip; label: string }[];
  active: TaskFilterChip;
  onChange: (chip: TaskFilterChip) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginBottom: "16px",
      }}
    >
      {chips.map((chip) => {
        const isActive = active === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            style={{
              background: isActive ? "#E51937" : "transparent",
              color: isActive ? "#ffffff" : "#999999",
              border: isActive ? "1px solid #E51937" : "1px solid #333333",
              borderRadius: "20px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const myCommenterName =
    members.find((m) => m.userId === user?.id)?.fullName ?? "A member";

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

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeFilter, setActiveFilter] = useState<TaskFilterChip>("all");
  const effectiveViewMode: ViewMode = isPrivileged ? viewMode : "list";
  const [showForm, setShowForm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case "assigned_to_me":
        return visibleTasks.filter((t) => t.assignedTo === user?.id);
      case "assigned_by_me":
        return visibleTasks.filter(
          (t) =>
            t.createdBy === user?.id &&
            t.assignedTo &&
            t.assignedTo !== user?.id,
        );
      case "overdue":
        return visibleTasks.filter(isTaskOverdue);
      case "high_priority":
        return visibleTasks.filter((t) => t.priority === "high");
      case "completed":
        return visibleTasks.filter((t) => t.status === "done");
      default:
        return visibleTasks;
    }
  }, [visibleTasks, activeFilter, user?.id]);

  const filteredDoneCount = filteredTasks.filter((t) => t.status === "done").length;
  const filteredTotalCount = filteredTasks.length;
  const progressFillPercent =
    filteredTotalCount === 0
      ? 0
      : (filteredDoneCount / filteredTotalCount) * 100;
  const progressPercent =
    filteredTotalCount === 0
      ? 0
      : Math.round((filteredDoneCount / filteredTotalCount) * 100);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of filteredTasks) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [filteredTasks]);

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

  useEffect(() => {
    const shouldOpenCreate =
      searchParams.get("openCreate") === "true" ||
      searchParams.get("create") === "true";
    if (!shouldOpenCreate || !isPrivileged || loading) return;

    setEditingId(null);
    setTitle("");
    setDescription("");
    setHighImportance(false);
    setAssignedTo("");
    setDueDate("");
    setShowForm(true);

    const next = new URLSearchParams(searchParams);
    next.delete("openCreate");
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isPrivileged, loading]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    setFeedback(null);

    const priority: TaskPriority = highImportance ? "high" : "medium";

    let ok = false;
    if (editingId) {
      ok = await updateTask(editingId, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
      });
    } else {
      const taskId = await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined,
      });
      ok = Boolean(taskId);
      if (
        taskId &&
        assignedTo &&
        assignedTo !== user?.id &&
        clubId &&
        club?.name
      ) {
        const dueLabel = dueDate.trim()
          ? formatTaskDate(dueDate)
          : "No due date";
        void notifyUsers([
          {
            user_id: assignedTo,
            type: "task_assigned",
            message: `You've been assigned "${title.trim()}" in ${club.name}. Due: ${dueLabel}`,
            club_id: clubId,
            reference_id: taskId,
          },
        ]);
      }
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

  function openTaskDetail(task: Task) {
    setOpenMenuTaskId(null);
    setSelectedTask(task);
  }

  function closeTaskDetail() {
    setSelectedTask(null);
  }

  const detailTask = selectedTask
    ? visibleTasks.find((t) => t.id === selectedTask.id) ?? null
    : null;

  function assigneeAvatarFor(task: Task): string | undefined {
    if (task.assigneeAvatar) return task.assigneeAvatar;
    const member = members.find((m) => m.userId === task.assignedTo);
    return member?.avatarUrl;
  }

  function assigneeDisplayFor(task: Task): string {
    const member = members.find((m) => m.userId === task.assignedTo);
    const name = task.assigneeName ?? member?.fullName ?? "Unassigned";
    if (!task.assignedTo) return "Unassigned";
    return formatNameWithRoleTitle(name, member?.roleTitle);
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
    const assigneeName = assigneeDisplayFor(task);
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
          background: "#141414",
          border: `1px solid ${isHovered ? "#333333" : "#2a2a2a"}`,
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "8px",
          cursor: "pointer",
          opacity: isDone ? 0.65 : isAnimating ? 0.5 : 1,
          transform: isHovered ? "translateY(-1px)" : undefined,
          transition: "border-color 0.15s ease, transform 0.15s ease, opacity 0.2s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              flex: 1,
              minWidth: 0,
              flexWrap: "wrap",
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
                flex: 1,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight: 1.35,
              }}
            >
              {task.title}
            </p>
            <PriorityPill priority={task.priority} muted={isDone} />
          </div>
          {isHovered ? renderTaskMenu(task) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "10px",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <AvatarCircle
              name={assigneeName}
              avatarUrl={assigneeAvatarFor(task)}
              size={28}
            />
            <span style={{ fontSize: "11px", color: "#555555" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {task.dueDate ? (
              <span
                style={{
                  fontSize: "11px",
                  color: dueDateColor(task.dueDate, task.status),
                }}
              >
                Due {formatTaskDate(task.dueDate)}
              </span>
            ) : null}
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
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openTaskDetail(task);
          }}
          style={viewDetailsLinkStyle}
        >
          View Details
        </button>

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
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#555555";
                  e.currentTarget.style.color = "#cccccc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#333333";
                  e.currentTarget.style.color = "#777777";
                }}
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
              taskTitle={task.title}
              assigneeId={task.assignedTo}
              clubId={clubId}
              commenterName={myCommenterName}
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

  function renderListSectionHeader(
    sectionStatus: TaskStatus,
    sectionTasks: Task[],
  ) {
    const nextDue = getSectionNextDue(sectionTasks);

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          paddingBottom: "8px",
          borderBottom: "1px solid #2a2a2a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#ffffff",
              textTransform: "uppercase",
            }}
          >
            {statusLabels[sectionStatus]}
          </span>
          <span
            style={{
              marginLeft: "8px",
              background: "#2a2a2a",
              color: "#999999",
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "12px",
            }}
          >
            {sectionTasks.length}
          </span>
        </div>
        {nextDue && sectionStatus !== "done" ? (
          <span
            style={{
              fontSize: "12px",
              color: nextDue.isOverdue ? "#E51937" : "#777777",
            }}
          >
            Next due {nextDue.label}
          </span>
        ) : null}
      </div>
    );
  }

  function renderListSection(sectionStatus: TaskStatus, sectionTasks: Task[]) {
    if (sectionTasks.length === 0) return null;

    const content = (
      <>
        {renderListSectionHeader(sectionStatus, sectionTasks)}
        {sectionTasks.map((task) =>
          renderListCard(task, sectionStatus === "done"),
        )}
      </>
    );

    if (sectionStatus === "in_progress") {
      return (
        <div
          key={sectionStatus}
          style={{
            marginBottom: "20px",
            background: "#0d0d0d",
            borderRadius: "10px",
            padding: "16px",
            border: "1px solid #222222",
          }}
        >
          {content}
        </div>
      );
    }

    return (
      <div key={sectionStatus} style={{ marginBottom: "20px" }}>
        {content}
      </div>
    );
  }

  function renderListSectionsEmpty() {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <CheckCircle
          size={40}
          color="#333333"
          style={{ margin: "0 auto 12px", display: "block" }}
          aria-hidden
        />
        <p
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "#555555",
            margin: "0 0 6px",
          }}
        >
          No tasks yet
        </p>
        <p style={{ fontSize: "13px", color: "#444444", margin: 0 }}>
          Create a task to get started
        </p>
      </div>
    );
  }

  function renderListSections(tasks: Task[]) {
    const sectionOrder: TaskStatus[] = ["todo", "in_progress", "done"];
    const sections = sectionOrder
      .map((status) => ({
        status,
        tasks: tasks.filter((task) => task.status === status),
      }))
      .filter((section) => section.tasks.length > 0);

    if (sections.length === 0) {
      return renderListSectionsEmpty();
    }

    return (
      <>
        {sections.map((section) =>
          renderListSection(section.status, section.tasks),
        )}
      </>
    );
  }

  function renderListCard(task: Task, completed = false) {
    const isHovered = hoveredTaskId === task.id;
    const isDone = completed || task.status === "done";
    const canChangeStatus = isPrivileged || task.assignedTo === user?.id;
    const canViewComments = isPrivileged || task.assignedTo === user?.id;
    const canComment = isPrivileged || task.assignedTo === user?.id;
    const next = nextStatus(task.status);
    const assigneeName = assigneeDisplayFor(task);
    const commentCount = commentCounts[task.id] ?? 0;
    const listAction = listQuickActionLabel(task.status);
    const showStatusAction = canChangeStatus && listAction && !isDone;
    const leftBorder = listRowLeftBorder(task.status);
    const metaParts: string[] = [assigneeName];
    if (task.dueDate) {
      metaParts.push(formatTaskDate(task.dueDate));
    }
    if (canViewComments) {
      metaParts.push(
        `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`,
      );
    }

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
          alignItems: "center",
          gap: "12px",
          background: "#141414",
          borderTop: `1px solid ${isHovered ? "#333333" : "#2a2a2a"}`,
          borderRight: `1px solid ${isHovered ? "#333333" : "#2a2a2a"}`,
          borderBottom: `1px solid ${isHovered ? "#333333" : "#2a2a2a"}`,
          borderLeft: `3px solid ${leftBorder}`,
          borderRadius: "8px",
          padding: "14px 16px",
          marginBottom: "8px",
          opacity: isDone ? 0.65 : 1,
          transition: "opacity 0.15s ease, border-color 0.15s ease",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "4px",
            }}
          >
            <p
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#ffffff",
                margin: 0,
                textDecoration: isDone ? "line-through" : "none",
                minWidth: 0,
              }}
            >
              {task.title}
            </p>
            {!isDone ? (
              <PriorityPill priority={task.priority} />
            ) : null}
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "#777777",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.assignedTo ? (
              <>
                <Link
                  to={`/app/profile/${task.assignedTo}`}
                  style={{ color: "#777777", textDecoration: "none" }}
                >
                  {metaParts[0]}
                </Link>
                {metaParts.length > 1 ? ` · ${metaParts.slice(1).join(" · ")}` : ""}
              </>
            ) : (
              metaParts.join(" · ")
            )}
          </p>
          {canViewComments && expandedComments[task.id] ? (
            <TaskCommentsSection
              taskId={task.id}
              taskTitle={task.title}
              assigneeId={task.assignedTo}
              clubId={clubId}
              commenterName={myCommenterName}
              userId={user?.id}
              expanded
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
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {showStatusAction ? (
            <button
              type="button"
              onClick={() => {
                if (next) void handleStatusChange(task.id, next);
              }}
              style={
                task.status === "todo" ? startTaskButtonStyle : markDoneButtonStyle
              }
            >
              {listAction}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openTaskDetail(task)}
              style={viewDetailsPlainStyle}
            >
              View Details
            </button>
          )}
          {isHovered && isPrivileged ? renderTaskMenu(task) : null}
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
              fontSize: "14px",
              color: "#777777",
              margin: "6px 0 0",
            }}
          >
            Track club work, assignments, and deadlines.
          </p>
          {!isPrivileged ? (
            <p
              style={{
                fontSize: "13px",
                color: "#777777",
                margin: "10px 0 0",
              }}
            >
              Showing tasks assigned to you
            </p>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          {isPrivileged ? (
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          ) : null}
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "#777777",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {filteredDoneCount} of {filteredTotalCount} tasks complete · {progressPercent}%
        </span>
        <div
          style={{
            flex: 1,
            height: "6px",
            borderRadius: "3px",
            background: "#2a2a2a",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {progressFillPercent > 0 ? (
            <div
              style={{
                height: "100%",
                width: `${progressFillPercent}%`,
                background: "#FFC429",
                borderRadius: "3px",
                transition: "width 0.25s ease",
              }}
            />
          ) : null}
        </div>
      </div>

      <TaskFilterChipBar
        chips={isPrivileged ? privilegedFilterChips : memberFilterChips}
        active={activeFilter}
        onChange={setActiveFilter}
      />

      <p
        style={{
          fontSize: "12px",
          color: "#555555",
          marginTop: 0,
          marginBottom: "16px",
        }}
      >
        Grouped by status · Sorted by due date
      </p>

      {feedback ? (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-[#FFC429]/10 text-[#FFC429]"
              : "bg-primary/10 text-primary"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {showForm && isPrivileged ? (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-white">
              {editingId ? "Edit Task" : "Create New Task"}
            </h3>
            {!editingId ? (
              <button
                type="button"
                onClick={() => setShowTemplatePicker(true)}
                className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-[#cccccc] transition-colors hover:border-[#555555] hover:text-white"
              >
                Use Template
              </button>
            ) : null}
          </div>
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
        renderListSectionsEmpty()
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "#555555",
              margin: "0 0 6px",
            }}
          >
            No matching tasks
          </p>
          <p style={{ fontSize: "13px", color: "#444444", margin: 0 }}>
            Try a different filter to see more tasks.
          </p>
        </div>
      ) : effectiveViewMode === "board" ? (
        <div
          style={
            isMobile
              ? {
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  paddingBottom: "8px",
                  WebkitOverflowScrolling: "touch",
                  alignItems: "flex-start",
                }
              : {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "12px",
                  alignItems: "flex-start",
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
                display: "flex",
                flexDirection: "column",
                alignSelf: "flex-start",
                width: "100%",
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
                    color: boardColumnHeaderColor[columnStatus],
                  }}
                >
                  {statusLabels[columnStatus]}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: boardColumnHeaderColor[columnStatus],
                    background: "#1a1a1a",
                    borderRadius: "20px",
                    padding: "2px 8px",
                  }}
                >
                  {tasksByStatus[columnStatus].length}
                </span>
              </div>
              {tasksByStatus[columnStatus].length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 12px" }}>
                  <Circle
                    size={18}
                    color="#555555"
                    style={{ margin: "0 auto 6px", display: "block" }}
                    aria-hidden
                  />
                  <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
                    No tasks here
                  </p>
                </div>
              ) : (
                <div>
                  {tasksByStatus[columnStatus].map((task) => renderBoardCard(task))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        renderListSections(filteredTasks)
      )}

      {detailTask ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
          onClick={closeTaskDetail}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#141414",
              border: "1px solid #2a2a2a",
              borderRadius: "16px",
              maxWidth: "580px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "32px",
              position: "relative",
            }}
          >
            <button
              type="button"
              aria-label="Close task details"
              onClick={closeTaskDetail}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#555555",
                padding: "4px",
                display: "flex",
              }}
            >
              <X size={20} aria-hidden />
            </button>

            <PriorityPill priority={detailTask.priority} />

            <h2
              id="task-detail-title"
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#ffffff",
                margin: "8px 0 0",
              }}
            >
              {detailTask.title}
            </h2>

            {(
              [
                {
                  icon: User,
                  label: "Assignee",
                  value: assigneeDisplayFor(detailTask),
                },
                {
                  icon: Calendar,
                  label: "Due date",
                  value: detailTask.dueDate
                    ? formatTaskDate(detailTask.dueDate)
                    : "No due date",
                },
                {
                  icon: Circle,
                  label: "Status",
                  value: statusLabels[detailTask.status],
                },
              ] as const
            ).map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid #1e1e1e",
                }}
              >
                <Icon size={16} color="#555555" aria-hidden />
                <span
                  style={{
                    fontSize: "12px",
                    color: "#555555",
                    width: "100px",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <span style={{ fontSize: "14px", color: "#cccccc" }}>{value}</span>
              </div>
            ))}

            <p style={sectionLabelStyle}>Description</p>
            <p
              style={{
                fontSize: "14px",
                color: "#cccccc",
                lineHeight: 1.8,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {detailTask.description.trim() || "No description provided."}
            </p>

            <p style={{ fontSize: "12px", color: "#555555", margin: "16px 0 0" }}>
              {commentCounts[detailTask.id] ?? 0}{" "}
              {(commentCounts[detailTask.id] ?? 0) === 1 ? "comment" : "comments"}
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "20px",
              }}
            >
              {(isPrivileged || detailTask.assignedTo === user?.id) &&
              listQuickActionLabel(detailTask.status) ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = nextStatus(detailTask.status);
                    if (target) void handleStatusChange(detailTask.id, target);
                  }}
                  style={
                    detailTask.status === "todo"
                      ? startTaskButtonStyle
                      : markDoneButtonStyle
                  }
                >
                  {listQuickActionLabel(detailTask.status)}
                </button>
              ) : null}
              {isPrivileged ? (
                <button
                  type="button"
                  onClick={() => {
                    closeTaskDetail();
                    startEdit(detailTask);
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid #E51937",
                    borderRadius: "20px",
                    padding: "5px 12px",
                    fontSize: "11px",
                    color: "#E51937",
                    cursor: "pointer",
                  }}
                >
                  Edit Task
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showTemplatePicker ? (
        <TemplatePickerModal
          type="task"
          clubName={club?.name ?? "your club"}
          clubCategory={club?.category}
          onClose={() => setShowTemplatePicker(false)}
          onSelect={(template) => {
            if ("description" in template) {
              setTitle(template.title);
              setDescription(template.description);
            }
          }}
        />
      ) : null}
    </div>
  );
}
