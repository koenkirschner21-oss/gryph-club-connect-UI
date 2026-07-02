import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MessageSquare,
  Send,
  X,
  CheckCircle,
} from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubTasks } from "../../hooks/useClubTasks";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import { notifyUsers } from "../../lib/notifyUsers";
import { formatNameWithRoleTitle } from "../../lib/memberRoleTitle";
import { formatTaskDate } from "../../lib/taskDueUrgency";
import { resolveTaskCompletionStatus, isTaskAwaitingReviewFromUser } from "../../lib/taskCompletion";
import { addTaskComment } from "../../lib/taskComments";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import type { Task, TaskStatus, TaskPriority, TaskType } from "../../types";
import {
  TASK_TYPE_FILTER_CHIPS,
  TASK_TYPE_FORM_OPTIONS,
  type TaskTypeFilter,
} from "../../lib/taskTypes";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import LinkedMeetingCancelledLabel from "../../components/tasks/LinkedMeetingCancelledLabel";
import TaskDetailModal from "../../components/tasks/TaskDetailModal";
import Spinner from "../../components/ui/Spinner";
import TemplatePickerModal from "../../components/club/TemplatePickerModal";
import {
  TasksListColumnHeaders,
  TasksListFooter,
  TasksListMenu,
  TasksListMenuButton,
  TasksListMobileCard,
  TasksListSectionHeader,
  TasksListStatCards,
  TasksListTableRow,
  TaskTypeFilterDropdown,
  type TasksStatCardFilter,
  formatDueDateSubLabel,
  parseTaskDueDay,
  sortTasksByDueDate,
} from "./tasks/TasksListUI";

type AssignmentTab = "assigned_to_me" | "assigned_by_me";

const STAT_CARD_FILTER_LABELS: Record<TasksStatCardFilter, string> = {
  all: "all",
  due_this_week: "due this week",
  high_priority: "high priority",
  completed: "completed",
};

function isTaskDueThisWeek(task: Task): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const due = parseTaskDueDay(task.dueDate);
  if (!due) return false;
  return due.getTime() >= today.getTime() && due.getTime() <= weekEnd.getTime();
}

function TaskLinkedLabel({ task }: { task: Task }) {
  return (
    <>
      <LinkedMeetingCancelledLabel task={task} />
      {task.taskType === "event" && task.linkedEventId ? (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555555" }}>
          📅 Linked to: {task.linkedEventTitle ?? "Event"}
        </p>
      ) : null}
      {task.taskType === "meeting" && task.linkedMeetingId ? (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555555" }}>
          🗓 Linked to: {task.linkedMeetingTitle ?? "Meeting"}
        </p>
      ) : null}
    </>
  );
}

function listRowLeftBorder(status: TaskStatus): string {
  if (status === "in_progress") return "#FFC429";
  if (status === "done") return "#2a2a2a";
  return "#333333";
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

function nextStatus(status: TaskStatus): TaskStatus | null {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
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

const viewDetailsActionStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #2a2a2a",
  color: "#777777",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
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


function AssignmentTabToggle({
  active,
  onChange,
  showAssignedByMe,
}: {
  active: AssignmentTab;
  onChange: (tab: AssignmentTab) => void;
  showAssignedByMe: boolean;
}) {
  const tabs: { id: AssignmentTab; label: string }[] = [
    { id: "assigned_to_me", label: "Assigned to Me" },
    ...(showAssignedByMe
      ? [{ id: "assigned_by_me" as const, label: "Assigned by Me" }]
      : []),
  ];

  return (
    <div
      role="tablist"
      aria-label="Assignment view"
      style={{ display: "flex", gap: "6px", marginBottom: "20px" }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              background: isActive ? "#E51937" : "#1a1a1a",
              color: isActive ? "#ffffff" : "#777777",
              border: isActive ? "none" : "1px solid #333333",
              borderRadius: "6px",
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {tab.label}
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

  const memberAccess = useClubMemberAccess(clubId);
  const canManageTasks =
    memberAccess.isPresident || memberAccess.can("manage_tasks");
  const [eventLinkOptions, setEventLinkOptions] = useState<{ id: string; title: string }[]>([]);
  const [meetingLinkOptions, setMeetingLinkOptions] = useState<{ id: string; title: string }[]>([]);
  const [hiringLinkOptions, setHiringLinkOptions] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!clubId || !canManageTasks) return;

    const nowIso = new Date().toISOString();

    void Promise.all([
      supabase
        .from("events")
        .select("id, title, date")
        .eq("club_id", clubId)
        .gte("date", nowIso.slice(0, 10))
        .order("date", { ascending: true }),
      supabase
        .from("club_meetings")
        .select("id, title, date")
        .eq("club_id", clubId)
        .gte("date", nowIso)
        .order("date", { ascending: true }),
      supabase
        .from("hiring_listings")
        .select("id, title")
        .eq("club_id", clubId)
        .eq("is_open", true)
        .order("created_at", { ascending: false }),
    ]).then(([eventsRes, meetingsRes, hiringRes]) => {
      setEventLinkOptions(
        (eventsRes.data ?? []).map((row) => ({
          id: row.id as string,
          title: (row.title as string) ?? "Event",
        })),
      );
      setMeetingLinkOptions(
        (meetingsRes.data ?? []).map((row) => ({
          id: row.id as string,
          title: (row.title as string) ?? "Meeting",
        })),
      );
      setHiringLinkOptions(
        (hiringRes.data ?? []).map((row) => ({
          id: row.id as string,
          title: (row.title as string) ?? "Role",
        })),
      );
    });
  }, [clubId, canManageTasks]);

  const enrichedTasks = useMemo(
    () =>
      tasks.map((task) => ({
        ...task,
        linkedEventTitle:
          task.linkedEventTitle ??
          eventLinkOptions.find((option) => option.id === task.linkedEventId)?.title,
        linkedMeetingTitle:
          task.linkedMeetingTitle ??
          meetingLinkOptions.find((option) => option.id === task.linkedMeetingId)?.title,
        linkedHiringTitle:
          task.linkedHiringTitle ??
          hiringLinkOptions.find((option) => option.id === task.linkedHiringListingId)?.title,
      })),
    [tasks, eventLinkOptions, meetingLinkOptions, hiringLinkOptions],
  );

  const [assignmentTab, setAssignmentTab] = useState<AssignmentTab>("assigned_to_me");
  const [activeQuickFilter, setActiveQuickFilter] = useState<TasksStatCardFilter>("all");
  const [activeTypeFilter, setActiveTypeFilter] = useState<TaskTypeFilter>("all");

  const visibleTasks = useMemo(() => {
    const activeTasks = enrichedTasks.filter((task) => task.status !== "cancelled");

    if (!canManageTasks) {
      return activeTasks.filter(
      (task) => task.assignedTo === user?.id && task.status !== "pending_review",
    );
    }

    if (activeTypeFilter === "event") {
      return activeTasks.filter((task) => (task.taskType ?? "general") === "event");
    }

    if (assignmentTab === "assigned_by_me") {
      return activeTasks.filter(
        (task) =>
          task.createdBy === user?.id &&
          task.assignedTo &&
          task.assignedTo !== user?.id,
      );
    }

    return activeTasks.filter(
      (task) => task.assignedTo === user?.id && task.status !== "pending_review",
    );
  }, [enrichedTasks, assignmentTab, user?.id, canManageTasks, activeTypeFilter]);


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
  const [taskType, setTaskType] = useState<TaskType>("general");
  const [linkedEventId, setLinkedEventId] = useState("");
  const [linkedMeetingId, setLinkedMeetingId] = useState("");
  const [linkedHiringListingId, setLinkedHiringListingId] = useState("");
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleCommentCountChange = useCallback((taskId: string, count: number) => {
    setCommentCounts((prev) => ({ ...prev, [taskId]: count }));
  }, []);

  useEffect(() => {
    if (!canManageTasks && assignmentTab === "assigned_by_me") {
      setAssignmentTab("assigned_to_me");
    }
  }, [canManageTasks, assignmentTab]);

  useEffect(() => {
    setActiveQuickFilter("all");
  }, [assignmentTab]);

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

  const typeFilteredTasks = useMemo(() => {
    if (activeTypeFilter === "all") return visibleTasks;
    return visibleTasks.filter((task) => (task.taskType ?? "general") === activeTypeFilter);
  }, [visibleTasks, activeTypeFilter]);

  const filteredTasks = useMemo(() => {
    if (activeQuickFilter === "all") return typeFilteredTasks;

    switch (activeQuickFilter) {
      case "due_this_week":
        return typeFilteredTasks.filter(isTaskDueThisWeek);
      case "high_priority":
        return typeFilteredTasks.filter(
          (task) => task.priority === "high" && task.status !== "done",
        );
      case "completed":
        return typeFilteredTasks.filter((task) => task.status === "done");
      default:
        return typeFilteredTasks;
    }
  }, [typeFilteredTasks, activeQuickFilter]);

  const statDoneCount = typeFilteredTasks.filter((task) => task.status === "done").length;
  const statTotalCount = typeFilteredTasks.length;

  const dueThisWeekCount = useMemo(
    () => typeFilteredTasks.filter(isTaskDueThisWeek).length,
    [typeFilteredTasks],
  );

  const highPriorityCount = useMemo(
    () =>
      typeFilteredTasks.filter((task) => task.priority === "high" && task.status !== "done")
        .length,
    [typeFilteredTasks],
  );

  const listFooterLabel = useMemo(() => {
    if (activeQuickFilter === "all" && activeTypeFilter === "all") {
      return "Showing all tasks";
    }
    const parts: string[] = [];
    if (activeQuickFilter !== "all") {
      parts.push(STAT_CARD_FILTER_LABELS[activeQuickFilter]);
    }
    if (activeTypeFilter !== "all") {
      const typeChip = TASK_TYPE_FILTER_CHIPS.find((c) => c.id === activeTypeFilter);
      parts.push(typeChip?.label.toLowerCase() ?? activeTypeFilter);
    }
    return `Showing ${parts.join(" · ")} tasks`;
  }, [activeQuickFilter, activeTypeFilter]);

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
    setTaskType("general");
    setLinkedEventId("");
    setLinkedMeetingId("");
    setLinkedHiringListingId("");
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
    setTaskType(task.taskType ?? "general");
    setLinkedEventId(task.linkedEventId ?? "");
    setLinkedMeetingId(task.linkedMeetingId ?? "");
    setLinkedHiringListingId(task.linkedHiringListingId ?? "");
    setShowForm(true);
    setOpenMenuTaskId(null);
  }

  useEffect(() => {
    const shouldOpenCreate =
      searchParams.get("openCreate") === "true" ||
      searchParams.get("create") === "true";
    if (!shouldOpenCreate || !canManageTasks || loading) return;

    setEditingId(null);
    setTitle("");
    setDescription("");
    setHighImportance(false);
    setAssignedTo("");
    setDueDate("");
    setTaskType("general");
    setLinkedEventId("");
    setLinkedMeetingId("");
    setLinkedHiringListingId("");
    setShowForm(true);

    const next = new URLSearchParams(searchParams);
    next.delete("openCreate");
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canManageTasks, loading]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    setFeedback(null);

    const priority: TaskPriority = highImportance ? "high" : "medium";
    const taskFields = {
        title: title.trim(),
        description: description.trim(),
        priority,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
      taskType,
      linkedEventId: taskType === "event" ? linkedEventId || null : null,
      linkedMeetingId: taskType === "meeting" ? linkedMeetingId || null : null,
      linkedHiringListingId: taskType === "hiring" ? linkedHiringListingId || null : null,
    };

    let ok = false;
    if (editingId) {
      ok = await updateTask(editingId, {
        title: taskFields.title,
        description: taskFields.description,
        priority: taskFields.priority,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
        taskType: taskFields.taskType,
        linkedEventId: taskFields.linkedEventId,
        linkedMeetingId: taskFields.linkedMeetingId,
        linkedHiringListingId: taskFields.linkedHiringListingId,
      });
    } else {
      const taskId = await createTask(taskFields);
      ok = Boolean(taskId);
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
    const task = enrichedTasks.find((item) => item.id === taskId);
    let resolvedStatus = newStatus;
    let completedAt: string | null | undefined;

    if (newStatus === "done" && task && user?.id) {
      resolvedStatus = resolveTaskCompletionStatus(task, user.id);
      if (resolvedStatus === "pending_review") {
        completedAt = new Date().toISOString();
      }
    }

    const ok = await updateTask(taskId, {
      status: resolvedStatus,
      ...(completedAt !== undefined ? { completedAt } : {}),
    });
    window.setTimeout(() => setStatusAnimatingId(null), 280);
    if (!ok) {
      setFeedback({ type: "error", text: "Failed to update status." });
    } else if (resolvedStatus === "pending_review") {
      setFeedback({ type: "success", text: "Task submitted for review." });
    }
  }

  async function handleApproveReview(task: Task) {
    const ok = await updateTask(task.id, {
      status: "done",
      completedAt: new Date().toISOString(),
    });
    if (ok) {
      setFeedback({ type: "success", text: "Task approved." });
      closeTaskDetail();
    }
  }

  async function handleSendBackReview(task: Task, note: string) {
    if (note.trim() && user?.id) {
      await addTaskComment(task.id, user.id, note.trim());
    }
    const ok = await updateTask(task.id, { status: "in_progress", completedAt: null });
    if (ok) {
      setFeedback({ type: "success", text: "Task sent back." });
      closeTaskDetail();
    }
  }

  async function handleRequestChangesReview(task: Task, note: string) {
    if (note.trim() && user?.id) {
      await addTaskComment(task.id, user.id, `Change requested: ${note.trim()}`);
    }
    const ok = await updateTask(task.id, { status: "in_progress", completedAt: null });
    if (ok) {
      setFeedback({ type: "success", text: "Changes requested." });
      closeTaskDetail();
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
    ? enrichedTasks.find((t) => t.id === selectedTask.id) ?? selectedTask
    : null;

  const isReviewingTask =
    detailTask != null &&
    user?.id != null &&
    isTaskAwaitingReviewFromUser(detailTask, user.id);

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

  function assigneePlainNameFor(task: Task): string {
    const member = members.find((m) => m.userId === task.assignedTo);
    return task.assigneeName ?? member?.fullName ?? "Unassigned";
  }

  function emptyTabMessage(): string {
    if (assignmentTab === "assigned_by_me") {
      return "No tasks assigned by you yet.";
    }
    return "No tasks yet";
  }

  function emptyFilterMessage(): string {
    switch (activeQuickFilter) {
      case "due_this_week":
        return "No tasks due this week.";
      case "high_priority":
        return "No high-priority tasks.";
      case "completed":
        return "No completed tasks yet.";
      default:
        return "No matching tasks";
    }
  }

  function renderListSectionHeader(
    sectionStatus: TaskStatus,
    sectionTasks: Task[],
  ) {
    const nextDue = getSectionNextDue(sectionTasks);
    if (sectionStatus === "cancelled") return null;

    return (
      <TasksListSectionHeader
        sectionStatus={sectionStatus}
        count={sectionTasks.length}
        nextDueLabel={nextDue?.label}
        nextDueOverdue={nextDue?.isOverdue}
      />
    );
  }

  function renderListSection(sectionStatus: TaskStatus, sectionTasks: Task[]) {
    if (sectionTasks.length === 0) return null;
    const sortedTasks = sortTasksByDueDate(sectionTasks);

    return (
      <div key={sectionStatus} style={{ marginBottom: "20px" }}>
        {renderListSectionHeader(sectionStatus, sortedTasks)}
        {sortedTasks.map((task) =>
          renderListCard(task, sectionStatus === "done"),
        )}
      </div>
    );
  }

  function renderListSectionsEmpty(message = "No tasks yet") {
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
            margin: 0,
          }}
        >
          {message}
        </p>
        {message === "No tasks yet" ? (
          <p style={{ fontSize: "13px", color: "#444444", margin: "6px 0 0" }}>
            Create a task to get started
          </p>
        ) : null}
      </div>
    );
  }

  function renderListSections(tasks: Task[]) {
    const sectionOrder: TaskStatus[] = [
      "pending_review",
      "todo",
      "in_progress",
      "done",
    ];
    const sections = sectionOrder
      .map((status) => ({
        status,
        tasks: tasks.filter((task) => {
          if (status === "pending_review") {
            return user?.id
              ? isTaskAwaitingReviewFromUser(task, user.id)
              : false;
          }
          return task.status === status;
        }),
      }))
      .filter((section) => section.tasks.length > 0);

    if (sections.length === 0) {
      return renderListSectionsEmpty();
    }

    return (
      <>
        {!isMobile ? <TasksListColumnHeaders /> : null}
        {sections.map((section) =>
          renderListSection(section.status, section.tasks),
        )}
        <TasksListFooter filterLabel={listFooterLabel} />
      </>
    );
  }

  function renderListCard(task: Task, completed = false) {
    const isHovered = hoveredTaskId === task.id;
    const isDone = completed || task.status === "done";
    const canChangeStatus = canManageTasks || task.assignedTo === user?.id;
    const canViewComments = canManageTasks || task.assignedTo === user?.id;
    const canComment = canManageTasks || task.assignedTo === user?.id;
    const next = nextStatus(task.status);
    const assigneeName = assigneePlainNameFor(task);
    const commentCount = commentCounts[task.id] ?? 0;
    const listAction = listQuickActionLabel(task.status);
    const showStatusAction = canChangeStatus && listAction && !isDone;
    const leftBorder = listRowLeftBorder(task.status);
    const metaParts: string[] = [assigneeName];
    if (task.dueDate) {
      metaParts.push(`Due: ${formatTaskDate(task.dueDate)}`);
      const dueSub = formatDueDateSubLabel(task.dueDate, task.status);
      if (dueSub) metaParts.push(dueSub.text);
    }
    if (canViewComments) {
      metaParts.push(
        `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`,
      );
    }

    const actionStyle =
      task.status === "todo" ? startTaskButtonStyle : markDoneButtonStyle;

    const menu = canManageTasks || canChangeStatus ? (
      <div style={{ position: "relative", flexShrink: 0 }}>
        <TasksListMenuButton
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuTaskId((prev) => (prev === task.id ? null : task.id));
          }}
        />
        <TasksListMenu
          open={openMenuTaskId === task.id}
          taskStatus={task.status}
          canChangeStatus={canChangeStatus}
          onStatusChange={(status) => {
            setOpenMenuTaskId(null);
            void handleStatusChange(task.id, status);
          }}
          onViewDetails={() => {
            setOpenMenuTaskId(null);
            openTaskDetail(task);
          }}
          onEdit={
            canManageTasks
              ? () => {
                  setOpenMenuTaskId(null);
                  startEdit(task);
                }
              : undefined
          }
          onDelete={
            canManageTasks
              ? () => {
                  setOpenMenuTaskId(null);
                  void handleDelete(task.id);
                }
              : undefined
          }
        />
      </div>
    ) : null;

    const linkedLabel = <TaskLinkedLabel task={task} />;

    const commentsSection =
      canViewComments && expandedComments[task.id] ? (
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
          canDeleteAnyComment={canManageTasks}
        />
      ) : null;

    if (isMobile) {
      return (
        <div
          key={task.id}
          onMouseEnter={() => setHoveredTaskId(task.id)}
          onMouseLeave={() => {
            setHoveredTaskId((prev) => (prev === task.id ? null : prev));
            if (openMenuTaskId === task.id) setOpenMenuTaskId(null);
          }}
        >
          <TasksListMobileCard
            task={task}
            isDone={isDone}
            isHovered={isHovered}
            leftBorder={leftBorder}
            assigneeId={task.assignedTo}
            metaParts={metaParts}
            showStatusAction={Boolean(showStatusAction)}
            listAction={listAction}
            actionStyle={
              showStatusAction
                ? actionStyle
                : viewDetailsActionStyle
            }
            onRowClick={() => openTaskDetail(task)}
            onStatusAction={() => {
              if (next) void handleStatusChange(task.id, next);
            }}
            onViewDetails={() => openTaskDetail(task)}
            menu={menu}
            linkedLabel={linkedLabel}
            commentsSection={commentsSection}
            statusUpdating={statusAnimatingId === task.id}
          />
        </div>
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
      >
        <TasksListTableRow
          task={task}
          isDone={isDone}
          isHovered={isHovered}
          assigneeName={assigneeName}
          assigneeId={task.assignedTo}
          assigneeAvatar={assigneeAvatarFor(task)}
          assigneeInitials={getInitials(assigneeName)}
          commentCount={commentCount}
          showStatusAction={Boolean(showStatusAction)}
          listAction={listAction}
          actionStyle={
            showStatusAction
              ? actionStyle
              : viewDetailsActionStyle
          }
          onRowClick={() => openTaskDetail(task)}
          onStatusAction={() => {
            if (next) void handleStatusChange(task.id, next);
          }}
          onViewDetails={() => openTaskDetail(task)}
          menu={menu}
          linkedLabel={linkedLabel}
          statusUpdating={statusAnimatingId === task.id}
        />
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
          {!canManageTasks ? (
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
          {canManageTasks ? (
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

      <AssignmentTabToggle
        active={assignmentTab}
        onChange={setAssignmentTab}
        showAssignedByMe={canManageTasks}
      />

      <TasksListStatCards
        doneCount={statDoneCount}
        totalCount={statTotalCount}
        dueThisWeekCount={dueThisWeekCount}
        highPriorityCount={highPriorityCount}
        isMobile={isMobile}
        activeFilter={activeQuickFilter}
        onFilterChange={setActiveQuickFilter}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          marginBottom: "16px",
          width: "100%",
        }}
      >
        <TaskTypeFilterDropdown
          value={activeTypeFilter}
          onChange={setActiveTypeFilter}
        />
      </div>

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

      {showForm && canManageTasks ? (
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
            <div>
                <label
                htmlFor="taskType"
                  className="mb-1 block text-sm font-medium text-white"
                >
                Task Type
                </label>
                <select
                id="taskType"
                value={taskType}
                onChange={(e) => {
                  const next = e.target.value as TaskType;
                  setTaskType(next);
                  if (next !== "event") setLinkedEventId("");
                  if (next !== "meeting") setLinkedMeetingId("");
                  if (next !== "hiring") setLinkedHiringListingId("");
                }}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
                >
                {TASK_TYPE_FORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                </select>
              </div>
            {taskType === "event" ? (
              <div>
                <label
                  htmlFor="taskLinkedEvent"
                  className="mb-1 block text-sm font-medium text-white"
                >
                  Link to Event
                </label>
                <select
                  id="taskLinkedEvent"
                  value={linkedEventId}
                  onChange={(e) => setLinkedEventId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
                >
                  <option value="">Select an event…</option>
                  {eventLinkOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {taskType === "meeting" ? (
              <div>
                <label
                  htmlFor="taskLinkedMeeting"
                  className="mb-1 block text-sm font-medium text-white"
                >
                  Link to Meeting
                </label>
                <select
                  id="taskLinkedMeeting"
                  value={linkedMeetingId}
                  onChange={(e) => setLinkedMeetingId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
                >
                  <option value="">Select a meeting…</option>
                  {meetingLinkOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {taskType === "hiring" ? (
              <div>
                <label
                  htmlFor="taskLinkedHiring"
                  className="mb-1 block text-sm font-medium text-white"
                >
                  Link to Hiring Role
                </label>
                <select
                  id="taskLinkedHiring"
                  value={linkedHiringListingId}
                  onChange={(e) => setLinkedHiringListingId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
                >
                  <option value="">Select a role…</option>
                  {hiringLinkOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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
        renderListSectionsEmpty(emptyTabMessage())
      ) : filteredTasks.length === 0 ? (
        renderListSectionsEmpty(emptyFilterMessage())
      ) : (
        renderListSections(filteredTasks)
      )}

      {detailTask && clubId ? (
        <TaskDetailModal
          task={detailTask}
          clubId={clubId}
          onClose={closeTaskDetail}
          onBack={closeTaskDetail}
          assigneeName={assigneeDisplayFor(detailTask)}
          assigneeAvatarUrl={assigneeAvatarFor(detailTask)}
          canEdit={canManageTasks && !isReviewingTask}
          canDelete={canManageTasks && !isReviewingTask}
          canChangeStatus={
            !isReviewingTask &&
            (canManageTasks || detailTask.assignedTo === user?.id)
          }
          canComment={canManageTasks || detailTask.assignedTo === user?.id}
          commenterName={myCommenterName}
          userId={user?.id}
          onEdit={() => {
            closeTaskDetail();
            startEdit(detailTask);
          }}
          onDelete={() => {
            void handleDelete(detailTask.id);
            closeTaskDetail();
          }}
          onStatusChange={(status) => void handleStatusChange(detailTask.id, status)}
          isReviewMode={isReviewingTask}
          onApproveReview={() => void handleApproveReview(detailTask)}
          onSendBackReview={(note) => void handleSendBackReview(detailTask, note)}
          onRequestChangesReview={(note) =>
            void handleRequestChangesReview(detailTask, note)
          }
        />
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
