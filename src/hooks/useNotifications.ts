import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import type { Notification } from "../types";

/** Map a Supabase `notifications` row to our Notification type. */
function mapRow(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: (row.type as Notification["type"]) ?? "club_update",
    message: (row.message as string) ?? "",
    read: (row.read as boolean) ?? false,
    clubId: (row.club_id as string) ?? undefined,
    referenceId: (row.reference_id as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
  };
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => void;
}

/**
 * Hook that fetches & manages the current user's notifications from Supabase.
 * Fetches once on mount (no real-time).
 */
export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuthContext();
  const userId = user?.id;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load notifications:", error.message);
        } else {
          setNotifications((data ?? []).map(mapRow));
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) {
      console.error("Failed to mark notification as read:", error.message);
      // Rollback optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId);
    if (error) {
      console.error("Failed to mark all notifications as read:", error.message);
    }
  }, [userId]);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh };
}
