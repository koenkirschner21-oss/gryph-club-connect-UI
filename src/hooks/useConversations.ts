import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { uploadImage } from "../lib/uploadImage";
import { useAuthContext } from "../context/useAuthContext";
import type { MemberRole } from "../types";

const STORAGE_BUCKET = "announcement-attachments";
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface ConversationMember {
  userId: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  readBy: string[];
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
}

export interface Conversation {
  id: string;
  clubId: string;
  type: "direct" | "group";
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isFavorite: boolean;
  members: ConversationMember[];
  lastMessage?: DirectMessage | null;
  unreadCount: number;
}

export interface ChatPoll {
  id: string;
  conversationId: string;
  clubId: string;
  createdBy: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>;
  endsAt: string | null;
  createdAt: string;
  creatorName?: string;
  creatorAvatar?: string;
}

function mapPollRow(row: Record<string, unknown>): ChatPoll {
  const rawOptions = row.options;
  const options = Array.isArray(rawOptions)
    ? (rawOptions as string[]).map(String)
    : [];

  const rawVotes = row.votes;
  let votes: Record<string, string[]> = {};
  if (rawVotes && typeof rawVotes === "object" && !Array.isArray(rawVotes)) {
    votes = Object.fromEntries(
      Object.entries(rawVotes as Record<string, unknown>).map(([key, val]) => [
        key,
        Array.isArray(val) ? (val as string[]) : [],
      ]),
    );
  }

  const creator = (row.creator ?? {}) as Record<string, unknown>;

  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    clubId: row.club_id as string,
    createdBy: row.created_by as string,
    question: row.question as string,
    options,
    votes,
    endsAt: (row.ends_at as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
    creatorName: (creator.full_name as string) ?? undefined,
    creatorAvatar: (creator.avatar_url as string) ?? undefined,
  };
}

function enrichPollsWithCreators(
  rows: Record<string, unknown>[],
): ChatPoll[] {
  return rows.map((row) => mapPollRow(row));
}

async function attachPollCreators(
  polls: ChatPoll[],
): Promise<ChatPoll[]> {
  const creatorIds = [...new Set(polls.map((p) => p.createdBy).filter(Boolean))];
  if (creatorIds.length === 0) return polls;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", creatorIds);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        name: (p.full_name as string) ?? "Unknown",
        avatar: (p.avatar_url as string) ?? undefined,
      },
    ]),
  );

  return polls.map((poll) => {
    const profile = profileMap[poll.createdBy];
    if (!profile) return poll;
    return {
      ...poll,
      creatorName: poll.creatorName ?? profile.name,
      creatorAvatar: poll.creatorAvatar ?? profile.avatar,
    };
  });
}

function normalizePollVotes(
  votes: Record<string, string[]>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(votes)) {
    if (Array.isArray(val)) {
      next[key] = val.filter((id) => typeof id === "string");
    }
  }
  return next;
}

function applyVote(
  votes: Record<string, string[]>,
  optionIndex: number,
  userId: string,
): Record<string, string[]> {
  const next = normalizePollVotes(votes);
  for (const key of Object.keys(next)) {
    next[key] = next[key].filter((id) => id !== userId);
  }
  const key = String(optionIndex);
  next[key] = [...(next[key] ?? []), userId];
  return next;
}

function getUserVoteOptionIndex(
  votes: Record<string, string[]>,
  userId: string,
): number | null {
  for (const [key, voterIds] of Object.entries(votes)) {
    if (voterIds.includes(userId)) {
      const index = Number.parseInt(key, 10);
      return Number.isNaN(index) ? null : index;
    }
  }
  return null;
}

export { getUserVoteOptionIndex };

function mapMessageRow(row: Record<string, unknown>): DirectMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    senderId: row.sender_id as string,
    content: (row.content as string | null) ?? null,
    attachmentUrl: (row.attachment_url as string | null) ?? null,
    attachmentType: (row.attachment_type as string | null) ?? null,
    readBy: (row.read_by as string[]) ?? [],
    createdAt: (row.created_at as string) ?? "",
  };
}

async function attachMessageSenders(
  messages: DirectMessage[],
): Promise<DirectMessage[]> {
  const senderIds = [...new Set(messages.map((m) => m.senderId).filter(Boolean))];
  if (senderIds.length === 0) return messages;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", senderIds);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        name: (p.full_name as string) ?? undefined,
        avatar: (p.avatar_url as string) ?? undefined,
      },
    ]),
  );

  return messages.map((message) => {
    const profile = profileMap[message.senderId];
    if (!profile) return message;
    return {
      ...message,
      senderName: message.senderName ?? profile.name,
      senderAvatar: message.senderAvatar ?? profile.avatar,
    };
  });
}

function isTempMessageId(id: string): boolean {
  return id.startsWith("temp-");
}

function mergeConfirmedMessage(
  prev: DirectMessage[],
  confirmed: DirectMessage,
  tempId?: string,
): DirectMessage[] {
  if (prev.some((m) => m.id === confirmed.id)) {
    return prev.filter((m) => !isTempMessageId(m.id));
  }

  if (tempId) {
    const tempIndex = prev.findIndex((m) => m.id === tempId);
    if (tempIndex !== -1) {
      const next = [...prev];
      next[tempIndex] = confirmed;
      return next;
    }
  }

  const optimisticIndex = prev.findIndex((m) => isTempMessageId(m.id));
  if (optimisticIndex !== -1) {
    const next = [...prev];
    next[optimisticIndex] = confirmed;
    return next;
  }

  return [...prev, confirmed];
}

function mapMemberRow(row: Record<string, unknown>): ConversationMember {
  const profile = (row.member_profile ?? {}) as Record<string, unknown>;
  return {
    userId: row.user_id as string,
    fullName: (profile.full_name as string) ?? undefined,
    avatarUrl: (profile.avatar_url as string) ?? undefined,
  };
}

function normalizeRole(role: string | null | undefined): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function displayNameForConversation(
  convo: Conversation,
  currentUserId: string,
): string {
  if (convo.type === "group") {
    return convo.name || "Group chat";
  }
  const other = convo.members.find((m) => m.userId !== currentUserId);
  return other?.fullName ?? "Direct message";
}

function avatarForConversation(
  convo: Conversation,
  currentUserId: string,
): string | null {
  if (convo.avatarUrl) return convo.avatarUrl;
  if (convo.type === "group") return null;
  const other = convo.members.find((m) => m.userId !== currentUserId);
  return other?.avatarUrl ?? null;
}

function conversationActivityAt(convo: Conversation): number {
  const lastMessageTs = convo.lastMessage?.createdAt
    ? new Date(convo.lastMessage.createdAt).getTime()
    : Number.NaN;
  if (!Number.isNaN(lastMessageTs)) return lastMessageTs;
  const updatedTs = new Date(convo.updatedAt).getTime();
  if (!Number.isNaN(updatedTs)) return updatedTs;
  const createdTs = new Date(convo.createdAt).getTime();
  return Number.isNaN(createdTs) ? 0 : createdTs;
}

function sortConversationsByPriority(items: Conversation[]): Conversation[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return conversationActivityAt(b) - conversationActivityAt(a);
  });
}

export interface UseConversationsReturn {
  conversations: Conversation[];
  messages: DirectMessage[];
  polls: ChatPoll[];
  loading: boolean;
  messagesLoading: boolean;
  pollsLoading: boolean;
  userRole: MemberRole;
  clubMembers: ConversationMember[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  activeConversation: Conversation | null;
  displayConversationName: (convo: Conversation) => string;
  displayConversationAvatar: (convo: Conversation) => string | null;
  createDirectMessage: (otherUserId: string) => Promise<string | null>;
  createGroupChat: (
    name: string,
    memberUserIds: string[],
    avatarUrl?: string | null,
  ) => Promise<string | null>;
  sendMessage: (
    conversationId: string,
    content: string,
    attachment?: { url: string; type: string } | null,
  ) => Promise<boolean>;
  createPoll: (
    conversationId: string,
    question: string,
    options: string[],
    endsAt?: string | null,
  ) => Promise<boolean>;
  voteOnPoll: (pollId: string, optionIndex: number) => Promise<boolean>;
  uploadAttachment: (
    file: File,
    conversationId: string,
  ) => Promise<{ url: string; type: string } | null>;
  uploadGroupAvatar: (file: File, conversationId: string) => Promise<string | null>;
  updateGroupConversation: (
    conversationId: string,
    fields: { name?: string; avatarUrl?: string | null },
  ) => Promise<boolean>;
  toggleConversationPin: (conversationId: string) => Promise<boolean>;
  toggleConversationFavorite: (conversationId: string) => Promise<boolean>;
  refresh: () => void;
}

const POLL_SELECT = `
  id,
  conversation_id,
  club_id,
  created_by,
  question,
  options,
  votes,
  ends_at,
  created_at
`;

const MEMBER_SELECT = `
  user_id,
  member_profile:profiles!conversation_members_user_profile_fkey (
    full_name,
    avatar_url
  )
`;

export function useConversations(
  clubId: string | undefined,
): UseConversationsReturn {
  const { user } = useAuthContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [polls, setPolls] = useState<ChatPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [clubMembers, setClubMembers] = useState<ConversationMember[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const messagesChannelRef = useRef<RealtimeChannel | null>(null);
  const pollsChannelRef = useRef<RealtimeChannel | null>(null);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  const displayConversationName = useCallback(
    (convo: Conversation) =>
      user ? displayNameForConversation(convo, user.id) : convo.name,
    [user],
  );

  const displayConversationAvatar = useCallback(
    (convo: Conversation) =>
      user ? avatarForConversation(convo, user.id) : convo.avatarUrl ?? null,
    [user],
  );

  useEffect(() => {
    if (!clubId || !user?.id) return;
    let cancelled = false;

    async function loadRoleAndMembers() {
      const [roleRes, membersRes] = await Promise.all([
        supabase
          .from("club_members")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user!.id)
          .single(),
        supabase
          .from("club_members")
          .select(`
            user_id,
            member_profile:profiles!club_members_user_profile_fkey (
              full_name,
              avatar_url
            )
          `)
          .eq("club_id", clubId)
          .eq("status", "active"),
      ]);

      if (cancelled) return;

      if (roleRes.data?.role) {
        setUserRole(normalizeRole(roleRes.data.role));
      }

      const members = (membersRes.data ?? [])
        .map((row) => mapMemberRow(row as Record<string, unknown>))
        .filter((m) => m.userId !== user!.id);

      setClubMembers(members);
    }

    loadRoleAndMembers();
    return () => {
      cancelled = true;
    };
  }, [clubId, user?.id]);

  const loadConversations = useCallback(async () => {
    if (!clubId || !user?.id) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: memberships, error: memErr } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (memErr) {
      console.error("Failed to load conversation memberships:", memErr.message);
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = (memberships ?? []).map((m) => m.conversation_id);
    if (conversationIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: convoRows, error: convoErr } = await supabase
      .from("conversations")
      .select("id, club_id, type, name, avatar_url, created_at, updated_at, is_pinned, is_favorite")
      .eq("club_id", clubId)
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });

    if (convoErr || !convoRows) {
      console.error("Failed to load conversations:", convoErr?.message);
      setConversations([]);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      convoRows.map(async (row) => {
        const [membersRes, lastMsgRes, unreadMsgsRes] = await Promise.all([
          supabase
            .from("conversation_members")
            .select(MEMBER_SELECT)
            .eq("conversation_id", row.id),
          supabase
            .from("direct_messages")
            .select("*")
            .eq("conversation_id", row.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("direct_messages")
            .select("id, read_by, sender_id")
            .eq("conversation_id", row.id)
            .neq("sender_id", user.id),
        ]);

        const members = (membersRes.data ?? []).map((m) =>
          mapMemberRow(m as Record<string, unknown>),
        );

        const lastMessageRaw = lastMsgRes.data
          ? mapMessageRow(lastMsgRes.data as Record<string, unknown>)
          : null;
        const lastMessage = lastMessageRaw
          ? (await attachMessageSenders([lastMessageRaw]))[0]
          : null;

        let displayName = row.name ?? "";
        if (row.type === "direct") {
          const other = members.find((m) => m.userId !== user.id);
          displayName = other?.fullName ?? "Direct message";
        }

        const unreadCount = (unreadMsgsRes.data ?? []).filter(
          (m) => !(m.read_by ?? []).includes(user.id),
        ).length;

        return {
          id: row.id,
          clubId: row.club_id,
          type: row.type as "direct" | "group",
          name: displayName,
          avatarUrl: row.avatar_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isPinned: Boolean(row.is_pinned),
          isFavorite: Boolean(row.is_favorite),
          members,
          lastMessage,
          unreadCount,
        } satisfies Conversation;
      }),
    );

    setConversations(sortConversationsByPriority(enriched));
    setLoading(false);
  }, [clubId, user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  const loadPolls = useCallback(async (conversationId: string) => {
    setPollsLoading(true);
    const { data, error } = await supabase
      .from("chat_polls")
      .select(POLL_SELECT)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load polls:", error.message);
      setPolls([]);
    } else {
      const mapped = enrichPollsWithCreators(
        (data ?? []) as Record<string, unknown>[],
      );
      setPolls(await attachPollCreators(mapped));
    }
    setPollsLoading(false);
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load messages:", error.message);
        setMessages([]);
      } else {
        const mapped = (data ?? []).map((r) =>
          mapMessageRow(r as Record<string, unknown>),
        );
        setMessages(await attachMessageSenders(mapped));
      }
      setMessagesLoading(false);
    },
    [],
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!user?.id) return;

      const { data: unread } = await supabase
        .from("direct_messages")
        .select("id, read_by")
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id);

      if (!unread?.length) return;

      await Promise.all(
        unread
          .filter((m) => !(m.read_by ?? []).includes(user.id))
          .map((m) =>
            supabase
              .from("direct_messages")
              .update({ read_by: [...(m.read_by ?? []), user.id] })
              .eq("id", m.id),
          ),
      );

      setConversations((prev) =>
        sortConversationsByPriority(
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c,
          ),
        ),
      );
    },
    [user?.id],
  );

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setPolls([]);
      return;
    }

    loadMessages(activeConversationId);
    loadPolls(activeConversationId);
    markConversationRead(activeConversationId);
  }, [activeConversationId, loadMessages, loadPolls, markConversationRead]);

  useEffect(() => {
    if (!activeConversationId) return;

    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
      messagesChannelRef.current = null;
    }

    const channel = supabase
      .channel(`direct_messages:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          const { data } = await supabase
            .from("direct_messages")
            .select("*")
            .eq("id", row.id as string)
            .single();

          if (data) {
            const mapped = mapMessageRow(data as Record<string, unknown>);
            const [enriched] = await attachMessageSenders([mapped]);
            setMessages((prev) => mergeConfirmedMessage(prev, enriched));
            if (user?.id && enriched.senderId !== user.id) {
              await supabase
                .from("direct_messages")
                .update({ read_by: [...enriched.readBy, user.id] })
                .eq("id", enriched.id);
            }
          }
          loadConversations();
        },
      )
      .subscribe();

    messagesChannelRef.current = channel;

    return () => {
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
        messagesChannelRef.current = null;
      }
    };
  }, [activeConversationId, loadConversations, user?.id]);

  useEffect(() => {
    if (!activeConversationId) return;

    if (pollsChannelRef.current) {
      supabase.removeChannel(pollsChannelRef.current);
      pollsChannelRef.current = null;
    }

    const channel = supabase
      .channel(`chat_polls:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_polls",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        () => {
          void loadPolls(activeConversationId);
        },
      )
      .subscribe();

    pollsChannelRef.current = channel;

    return () => {
      if (pollsChannelRef.current) {
        supabase.removeChannel(pollsChannelRef.current);
        pollsChannelRef.current = null;
      }
    };
  }, [activeConversationId, loadPolls]);

  const findExistingDirectConversation = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!clubId || !user?.id) return null;

      const directConvos = conversations.filter((c) => c.type === "direct");
      for (const convo of directConvos) {
        const memberIds = convo.members.map((m) => m.userId);
        if (
          memberIds.length === 2 &&
          memberIds.includes(user.id) &&
          memberIds.includes(otherUserId)
        ) {
          return convo.id;
        }
      }
      return null;
    },
    [clubId, conversations, user?.id],
  );

  const createDirectMessage = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!clubId || !user?.id) return null;

      const existing = await findExistingDirectConversation(otherUserId);
      if (existing) return existing;

      const { data: convo, error: convoErr } = await supabase
        .from("conversations")
        .insert({
          club_id: clubId,
          type: "direct",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (convoErr || !convo) {
        console.error("Failed to create DM conversation:", convoErr?.message);
        return null;
      }

      const { error: membersErr } = await supabase
        .from("conversation_members")
        .insert([
          { conversation_id: convo.id, user_id: user.id },
          { conversation_id: convo.id, user_id: otherUserId },
        ]);

      if (membersErr) {
        console.error("Failed to add DM members:", membersErr.message);
        return null;
      }

      await loadConversations();
      return convo.id;
    },
    [clubId, user?.id, findExistingDirectConversation, loadConversations],
  );

  const createGroupChat = useCallback(
    async (
      name: string,
      memberUserIds: string[],
      avatarUrl?: string | null,
    ): Promise<string | null> => {
      if (!clubId || !user?.id) return null;

      const uniqueIds = Array.from(new Set([...memberUserIds, user.id]));

      const { data: convo, error: convoErr } = await supabase
        .from("conversations")
        .insert({
          club_id: clubId,
          type: "group",
          name: name.trim(),
          avatar_url: avatarUrl ?? null,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (convoErr || !convo) {
        console.error("Failed to create group chat:", convoErr?.message);
        return null;
      }

      const { error: membersErr } = await supabase
        .from("conversation_members")
        .insert(
          uniqueIds.map((uid) => ({
            conversation_id: convo.id,
            user_id: uid,
          })),
        );

      if (membersErr) {
        console.error("Failed to add group members:", membersErr.message);
        return null;
      }

      await loadConversations();
      return convo.id;
    },
    [clubId, user?.id, loadConversations],
  );

  const uploadAttachment = useCallback(
    async (
      file: File,
      conversationId: string,
    ): Promise<{ url: string; type: string } | null> => {
      if (!clubId) return null;
      if (file.size > MAX_FILE_BYTES) {
        console.error("Attachment exceeds 20MB limit");
        return null;
      }
      const path = `${clubId}/chat/${conversationId}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const url = await uploadImage(STORAGE_BUCKET, path, file);
      if (!url) return null;
      return { url, type: file.type };
    },
    [clubId],
  );

  const uploadGroupAvatar = useCallback(
    async (file: File, conversationId: string): Promise<string | null> => {
      if (!clubId) return null;
      if (file.size > MAX_FILE_BYTES) {
        console.error("Avatar exceeds 20MB limit");
        return null;
      }
      const path = `group-avatars/${clubId}/${conversationId}/${Date.now()}-${sanitizeFileName(file.name)}`;
      return uploadImage(STORAGE_BUCKET, path, file);
    },
    [clubId],
  );

  const updateGroupConversation = useCallback(
    async (
      conversationId: string,
      fields: { name?: string; avatarUrl?: string | null },
    ): Promise<boolean> => {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (fields.name !== undefined) {
        payload.name = fields.name.trim() || null;
      }
      if (fields.avatarUrl !== undefined) {
        payload.avatar_url = fields.avatarUrl;
      }

      console.log("Updating conversation:", conversationId, fields.name, fields.avatarUrl);
      console.log("Update payload:", payload);

      const { data, error } = await supabase
        .from("conversations")
        .update(payload)
        .eq("id", conversationId);

      console.log("Update result:", data, "Error:", error);

      if (error) {
        console.error("Failed to update conversation:", error.message, error);
        return false;
      }

      setConversations((prev) =>
        sortConversationsByPriority(
          prev.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              name:
                fields.name !== undefined
                  ? fields.name.trim() || c.name
                  : c.name,
              avatarUrl:
                fields.avatarUrl !== undefined
                  ? fields.avatarUrl ?? null
                  : c.avatarUrl,
              updatedAt: payload.updated_at as string,
            };
          }),
        ),
      );
      console.log("Update succeeded; local conversations state patched");
      return true;
    },
    [],
  );

  const toggleConversationPin = useCallback(
    async (conversationId: string): Promise<boolean> => {
      const current = conversations.find((c) => c.id === conversationId);
      if (!current) return false;
      const nextValue = !current.isPinned;
      const { error } = await supabase
        .from("conversations")
        .update({ is_pinned: nextValue })
        .eq("id", conversationId);
      if (error) {
        console.error("Failed to toggle pin:", error.message);
        return false;
      }
      setConversations((prev) =>
        sortConversationsByPriority(
          prev.map((c) =>
            c.id === conversationId ? { ...c, isPinned: nextValue } : c,
          ),
        ),
      );
      return true;
    },
    [conversations],
  );

  const toggleConversationFavorite = useCallback(
    async (conversationId: string): Promise<boolean> => {
      const current = conversations.find((c) => c.id === conversationId);
      if (!current) return false;
      const nextValue = !current.isFavorite;
      const { error } = await supabase
        .from("conversations")
        .update({ is_favorite: nextValue })
        .eq("id", conversationId);
      if (error) {
        console.error("Failed to toggle favorite:", error.message);
        return false;
      }
      setConversations((prev) =>
        sortConversationsByPriority(
          prev.map((c) =>
            c.id === conversationId ? { ...c, isFavorite: nextValue } : c,
          ),
        ),
      );
      return true;
    },
    [conversations],
  );

  const sendMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      attachment?: { url: string; type: string } | null,
    ): Promise<boolean> => {
      if (!user?.id) return false;

      const trimmed = content.trim();
      if (!trimmed && !attachment) return false;

      const tempId = `temp-${Date.now()}`;
      const metadata = user.user_metadata as Record<string, unknown> | undefined;
      const currentUserName =
        (metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "You";
      const currentUserAvatar =
        (metadata?.avatar_url as string | undefined) ?? undefined;

      const optimisticMessage: DirectMessage = {
        id: tempId,
        conversationId,
        senderId: user.id,
        content: trimmed || null,
        attachmentUrl: attachment?.url ?? null,
        attachmentType: attachment?.type ?? null,
        readBy: [user.id],
        createdAt: new Date().toISOString(),
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: trimmed || null,
          attachment_url: attachment?.url ?? null,
          attachment_type: attachment?.type ?? null,
          read_by: [user.id],
        })
        .select("*")
        .single();

      if (error || !data) {
        console.error("Failed to send message:", error?.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return false;
      }

      const mapped = mapMessageRow(data as Record<string, unknown>);
      const [enriched] = await attachMessageSenders([mapped]);
      setMessages((prev) => mergeConfirmedMessage(prev, enriched, tempId));

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      await loadConversations();
      return true;
    },
    [user, loadConversations],
  );

  const createPoll = useCallback(
    async (
      conversationId: string,
      question: string,
      options: string[],
      endsAt?: string | null,
    ): Promise<boolean> => {
      if (!clubId || !user?.id) return false;

      const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
      if (!question.trim() || trimmedOptions.length < 2) return false;

      const { error } = await supabase.from("chat_polls").insert({
        conversation_id: conversationId,
        club_id: clubId,
        created_by: user.id,
        question: question.trim(),
        options: trimmedOptions,
        votes: {},
        ends_at: endsAt ?? null,
      });

      if (error) {
        console.error("Failed to create poll:", error.message);
        return false;
      }

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      await loadPolls(conversationId);
      await loadConversations();
      return true;
    },
    [clubId, user?.id, loadPolls, loadConversations],
  );

  const voteOnPoll = useCallback(
    async (pollId: string, optionIndex: number): Promise<boolean> => {
      if (!user?.id) return false;

      const poll = polls.find((p) => p.id === pollId);
      if (!poll) return false;

      if (poll.endsAt && new Date(poll.endsAt).getTime() < Date.now()) {
        return false;
      }

      const nextVotes = applyVote(poll.votes, optionIndex, user.id);

      const { error } = await supabase
        .from("chat_polls")
        .update({ votes: nextVotes })
        .eq("id", pollId);

      if (error) {
        console.error("Failed to vote on poll:", error.message);
        return false;
      }

      setPolls((prev) =>
        prev.map((p) =>
          p.id === pollId ? { ...p, votes: nextVotes } : p,
        ),
      );
      return true;
    },
    [polls, user?.id],
  );

  return {
    conversations,
    messages,
    polls,
    loading,
    messagesLoading,
    pollsLoading,
    userRole,
    clubMembers,
    activeConversationId,
    setActiveConversationId,
    activeConversation,
    displayConversationName,
    displayConversationAvatar,
    createDirectMessage,
    createGroupChat,
    sendMessage,
    createPoll,
    voteOnPoll,
    uploadAttachment,
    uploadGroupAvatar,
    updateGroupConversation,
    toggleConversationPin,
    toggleConversationFavorite,
    refresh,
  };
}
