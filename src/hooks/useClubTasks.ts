import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import { normalizeTaskType } from "../lib/taskTypes";
import type { Task, TaskStatus, TaskPriority, TaskType } from "../types";
import { removeRealtimeChannel, uniqueRealtimeTopic } from "../lib/realtimeChannels";
import { dispatchClubTasksChanged } from "../lib/clubDataSyncEvents";

const TASK_SELECT = `
  id,
  club_id,
  title,
  description,
  status,
  priority,
  task_type,
  linked_event_id,
  linked_meeting_id,
  linked_hiring_listing_id,
  assigned_to,
  due_date,
  created_by,
  created_at,
  completed_at,
  assignee:profiles!tasks_assigned_profile_fkey (
    id,
    full_name,
    avatar_url
  ),
  creator:profiles!tasks_creator_profile_fkey (
    id,
    full_name,
    avatar_url
  ),
  linked_event:events!tasks_linked_event_id_fkey ( title ),
  linked_meeting:club_meetings!tasks_linked_meeting_id_fkey ( title, status ),
  linked_hiring:hiring_listings!tasks_linked_hiring_listing_id_fkey ( title )
`;

/** Map a Supabase `tasks` row (with optional profile join) to our Task type. */
function mapTaskRow(row: Record<string, unknown>): Task {
  const profile = (row.assignee ?? null) as Record<string, unknown> | null;
  const creator = (row.creator ?? null) as Record<string, unknown> | null;
  const linkedEventRaw = row.linked_event;
  const linkedEvent = Array.isArray(linkedEventRaw) ? linkedEventRaw[0] : linkedEventRaw;
  const linkedMeetingRaw = row.linked_meeting;
  const linkedMeeting = Array.isArray(linkedMeetingRaw) ? linkedMeetingRaw[0] : linkedMeetingRaw;
  const linkedHiringRaw = row.linked_hiring;
  const linkedHiring = Array.isArray(linkedHiringRaw) ? linkedHiringRaw[0] : linkedHiringRaw;

  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    status: (row.status as TaskStatus) ?? "todo",
    priority: (row.priority as TaskPriority) ?? "medium",
    taskType: normalizeTaskType(row.task_type as string | null | undefined),
    linkedEventId: (row.linked_event_id as string | null) ?? undefined,
    linkedMeetingId: (row.linked_meeting_id as string | null) ?? undefined,
    linkedHiringListingId: (row.linked_hiring_listing_id as string | null) ?? undefined,
    linkedEventTitle: ((linkedEvent as { title?: string } | null)?.title ?? undefined),
    linkedMeetingTitle: ((linkedMeeting as { title?: string } | null)?.title ?? undefined),
    linkedMeetingStatus: ((linkedMeeting as { status?: string } | null)?.status as
      | "upcoming"
      | "completed"
      | "cancelled"
      | undefined),
    linkedHiringTitle: ((linkedHiring as { title?: string } | null)?.title ?? undefined),
    assignedTo: (row.assigned_to as string) ?? undefined,
    assigneeName: (profile?.full_name as string) ?? undefined,
    assigneeAvatar: (profile?.avatar_url as string) ?? undefined,
    creatorName: (creator?.full_name as string) ?? undefined,
    creatorAvatar: (creator?.avatar_url as string) ?? undefined,
    dueDate: (row.due_date as string) ?? undefined,
    createdBy: (row.created_by as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    completedAt: (row.completed_at as string) ?? undefined,
  };
}

function mapTaskRowFallback(row: Record<string, unknown>): Task {
  const profile = (row.assignee ?? null) as Record<string, unknown> | null;
  const creator = (row.creator ?? null) as Record<string, unknown> | null;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    status: (row.status as TaskStatus) ?? "todo",
    priority: (row.priority as TaskPriority) ?? "medium",
    taskType: normalizeTaskType(row.task_type as string | null | undefined),
    linkedEventId: (row.linked_event_id as string | null) ?? undefined,
    linkedMeetingId: (row.linked_meeting_id as string | null) ?? undefined,
    linkedHiringListingId: (row.linked_hiring_listing_id as string | null) ?? undefined,
    assignedTo: (row.assigned_to as string) ?? undefined,
    assigneeName: (profile?.full_name as string) ?? undefined,
    assigneeAvatar: (profile?.avatar_url as string) ?? undefined,
    creatorName: (creator?.full_name as string) ?? undefined,
    creatorAvatar: (creator?.avatar_url as string) ?? undefined,
    dueDate: (row.due_date as string) ?? undefined,
    createdBy: (row.created_by as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    completedAt: (row.completed_at as string) ?? undefined,
  };
}

const TASK_SELECT_FALLBACK = `
  id,
  club_id,
  title,
  description,
  status,
  priority,
  task_type,
  linked_event_id,
  linked_meeting_id,
  linked_hiring_listing_id,
  assigned_to,
  due_date,
  created_by,
  created_at,
  completed_at,
  assignee:profiles!tasks_assigned_profile_fkey (
    id,
    full_name,
    avatar_url
  ),
  creator:profiles!tasks_creator_profile_fkey (
    id,
    full_name,
    avatar_url
  )
`;

export interface TaskWriteFields {
  title: string;
  description: string;
  priority: TaskPriority;
  assignedTo?: string;
  dueDate?: string;
  taskType?: TaskType;
  linkedEventId?: string | null;
  linkedMeetingId?: string | null;
  linkedHiringListingId?: string | null;
}

export interface UseClubTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createTask: (fields: TaskWriteFields) => Promise<string | null>;
  updateTask: (
    taskId: string,
    fields: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      assignedTo: string | null;
      dueDate: string | null;
      taskType: TaskType;
      linkedEventId: string | null;
      linkedMeetingId: string | null;
      linkedHiringListingId: string | null;
      completedAt: string | null;
    }>,
  ) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  refresh: () => void;
}

async function fetchClubTasks(clubId: string): Promise<Task[]> {
  const primary = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (!primary.error) {
    return (primary.data ?? []).map((row) => mapTaskRow(row as Record<string, unknown>));
  }

  const fallback = await supabase
    .from("tasks")
    .select(TASK_SELECT_FALLBACK)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  return (fallback.data ?? []).map((row) => mapTaskRowFallback(row as Record<string, unknown>));
}

/**
 * Hook that provides CRUD operations for tasks belonging to a specific club.
 * Fetches from the Supabase `tasks` table with a profile join for assignee names.
 */
export function useClubTasks(clubId: string | undefined): UseClubTasksReturn {
  const { user } = useAuthContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!clubId) return;

    let cancelled = false;

    fetchClubTasks(clubId)
      .then((rows) => {
        if (cancelled) return;
        setTasks(rows);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load tasks";
        console.error("Failed to load tasks:", message);
        setError(message);
        setTasks([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, refreshKey]);

  useEffect(() => {
    if (!clubId) return;

    if (realtimeChannelRef.current) {
      removeRealtimeChannel(supabase, realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase.channel(uniqueRealtimeTopic(`tasks:club:${clubId}`));

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `club_id=eq.${clubId}`,
      },
      () => {
        refresh();
      },
    );

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Tasks realtime channel error for club:", clubId);
        refresh();
      }
    });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
      removeRealtimeChannel(supabase, channel);
    };
  }, [clubId, refresh]);

  const createTask = useCallback(
    async (fields: TaskWriteFields): Promise<string | null> => {
      if (!clubId || !user) return null;

      const insertRow: Record<string, unknown> = {
        club_id: clubId,
        title: fields.title,
        description: fields.description,
        priority: fields.priority,
        status: "todo" as TaskStatus,
        task_type: fields.taskType ?? "general",
        linked_event_id: fields.linkedEventId ?? null,
        linked_meeting_id: fields.linkedMeetingId ?? null,
        linked_hiring_listing_id: fields.linkedHiringListingId ?? null,
        assigned_to: fields.assignedTo || null,
        due_date: fields.dueDate || null,
        created_by: user.id,
      };

      const { data, error: err } = await supabase
        .from("tasks")
        .insert(insertRow)
        .select(TASK_SELECT_FALLBACK)
        .single();

      if (err || !data) {
        console.error("Failed to create task:", err?.message);
        return null;
      }

      const mapped = mapTaskRowFallback(data as Record<string, unknown>);
      setTasks((prev) => [mapped, ...prev]);
      refresh();
      dispatchClubTasksChanged({ clubId, taskId: data.id as string });
      return data.id as string;
    },
    [clubId, user, refresh],
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      fields: Partial<{
        title: string;
        description: string;
        status: TaskStatus;
        priority: TaskPriority;
        assignedTo: string | null;
        dueDate: string | null;
        taskType: TaskType;
        linkedEventId: string | null;
        linkedMeetingId: string | null;
        linkedHiringListingId: string | null;
        completedAt: string | null;
      }>,
    ): Promise<boolean> => {
      const row: Record<string, unknown> = {};
      if (fields.title !== undefined) row.title = fields.title;
      if (fields.description !== undefined) row.description = fields.description;
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.priority !== undefined) row.priority = fields.priority;
      if (fields.assignedTo !== undefined) row.assigned_to = fields.assignedTo;
      if (fields.dueDate !== undefined) row.due_date = fields.dueDate;
      if (fields.taskType !== undefined) row.task_type = fields.taskType;
      if (fields.linkedEventId !== undefined) row.linked_event_id = fields.linkedEventId;
      if (fields.linkedMeetingId !== undefined) row.linked_meeting_id = fields.linkedMeetingId;
      if (fields.linkedHiringListingId !== undefined) {
        row.linked_hiring_listing_id = fields.linkedHiringListingId;
      }
      if (fields.completedAt !== undefined) row.completed_at = fields.completedAt;

      const { data, error: err } = await supabase
        .from("tasks")
        .update(row)
        .eq("id", taskId)
        .select(TASK_SELECT_FALLBACK)
        .single();

      if (err || !data) {
        console.error("Failed to update task:", err?.message);
        return false;
      }

      const updated = mapTaskRowFallback(data as Record<string, unknown>);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      refresh();
      dispatchClubTasksChanged({ clubId, taskId });
      return true;
    },
    [clubId, refresh],
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const { error: unlinkError } = await supabase
        .from("meeting_action_items")
        .update({ linked_task_id: null })
        .eq("linked_task_id", taskId);

      if (unlinkError) {
        console.warn("Could not unlink meeting action items before task delete:", unlinkError.message);
      }

      const { data, error: err } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .select("id");

      if (err) {
        console.error("Failed to delete task:", err.message);
        return false;
      }

      if (!data?.length) {
        console.error("Failed to delete task: no row deleted (permission or not found).");
        return false;
      }

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      dispatchClubTasksChanged({ clubId, taskId });
      return true;
    },
    [clubId],
  );

  return { tasks, loading, error, createTask, updateTask, deleteTask, refresh };
}
