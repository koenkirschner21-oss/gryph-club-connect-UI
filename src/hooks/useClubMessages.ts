import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import type { Message } from "../types";

/** Map a Supabase `messages` row (joined with profiles) to our Message type. */
function mapMessageRow(row: Record<string, unknown>): Message {
  const profile = (row.profiles ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    authorId: row.author_id as string,
    channel: (row.channel as string) ?? "general",
    content: (row.content as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    authorName: (profile.full_name as string) ?? undefined,
    authorAvatar: (profile.avatar_url as string) ?? undefined,
  };
}

export interface UseClubMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (channel: string, content: string) => Promise<boolean>;
  refresh: () => void;
}

/**
 * Hook that provides read/write operations for chat messages
 * belonging to a specific club.
 */
export function useClubMessages(
  clubId: string | undefined,
): UseClubMessagesReturn {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch all messages for this club (joined with author profile)
  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    supabase
      .from("messages")
      .select("*, profiles:author_id ( full_name, avatar_url )")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error("Failed to load messages:", err.message);
          setError(err.message);
        } else {
          setMessages((data ?? []).map(mapMessageRow));
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, refreshKey]);

  /** Send a new message to a channel. */
  const sendMessage = useCallback(
    async (channel: string, content: string): Promise<boolean> => {
      if (!clubId || !user) return false;

      const { data, error: err } = await supabase
        .from("messages")
        .insert({
          club_id: clubId,
          author_id: user.id,
          channel,
          content,
        })
        .select("*, profiles:author_id ( full_name, avatar_url )")
        .single();

      if (err || !data) {
        console.error("Failed to send message:", err?.message);
        return false;
      }

      setMessages((prev) => [...prev, mapMessageRow(data)]);
      return true;
    },
    [clubId, user],
  );

  return { messages, loading, error, sendMessage, refresh };
}
