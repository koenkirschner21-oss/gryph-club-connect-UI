import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import {
  filterInboxMessages,
  mapInboxRow,
  type InboxFilter,
  type InboxMessage,
} from "../lib/inboxUtils";

export interface UseInboxReturn {
  messages: InboxMessage[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => void;
  unreadMessages: InboxMessage[];
  actionRequiredMessages: InboxMessage[];
  filterMessages: (filter: InboxFilter) => InboxMessage[];
}

export function useInbox(): UseInboxReturn {
  const { user } = useAuthContext();
  const userId = user?.id;

  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const fetchMessages = useCallback(async () => {
    if (!userId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("inbox_messages")
      .select("*, clubs(name)")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load inbox messages:", error.message);
      setMessages([]);
      setLoading(false);
      return;
    }

    setMessages((data ?? []).map((row) => mapInboxRow(row as Record<string, unknown>)));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages, refreshKey]);

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel | null = supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void fetchMessages();
        },
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [fetchMessages, userId]);

  const markAsRead = useCallback(
    async (id: string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, read: true } : message,
        ),
      );

      const { error } = await supabase
        .from("inbox_messages")
        .update({ read: true })
        .eq("id", id)
        .eq("recipient_id", userId ?? "");

      if (error) {
        console.error("Failed to mark inbox message as read:", error.message);
        void fetchMessages();
      }
    },
    [fetchMessages, userId],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    setMessages((prev) => prev.map((message) => ({ ...message, read: true })));

    const { error } = await supabase
      .from("inbox_messages")
      .update({ read: true })
      .eq("recipient_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Failed to mark all inbox messages as read:", error.message);
      void fetchMessages();
    }
  }, [fetchMessages, userId]);

  const unreadCount = useMemo(
    () => messages.filter((message) => !message.read).length,
    [messages],
  );

  const unreadMessages = useMemo(
    () => filterInboxMessages(messages, "unread"),
    [messages],
  );

  const actionRequiredMessages = useMemo(
    () => filterInboxMessages(messages, "action_required"),
    [messages],
  );

  const filterMessages = useCallback(
    (filter: InboxFilter) => filterInboxMessages(messages, filter),
    [messages],
  );

  return {
    messages,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
    unreadMessages,
    actionRequiredMessages,
    filterMessages,
  };
}
