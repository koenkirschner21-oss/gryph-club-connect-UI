import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Flag,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Task, TaskPriority, TaskStatus, TaskType } from "../../../types";
import { TASK_TYPE_BADGE_LABELS, TASK_TYPE_FILTER_CHIPS, type TaskTypeFilter } from "../../../lib/taskTypes";
import { formatTaskDate } from "../../../lib/taskDueUrgency";
import { getTaskStatusMenuItems } from "../../../lib/taskStatusActions";
import { isTaskInactiveForDueTracking } from "../../../lib/taskDueUrgency";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

export const LIST_GRID_COLUMNS = "32px 1fr 160px 140px 120px 100px 80px 120px";

const statCardStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "10px",
  padding: "16px",
};

export type TasksStatCardFilter = "all" | "due_this_week" | "high_priority" | "completed" | "overdue";

function statCardButtonStyle(isActive: boolean): CSSProperties {
  return {
    ...statCardStyle,
    border: isActive ? `1px solid ${GOLD}` : `1px solid ${CARD_BORDER}`,
    background: isActive ? "#1a1810" : CARD_BG,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    width: "100%",
    boxShadow: isActive ? `0 0 0 1px rgba(255, 196, 41, 0.2)` : undefined,
    transition: "border-color 0.15s ease, background 0.15s ease",
  };
}

export function CircularProgress({ percent }: { percent: number }) {
  const size = 56;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#2a2a2a"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={GOLD}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "none", animation: "none" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="14"
        fontWeight={700}
      >
        {percent}%
      </text>
    </svg>
  );
}

export function TasksListStatCards({
  doneCount,
  totalCount,
  dueThisWeekCount,
  highPriorityCount,
  isMobile = false,
  activeFilter = "all",
  onFilterChange,
}: {
  doneCount: number;
  totalCount: number;
  dueThisWeekCount: number;
  highPriorityCount: number;
  isMobile?: boolean;
  activeFilter?: TasksStatCardFilter;
  onFilterChange?: (filter: TasksStatCardFilter) => void;
}) {
  const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  const fillPercent = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;

  function handleFilter(filter: TasksStatCardFilter) {
    onFilterChange?.(filter);
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      <button
        type="button"
        onClick={() => handleFilter("all")}
        aria-pressed={activeFilter === "all"}
        style={{
          ...statCardButtonStyle(activeFilter === "all"),
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <CircularProgress percent={percent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "11px",
              color: "#777777",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Overall Progress
          </p>
          <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#cccccc" }}>
            {doneCount} of {totalCount} tasks complete
          </p>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: "#2a2a2a",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${fillPercent}%`,
                background: GOLD,
                borderRadius: "2px",
                transition: "none",
              }}
            />
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => handleFilter("due_this_week")}
        aria-pressed={activeFilter === "due_this_week"}
        style={statCardButtonStyle(activeFilter === "due_this_week")}
      >
        <Calendar size={20} color="#777777" aria-hidden style={{ marginBottom: "8px" }} />
        <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>
          {dueThisWeekCount}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#777777" }}>Due This Week</p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#555555" }}>
          {dueThisWeekCount === 1 ? "task" : "tasks"}
        </p>
      </button>

      <button
        type="button"
        onClick={() => handleFilter("high_priority")}
        aria-pressed={activeFilter === "high_priority"}
        style={statCardButtonStyle(activeFilter === "high_priority")}
      >
        <Flag size={20} color={ACCENT_RED} aria-hidden style={{ marginBottom: "8px" }} />
        <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>
          {highPriorityCount}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#777777" }}>High Priority</p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#555555" }}>
          {highPriorityCount === 1 ? "task" : "tasks"}
        </p>
      </button>

      <button
        type="button"
        onClick={() => handleFilter("completed")}
        aria-pressed={activeFilter === "completed"}
        style={statCardButtonStyle(activeFilter === "completed")}
      >
        <CheckCircle size={20} color={GOLD} aria-hidden style={{ marginBottom: "8px" }} />
        <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>
          {doneCount}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#777777" }}>Completed</p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#555555" }}>
          {doneCount === 1 ? "task" : "tasks"}
        </p>
      </button>
    </div>
  );
}

export function TaskTypeFilterDropdown({
  value,
  onChange,
}: {
  value: TaskTypeFilter;
  onChange: (value: TaskTypeFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const current =
    TASK_TYPE_FILTER_CHIPS.find((chip) => chip.id === value)?.label ?? "All";

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "#1a1a1a",
          border: `1px solid ${CARD_BORDER}`,
          color: "#ffffff",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "13px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Type: {current}
        <ChevronDown size={14} color="#777777" aria-hidden />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            minWidth: "180px",
            background: "#151515",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            overflow: "hidden",
            zIndex: 20,
          }}
        >
          {TASK_TYPE_FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                onChange(chip.id);
                setOpen(false);
              }}
              style={{
                width: "100%",
                background: value === chip.id ? "#1f1f1f" : "transparent",
                border: "none",
                textAlign: "left",
                color: value === chip.id ? "#ffffff" : "#999999",
                fontSize: "13px",
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusCircleIcon({
  status,
  isUpdating = false,
}: {
  status: TaskStatus;
  isUpdating?: boolean;
}) {
  if (isUpdating) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-hidden
        style={{ animation: "taskStatusSpin 0.8s linear infinite", flexShrink: 0 }}
      >
        <style>{`@keyframes taskStatusSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="3"
        />
        <path
          fill="none"
          stroke={GOLD}
          strokeWidth="3"
          strokeLinecap="round"
          d="M12 2a10 10 0 0 1 10 10"
        />
      </svg>
    );
  }

  if (status === "done") {
    return <CheckCircle size={18} color={GOLD} aria-hidden />;
  }

  if (status === "in_progress") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden style={{ flexShrink: 0 }}>
        <circle cx="9" cy="9" r="7" fill="none" stroke="#2a2a2a" strokeWidth="2" />
        <path
          d="M9 2 A7 7 0 0 1 16 9"
          fill="none"
          stroke={GOLD}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        border: "2px solid #555555",
        flexShrink: 0,
      }}
      aria-hidden
    />
  );
}

export function parseTaskDueDay(dueDate: string): Date | null {
  const trimmed = dueDate.trim();
  if (!trimmed) return null;
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  return due;
}

export function formatDueDateSubLabel(
  dueDate: string | undefined,
  status: TaskStatus,
): { text: string; color: string } | null {
  if (!dueDate?.trim() || isTaskInactiveForDueTracking(status)) return null;
  const dueDay = parseTaskDueDay(dueDate);
  if (!dueDay) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      text: `Overdue by ${days} day${days === 1 ? "" : "s"}`,
      color: ACCENT_RED,
    };
  }
  if (diffDays === 0) {
    return { text: "Due today", color: "#777777" };
  }
  return {
    text: `${diffDays} day${diffDays === 1 ? "" : "s"} left`,
    color: "#777777",
  };
}

export function formatRelativeDueLabel(
  dueDate: string | undefined,
  status: TaskStatus,
): { text: string; color: string } | null {
  if (!dueDate?.trim() || isTaskInactiveForDueTracking(status)) return null;
  const dueDay = parseTaskDueDay(dueDate);
  if (!dueDay) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { text: "Overdue", color: ACCENT_RED };
  if (diffDays === 0) return { text: "Today", color: "#777777" };
  if (diffDays === 1) return { text: "Tomorrow", color: "#777777" };
  if (diffDays <= 7) return { text: `In ${diffDays} days`, color: "#777777" };
  return null;
}

export function sortTasksByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDue = a.dueDate ? parseTaskDueDay(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? parseTaskDueDay(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

function ListTypePill({ taskType }: { taskType: TaskType }) {
  return (
    <span
      style={{
        background: "#1a1a1a",
        border: `1px solid ${CARD_BORDER}`,
        color: "#999999",
        borderRadius: "4px",
        padding: "2px 8px",
        fontSize: "11px",
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {TASK_TYPE_BADGE_LABELS[taskType]}
    </span>
  );
}

function ListPriorityPill({
  priority,
  muted = false,
}: {
  priority: TaskPriority;
  muted?: boolean;
}) {
  const config: Record<TaskPriority, { border: string; color: string; label: string }> = {
    high: { border: ACCENT_RED, color: ACCENT_RED, label: "High" },
    medium: { border: GOLD, color: GOLD, label: "Medium" },
    low: { border: "#555555", color: "#555555", label: "Low" },
  };
  const { border, color, label } = muted
    ? { border: "#555555", color: "#555555", label: config[priority].label }
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
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function TasksListColumnHeaders() {
  const labelStyle: CSSProperties = {
    fontSize: "11px",
    color: "#555555",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: LIST_GRID_COLUMNS,
        gap: "8px",
        borderBottom: `1px solid ${CARD_BORDER}`,
        paddingBottom: "8px",
        marginBottom: "8px",
      }}
    >
      <span />
      <span style={labelStyle}>Task</span>
      <span style={labelStyle}>Assignee</span>
      <span style={labelStyle}>Due Date</span>
      <span style={labelStyle}>Type</span>
      <span style={labelStyle}>Priority</span>
      <span style={labelStyle}>Comments</span>
      <span style={labelStyle}>Actions</span>
    </div>
  );
}

const sectionUnderlineColor: Record<
  "todo" | "in_progress" | "done" | "pending_review",
  string
> = {
  todo: ACCENT_RED,
  in_progress: GOLD,
  done: "#555555",
  pending_review: GOLD,
};

const sectionLabels: Record<"todo" | "in_progress" | "done" | "pending_review", string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Completed",
  pending_review: "Submitted for Review",
};

export function TasksListSectionHeader({
  sectionStatus,
  count,
  nextDueLabel,
  nextDueOverdue,
}: {
  sectionStatus: "todo" | "in_progress" | "done" | "pending_review";
  count: number;
  nextDueLabel?: string | null;
  nextDueOverdue?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
        paddingBottom: "8px",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#ffffff",
              textTransform: "uppercase",
            }}
          >
            {sectionLabels[sectionStatus]}
          </span>
          <span
            style={{
              background: "#2a2a2a",
              color: "#999999",
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "12px",
            }}
          >
            {count}
          </span>
        </div>
        <div
          style={{
            marginTop: "6px",
            height: "2px",
            width: "40px",
            background: sectionUnderlineColor[sectionStatus],
            borderRadius: "1px",
          }}
        />
      </div>
      {nextDueLabel && sectionStatus !== "done" ? (
        <span
          style={{
            fontSize: "12px",
            color: nextDueOverdue ? ACCENT_RED : "#777777",
          }}
        >
          Next due {nextDueLabel}
        </span>
      ) : null}
    </div>
  );
}

function AssigneeCell({
  assigneeId,
  assigneeName,
  avatarUrl,
  initials,
}: {
  assigneeId?: string;
  assigneeName: string;
  avatarUrl?: string;
  initials: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
      {avatarUrl ? (
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
      ) : (
        <div
          style={{
            width: "28px",
            height: "28px",
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
          {initials}
        </div>
      )}
      {assigneeId ? (
        <Link
          to={`/app/profile/${assigneeId}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: "13px",
            color: "#cccccc",
            textDecoration: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {assigneeName}
        </Link>
      ) : (
        <span
          style={{
            fontSize: "13px",
            color: "#cccccc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {assigneeName}
        </span>
      )}
    </div>
  );
}

export function TasksListTableRow({
  task,
  isDone,
  isHovered,
  assigneeName,
  assigneeId,
  assigneeAvatar,
  assigneeInitials,
  commentCount,
  showStatusAction,
  listAction,
  actionStyle,
  onRowClick,
  onStatusAction,
  onViewDetails,
  menu,
  linkedLabel,
  statusUpdating = false,
}: {
  task: Task;
  isDone: boolean;
  isHovered: boolean;
  assigneeName: string;
  assigneeId?: string;
  assigneeAvatar?: string;
  assigneeInitials: string;
  commentCount: number;
  showStatusAction: boolean;
  listAction: string | null;
  actionStyle: CSSProperties;
  onRowClick: () => void;
  onStatusAction: () => void;
  onViewDetails: () => void;
  menu: ReactNode;
  linkedLabel?: ReactNode;
  statusUpdating?: boolean;
}) {
  const dueSubLabel = formatDueDateSubLabel(task.dueDate, task.status);

  return (
    <div
      onClick={onRowClick}
      style={{
        display: "grid",
        gridTemplateColumns: LIST_GRID_COLUMNS,
        gap: "8px",
        alignItems: "start",
        background: isHovered ? "#181818" : CARD_BG,
        border: `1px solid ${isHovered ? "#333333" : CARD_BORDER}`,
        borderRadius: "8px",
        padding: "12px 14px",
        marginBottom: "8px",
        opacity: isDone ? 0.65 : 1,
        cursor: "pointer",
        transition: "border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease",
      }}
    >
      <GripVertical size={16} color="#333333" aria-hidden style={{ flexShrink: 0, marginTop: "2px" }} />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ marginTop: "2px", flexShrink: 0 }}>
          <StatusCircleIcon status={task.status} isUpdating={statusUpdating} />
        </div>
        <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              textDecoration: isDone ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </p>
          {linkedLabel}
        </div>
      </div>

      <AssigneeCell
        assigneeId={assigneeId}
        assigneeName={assigneeName}
        avatarUrl={assigneeAvatar}
        initials={assigneeInitials}
      />

      <div style={{ minWidth: 0, paddingTop: "2px" }}>
        {task.dueDate ? (
          <>
            <p style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>
              Due: {formatTaskDate(task.dueDate)}
            </p>
            {dueSubLabel ? (
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: dueSubLabel.color }}>
                {dueSubLabel.text}
              </p>
            ) : null}
          </>
        ) : (
          <span style={{ fontSize: "13px", color: "#555555" }}>—</span>
        )}
      </div>

      <div style={{ minWidth: 0, paddingTop: "2px" }}>
        <ListTypePill taskType={task.taskType ?? "general"} />
      </div>

      <div style={{ minWidth: 0, paddingTop: "2px" }}>
        {!isDone ? <ListPriorityPill priority={task.priority} /> : <ListPriorityPill priority={task.priority} muted />}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          color: "#555555",
          minWidth: 0,
          paddingTop: "2px",
        }}
      >
        <MessageSquare size={14} aria-hidden />
        <span style={{ fontSize: "12px" }}>{commentCount}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          justifyContent: "flex-end",
          minWidth: 0,
          paddingTop: "2px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showStatusAction && listAction ? (
          <button type="button" onClick={onStatusAction} style={actionStyle}>
            {listAction}
          </button>
        ) : (
          <button type="button" onClick={onViewDetails} style={actionStyle}>
            View Details
          </button>
        )}
        {menu}
      </div>
    </div>
  );
}

export function TasksListMobileCard({
  task,
  isDone,
  isHovered,
  leftBorder,
  assigneeId,
  metaParts,
  showStatusAction,
  listAction,
  actionStyle,
  onRowClick,
  onStatusAction,
  onViewDetails,
  menu,
  linkedLabel,
  commentsSection,
  statusUpdating = false,
}: {
  task: Task;
  isDone: boolean;
  isHovered: boolean;
  leftBorder: string;
  assigneeId?: string;
  metaParts: string[];
  showStatusAction: boolean;
  listAction: string | null;
  actionStyle: CSSProperties;
  onRowClick: () => void;
  onStatusAction: () => void;
  onViewDetails: () => void;
  menu: ReactNode;
  linkedLabel?: ReactNode;
  commentsSection?: ReactNode;
  statusUpdating?: boolean;
}) {
  return (
    <div
      onClick={onRowClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: isHovered ? "#181818" : CARD_BG,
        borderTop: `1px solid ${isHovered ? "#333333" : CARD_BORDER}`,
        borderRight: `1px solid ${isHovered ? "#333333" : CARD_BORDER}`,
        borderBottom: `1px solid ${isHovered ? "#333333" : CARD_BORDER}`,
        borderLeft: `3px solid ${leftBorder}`,
        borderRadius: "8px",
        padding: "14px 16px",
        marginBottom: "8px",
        opacity: isDone ? 0.65 : 1,
        transition: "opacity 0.15s ease, border-color 0.15s ease, background 0.15s ease",
        cursor: "pointer",
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
          <StatusCircleIcon status={task.status} isUpdating={statusUpdating} />
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
          {!isDone ? <ListPriorityPill priority={task.priority} /> : null}
          <ListTypePill taskType={task.taskType ?? "general"} />
        </div>
        {linkedLabel}
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
          {assigneeId ? (
            <>
              <Link
                to={`/app/profile/${assigneeId}`}
                onClick={(e) => e.stopPropagation()}
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
        {commentsSection}
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {showStatusAction && listAction ? (
          <button type="button" onClick={onStatusAction} style={actionStyle}>
            {listAction}
          </button>
        ) : (
          <button type="button" onClick={onViewDetails} style={actionStyle}>
            View Details
          </button>
        )}
        {menu}
      </div>
    </div>
  );
}

export function TasksListFooter({ filterLabel }: { filterLabel: string }) {
  return (
    <p
      style={{
        fontSize: "12px",
        color: "#555555",
        textAlign: "center",
        margin: "24px 0 0",
      }}
    >
      {filterLabel} · Sorted by due date
    </p>
  );
}

export function TasksListMenu({
  open,
  onViewDetails,
  onEdit,
  onDelete,
  taskStatus,
  canChangeStatus = false,
  submitForReview = false,
  onStatusChange,
}: {
  open: boolean;
  onViewDetails: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  taskStatus?: TaskStatus;
  canChangeStatus?: boolean;
  submitForReview?: boolean;
  onStatusChange?: (status: TaskStatus) => void;
}) {
  if (!open) return null;

  const statusItems =
    canChangeStatus && taskStatus && onStatusChange
      ? getTaskStatusMenuItems(taskStatus, { submitForReview })
      : [];

  const menuButtonStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: "#cccccc",
    padding: "9px 12px",
    fontSize: "12px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "100%",
        marginTop: "4px",
        background: "#151515",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        minWidth: "160px",
        zIndex: 20,
        overflow: "hidden",
      }}
    >
      <button type="button" onClick={onViewDetails} style={menuButtonStyle}>
        View Details
      </button>
      {statusItems.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onStatusChange!(item.status)}
          style={menuButtonStyle}
        >
          {item.label}
        </button>
      ))}
      {onEdit ? (
        <button type="button" onClick={onEdit} style={menuButtonStyle}>
          Edit
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          style={{
            ...menuButtonStyle,
            color: ACCENT_RED,
          }}
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}

export function TasksListMenuButton({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label="Task options"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: "#555555",
        cursor: "pointer",
        padding: "2px",
        display: "flex",
        flexShrink: 0,
      }}
    >
      <MoreHorizontal size={16} aria-hidden />
    </button>
  );
}
