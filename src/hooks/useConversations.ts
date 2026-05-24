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
  members: ConversationMember[];
  lastMessage?: DirectMessage | null;
  unreadCount: number;
}

function mapMessageRow(row: Record<string, unknown>): DirectMessage {
  const sender = (row.sender ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    senderId: row.sender_id as string,
    content: (row.content as string | null) ?? null,
    attachmentUrl: (row.attachment_url as string | null) ?? null,
    attachmentType: (row.attachment_type as string | null) ?? null,
    readBy: (row.read_by as string[]) ?? [],
    createdAt: (row.created_at as string) ?? "",
    senderName: (sender.full_name as string) ?? undefined,
    senderAvatar: (sender.avatar_url as string) ?? undefined,
  };
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

export interface UseConversationsReturn {
  conversations: Conversation[];
  messages: DirectMessage[];
  loading: boolean;
  messagesLoading: boolean;
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
  uploadAttachment: (
    file: File,
    conversationId: string,
  ) => Promise<{ url: string; type: string } | null>;
  uploadGroupAvatar: (file: File, conversationId: string) => Promise<string | null>;
  updateGroupConversation: (
    conversationId: string,
    fields: { name?: string; avatarUrl?: string | null },
  ) => Promise<boolean>;
  refresh: () => void;
}

const MESSAGE_SELECT = `
  id,
  conversation_id,
  sender_id,
  content,
  attachment_url,
  attachment_type,
  read_by,
  created_at,
  sender:profiles!direct_messages_sender_profile_fkey (
    full_name,
    avatar_url
  )
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
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [clubMembers, setClubMembers] = useState<ConversationMember[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const messagesChannelRef = useRef<RealtimeChannel | null>(null);
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
      .select("id, club_id, type, name, avatar_url, created_at, updated_at")
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
            .select(MESSAGE_SELECT)
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

        const lastMessage = lastMsgRes.data
          ? mapMessageRow(lastMsgRes.data as Record<string, unknown>)
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
          members,
          lastMessage,
          unreadCount,
        } satisfies Conversation;
      }),
    );

    setConversations(enriched);
    setLoading(false);
  }, [clubId, user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setMessagesLoading(true);
      const { data, error } = await supabase
        .from("direct_messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load messages:", error.message);
        setMessages([]);
      } else {
        setMessages((data ?? []).map((r) => mapMessageRow(r as Record<string, unknown>)));
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
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      );
    },
    [user?.id],
  );

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(activeConversationId);
    markConversationRead(activeConversationId);
  }, [activeConversationId, loadMessages, markConversationRead]);

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
            .select(MESSAGE_SELECT)
            .eq("id", row.id as string)
            .single();

          if (data) {
            const mapped = mapMessageRow(data as Record<string, unknown>);
            setMessages((prev) => mergeConfirmedMessage(prev, mapped));
            if (user?.id && mapped.senderId !== user.id) {
              await supabase
                .from("direct_messages")
                .update({ read_by: [...mapped.readBy, user.id] })
                .eq("id", mapped.id);
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

      const { data, error } = await supabase
        .from("conversations")
        .update(payload)
        .eq("id", conversationId)
        .select("id, club_id, type, name, avatar_url, created_at, updated_at")
        .single();

      if (error || !data) {
        console.error("Failed to update conversation:", error?.message);
        return false;
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            name: (data.name as string) || c.name,
            avatarUrl: (data.avatar_url as string | null) ?? null,
            updatedAt: data.updated_at as string,
          };
        }),
      );
      return true;
    },
    [],
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
        .select(MESSAGE_SELECT)
        .single();

      if (error || !data) {
        console.error("Failed to send message:", error?.message);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return false;
      }

      const mapped = mapMessageRow(data as Record<string, unknown>);
      setMessages((prev) => mergeConfirmedMessage(prev, mapped, tempId));

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      await loadConversations();
      return true;
    },
    [user, loadConversations],
  );

  return {
    conversations,
    messages,
    loading,
    messagesLoading,
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
    uploadAttachment,
    uploadGroupAvatar,
    updateGroupConversation,
    refresh,
  };
}
