import { useState } from "react";
import { useParams } from "react-router-dom";
import type { Task, TaskStatus, TaskPriority } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-700",
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export default function ClubTasksPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  // New task form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  function handleAddTask() {
    if (!title.trim()) return;

    const task: Task = {
      id: `task-${Date.now()}`,
      clubId: clubId ?? "",
      title: title.trim(),
      description: description.trim(),
      status: "todo",
      priority,
      dueDate: dueDate || undefined,
      createdBy: "current-user",
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [task, ...prev]);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setShowForm(false);
  }

  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
  }

  const filteredTasks =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-accent">Tasks</h1>
          <p className="text-sm text-muted">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Task"}
        </Button>
      </div>

      {/* New task form */}
      {showForm && (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 font-semibold text-accent">Create New Task</h3>
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
                className="mb-1 block text-sm font-medium text-accent"
              >
                Description
              </label>
              <textarea
                id="taskDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Add details…"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-accent placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label
                  htmlFor="taskPriority"
                  className="mb-1 block text-sm font-medium text-accent"
                >
                  Priority
                </label>
                <select
                  id="taskPriority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-accent focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            <div className="flex justify-end pt-2">
              <Button onClick={handleAddTask} disabled={!title.trim()}>
                Add Task
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
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
            {s === "all" ? "All" : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            {tasks.length === 0
              ? "No tasks yet. Create one to get started!"
              : "No tasks match the current filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`font-medium ${task.status === "done" ? "text-muted line-through" : "text-accent"}`}
                    >
                      {task.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="mt-1 text-sm text-muted">
                      {task.description}
                    </p>
                  )}
                  {task.dueDate && (
                    <p className="mt-1 text-xs text-muted">
                      Due:{" "}
                      {new Date(task.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <select
                  value={task.status}
                  onChange={(e) =>
                    handleStatusChange(task.id, e.target.value as TaskStatus)
                  }
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-accent"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
