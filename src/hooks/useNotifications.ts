import { useCallback, useEffect, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import type { Notification } from "../types";

const notificationsRealtimeOwnersByUserId = new Map<string, number>();
const notificationsRealtimeByUserId = new Map<
  string,
  { channel: RealtimeChannel | null; timeoutId: ReturnType<typeof setTimeout> | null }
>();

function teardownNotificationsRealtimeForUser(userId: string): void {
  const entry = notificationsRealtimeByUserId.get(userId);
  if (!entry) return;

  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.timeoutId = null;

  if (entry.channel) {
    supabase.removeChannel(entry.channel);
    entry.channel = null;
  }
}

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
export function useNotificationsSubscription(): UseNotificationsReturn {
  const { user } = useAuthContext();
  const userId = user?.id;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const upsertNotification = useCallback((next: Notification) => {
    setNotifications((prev) => {
      const existingIndex = prev.findIndex((n) => n.id === next.id);
      let merged: Notification[];

      if (existingIndex === -1) {
        merged = [next, ...prev];
      } else {
        merged = prev.map((n, i) => (i === existingIndex ? { ...n, ...next } : n));
      }

      return merged
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

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

  useEffect(() => {
    if (!userId) return;

    const STABILIZATION_MS = 150;

    const onNotificationChange = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        if (payload.new && Object.keys(payload.new).length > 0) {
          upsertNotification(mapRow(payload.new));
        }
        return;
      }

      if (payload.eventType === "UPDATE") {
        if (payload.new && Object.keys(payload.new).length > 0) {
          upsertNotification(mapRow(payload.new));
        }
        return;
      }

      if (payload.eventType === "DELETE") {
        const deletedId = payload.old?.id;
        if (typeof deletedId === "string" && deletedId.length > 0) {
          removeNotification(deletedId);
        }
      }
    };

    let entry =
      notificationsRealtimeByUserId.get(userId) ?? ({ channel: null, timeoutId: null } satisfies {
        channel: RealtimeChannel | null;
        timeoutId: ReturnType<typeof setTimeout> | null;
      });
    notificationsRealtimeByUserId.set(userId, entry);

    // Ensure we never collide with whatever channel/timer may still exist for this topic.
    teardownNotificationsRealtimeForUser(userId);
    entry =
      notificationsRealtimeByUserId.get(userId) ?? ({ channel: null, timeoutId: null } satisfies {
        channel: RealtimeChannel | null;
        timeoutId: ReturnType<typeof setTimeout> | null;
      });
    notificationsRealtimeByUserId.set(userId, entry);

    notificationsRealtimeOwnersByUserId.set(
      userId,
      (notificationsRealtimeOwnersByUserId.get(userId) ?? 0) + 1,
    );

    entry.timeoutId = setTimeout(() => {
      entry.timeoutId = null;

      if (entry.channel) {
        supabase.removeChannel(entry.channel);
        entry.channel = null;
      }

      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          onNotificationChange,
        )
        .subscribe();

      entry.channel = channel;
    }, STABILIZATION_MS);

    return () => {
      const nextOwners = Math.max((notificationsRealtimeOwnersByUserId.get(userId) ?? 1) - 1, 0);
      if (nextOwners === 0) {
        notificationsRealtimeOwnersByUserId.delete(userId);
        teardownNotificationsRealtimeForUser(userId);
        notificationsRealtimeByUserId.delete(userId);
      } else {
        notificationsRealtimeOwnersByUserId.set(userId, nextOwners);
      }
    };
  }, [removeNotification, upsertNotification, userId]);

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
      .eq("user_id", userId)
      .eq("read", false);
    if (error) {
      console.error("Failed to mark all notifications as read:", error.message);
    }
  }, [userId]);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh };
}
