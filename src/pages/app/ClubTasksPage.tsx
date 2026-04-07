import { useState } from "react";
import { useParams } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubTasks } from "../../hooks/useClubTasks";
import { useClubMembers } from "../../hooks/useClubMembers";
import type { Task, TaskStatus, TaskPriority } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-green-500/10 text-green-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high: "bg-red-500/10 text-red-400",
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-blue-500/10 text-blue-400",
  in_progress: "bg-yellow-500/10 text-yellow-400",
  done: "bg-green-500/10 text-green-400",
};

export default function ClubTasksPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getUserRole } = useClubContext();
  const {
    tasks,
    loading,
    error: loadError,
    createTask,
    updateTask,
    deleteTask,
  } = useClubTasks(clubId);
  const { members } = useClubMembers(clubId);

  const role = getUserRole(clubId ?? "");
  const isAdminOrExec = role === "admin" || role === "exec";

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
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  // Count tasks by status
  const todoCt = tasks.filter((t) => t.status === "todo").length;
  const inProgressCt = tasks.filter((t) => t.status === "in_progress").length;
  const doneCt = tasks.filter((t) => t.status === "done").length;

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
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-muted">
            {todoCt} to do · {inProgressCt} in progress · {doneCt} done
          </p>
        </div>
        {isAdminOrExec && (
          <Button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
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
      {showForm && isAdminOrExec && (
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
                Assign To
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
            className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === s
                ? "bg-primary text-white"
                : "bg-surface text-muted hover:bg-surface-alt"
            }`}
          >
            {s === "all"
              ? `All (${tasks.length})`
              : `${statusLabels[s]} (${tasks.filter((t) => t.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 text-3xl">📋</div>
          <p className="font-medium text-white">
            {tasks.length === 0
              ? "No tasks yet"
              : "No tasks match this filter"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {tasks.length === 0
              ? isAdminOrExec
                ? "Create a task to get your team organized."
                : "Your team hasn't created any tasks yet."
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

            return (
              <Card key={task.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`font-medium ${task.status === "done" ? "text-muted line-through" : "text-white"}`}
                      >
                        {task.title}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[task.status]}`}
                      >
                        {statusLabels[task.status]}
                      </span>
                    </div>
                    {task.description && (
                      <p className="mt-1 text-sm text-muted">
                        {task.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                      {task.assigneeName && (
                        <span>👤 {task.assigneeName}</span>
                      )}
                      {task.dueDate && (
                        <span className={isOverdue ? "text-red-400" : ""}>
                          📅{" "}
                          {new Date(task.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {isOverdue && " (overdue)"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        handleStatusChange(
                          task.id,
                          e.target.value as TaskStatus,
                        )
                      }
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-white"
                      aria-label="Change task status"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    {isAdminOrExec && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(task)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(task.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
