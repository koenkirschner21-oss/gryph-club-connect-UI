import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { ensureMyClubChats, isClubChatExecutive } from "../lib/clubChatProvisioning";
import { notifyClubChatRead } from "../lib/clubChatEvents";
import { uploadImage } from "../lib/uploadImage";
import { notifyUsers, type NotificationRequest } from "../lib/notifyUsers";
import { useAuthContext } from "../context/useAuthContext";
import type { AccessLevel, MemberRole, NotificationType } from "../types";
import { removeRealtimeChannel, uniqueRealtimeTopic } from "../lib/realtimeChannels";

const STORAGE_BUCKET = "announcement-attachments";
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface ConversationMember {
  userId: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  mentionUsername: string;
}

export function mentionUsernameFromProfile(
  fullName: string | undefined,
  userId: string,
): string {
  if (fullName?.trim()) {
    const slug = fullName.trim().replace(/\s+/g, "").replace(/[^a-zA-Z0-9._]/g, "");
    if (slug) return slug;
  }
  return userId.slice(0, 8);
}

function parseMentionedUserIds(
  content: string,
  members: ConversationMember[],
  currentUserId: string,
): string[] {
  const tokens = content.match(/@([a-zA-Z0-9._]+)/g) ?? [];
  const mentioned = new Set<string>();
  for (const token of tokens) {
    const username = token.slice(1).toLowerCase();
    for (const member of members) {
      if (member.mentionUsername.toLowerCase() === username && member.userId !== currentUserId) {
        mentioned.add(member.userId);
      }
    }
  }
  return [...mentioned];
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  readBy: string[];
  createdAt: string;
  editedAt?: string | null;
  senderName?: string;
  senderAvatar?: string;
  replyToId?: string | null;
  replyToContent?: string | null;
  replyToSender?: string | null;
}

export interface Conversation {
  id: string;
  clubId: string;
  type: "direct" | "group";
  name: string;
  avatarUrl?: string | null;
  createdBy?: string | null;
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
    senderId: (row.sender_id as string | null) ?? null,
    content: (row.content as string | null) ?? null,
    attachmentUrl: (row.attachment_url as string | null) ?? null,
    attachmentType: (row.attachment_type as string | null) ?? null,
    readBy: (row.read_by as string[]) ?? [],
    createdAt: (row.created_at as string) ?? "",
    editedAt: (row.edited_at as string | null) ?? null,
    replyToId: (row.reply_to_id as string | null) ?? null,
    replyToContent: (row.reply_to_content as string | null) ?? null,
    replyToSender: (row.reply_to_sender as string | null) ?? null,
  };
}

async function attachMessageSenders(
  messages: DirectMessage[],
): Promise<DirectMessage[]> {
  const senderIds = [...new Set(messages.map((m) => m.senderId).filter(Boolean))] as string[];
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
    if (!message.senderId) return message;
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
  const userId = row.user_id as string;
  const fullName = (profile.full_name as string) ?? undefined;
  return {
    userId,
    fullName,
    email: (profile.email as string) ?? undefined,
    avatarUrl: (profile.avatar_url as string) ?? undefined,
    mentionUsername: mentionUsernameFromProfile(fullName, userId),
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

export function pickDefaultConversationId(
  conversations: Conversation[],
): string | null {
  if (conversations.length === 0) return null;

  const byRecentActivity = (items: Conversation[]) =>
    [...items].sort(
      (a, b) => conversationActivityAt(b) - conversationActivityAt(a),
    );

  const withUnread = conversations.filter((convo) => convo.unreadCount > 0);
  if (withUnread.length > 0) {
    return byRecentActivity(withUnread)[0].id;
  }

  return byRecentActivity(conversations)[0].id;
}

/** Find an existing 1:1 DM in this club (DB-backed; avoids duplicate threads). */
export async function findExistingDirectConversationId(
  clubId: string,
  userId: string,
  otherUserId: string,
): Promise<string | null> {
  if (!otherUserId || otherUserId === userId) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (membershipError) {
    console.error(
      "Failed to load conversation memberships:",
      membershipError.message,
    );
    return null;
  }

  const conversationIds = (memberships ?? []).map(
    (row) => row.conversation_id as string,
  );
  if (conversationIds.length === 0) return null;

  const { data: directConvos, error: convoError } = await supabase
    .from("conversations")
    .select("id")
    .eq("club_id", clubId)
    .eq("type", "direct")
    .in("id", conversationIds);

  if (convoError) {
    console.error("Failed to load direct conversations:", convoError.message);
    return null;
  }

  for (const convo of directConvos ?? []) {
    const conversationId = convo.id as string;
    const { data: members, error: membersError } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);

    if (membersError) continue;

    const memberIds = (members ?? []).map((row) => row.user_id as string);
    if (
      memberIds.length === 2 &&
      memberIds.includes(userId) &&
      memberIds.includes(otherUserId)
    ) {
      return conversationId;
    }
  }

  return null;
}

export interface UseConversationsReturn {
  conversations: Conversation[];
  messages: DirectMessage[];
  polls: ChatPoll[];
  loading: boolean;
  messagesLoading: boolean;
  pollsLoading: boolean;
  userRole: MemberRole;
  userAccessLevel: AccessLevel;
  isChatExecutive: boolean;
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
    reply?: {
      id: string;
      content: string;
      senderName: string;
    } | null,
  ) => Promise<boolean>;
  editMessage: (messageId: string, content: string) => Promise<boolean>;
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
  fetchConversationMembers: (conversationId: string) => Promise<ConversationMember[]>;
  addConversationMember: (
    conversationId: string,
    userId: string,
  ) => Promise<boolean>;
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
    avatar_url,
    email
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
  const [userAccessLevel, setUserAccessLevel] = useState<AccessLevel>("member");
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

  const isChatExecutive = useMemo(
    () => isClubChatExecutive(userRole, userAccessLevel),
    [userRole, userAccessLevel],
  );

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

  const loadRoleAndMembers = useCallback(async () => {
    if (!clubId || !user?.id) return;

    const [roleRes, membersRes] = await Promise.all([
      supabase
        .from("club_members")
        .select("role, access_level")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("club_members")
        .select(`
          user_id,
          member_profile:profiles!club_members_user_profile_fkey (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq("club_id", clubId)
        .eq("status", "active"),
    ]);

    // No active membership row (e.g. removed/left): drop privileged role.
    setUserRole(roleRes.data?.role ? normalizeRole(roleRes.data.role) : "member");

    const rawAccessLevel = roleRes.data?.access_level as string | null | undefined;
    setUserAccessLevel(
      rawAccessLevel === "president" ||
        rawAccessLevel === "managerial_executive" ||
        rawAccessLevel === "executive" ||
        rawAccessLevel === "member"
        ? rawAccessLevel
        : "member",
    );

    const members = (membersRes.data ?? [])
      .map((row) => mapMemberRow(row as Record<string, unknown>))
      .filter((m) => m.userId !== user.id);

    setClubMembers(members);
  }, [clubId, user?.id]);

  useEffect(() => {
    void loadRoleAndMembers();
  }, [loadRoleAndMembers, refreshKey]);

  const loadConversations = useCallback(async () => {
    if (!clubId || !user?.id) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    await ensureMyClubChats(supabase, clubId);

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
      .select("id, club_id, type, name, avatar_url, created_by, created_at, updated_at, is_pinned, is_favorite")
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
          (m) =>
            m.sender_id != null && !(m.read_by ?? []).includes(user.id),
        ).length;

        return {
          id: row.id,
          clubId: row.club_id,
          type: row.type as "direct" | "group",
          name: displayName,
          avatarUrl: row.avatar_url,
          createdBy: (row.created_by as string | null) ?? null,
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

  useEffect(() => {
    setActiveConversationId(null);
    setConversations([]);
    setLoading(Boolean(clubId && user?.id));
  }, [clubId, user?.id]);

  useEffect(() => {
    if (loading) return;

    const hasValidSelection =
      activeConversationId != null &&
      conversations.some((convo) => convo.id === activeConversationId);

    if (hasValidSelection) return;

    const defaultId = pickDefaultConversationId(conversations);
    if (defaultId) {
      setActiveConversationId(defaultId);
    }
  }, [loading, conversations, activeConversationId]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(uniqueRealtimeTopic(`new-conversations:${user.id}`));

    // INSERT: newly provisioned/added conversations appear promptly.
    // DELETE: de-provisioned rows (Batch 3 cleanup) remove the conversation
    // from the sidebar promptly instead of lingering until a full reload.
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadConversations();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "conversation_members",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const removedConversationId =
            (payload.old as { conversation_id?: string } | null)
              ?.conversation_id ?? null;
          if (removedConversationId) {
            setConversations((prev) =>
              prev.filter((convo) => convo.id !== removedConversationId),
            );
            setActiveConversationId((current) =>
              current === removedConversationId ? null : current,
            );
          }
          void loadConversations();
        },
      );

    channel.subscribe();

    return () => {
      removeRealtimeChannel(supabase, channel);
    };
  }, [loadConversations, user?.id]);

  // Refresh role/derived flags (isPrivileged, canAddMembers, …) and the
  // conversation list promptly when the current user's own club membership
  // (role / access_level / status) changes — no full page reload required.
  useEffect(() => {
    if (!clubId || !user?.id) return;

    const channel = supabase.channel(
      uniqueRealtimeTopic(`chat-membership:${clubId}:${user.id}`),
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "club_members",
        filter: `user_id=eq.${user.id}`,
      },
      () => {
        void loadRoleAndMembers();
        void loadConversations();
      },
    );

    channel.subscribe();

    return () => {
      removeRealtimeChannel(supabase, channel);
    };
  }, [clubId, user?.id, loadRoleAndMembers, loadConversations]);

  useEffect(() => {
    if (!clubId || !user?.id) return;

    const channel = supabase.channel(
      uniqueRealtimeTopic(`conversations-refresh:${clubId}:${user.id}`),
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `club_id=eq.${clubId}`,
      },
      () => {
        void loadConversations();
      },
    );

    channel.subscribe();

    return () => {
      removeRealtimeChannel(supabase, channel);
    };
  }, [clubId, loadConversations, user?.id]);

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

      const { error } = await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
      });

      if (error) {
        console.error("Failed to mark conversation as read:", error.message);
        return;
      }

      setConversations((prev) =>
        sortConversationsByPriority(
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c,
          ),
        ),
      );

      if (clubId) {
        notifyClubChatRead(clubId, conversationId);
      }
      void loadConversations();
    },
    [clubId, loadConversations, user?.id],
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
      removeRealtimeChannel(supabase, messagesChannelRef.current);
      messagesChannelRef.current = null;
    }

    const channel = supabase.channel(
      uniqueRealtimeTopic(`direct_messages:${activeConversationId}`),
    );

    channel
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
              await supabase.rpc("mark_direct_message_read", {
                p_message_id: enriched.id,
              });
            }
          }
          void loadConversations();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row?.id) return;
          const mapped = mapMessageRow(row);
          const [enriched] = await attachMessageSenders([mapped]);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === enriched.id ? enriched : message,
            ),
          );
          void loadConversations();
        },
      );

    channel.subscribe();

    messagesChannelRef.current = channel;

    return () => {
      if (messagesChannelRef.current === channel) {
        messagesChannelRef.current = null;
      }
      removeRealtimeChannel(supabase, channel);
    };
  }, [activeConversationId, loadConversations, user?.id]);

  useEffect(() => {
    if (!activeConversationId) return;

    if (pollsChannelRef.current) {
      removeRealtimeChannel(supabase, pollsChannelRef.current);
      pollsChannelRef.current = null;
    }

    const channel = supabase.channel(
      uniqueRealtimeTopic(`chat_polls:${activeConversationId}`),
    );

    channel.on(
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
    );

    channel.subscribe();

    pollsChannelRef.current = channel;

    return () => {
      if (pollsChannelRef.current === channel) {
        pollsChannelRef.current = null;
      }
      removeRealtimeChannel(supabase, channel);
    };
  }, [activeConversationId, loadPolls]);

  const createDirectMessage = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!clubId || !user?.id) return null;

      const trimmedOtherUserId = otherUserId.trim();
      if (!trimmedOtherUserId || trimmedOtherUserId === user.id) return null;

      const existing = await findExistingDirectConversationId(
        clubId,
        user.id,
        trimmedOtherUserId,
      );
      if (existing) {
        await loadConversations();
        return existing;
      }

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
        const raced = await findExistingDirectConversationId(
          clubId,
          user.id,
          trimmedOtherUserId,
        );
        if (raced) {
          await loadConversations();
          return raced;
        }
        return null;
      }

      const conversationId = convo.id as string;

      const { error: selfMemberErr } = await supabase
        .from("conversation_members")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
        });

      if (selfMemberErr) {
        console.error("Failed to add self to DM:", selfMemberErr.message);
        return null;
      }

      const { error: peerMemberErr } = await supabase
        .from("conversation_members")
        .insert({
          conversation_id: conversationId,
          user_id: trimmedOtherUserId,
        });

      if (peerMemberErr) {
        console.error("Failed to add peer to DM:", peerMemberErr.message);
        const raced = await findExistingDirectConversationId(
          clubId,
          user.id,
          trimmedOtherUserId,
        );
        if (raced) {
          await loadConversations();
          return raced;
        }
        return null;
      }

      await loadConversations();
      return conversationId;
    },
    [clubId, user?.id, loadConversations],
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

      const { error } = await supabase
        .from("conversations")
        .update(payload)
        .eq("id", conversationId);

      if (error) {
        console.error("Failed to update conversation:", error.message);
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
      return true;
    },
    [],
  );

  const fetchConversationMembers = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("conversation_members")
      .select(MEMBER_SELECT)
      .eq("conversation_id", conversationId);

    if (error) {
      console.error("Failed to load conversation members:", error.message);
      return [];
    }

    return (data ?? []).map((row) => mapMemberRow(row as Record<string, unknown>));
  }, []);

  const addConversationMember = useCallback(
    async (conversationId: string, memberUserId: string): Promise<boolean> => {
      const { error } = await supabase.from("conversation_members").insert({
        conversation_id: conversationId,
        user_id: memberUserId,
      });

      if (error) {
        console.error("Failed to add conversation member:", error.message);
        return false;
      }

      await loadConversations();
      if (activeConversationId === conversationId) {
        const members = await fetchConversationMembers(conversationId);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, members } : c,
          ),
        );
      }
      return true;
    },
    [loadConversations, activeConversationId, fetchConversationMembers],
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
      reply?: {
        id: string;
        content: string;
        senderName: string;
      } | null,
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
        replyToId: reply?.id ?? null,
        replyToContent: reply?.content ?? null,
        replyToSender: reply?.senderName ?? null,
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
          reply_to_id: reply?.id ?? null,
          reply_to_content: reply?.content ?? null,
          reply_to_sender: reply?.senderName ?? null,
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

      const convo = conversations.find((c) => c.id === conversationId);
      if (convo && clubId && trimmed) {
        const mentionedUserIds = parseMentionedUserIds(trimmed, convo.members, user.id);
        if (mentionedUserIds.length > 0) {
          const conversationName = displayNameForConversation(convo, user.id);
          const rows: NotificationRequest[] = mentionedUserIds.map((mentionedUserId) => ({
            user_id: mentionedUserId,
            type: "mention" as NotificationType,
            message: `${currentUserName} mentioned you in ${conversationName}`,
            club_id: clubId,
            reference_id: conversationId,
          }));
          void notifyUsers(rows).then((ok) => {
            if (!ok) {
              console.error("Failed to send mention notifications.");
            }
          });
        }
      }

      await loadConversations();
      return true;
    },
    [user, clubId, conversations, loadConversations],
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

  const editMessage = useCallback(
    async (messageId: string, content: string): Promise<boolean> => {
      if (!user?.id) return false;

      const trimmed = content.trim();
      if (!trimmed) return false;

      const { data, error } = await supabase
        .from("direct_messages")
        .update({
          content: trimmed,
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .eq("sender_id", user.id)
        .select("*")
        .single();

      if (error || !data) {
        console.error("Failed to edit message:", error?.message);
        return false;
      }

      const mapped = mapMessageRow(data as Record<string, unknown>);
      const [enriched] = await attachMessageSenders([mapped]);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? enriched : message,
        ),
      );
      await loadConversations();
      return true;
    },
    [loadConversations, user?.id],
  );

  return {
    conversations,
    messages,
    polls,
    loading,
    messagesLoading,
    pollsLoading,
    userRole,
    userAccessLevel,
    isChatExecutive,
    clubMembers,
    activeConversationId,
    setActiveConversationId,
    activeConversation,
    displayConversationName,
    displayConversationAvatar,
    createDirectMessage,
    createGroupChat,
    sendMessage,
    editMessage,
    createPoll,
    voteOnPoll,
    uploadAttachment,
    uploadGroupAvatar,
    updateGroupConversation,
    toggleConversationPin,
    toggleConversationFavorite,
    fetchConversationMembers,
    addConversationMember,
    refresh,
  };
}
