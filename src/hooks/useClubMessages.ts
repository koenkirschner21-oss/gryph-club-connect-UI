import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import type { Message } from "../types";

/** Map a Supabase `messages` row (joined with profiles) to our Message type. */
function mapMessageRow(row: Record<string, unknown>): Message {
  const profile = (row.sender ?? {}) as Record<string, unknown>;
  const channel = (row.channel_meta ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    authorId: row.author_id as string,
    channelId: (row.channel_id as string) ?? undefined,
    channel: (channel.name as string) ?? "general",
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
  sendMessage: (channelId: string, content: string) => Promise<boolean>;
  refresh: () => void;
}

/**
 * Hook that provides read/write operations for chat messages
 * belonging to a specific club channel.
 */
export function useClubMessages(
  clubId: string | undefined,
  channelId?: string | undefined,
): UseClubMessagesReturn {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!clubId || !channelId) {
      setMessages([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("messages")
      .select(`
        id,
        club_id,
        author_id,
        channel_id,
        content,
        created_at,
        channel_meta:channels!messages_channel_id_fkey (
          name
        ),
        sender:profiles!messages_author_profile_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq("club_id", clubId)
      .eq("channel_id", channelId)
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
  }, [clubId, channelId, refreshKey]);

  useEffect(() => {
    if (!clubId || !channelId) {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`messages:club:${clubId}:channel:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
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
  }, [clubId, channelId, refresh]);

  const sendMessage = useCallback(
    async (sendChannelId: string, content: string): Promise<boolean> => {
      if (!clubId || !user) return false;

      const { data, error: err } = await supabase
        .from("messages")
        .insert({
          club_id: clubId,
          author_id: user.id,
          channel_id: sendChannelId,
          content,
        })
        .select(`
          id,
          club_id,
          author_id,
          channel_id,
          content,
          created_at,
          channel_meta:channels!messages_channel_id_fkey (
            name
          ),
          sender:profiles!messages_author_profile_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
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
