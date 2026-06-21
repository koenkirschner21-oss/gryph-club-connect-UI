import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MoreHorizontal, X } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import type { UseClubTasksReturn } from "../../hooks/useClubTasks";
import { formatNameWithRoleTitle } from "../../lib/memberRoleTitle";
import { formatTaskDate } from "../../lib/taskDueUrgency";
import { getTaskStatusMenuItems } from "../../lib/taskStatusActions";
import {
  EVENT_PLANNING_TASK_TITLES,
  TASK_TYPE_BADGE_LABELS,
} from "../../lib/taskTypes";
import type { ClubMember, Task, TaskPriority, TaskStatus } from "../../types";
import LinkedMeetingCancelledLabel from "../tasks/LinkedMeetingCancelledLabel";
import TaskDetailModal from "../tasks/TaskDetailModal";
import Button from "../ui/Button";
import FormInput from "../ui/FormInput";

const GOLD = "#FFC429";
const ACCENT_RED = "#E51937";

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const useTemplateButtonClass =
  "rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-[#cccccc] transition-colors hover:border-[#555555] hover:text-white";

interface TemplateDraftRow {
  id: string;
  included: boolean;
  title: string;
  assignedTo: string;
  dueDate: string;
}

function TaskTypeBadge() {
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
        flexShrink: 0,
      }}
    >
      {TASK_TYPE_BADGE_LABELS.event}
    </span>
  );
}

function PriorityPill({ priority }: { priority: TaskPriority }) {
  const config: Record<TaskPriority, { border: string; color: string; label: string }> = {
    high: { border: "#E51937", color: "#E51937", label: "High" },
    medium: { border: "#FFC429", color: "#FFC429", label: "Medium" },
    low: { border: "#555555", color: "#555555", label: "Low" },
  };
  const { border, color, label } = config[priority];
  return (
    <span
      style={{
        border: `1px solid ${border}`,
        color,
        borderRadius: "4px",
        padding: "2px 8px",
        fontSize: "10px",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function EventPlanningTemplateModal({
  eventTitle,
  members,
  existingTitles,
  saving,
  onClose,
  onSubmit,
}: {
  eventTitle: string;
  members: ClubMember[];
  existingTitles: Set<string>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (rows: TemplateDraftRow[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<TemplateDraftRow[]>(() =>
    EVENT_PLANNING_TASK_TITLES.map((title, index) => ({
      id: `template-${index}`,
      included: !existingTitles.has(title.toLowerCase()),
      title,
      assignedTo: "",
      dueDate: "",
    })),
  );

  const selectedCount = rows.filter((row) => row.included && row.title.trim()).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-planning-template-title"
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
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #222222",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <h2
              id="event-planning-template-title"
              style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#ffffff" }}
            >
              Review Event Planning Template
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#777777" }}>
              Choose tasks to add for {eventTitle}. All will be linked as Event Tasks.
            </p>
          </div>
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

        <div style={{ overflowY: "auto", padding: "16px 24px", flex: 1 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 1fr 140px",
                gap: "10px",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #1e1e1e",
              }}
            >
              <input
                type="checkbox"
                checked={row.included}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((item) =>
                      item.id === row.id ? { ...item, included: e.target.checked } : item,
                    ),
                  )
                }
              />
              <input
                value={row.title}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((item) =>
                      item.id === row.id ? { ...item, title: e.target.value } : item,
                    ),
                  )
                }
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  color: "#ffffff",
                  padding: "8px 10px",
                  fontSize: "13px",
                }}
              />
              <select
                value={row.assignedTo}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((item) =>
                      item.id === row.id ? { ...item, assignedTo: e.target.value } : item,
                    ),
                  )
                }
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  color: "#ffffff",
                  padding: "8px 10px",
                  fontSize: "13px",
                }}
              >
                <option value="">Unassigned</option>
                {members
                  .filter((member) => member.status === "active")
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {formatNameWithRoleTitle(member.fullName ?? "Member", member.roleTitle)}
                    </option>
                  ))}
              </select>
              <input
                type="date"
                value={row.dueDate}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((item) =>
                      item.id === row.id ? { ...item, dueDate: e.target.value } : item,
                    ),
                  )
                }
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  color: "#ffffff",
                  padding: "8px 10px",
                  fontSize: "13px",
                }}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #222222",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button type="button" onClick={onClose} className={useTemplateButtonClass}>
            Cancel
          </button>
          <Button
            onClick={() => void onSubmit(rows)}
            disabled={saving || selectedCount === 0}
          >
            {saving ? "Adding…" : `Add Selected Tasks (${selectedCount})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanningTaskRow({
  task,
  eventTitle,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  onReassign,
}: {
  task: Task;
  eventTitle: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onReassign: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isDone = task.status === "done";

  return (
    <li
      style={{
        listStyle: "none",
        borderBottom: "1px solid #222222",
        padding: "10px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
            color: "inherit",
            fontFamily: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {isDone ? (
              <Check size={16} color={GOLD} strokeWidth={2.5} aria-hidden />
            ) : null}
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: isDone ? "#666666" : "#ffffff",
                textDecoration: isDone ? "line-through" : "none",
              }}
            >
              {task.title}
            </span>
            <TaskTypeBadge />
            <PriorityPill priority={task.priority} />
          </div>
          <LinkedMeetingCancelledLabel task={task} />
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555555" }}>
            Linked to: {task.linkedEventTitle ?? eventTitle}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#777777" }}>
            {task.assigneeName ?? "Unassigned"}
            {task.dueDate ? ` · Due ${formatTaskDate(task.dueDate)}` : ""}
            {` · ${statusLabels[task.status]}`}
          </p>
        </button>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Task actions"
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: "4px",
                background: "#151515",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                minWidth: "160px",
                zIndex: 30,
                overflow: "hidden",
              }}
            >
              {[
                { label: "View Details", action: onOpen },
                { label: "Edit", action: onEdit },
                ...getTaskStatusMenuItems(task.status).map((item) => ({
                  label: item.label,
                  action: () => onStatusChange(item.status),
                })),
                { label: "Reassign", action: onReassign },
                { label: "Delete", action: onDelete, danger: true },
              ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      item.action();
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: item.danger ? ACCENT_RED : "#cccccc",
                      padding: "9px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export interface EventPlanningTasksSectionProps {
  clubId: string;
  eventId: string;
  eventTitle: string;
  planningTasks: Task[];
  members: ClubMember[];
  createTask: UseClubTasksReturn["createTask"];
  updateTask: UseClubTasksReturn["updateTask"];
  deleteTask: UseClubTasksReturn["deleteTask"];
  onFeedback: (message: { type: "success" | "error"; text: string }) => void;
  initialQuickAddOpen?: boolean;
  onQuickAddOpened?: () => void;
}

export default function EventPlanningTasksSection({
  clubId,
  eventId,
  eventTitle,
  planningTasks,
  members,
  createTask,
  updateTask,
  deleteTask,
  onFeedback,
  initialQuickAddOpen = false,
  onQuickAddOpened,
}: EventPlanningTasksSectionProps) {
  const { user } = useAuthContext();
  const [expanded, setExpanded] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [saving, setSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!initialQuickAddOpen) return;
    setExpanded(true);
    setShowQuickAdd(true);
    onQuickAddOpened?.();
  }, [initialQuickAddOpen, onQuickAddOpened]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );

  const existingTemplateTitles = useMemo(
    () => new Set(planningTasks.map((task) => task.title.trim().toLowerCase())),
    [planningTasks],
  );

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setAssignedTo("");
    setDueDate("");
    setPriority("medium");
    setEditingTaskId(null);
    setShowQuickAdd(false);
  }, []);

  const startEdit = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setAssignedTo(task.assignedTo ?? "");
    setDueDate(task.dueDate ?? "");
    setPriority(task.priority);
    setShowQuickAdd(true);
    setDetailTask(null);
  }, []);

  async function handleSaveTask() {
    if (!title.trim()) return;
    setSaving(true);

    const fields = {
      title: title.trim(),
      description: description.trim(),
      priority,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
      taskType: "event" as const,
      linkedEventId: eventId,
    };

    let ok = false;
    if (editingTaskId) {
      ok = await updateTask(editingTaskId, {
        title: fields.title,
        description: fields.description,
        priority: fields.priority,
        assignedTo: assignedTo || null,
        dueDate: dueDate || null,
        taskType: "event",
        linkedEventId: eventId,
      });
    } else {
      const taskId = await createTask(fields);
      ok = Boolean(taskId);
    }

    setSaving(false);
    if (ok) {
      resetForm();
      onFeedback({
        type: "success",
        text: editingTaskId ? "Planning task updated." : "Planning task added.",
      });
    } else {
      onFeedback({ type: "error", text: "Could not save planning task." });
    }
  }

  async function handleTemplateSubmit(rows: TemplateDraftRow[]) {
    setTemplateSaving(true);
    let created = 0;
    for (const row of rows) {
      if (!row.included || !row.title.trim()) continue;
      const taskId = await createTask({
        title: row.title.trim(),
        description: `Planning task for ${eventTitle}`,
        priority: "medium",
        assignedTo: row.assignedTo || undefined,
        dueDate: row.dueDate || undefined,
        taskType: "event",
        linkedEventId: eventId,
      });
      if (taskId) created += 1;
    }
    setTemplateSaving(false);
    setShowTemplateModal(false);
    if (created > 0) {
      onFeedback({
        type: "success",
        text: `Added ${created} planning task${created === 1 ? "" : "s"}.`,
      });
    } else {
      onFeedback({ type: "error", text: "No tasks were added." });
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    const ok = await updateTask(taskId, { status });
    if (ok) {
      onFeedback({
        type: "success",
        text: status === "done" ? "Task marked complete." : "Task status updated.",
      });
      setDetailTask((prev) => (prev?.id === taskId ? { ...prev, status } : prev));
    } else {
      onFeedback({ type: "error", text: "Could not update task status." });
    }
  }

  async function handleDelete(taskId: string) {
    if (!window.confirm("Delete this planning task?")) return;
    const ok = await deleteTask(taskId);
    if (ok) {
      if (detailTask?.id === taskId) setDetailTask(null);
      onFeedback({ type: "success", text: "Planning task deleted." });
    } else {
      onFeedback({ type: "error", text: "Could not delete planning task." });
    }
  }

  const detailTaskLive =
    detailTask ? planningTasks.find((task) => task.id === detailTask.id) ?? detailTask : null;

  function assigneeDisplayFor(task: Task): string {
    const member = members.find((m) => m.userId === task.assignedTo);
    const name = task.assigneeName ?? member?.fullName ?? "Unassigned";
    if (!task.assignedTo) return "Unassigned";
    return formatNameWithRoleTitle(name, member?.roleTitle);
  }

  function assigneeAvatarFor(task: Task): string | undefined {
    if (task.assigneeAvatar) return task.assigneeAvatar;
    return members.find((m) => m.userId === task.assignedTo)?.avatarUrl;
  }

  const commenterName =
    (typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") ||
    user?.email?.split("@")[0] ||
    "A member";

  return (
    <>
      <div
        style={{
          border: "1px solid #2a2a2a",
          borderRadius: "10px",
          padding: "14px",
          background: "#111111",
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            background: "transparent",
            border: "none",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          <span>Planning Tasks ({planningTasks.length})</span>
        </button>

        {expanded ? (
          <div style={{ marginTop: "12px" }}>
            {planningTasks.length === 0 ? (
              <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#777777" }}>
                No planning tasks linked to this event yet.
              </p>
            ) : (
              <ul style={{ margin: "0 0 12px", padding: 0 }}>
                {planningTasks.map((task) => (
                  <PlanningTaskRow
                    key={task.id}
                    task={task}
                    eventTitle={eventTitle}
                    onOpen={() => setDetailTask(task)}
                    onEdit={() => startEdit(task)}
                    onDelete={() => void handleDelete(task.id)}
                    onStatusChange={(status) => void handleStatusChange(task.id, status)}
                    onReassign={() => startEdit(task)}
                  />
                ))}
              </ul>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  if (showQuickAdd && !editingTaskId) {
                    resetForm();
                  } else {
                    setShowQuickAdd(true);
                  }
                }}
                className={useTemplateButtonClass}
              >
                {showQuickAdd ? "Cancel" : "Add Planning Task"}
              </button>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                disabled={templateSaving}
                className={useTemplateButtonClass}
              >
                Use Event Planning Template
              </button>
            </div>

            {showQuickAdd ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <FormInput
                  id="planningTaskTitle"
                  label="Task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Confirm catering"
                  required
                />
                <div>
                  <label
                    htmlFor="planningTaskDescription"
                    style={{ display: "block", fontSize: "13px", color: "#cccccc", marginBottom: "6px" }}
                  >
                    Description / notes
                  </label>
                  <textarea
                    id="planningTaskDescription"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Optional details for this planning task"
                    style={{
                      width: "100%",
                      background: "#0f0f0f",
                      border: "1px solid #2a2a2a",
                      borderRadius: "8px",
                      color: "#ffffff",
                      padding: "10px 12px",
                      fontSize: "14px",
                      resize: "vertical",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div>
                    <label
                      htmlFor="planningTaskAssignee"
                      style={{ display: "block", fontSize: "13px", color: "#cccccc", marginBottom: "6px" }}
                    >
                      Assigned to
                    </label>
                    <select
                      id="planningTaskAssignee"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#0f0f0f",
                        border: "1px solid #2a2a2a",
                        borderRadius: "8px",
                        color: "#ffffff",
                        padding: "10px 12px",
                        fontSize: "14px",
                      }}
                    >
                      <option value="">Unassigned</option>
                      {activeMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {formatNameWithRoleTitle(member.fullName ?? "Member", member.roleTitle)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FormInput
                    id="planningTaskDueDate"
                    label="Due date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <div>
                    <label
                      htmlFor="planningTaskPriority"
                      style={{ display: "block", fontSize: "13px", color: "#cccccc", marginBottom: "6px" }}
                    >
                      Priority
                    </label>
                    <select
                      id="planningTaskPriority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      style={{
                        width: "100%",
                        background: "#0f0f0f",
                        border: "1px solid #2a2a2a",
                        borderRadius: "8px",
                        color: "#ffffff",
                        padding: "10px 12px",
                        fontSize: "14px",
                      }}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <FormInput
                    id="planningTaskStatus"
                    label="Status"
                    value="To Do"
                    readOnly
                    onChange={() => undefined}
                  />
                  <FormInput
                    id="planningLinkedEvent"
                    label="Linked event"
                    value={eventTitle}
                    readOnly
                    onChange={() => undefined}
                  />
                  <FormInput
                    id="planningTaskType"
                    label="Task type"
                    value="Event Task"
                    readOnly
                    onChange={() => undefined}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <Button variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleSaveTask()} disabled={!title.trim() || saving}>
                    {saving ? "Saving…" : editingTaskId ? "Save Changes" : "Add Task"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showTemplateModal ? (
        <EventPlanningTemplateModal
          eventTitle={eventTitle}
          members={members}
          existingTitles={existingTemplateTitles}
          saving={templateSaving}
          onClose={() => setShowTemplateModal(false)}
          onSubmit={handleTemplateSubmit}
        />
      ) : null}

      {detailTaskLive ? (
        <TaskDetailModal
          task={detailTaskLive}
          clubId={clubId}
          onClose={() => setDetailTask(null)}
          assigneeName={assigneeDisplayFor(detailTaskLive)}
          assigneeAvatarUrl={assigneeAvatarFor(detailTaskLive)}
          canEdit
          canDelete
          canChangeStatus
          canComment
          commenterName={commenterName}
          userId={user?.id}
          linkedEventFallback={eventTitle}
          onEdit={() => startEdit(detailTaskLive)}
          onDelete={() => void handleDelete(detailTaskLive.id)}
          onStatusChange={(status) => void handleStatusChange(detailTaskLive.id, status)}
        />
      ) : null}
    </>
  );
}
