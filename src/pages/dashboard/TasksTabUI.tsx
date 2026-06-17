import { useMemo } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Play,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import LinkedMeetingCancelledLabel from "../../components/tasks/LinkedMeetingCancelledLabel";
import { formatTaskDate } from "../../lib/taskDueUrgency";

const CARD_STYLE = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "20px",
} as const;

const CHIP_BASE = {
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid #2a2a2a",
} as const;

export type TasksTabTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  taskType: string;
  clubName: string;
  clubId: string;
  clubAbbreviation?: string;
  clubLogoUrl?: string;
  dueDate?: string;
  createdAt?: string;
  linkedMeetingCancelled?: boolean;
};

export type TaskClubGroup = {
  clubId: string;
  clubName: string;
  clubAbbreviation?: string;
  tasks: TasksTabTask[];
  doneCount: number;
  totalCount: number;
};

export type TaskSortOption = "due_date" | "priority" | "status" | "club_name";
export type TaskPriorityFilter = "all" | "high" | "medium" | "low";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DONUT_CIRCUMFERENCE = 201;

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentWeekDayKeys(reference = new Date()): string[] {
  const ref = new Date(reference);
  const dayOfWeek = ref.getDay();
  const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diff);

  return WEEK_LABELS.map((_, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return localIsoDate(d);
  });
}

function parseIsoDay(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  const d = new Date(`${dateStr.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntilDue(dueDate?: string): number | null {
  if (!dueDate?.trim()) return null;
  const due = parseIsoDay(dueDate.trim());
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysLeftColor(days: number): string {
  if (days <= 3) return "#E51937";
  if (days <= 7) return "#FFC429";
  return "#555555";
}

function daysLeftLabel(days: number): string {
  if (days < 0) {
    const overdue = Math.abs(days);
    return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

function taskTypeLabel(taskType: string): string {
  switch (taskType) {
    case "event":
      return "Event";
    case "hiring":
      return "Hiring";
    case "setup":
      return "Setup";
    case "meeting":
      return "Meeting";
    default:
      return "General";
  }
}

function taskStatusLabel(status: string): string {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "To Do";
}

function taskStatusPillStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    borderRadius: "20px",
    padding: "3px 10px",
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
  if (status === "in_progress") {
    return {
      ...base,
      background: "rgba(255, 196, 41, 0.12)",
      border: "1px solid rgba(255, 196, 41, 0.35)",
      color: "#FFC429",
    };
  }
  if (status === "done") {
    return {
      ...base,
      background: "rgba(229, 25, 55, 0.12)",
      border: "1px solid rgba(229, 25, 55, 0.35)",
      color: "#E51937",
    };
  }
  return {
    ...base,
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#888888",
  };
}

function completionDayKey(task: TasksTabTask): string | null {
  if (task.status !== "done" || !task.createdAt) return null;
  const d = new Date(task.createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return localIsoDate(d);
}

export function useWeeklyTaskProgress(tasks: TasksTabTask[]) {
  return useMemo(() => {
    const weekDayKeys = getCurrentWeekDayKeys();
    const weekStart = weekDayKeys[0];
    const weekEnd = weekDayKeys[6];

    const weekTasks = tasks.filter((task) => {
      if (task.dueDate?.trim()) {
        const due = task.dueDate.trim();
        return due >= weekStart && due <= weekEnd;
      }
      return true;
    });

    const completed = weekTasks.filter((task) => task.status === "done").length;
    const dailyCounts = weekDayKeys.map((dayKey) =>
      tasks.filter((task) => completionDayKey(task) === dayKey).length,
    );

    return {
      weekDayKeys,
      weekLabels: WEEK_LABELS,
      completed,
      total: weekTasks.length,
      dailyCounts,
    };
  }, [tasks]);
}

export function useTaskBreakdown(tasks: TasksTabTask[]) {
  return useMemo(() => {
    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const total = todo + inProgress + done || 1;

    const segments = [
      { key: "todo", label: "To Do", color: "#555555", count: todo },
      { key: "in_progress", label: "In Progress", color: "#FFC429", count: inProgress },
      { key: "done", label: "Done", color: "#E51937", count: done },
    ];

    let offset = 0;
    const arcs = segments.map((segment) => {
      const length = (segment.count / total) * DONUT_CIRCUMFERENCE;
      const arc = { ...segment, dashArray: `${length} ${DONUT_CIRCUMFERENCE}`, dashOffset: -offset };
      offset += length;
      return arc;
    });

    return { segments, arcs, total: todo + inProgress + done };
  }, [tasks]);
}

export function WeeklyTaskProgressCard({
  completed,
  total,
  dailyCounts,
  weekLabels,
}: {
  completed: number;
  total: number;
  dailyCounts: number[];
  weekLabels: readonly string[];
}) {
  const chartWidth = 320;
  const chartHeight = 88;
  const paddingX = 16;
  const paddingY = 12;
  const maxCount = Math.max(1, ...dailyCounts);

  const points = dailyCounts.map((count, index) => {
    const x =
      paddingX +
      (index / Math.max(weekLabels.length - 1, 1)) * (chartWidth - paddingX * 2);
    const y =
      chartHeight - paddingY - (count / maxCount) * (chartHeight - paddingY * 2);
    return { x, y, count };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div style={{ ...CARD_STYLE, flex: 1.5, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          gap: "12px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
          Weekly Task Progress
        </h3>
        <span style={{ fontSize: "12px", color: "#777777", whiteSpace: "nowrap" }}>
          {completed} / {total} completed
        </span>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
        height={chartHeight}
        aria-hidden
        style={{ display: "block" }}
      >
        <polyline
          points={polyline}
          fill="none"
          stroke="#E51937"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={weekLabels[index]}>
            <circle cx={point.x} cy={point.y} r={4} fill="#E51937" />
            {point.count > 0 ? (
              <g transform={`translate(${point.x - 6}, ${point.y - 22})`}>
                <circle cx={6} cy={6} r={7} fill="#141414" stroke="#E51937" strokeWidth={1} />
                <path
                  d="M3.5 6 L5.5 8 L8.5 4.5"
                  stroke="#FFC429"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
          </g>
        ))}
      </svg>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${weekLabels.length}, 1fr)`,
          gap: "4px",
          marginTop: "8px",
        }}
      >
        {weekLabels.map((label) => (
          <span
            key={label}
            style={{ textAlign: "center", fontSize: "11px", color: "#555555" }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TaskBreakdownCard({
  arcs,
  segments,
}: {
  arcs: Array<{
    key: string;
    label: string;
    color: string;
    count: number;
    dashArray: string;
    dashOffset: number;
  }>;
  segments: Array<{ key: string; label: string; color: string; count: number }>;
}) {
  return (
    <div style={{ ...CARD_STYLE, flex: 1, minWidth: 0 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
        Task Breakdown
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <svg width={88} height={88} viewBox="0 0 80 80" aria-hidden style={{ flexShrink: 0 }}>
          <circle cx={40} cy={40} r={32} stroke="#2a2a2a" strokeWidth={8} fill="none" />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={40}
              cy={40}
              r={32}
              stroke={arc.color}
              strokeWidth={8}
              fill="none"
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
              transform="rotate(-90 40 40)"
            />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
          {segments.map((segment) => (
            <div
              key={segment.key}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: segment.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: "12px", color: "#cccccc" }}>{segment.label}</span>
              <span style={{ fontSize: "12px", color: "#ffffff", fontWeight: 700 }}>
                {segment.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TasksFilterBar({
  search,
  onSearchChange,
  clubFilter,
  onClubFilterChange,
  clubOptions,
  sort,
  onSortChange,
  priorityFilter,
  onPriorityFilterChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  clubFilter: string;
  onClubFilterChange: (value: string) => void;
  clubOptions: Array<{ id: string; name: string }>;
  sort: TaskSortOption;
  onSortChange: (value: TaskSortOption) => void;
  priorityFilter: TaskPriorityFilter;
  onPriorityFilterChange: (value: TaskPriorityFilter) => void;
}) {
  const priorities: TaskPriorityFilter[] = ["all", "high", "medium", "low"];

  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          justifyContent: "flex-end",
          marginBottom: "12px",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "10px 14px",
            width: "min(100%, 240px)",
          }}
        >
          <Search size={16} color="#555555" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tasks..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#ffffff",
              fontSize: "13px",
            }}
          />
        </label>

        <select
          value={clubFilter}
          onChange={(event) => onClubFilterChange(event.target.value)}
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "#cccccc",
            fontSize: "13px",
          }}
        >
          <option value="all">All Clubs</option>
          {clubOptions.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as TaskSortOption)}
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "#cccccc",
            fontSize: "13px",
          }}
        >
          <option value="due_date">Sort: Due Date</option>
          <option value="priority">Sort: Priority</option>
          <option value="status">Sort: Status</option>
          <option value="club_name">Sort: Club Name</option>
        </select>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {priorities.map((priority) => {
          const selected = priorityFilter === priority;
          const label =
            priority === "all"
              ? "All"
              : priority.charAt(0).toUpperCase() + priority.slice(1);
          return (
            <button
              key={priority}
              type="button"
              onClick={() => onPriorityFilterChange(priority)}
              style={{
                ...CHIP_BASE,
                background: selected ? "#E51937" : "#111111",
                border: `1px solid ${selected ? "#E51937" : "#2a2a2a"}`,
                color: selected ? "#ffffff" : "#999999",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "in_progress") {
    return (
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "rgba(255, 196, 41, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Play size={12} color="#FFC429" fill="#FFC429" aria-hidden />
      </div>
    );
  }

  if (status === "done") {
    return (
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          border: "2px solid #FFC429",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Check size={12} color="#FFC429" strokeWidth={3} aria-hidden />
      </div>
    );
  }

  return (
    <Circle
      size={22}
      color="#444444"
      strokeWidth={2}
      aria-hidden
      style={{ flexShrink: 0 }}
    />
  );
}

function TaskTabClubLogo({
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
  const abbr =
    abbreviation?.trim() ||
    name
      .split(" ")
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
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
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
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

export function TasksTabTaskRow({ task }: { task: TasksTabTask }) {
  const daysLeft = daysUntilDue(task.dueDate);

  return (
    <Link
      to={`/app/clubs/${task.clubId}/tasks`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
          padding: "14px 16px",
          marginBottom: "6px",
        }}
      >
        <TaskStatusIcon status={task.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            {task.title}
          </p>
          <LinkedMeetingCancelledLabel show={task.linkedMeetingCancelled} />
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#555555" }}>
            {task.clubName} · {taskTypeLabel(task.taskType)}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginRight: "8px" }}>
          {task.dueDate?.trim() ? (
            <>
              <p style={{ margin: 0, fontSize: "12px", color: "#cccccc" }}>
                {formatTaskDate(task.dueDate)}
              </p>
              {daysLeft !== null && task.status !== "done" ? (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "11px",
                    color: daysLeftColor(daysLeft),
                  }}
                >
                  {daysLeftLabel(daysLeft)}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <span style={taskStatusPillStyle(task.status)}>{taskStatusLabel(task.status)}</span>
      </div>
    </Link>
  );
}

export function TaskClubGroupSection({
  group,
  logoUrl,
  expanded,
  onToggle,
}: {
  group: TaskClubGroup;
  logoUrl?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const progressPercent =
    group.totalCount > 0 ? Math.round((group.doneCount / group.totalCount) * 100) : 0;
  const progressColor = progressPercent < 50 ? "#E51937" : "#FFC429";

  return (
    <div style={{ marginBottom: "20px" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "transparent",
          border: "none",
          padding: 0,
          marginBottom: expanded ? "12px" : 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <TaskTabClubLogo
          name={group.clubName}
          abbreviation={group.clubAbbreviation}
          logoUrl={logoUrl}
          size={32}
        />
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>
          {group.clubName}
        </span>
        <div
          style={{
            flex: 1,
            height: "4px",
            background: "#2a2a2a",
            borderRadius: "2px",
            overflow: "hidden",
            minWidth: "60px",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: progressColor,
            }}
          />
        </div>
        <span style={{ fontSize: "12px", color: "#777777", whiteSpace: "nowrap" }}>
          {group.doneCount} of {group.totalCount} done
        </span>
        {expanded ? (
          <ChevronUp size={18} color="#555555" aria-hidden />
        ) : (
          <ChevronDown size={18} color="#555555" aria-hidden />
        )}
      </button>

      {expanded ? (
        group.tasks.length === 0 ? (
          <p style={{ margin: 0, textAlign: "center", fontSize: "12px", color: "#555555" }}>
            No tasks for this club
          </p>
        ) : (
          <div>
            {group.tasks.map((task) => (
              <TasksTabTaskRow key={task.id} task={task} />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

export function TasksTabFooter({
  visibleCount,
  totalCount,
  clubCount,
  filtersActive,
}: {
  visibleCount: number;
  totalCount: number;
  clubCount: number;
  filtersActive: boolean;
}) {
  const label = filtersActive
    ? `Showing ${visibleCount} of ${totalCount} tasks`
    : `Showing ${visibleCount} tasks across ${clubCount} club${clubCount === 1 ? "" : "s"}`;

  return (
    <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: "12px", color: "#555555" }}>
      {label}
    </p>
  );
}

export function prioritySortValue(priority: string): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

export function statusSortValue(status: string): number {
  if (status === "todo") return 0;
  if (status === "in_progress") return 1;
  if (status === "done") return 2;
  return 3;
}
