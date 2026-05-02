import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import { notifyUsers } from "../lib/notifyUsers";
import type { Task, TaskStatus, TaskPriority } from "../types";

/** Map a Supabase `tasks` row (with optional profile join) to our Task type. */
function mapTaskRow(row: Record<string, unknown>): Task {
  const profile = (row.assignee ?? null) as Record<string, unknown> | null;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    status: (row.status as TaskStatus) ?? "todo",
    priority: (row.priority as TaskPriority) ?? "medium",
    assignedTo: (row.assigned_to as string) ?? undefined,
    assigneeName: (profile?.full_name as string) ?? undefined,
    dueDate: (row.due_date as string) ?? undefined,
    createdBy: (row.created_by as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
  };
}

export interface UseClubTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createTask: (fields: {
    title: string;
    description: string;
    priority: TaskPriority;
    assignedTo?: string;
    dueDate?: string;
  }) => Promise<boolean>;
  updateTask: (
    taskId: string,
    fields: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      assignedTo: string | null;
      dueDate: string | null;
    }>,
  ) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  refresh: () => void;
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

  // Fetch tasks for this club
  useEffect(() => {
    if (!clubId) return;

    let cancelled = false;

    supabase
      .from("tasks")
      .select(`
        id,
        club_id,
        title,
        description,
        status,
        priority,
        assigned_to,
        due_date,
        created_by,
        created_at,
        assignee:profiles!tasks_assigned_profile_fkey (
          full_name
        ),
        creator:profiles!tasks_creator_profile_fkey (
          full_name
        )
      `)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error("Failed to load tasks:", err.message);
          setError(err.message);
        } else {
          setTasks((data ?? []).map(mapTaskRow));
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, refreshKey]);

  useEffect(() => {
    if (!clubId) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`tasks:club:${clubId}`)
      .on(
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
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [clubId, refresh]);

  const createTask = useCallback(
    async (fields: {
      title: string;
      description: string;
      priority: TaskPriority;
      assignedTo?: string;
      dueDate?: string;
    }): Promise<boolean> => {
      if (!clubId || !user) return false;

      const { data, error: err } = await supabase
        .from("tasks")
        .insert({
          club_id: clubId,
          title: fields.title,
          description: fields.description,
          priority: fields.priority,
          status: "todo" as TaskStatus,
          assigned_to: fields.assignedTo || null,
          due_date: fields.dueDate || null,
          created_by: user.id,
        })
        .select(`
          id,
          club_id,
          title,
          description,
          status,
          priority,
          assigned_to,
          due_date,
          created_by,
          created_at,
          assignee:profiles!tasks_assigned_profile_fkey (
            full_name
          ),
          creator:profiles!tasks_creator_profile_fkey (
            full_name
          )
        `)
        .single();

      if (err || !data) {
        console.error("Failed to create task:", err?.message);
        return false;
      }

      setTasks((prev) => [mapTaskRow(data), ...prev]);

      // Notify the assigned user (fire-and-forget)
      if (fields.assignedTo && fields.assignedTo !== user.id) {
        Promise.resolve(
          notifyUsers([
            {
              user_id: fields.assignedTo,
              type: "task_assigned",
              message: `You were assigned a task: ${fields.title}`,
              club_id: clubId,
              reference_id: data.id as string,
            },
          ]).then((ok) => {
            if (!ok) {
              console.error("Failed to send task notification.");
            }
          }),
        ).catch((err: unknown) => {
          console.error("Failed to send task notification:", err);
        });
      }

      return true;
    },
    [clubId, user],
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
      }>,
    ): Promise<boolean> => {
      const row: Record<string, unknown> = {};
      if (fields.title !== undefined) row.title = fields.title;
      if (fields.description !== undefined)
        row.description = fields.description;
      if (fields.status !== undefined) row.status = fields.status;
      if (fields.priority !== undefined) row.priority = fields.priority;
      if (fields.assignedTo !== undefined) row.assigned_to = fields.assignedTo;
      if (fields.dueDate !== undefined) row.due_date = fields.dueDate;

      const { data, error: err } = await supabase
        .from("tasks")
        .update(row)
        .eq("id", taskId)
        .select(`
          id,
          club_id,
          title,
          description,
          status,
          priority,
          assigned_to,
          due_date,
          created_by,
          created_at,
          assignee:profiles!tasks_assigned_profile_fkey (
            full_name
          ),
          creator:profiles!tasks_creator_profile_fkey (
            full_name
          )
        `)
        .single();

      if (err || !data) {
        console.error("Failed to update task:", err?.message);
        return false;
      }

      const updated = mapTaskRow(data);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return true;
    },
    [],
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (err) {
        console.error("Failed to delete task:", err.message);
        return false;
      }

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      return true;
    },
    [],
  );

  return { tasks, loading, error, createTask, updateTask, deleteTask, refresh };
}
