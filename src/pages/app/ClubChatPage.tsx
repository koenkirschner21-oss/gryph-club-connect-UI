import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  BarChart2,
  Menu,
  Pencil,
  Pin,
  Reply,
  Search,
  SquarePen,
  Star,
  ThumbsUp,
  UserPlus,
  X,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import {
  useConversations,
  getUserVoteOptionIndex,
  type ChatPoll,
  type Conversation,
  type ConversationMember,
  type DirectMessage,
} from "../../hooks/useConversations";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { notifyUnreadCountRefresh } from "../../components/ui/NotificationsDropdown";
import { supabase } from "../../lib/supabaseClient";
import { uploadImage } from "../../lib/uploadImage";
import Spinner from "../../components/ui/Spinner";
import ImageCropModal from "../../components/ui/ImageCropModal";

const ACCEPTED_FILE_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf,application/octet-stream";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const STORAGE_BUCKET = "announcement-attachments";

const pdfLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "#1a1a1a",
  border: "1px solid #333333",
  borderRadius: "6px",
  padding: "8px 14px",
  color: "#E51937",
  fontSize: "13px",
  textDecoration: "none",
};

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) return timeStr;
  if (diffDays < 7) {
    return `${date.toLocaleDateString("en-US", { weekday: "short" })} ${timeStr}`;
  }
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${timeStr}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatConversationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}

function Avatar({
  url,
  name,
  size,
  rounded = "full",
}: {
  url?: string | null;
  name: string;
  size: number;
  rounded?: "full" | "group";
}) {
  const radius = rounded === "group" ? "10px" : "50%";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "#2a2a2a",
        color: "#888888",
        fontSize: size < 36 ? 12 : 14,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

function isSystemGroupChat(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === "general" || normalized === "executive team";
}

function canEditGroupChat(
  convo: Conversation,
  role: "owner" | "executive" | "member",
): boolean {
  if (convo.type !== "group") return false;
  if (isSystemGroupChat(convo.name)) {
    return role === "owner";
  }
  return role === "owner" || role === "executive";
}

const pollInputStyle: CSSProperties = {
  width: "100%",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "14px",
  boxSizing: "border-box",
};

const pollModalStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "420px",
  width: "100%",
};

function isPollEnded(poll: ChatPoll): boolean {
  if (!poll.endsAt) return false;
  return new Date(poll.endsAt).getTime() < Date.now();
}

function pollTotalVotes(votes: Record<string, string[]>): number {
  const unique = new Set<string>();
  for (const voterIds of Object.values(votes)) {
    for (const id of voterIds) unique.add(id);
  }
  return unique.size;
}

const POLL_TYPE_TAG = /^\[gryph-poll:(general|meeting_time|team_social|other)\]\n?/;

type PollType = "general" | "meeting_time" | "team_social" | "other";

const POLL_TYPE_OPTIONS: { value: PollType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "meeting_time", label: "Meeting Time" },
  { value: "team_social", label: "Team Social" },
  { value: "other", label: "Other" },
];

function encodePollQuestion(pollType: PollType, question: string): string {
  return `[gryph-poll:${pollType}]\n${question.trim()}`;
}

function decodePollQuestion(raw: string): { pollType: PollType; question: string } {
  const match = raw.match(POLL_TYPE_TAG);
  if (match) {
    return {
      pollType: match[1] as PollType,
      question: raw.replace(POLL_TYPE_TAG, "").trim(),
    };
  }
  return { pollType: "general", question: raw };
}

function pollTypeLabel(pollType: PollType): string {
  return POLL_TYPE_OPTIONS.find((o) => o.value === pollType)?.label ?? "General";
}

function pollTypeBadgeStyle(pollType: PollType): CSSProperties {
  const base: CSSProperties = {
    background: "#111111",
    border: "1px solid #222222",
    color: "#747676",
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    display: "inline-block",
    flexShrink: 0,
  };

  switch (pollType) {
    case "meeting_time":
      return { ...base, borderColor: "#2a2a3a", color: "#6b7cff" };
    case "team_social":
      return { ...base, borderColor: "#1a2a1a", color: "#4ade80" };
    case "other":
      return { ...base, borderColor: "#2a1a2a", color: "#a78bfa" };
    default:
      return base;
  }
}

function formatPollOptionLabel(option: string, pollType: PollType): string {
  if (pollType !== "meeting_time") return option;
  const parsed = new Date(option);
  if (Number.isNaN(parsed.getTime())) return option;
  return parsed.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PollTypePill({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: selected ? "#E51937" : "#1a1a1a",
        border: selected ? "1px solid #E51937" : "1px solid #333333",
        color: selected ? "#ffffff" : "#777777",
        borderRadius: "20px",
        padding: "6px 16px",
        fontSize: "12px",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

function PollBubble({
  poll,
  currentUserId,
  onVote,
  voting,
}: {
  poll: ChatPoll;
  currentUserId?: string;
  onVote: (pollId: string, optionIndex: number) => void;
  voting: boolean;
}) {
  const ended = isPollEnded(poll);
  const total = pollTotalVotes(poll.votes);
  const userVote =
    currentUserId != null
      ? getUserVoteOptionIndex(poll.votes, currentUserId)
      : null;
  const profilePath = `/app/profile/${poll.createdBy}`;
  const creatorName = poll.creatorName ?? "Member";
  const { pollType, question } = decodePollQuestion(poll.question);

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        marginBottom: "12px",
        alignItems: "flex-start",
      }}
    >
      <Link to={profilePath} style={{ display: "flex", flexShrink: 0 }}>
        <Avatar
          url={poll.creatorAvatar}
          name={creatorName}
          size={32}
        />
      </Link>
      <div style={{ maxWidth: "85%", minWidth: "240px" }}>
        <Link
          to={profilePath}
          style={{
            fontSize: "11px",
            color: "#555555",
            marginBottom: "2px",
            textDecoration: "none",
            display: "block",
          }}
        >
          {creatorName}
        </Link>
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: "12px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            <BarChart2 size={14} color="#E51937" aria-hidden />
            <span
              style={{
                fontSize: "11px",
                color: "#747676",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Poll
            </span>
            <span style={pollTypeBadgeStyle(pollType)}>
              {pollTypeLabel(pollType)}
            </span>
          </div>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              margin: "0 0 12px",
              lineHeight: 1.4,
            }}
          >
            {question}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {poll.options.map((option, index) => {
              const voteCount = (poll.votes[String(index)] ?? []).length;
              const percent = total > 0 ? Math.round((voteCount / total) * 100) : 0;
              const selected = userVote === index;
              const disabled = ended || voting;

              return (
                <button
                  key={`${poll.id}-${index}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onVote(poll.id, index)}
                  style={{
                    position: "relative",
                    width: "100%",
                    textAlign: "left",
                    background: selected ? "#2a1518" : "#111111",
                    border: selected
                      ? "1px solid #E51937"
                      : "1px solid #2a2a2a",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    cursor: disabled ? "default" : "pointer",
                    overflow: "hidden",
                  }}
                >
                  {total > 0 ? (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${percent}%`,
                        background: "rgba(229, 25, 55, 0.15)",
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#ffffff",
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      {formatPollOptionLabel(option, pollType)}
                    </span>
                    <span style={{ fontSize: "12px", color: "#747676" }}>
                      {voteCount > 0 ? `${percent}%` : ""}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: "11px", color: "#555555", margin: "10px 0 0" }}>
            {total} vote{total === 1 ? "" : "s"}
            {ended ? " · Poll ended" : null}
            {!ended && poll.endsAt
              ? ` · Ends ${formatTime(poll.endsAt)}`
              : null}
          </p>
        </div>
        <span
          style={{
            fontSize: "10px",
            color: "#555555",
            marginTop: "2px",
            display: "block",
          }}
        >
          {formatTime(poll.createdAt)}
        </span>
      </div>
    </div>
  );
}

function ReplyQuote({
  sender,
  content,
}: {
  sender: string;
  content: string;
}) {
  return (
    <div
      style={{
        background: "#111111",
        borderLeft: "3px solid #E51937",
        borderRadius: "4px",
        padding: "6px 10px",
        marginBottom: "6px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          color: "#E51937",
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {sender}
      </p>
      <p
        style={{
          fontSize: "11px",
          color: "#555555",
          margin: "2px 0 0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {content}
      </p>
    </div>
  );
}

function MessageAttachment({ msg }: { msg: DirectMessage }) {
  if (!msg.attachmentUrl || !msg.attachmentType) return null;
  if (msg.attachmentType.startsWith("image/")) {
    return (
      <img
        src={msg.attachmentUrl}
        alt="Attachment"
        style={{
          display: "block",
          maxWidth: "200px",
          maxHeight: "200px",
          borderRadius: "12px",
          objectFit: "cover",
          marginTop: "6px",
        }}
      />
    );
  }
  const fileName = msg.attachmentUrl.split("/").pop() ?? "Download file";
  return (
    <a
      href={msg.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      download
      style={{ ...pdfLinkStyle, marginTop: "6px" }}
    >
      <DownloadIcon />
      {decodeURIComponent(fileName)}
    </a>
  );
}

type MessageReactionSummary = { count: number; liked: boolean };

function MessageBubble({
  msg,
  isOwn,
  isGroupChat,
  onReply,
  reaction,
  onToggleReaction,
}: {
  msg: DirectMessage;
  isOwn: boolean;
  isGroupChat: boolean;
  onReply?: (msg: DirectMessage) => void;
  reaction?: MessageReactionSummary;
  onToggleReaction?: (messageId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const profilePath = `/app/profile/${msg.senderId}`;
  const liked = reaction?.liked ?? false;
  const reactionCount = reaction?.count ?? 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isOwn ? "row-reverse" : "row",
        gap: "10px",
        marginBottom: "12px",
        alignItems: "flex-end",
      }}
    >
      <Link to={profilePath} style={{ display: "flex", flexShrink: 0 }}>
        <Avatar
          url={msg.senderAvatar}
          name={msg.senderName ?? "User"}
          size={32}
        />
      </Link>
      <div
        style={{
          maxWidth: "70%",
          display: "flex",
          flexDirection: "column",
          alignItems: isOwn ? "flex-end" : "flex-start",
        }}
      >
        {!isOwn && (
          <Link
            to={profilePath}
            style={{
              fontSize: "11px",
              color: "#555555",
              marginBottom: "2px",
              textDecoration: "none",
            }}
          >
            {msg.senderName ?? "Unknown"}
          </Link>
        )}
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div
            style={{
              background: isOwn ? "#E51937" : "#1a1a1a",
              color: isOwn ? "#ffffff" : "#cccccc",
              borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "10px 14px",
              fontSize: "14px",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {msg.replyToId && msg.replyToContent ? (
              <ReplyQuote
                sender={msg.replyToSender ?? "Member"}
                content={msg.replyToContent}
              />
            ) : null}
            {msg.content}
            <MessageAttachment msg={msg} />
          </div>
          <div
            style={{
              position: "absolute",
              top: "4px",
              right: isOwn ? "auto" : "4px",
              left: isOwn ? "4px" : "auto",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.15s ease",
            }}
          >
            {onToggleReaction ? (
              <button
                type="button"
                aria-label={liked ? "Remove like" : "Like message"}
                onClick={() => onToggleReaction(msg.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: liked ? "#FFC429" : "#555555",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
                onMouseEnter={(e) => {
                  if (!liked) e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  if (!liked) e.currentTarget.style.color = "#555555";
                }}
              >
                <ThumbsUp
                  size={14}
                  aria-hidden
                  fill={liked ? "#FFC429" : "none"}
                />
                {reactionCount > 0 ? (
                  <span style={{ fontSize: "11px", color: "#FFC429" }}>
                    {reactionCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {isGroupChat && onReply ? (
              <button
                type="button"
                aria-label="Reply"
                onClick={() => onReply(msg)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                }}
              >
                <Reply size={14} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <span
          style={{
            fontSize: "10px",
            color: "#555555",
            marginTop: "2px",
            textAlign: isOwn ? "right" : "left",
          }}
        >
          {formatMessageTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
}

type ModalStep = "type" | "members";
type ChatContentFilter = "all" | "polls" | "files";

export default function ClubChatPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthContext();
  const {
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
    addConversationMember,
    toggleConversationPin,
    toggleConversationFavorite,
    fetchConversationMembers,
    refresh,
  } = useConversations(clubId);

  const [showModal, setShowModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupAvatarFile, setEditGroupAvatarFile] = useState<File | null>(null);
  const [savingGroupEdit, setSavingGroupEdit] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>("type");
  const [chatType, setChatType] = useState<"direct" | "group">("direct");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupAvatarFile, setGroupAvatarFile] = useState<File | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarCropTarget, setAvatarCropTarget] = useState<
    "create-group" | "edit-group" | null
  >(null);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);
  const [chatContentFilter, setChatContentFilter] =
    useState<ChatContentFilter>("all");
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [recentlyAddedMemberIds, setRecentlyAddedMemberIds] = useState<
    Set<string>
  >(() => new Set());
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollType, setPollType] = useState<PollType>("general");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollEndsAt, setPollEndsAt] = useState("");
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<
    Record<string, MessageReactionSummary>
  >({});
  const [dmHandled, setDmHandled] = useState(false);
  const [hoveredConversationId, setHoveredConversationId] = useState<string | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionMembers, setMentionMembers] = useState<ConversationMember[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      if (isMobile) setSidebarOpen(false);
    },
    [isMobile, setActiveConversationId],
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarEditRef = useRef<HTMLInputElement>(null);
  const groupAvatarCreateRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const mentionPopupRef = useRef<HTMLDivElement>(null);

  const isPrivileged = userRole === "owner" || userRole === "executive";

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return clubMembers;
    return clubMembers.filter((m) =>
      (m.fullName ?? "").toLowerCase().includes(q),
    );
  }, [clubMembers, memberSearch]);

  type ChatTimelineItem =
    | { kind: "message"; id: string; sortAt: string; message: DirectMessage }
    | { kind: "poll"; id: string; sortAt: string; poll: ChatPoll };

  const chatTimeline = useMemo(() => {
    const items: ChatTimelineItem[] = [
      ...messages.map((message) => ({
        kind: "message" as const,
        id: message.id,
        sortAt: message.createdAt,
        message,
      })),
      ...polls.map((poll) => ({
        kind: "poll" as const,
        id: poll.id,
        sortAt: poll.createdAt,
        poll,
      })),
    ];
    return items.sort(
      (a, b) => new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime(),
    );
  }, [messages, polls]);

  const filteredChatTimeline = useMemo(() => {
    if (chatContentFilter === "all") return chatTimeline;
    if (chatContentFilter === "polls") {
      return chatTimeline.filter((item) => item.kind === "poll");
    }
    return chatTimeline.filter(
      (item) => item.kind === "message" && Boolean(item.message.attachmentUrl),
    );
  }, [chatTimeline, chatContentFilter]);

  const canAddMembers =
    activeConversation?.type === "group" &&
    Boolean(user?.id) &&
    (activeConversation.createdBy === user?.id ||
      userRole === "owner" ||
      userRole === "executive");

  const membersAvailableToAdd = useMemo(() => {
    if (!activeConversation) return [];
    const inChat = new Set(activeConversation.members.map((m) => m.userId));
    return clubMembers.filter((m) => !inChat.has(m.userId));
  }, [activeConversation, clubMembers]);

  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.isPinned),
    [conversations],
  );
  const favoriteConversations = useMemo(
    () => conversations.filter((c) => !c.isPinned && c.isFavorite),
    [conversations],
  );
  const regularConversations = useMemo(
    () => conversations.filter((c) => !c.isPinned && !c.isFavorite),
    [conversations],
  );

  const conversationSearchTrimmed = conversationSearch.trim().toLowerCase();

  const conversationMatchesSearch = useCallback(
    (convo: Conversation) => {
      if (!conversationSearchTrimmed) return true;
      const name = displayConversationName(convo).toLowerCase();
      const msg = convo.lastMessage;
      const preview = msg
        ? msg.attachmentUrl && !msg.content
          ? "attachment"
          : (msg.content ?? "").toLowerCase()
        : "no messages yet";
      return (
        name.includes(conversationSearchTrimmed) ||
        preview.includes(conversationSearchTrimmed)
      );
    },
    [conversationSearchTrimmed, displayConversationName],
  );

  const filteredPinnedConversations = useMemo(
    () => pinnedConversations.filter(conversationMatchesSearch),
    [pinnedConversations, conversationMatchesSearch],
  );
  const filteredFavoriteConversations = useMemo(
    () => favoriteConversations.filter(conversationMatchesSearch),
    [favoriteConversations, conversationMatchesSearch],
  );
  const filteredRegularConversations = useMemo(
    () => regularConversations.filter(conversationMatchesSearch),
    [regularConversations, conversationMatchesSearch],
  );

  const hasFilteredConversations =
    filteredPinnedConversations.length +
      filteredFavoriteConversations.length +
      filteredRegularConversations.length >
    0;

  const filteredMentionMembers = useMemo(() => {
    const pool =
      mentionMembers.length > 0
        ? mentionMembers
        : activeConversation?.members ?? [];
    const others = pool.filter((m) => m.userId !== user?.id);
    const q = mentionQuery.toLowerCase();
    if (!q) return others;
    return others.filter(
      (m) =>
        (m.fullName ?? "").toLowerCase().includes(q) ||
        m.mentionUsername.toLowerCase().includes(q),
    );
  }, [mentionMembers, mentionQuery, activeConversation?.members, user?.id]);

  useEffect(() => {
    if (!showMentionPopup || !activeConversationId) return;
    void fetchConversationMembers(activeConversationId).then(setMentionMembers);
  }, [showMentionPopup, activeConversationId, fetchConversationMembers]);

  useEffect(() => {
    if (!showMentionPopup) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (mentionPopupRef.current?.contains(target)) return;
      if (messageInputRef.current?.contains(target)) return;
      setShowMentionPopup(false);
      setMentionQuery("");
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showMentionPopup]);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations, setActiveConversationId]);

  useEffect(() => {
    setReplyingTo(null);
    setChatContentFilter("all");
    setShowAddMembersModal(false);
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredChatTimeline.length, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !user?.id || !clubId) return;

    void supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("type", "direct_message")
      .eq("club_id", clubId)
      .eq("read", false)
      .then(({ error }) => {
        if (error) {
          console.error(
            "Failed to mark direct message notifications as read:",
            error.message,
          );
          return;
        }
        notifyUnreadCountRefresh();
      });
  }, [activeConversationId, user?.id, clubId]);

  const loadMessageReactions = useCallback(
    async (messageIds: string[]) => {
      if (!user?.id || messageIds.length === 0) {
        setMessageReactions({});
        return;
      }

      const { data, error } = await supabase
        .from("message_reactions")
        .select("message_id, user_id")
        .in("message_id", messageIds)
        .eq("reaction", "👍");

      if (error) {
        console.error("Failed to load message reactions:", error.message);
        return;
      }

      const map: Record<string, MessageReactionSummary> = {};
      for (const row of data ?? []) {
        const messageId = row.message_id as string;
        if (!map[messageId]) {
          map[messageId] = { count: 0, liked: false };
        }
        map[messageId].count += 1;
        if (row.user_id === user.id) {
          map[messageId].liked = true;
        }
      }
      setMessageReactions(map);
    },
    [user?.id],
  );

  useEffect(() => {
    void loadMessageReactions(messages.map((m) => m.id));
  }, [messages, loadMessageReactions]);

  const toggleMessageReaction = useCallback(
    async (messageId: string) => {
      if (!user?.id) return;
      const current = messageReactions[messageId];
      if (current?.liked) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("reaction", "👍");
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          user_id: user.id,
          reaction: "👍",
        });
      }
      await loadMessageReactions(messages.map((m) => m.id));
    },
    [user?.id, messageReactions, messages, loadMessageReactions],
  );

  useEffect(() => {
    setDmHandled(false);
  }, [clubId]);

  useEffect(() => {
    const dmUserId = searchParams.get("dm");
    if (!dmUserId || dmHandled || loading || !user?.id) return;

    setDmHandled(true);
    void (async () => {
      const convId = await createDirectMessage(dmUserId);
      if (convId) {
        setActiveConversationId(convId);
      }
      const next = new URLSearchParams(searchParams);
      next.delete("dm");
      setSearchParams(next, { replace: true });
    })();
  }, [
    searchParams,
    dmHandled,
    loading,
    user?.id,
    createDirectMessage,
    setActiveConversationId,
    setSearchParams,
  ]);

  function resetPollModal() {
    setShowPollModal(false);
    setPollType("general");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollEndsAt("");
  }

  async function handleCreatePoll() {
    if (!activeConversationId) return;
    const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || trimmedOptions.length < 2) return;

    setCreatingPoll(true);
    const endsAt = pollEndsAt.trim()
      ? new Date(pollEndsAt).toISOString()
      : null;
    const storedOptions =
      pollType === "meeting_time"
        ? trimmedOptions.map((slot) => new Date(slot).toISOString())
        : trimmedOptions;
    const ok = await createPoll(
      activeConversationId,
      encodePollQuestion(pollType, pollQuestion),
      storedOptions,
      endsAt,
    );
    setCreatingPoll(false);
    if (ok) resetPollModal();
  }

  async function handlePollVote(pollId: string, optionIndex: number) {
    setVotingPollId(pollId);
    await voteOnPoll(pollId, optionIndex);
    setVotingPollId(null);
  }

  function resetModal() {
    setShowModal(false);
    setModalStep("type");
    setChatType("direct");
    setMemberSearch("");
    setSelectedMemberIds([]);
    setGroupName("");
    setGroupAvatarFile(null);
    setCreating(false);
  }

  function openModal() {
    setModalStep("type");
    setChatType("direct");
    setMemberSearch("");
    setSelectedMemberIds([]);
    setGroupName("");
    setGroupAvatarFile(null);
    setCreating(false);
    setShowModal(true);
  }

  function toggleMember(userId: string) {
    if (chatType === "direct") {
      setSelectedMemberIds([userId]);
      return;
    }
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  function openAvatarCrop(
    file: File,
    target: "create-group" | "edit-group",
  ) {
    setAvatarCropTarget(target);
    setAvatarCropFile(file);
  }

  function cancelAvatarCrop() {
    if (avatarCropTarget === "edit-group" && groupAvatarEditRef.current) {
      groupAvatarEditRef.current.value = "";
    }
    if (avatarCropTarget === "create-group" && groupAvatarCreateRef.current) {
      groupAvatarCreateRef.current.value = "";
    }
    setAvatarCropFile(null);
    setAvatarCropTarget(null);
  }

  function completeAvatarCrop(blob: Blob) {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    if (avatarCropTarget === "create-group") {
      setGroupAvatarFile(file);
    } else if (avatarCropTarget === "edit-group") {
      setEditGroupAvatarFile(file);
    }
    setAvatarCropFile(null);
    setAvatarCropTarget(null);
  }

  async function handleCreateConversation() {
    if (!clubId) return;
    setCreating(true);

    try {
      if (chatType === "direct") {
        if (selectedMemberIds.length !== 1) {
          setCreating(false);
          return;
        }
        const id = await createDirectMessage(selectedMemberIds[0]);
        if (id) {
          setActiveConversationId(id);
          resetModal();
        }
      } else {
        if (!groupName.trim() || selectedMemberIds.length === 0) {
          setCreating(false);
          return;
        }
        let avatarUrl: string | null = null;
        if (groupAvatarFile) {
          const path = `${clubId}/chat/groups/${Date.now()}-${groupAvatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          avatarUrl = await uploadImage(STORAGE_BUCKET, path, groupAvatarFile);
        }
        const id = await createGroupChat(
          groupName.trim(),
          selectedMemberIds,
          avatarUrl,
        );
        if (id) {
          setActiveConversationId(id);
          resetModal();
        }
      }
    } finally {
      setCreating(false);
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setSendError(true);
      return;
    }
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDraftChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setDraft(value);
    const cursor = e.target.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    const mentionMatch = beforeCursor.match(/@([a-zA-Z0-9._]*)$/);
    if (mentionMatch) {
      setShowMentionPopup(true);
      setMentionQuery(mentionMatch[1]);
    } else {
      setShowMentionPopup(false);
      setMentionQuery("");
    }
  }

  function insertMention(member: ConversationMember) {
    const username = member.mentionUsername;
    const input = messageInputRef.current;
    const cursor = input?.selectionStart ?? draft.length;
    const beforeCursor = draft.slice(0, cursor);
    const afterCursor = draft.slice(cursor);
    const atIndex = beforeCursor.lastIndexOf("@");
    const nextDraft =
      atIndex === -1
        ? `${draft}@${username} `
        : `${beforeCursor.slice(0, atIndex)}@${username} ${afterCursor}`;
    setDraft(nextDraft);
    setShowMentionPopup(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      input?.focus();
    });
  }

  function handleMessageKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && showMentionPopup) {
      e.preventDefault();
      setShowMentionPopup(false);
      setMentionQuery("");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function startReply(msg: DirectMessage) {
    const preview =
      msg.content?.trim() ||
      (msg.attachmentUrl ? "Attachment" : "Message");
    setReplyingTo({
      id: msg.id,
      content: preview,
      senderName: msg.senderName ?? "Unknown",
    });
  }

  async function handleAddMemberToChat(memberUserId: string) {
    if (!activeConversationId) return;
    setAddingMemberId(memberUserId);
    const ok = await addConversationMember(activeConversationId, memberUserId);
    setAddingMemberId(null);
    if (!ok) {
      setSendError(true);
      return;
    }
    setRecentlyAddedMemberIds((prev) => new Set(prev).add(memberUserId));
    window.setTimeout(() => {
      setRecentlyAddedMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(memberUserId);
        return next;
      });
    }, 2000);
  }

  async function handleSend() {
    if (!activeConversationId || !user) return;
    const text = draft.trim();
    if (!text && !pendingFile) return;

    setSending(true);
    setSendError(false);

    let attachment: { url: string; type: string } | null = null;
    if (pendingFile) {
      attachment = await uploadAttachment(pendingFile, activeConversationId);
      if (!attachment) {
        setSendError(true);
        setSending(false);
        return;
      }
    }

    const ok = await sendMessage(
      activeConversationId,
      text,
      attachment,
      replyingTo,
    );
    if (ok) {
      setDraft("");
      setPendingFile(null);
      setReplyingTo(null);
    } else {
      setSendError(true);
    }
    setSending(false);
  }

  function previewText(convo: Conversation): string {
    const msg = convo.lastMessage;
    if (!msg) return "No messages yet";
    if (msg.attachmentUrl && !msg.content) return "📎 Attachment";
    return msg.content ?? "";
  }

  function openEditGroupModal() {
    if (!activeConversation || activeConversation.type !== "group") return;
    setEditGroupName(activeConversation.name);
    setEditGroupAvatarFile(null);
    setShowEditGroupModal(true);
  }

  function closeEditGroupModal() {
    setShowEditGroupModal(false);
    setEditGroupName("");
    setEditGroupAvatarFile(null);
    if (groupAvatarEditRef.current) {
      groupAvatarEditRef.current.value = "";
    }
  }

  async function handleSaveGroupEdit() {
    if (!activeConversation || activeConversation.type !== "group") return;
    if (!editGroupName.trim()) return;

    setSavingGroupEdit(true);
    let avatarUrl: string | null | undefined = undefined;
    if (editGroupAvatarFile) {
      const uploaded = await uploadGroupAvatar(
        editGroupAvatarFile,
        activeConversation.id,
      );
      if (!uploaded) {
        setSavingGroupEdit(false);
        setSendError(true);
        return;
      }
      avatarUrl = uploaded;
    }

    const ok = await updateGroupConversation(activeConversation.id, {
      name: editGroupName.trim(),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    });

    setSavingGroupEdit(false);
    if (ok) {
      refresh();
      closeEditGroupModal();
    } else {
      setSendError(true);
    }
  }

  function listConversationAvatar(convo: Conversation): string | null {
    if (convo.type === "group") {
      return convo.avatarUrl ?? null;
    }
    return displayConversationAvatar(convo);
  }

  if (loading) {
    return (
      <div
        className="flex h-[calc(100vh-4rem)] items-center justify-center"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <Spinner label="Loading messages…" />
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-4rem)] overflow-hidden"
      style={{ backgroundColor: "#0f0f0f", position: "relative" }}
    >
      {isMobile && sidebarOpen ? (
        <div
          role="presentation"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 99,
          }}
        />
      ) : null}

      {/* Left panel */}
      <aside
        style={{
          width: "280px",
          flexShrink: 0,
          background: "#111111",
          borderRight: "1px solid #1e1e1e",
          display: isMobile ? (sidebarOpen ? "flex" : "none") : undefined,
          flexDirection: "column",
          ...(isMobile && sidebarOpen
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                height: "100%",
                zIndex: 100,
              }
            : {}),
        }}
        className={isMobile ? undefined : "hidden sm:flex"}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
          }}
        >
          <h2
            style={{
              fontWeight: 700,
              fontSize: "16px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Messages
          </h2>
          <button
            type="button"
            onClick={openModal}
            aria-label="New conversation"
            style={{
              background: "none",
              border: "none",
              color: "#E51937",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
            }}
          >
            <SquarePen size={20} aria-hidden />
          </button>
        </div>

        <div style={{ padding: "0 16px 12px", position: "relative" }}>
          <Search
            size={14}
            color="#555555"
            aria-hidden
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            placeholder="Search conversations..."
            style={{
              width: "100%",
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "8px 12px 8px 34px",
              color: "#ffffff",
              fontSize: "13px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.length === 0 ? (
            <p
              style={{
                padding: "16px",
                fontSize: "13px",
                color: "#555555",
                textAlign: "center",
              }}
            >
              No conversations yet
            </p>
          ) : !hasFilteredConversations ? (
            <p
              style={{
                padding: "16px",
                fontSize: "13px",
                color: "#555555",
                textAlign: "center",
              }}
            >
              No conversations found
            </p>
          ) : (
            <>
              {filteredPinnedConversations.length > 0 ? (
                <>
                  <p
                    style={{
                      fontSize: "10px",
                      color: "#555555",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      margin: "8px 16px 6px",
                    }}
                  >
                    PINNED
                  </p>
                  {filteredPinnedConversations.map((convo) => {
                    const isActive = convo.id === activeConversationId;
                    const name = displayConversationName(convo);
                    const avatar = listConversationAvatar(convo);
                    const hasGroupAvatar = convo.type === "group" && Boolean(convo.avatarUrl);
                    const showActions = hoveredConversationId === convo.id;
                    return (
                      <div
                        key={convo.id}
                        role="button"
                        onClick={() => selectConversation(convo.id)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          background: isActive ? "#1f1f1f" : "transparent",
                          border: "none",
                          borderLeft: isActive
                            ? "3px solid #E51937"
                            : "3px solid transparent",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          setHoveredConversationId(convo.id);
                          if (!isActive) e.currentTarget.style.background = "#1a1a1a";
                        }}
                        onMouseLeave={(e) => {
                          setHoveredConversationId((prev) => (prev === convo.id ? null : prev));
                          if (!isActive) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Avatar
                          url={avatar}
                          name={name}
                          size={40}
                          rounded={
                            convo.type === "group" && !hasGroupAvatar
                              ? "group"
                              : "full"
                          }
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "#ffffff",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Pin size={12} color="#FFC429" fill="#FFC429" aria-hidden />
                              {name}
                            </span>
                            {convo.lastMessage ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#555555",
                                  flexShrink: 0,
                                }}
                              >
                                {formatConversationTime(convo.lastMessage.createdAt)}
                              </span>
                            ) : null}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              marginTop: "2px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#555555",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {previewText(convo)}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                              {convo.unreadCount > 0 ? (
                                <span
                                  style={{
                                    background: "#E51937",
                                    color: "#ffffff",
                                    borderRadius: "50%",
                                    width: "18px",
                                    height: "18px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                                </span>
                              ) : null}
                              {showActions ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label={convo.isPinned ? "Unpin conversation" : "Pin conversation"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void toggleConversationPin(convo.id);
                                    }}
                                    style={{ background: "transparent", border: "none", padding: 0, display: "flex", cursor: "pointer", color: "#555555" }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = "#FFC429";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = "#555555";
                                    }}
                                  >
                                    <Pin size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={convo.isFavorite ? "Remove favorite" : "Favorite conversation"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void toggleConversationFavorite(convo.id);
                                    }}
                                    style={{ background: "transparent", border: "none", padding: 0, display: "flex", cursor: "pointer", color: convo.isFavorite ? "#FFC429" : "#555555" }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = "#FFC429";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = convo.isFavorite ? "#FFC429" : "#555555";
                                    }}
                                  >
                                    <Star size={14} fill={convo.isFavorite ? "#FFC429" : "none"} />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {filteredFavoriteConversations.length > 0 ? (
                <>
                  <p
                    style={{
                      fontSize: "10px",
                      color: "#555555",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      margin: "10px 16px 6px",
                    }}
                  >
                    FAVORITES
                  </p>
                  {filteredFavoriteConversations.map((convo) => {
                    const isActive = convo.id === activeConversationId;
                    const name = displayConversationName(convo);
                    const avatar = listConversationAvatar(convo);
                    const hasGroupAvatar = convo.type === "group" && Boolean(convo.avatarUrl);
                    const showActions = hoveredConversationId === convo.id;
                    return (
                      <div
                        key={convo.id}
                        role="button"
                        onClick={() => selectConversation(convo.id)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          background: isActive ? "#1f1f1f" : "transparent",
                          border: "none",
                          borderLeft: isActive
                            ? "3px solid #E51937"
                            : "3px solid transparent",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          setHoveredConversationId(convo.id);
                          if (!isActive) e.currentTarget.style.background = "#1a1a1a";
                        }}
                        onMouseLeave={(e) => {
                          setHoveredConversationId((prev) => (prev === convo.id ? null : prev));
                          if (!isActive) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Avatar
                          url={avatar}
                          name={name}
                          size={40}
                          rounded={
                            convo.type === "group" && !hasGroupAvatar
                              ? "group"
                              : "full"
                          }
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "#ffffff",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {name}
                            </span>
                            {convo.lastMessage ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#555555",
                                  flexShrink: 0,
                                }}
                              >
                                {formatConversationTime(convo.lastMessage.createdAt)}
                              </span>
                            ) : null}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              marginTop: "2px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#555555",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {previewText(convo)}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                              {convo.unreadCount > 0 ? (
                                <span
                                  style={{
                                    background: "#E51937",
                                    color: "#ffffff",
                                    borderRadius: "50%",
                                    width: "18px",
                                    height: "18px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                                </span>
                              ) : null}
                              {showActions ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label={convo.isPinned ? "Unpin conversation" : "Pin conversation"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void toggleConversationPin(convo.id);
                                    }}
                                    style={{ background: "transparent", border: "none", padding: 0, display: "flex", cursor: "pointer", color: "#555555" }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = "#FFC429";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = "#555555";
                                    }}
                                  >
                                    <Pin size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={convo.isFavorite ? "Remove favorite" : "Favorite conversation"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void toggleConversationFavorite(convo.id);
                                    }}
                                    style={{ background: "transparent", border: "none", padding: 0, display: "flex", cursor: "pointer", color: convo.isFavorite ? "#FFC429" : "#555555" }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = "#FFC429";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = convo.isFavorite ? "#FFC429" : "#555555";
                                    }}
                                  >
                                    <Star size={14} fill={convo.isFavorite ? "#FFC429" : "none"} />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {filteredRegularConversations.map((convo) => {
              const isActive = convo.id === activeConversationId;
              const name = displayConversationName(convo);
              const avatar = listConversationAvatar(convo);
              const hasGroupAvatar = convo.type === "group" && Boolean(convo.avatarUrl);
              const showActions = hoveredConversationId === convo.id;
              return (
                <div
                  key={convo.id}
                  role="button"
                  onClick={() => selectConversation(convo.id)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    background: isActive ? "#1f1f1f" : "transparent",
                    border: "none",
                    borderLeft: isActive
                      ? "3px solid #E51937"
                      : "3px solid transparent",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    setHoveredConversationId(convo.id);
                    if (!isActive) {
                      e.currentTarget.style.background = "#1a1a1a";
                    }
                  }}
                  onMouseLeave={(e) => {
                    setHoveredConversationId((prev) => (prev === convo.id ? null : prev));
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <Avatar
                    url={avatar}
                    name={name}
                    size={40}
                    rounded={
                      convo.type === "group" && !hasGroupAvatar
                        ? "group"
                        : "full"
                    }
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#ffffff",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                      </span>
                      {convo.lastMessage ? (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#555555",
                            flexShrink: 0,
                          }}
                        >
                          {formatConversationTime(convo.lastMessage.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginTop: "2px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#555555",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {previewText(convo)}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                        {convo.unreadCount > 0 ? (
                          <span
                            style={{
                              background: "#E51937",
                              color: "#ffffff",
                              borderRadius: "50%",
                              width: "18px",
                              height: "18px",
                              fontSize: "10px",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                          </span>
                        ) : null}
                        {showActions ? (
                          <>
                            <button
                              type="button"
                              aria-label={convo.isPinned ? "Unpin conversation" : "Pin conversation"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleConversationPin(convo.id);
                              }}
                              style={{ background: "transparent", border: "none", padding: 0, display: "flex", cursor: "pointer", color: "#555555" }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#FFC429";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#555555";
                              }}
                            >
                              <Pin size={14} />
                            </button>
                            <button
                              type="button"
                              aria-label={convo.isFavorite ? "Remove favorite" : "Favorite conversation"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleConversationFavorite(convo.id);
                              }}
                              style={{ background: "transparent", border: "none", padding: 0, display: "flex", cursor: "pointer", color: convo.isFavorite ? "#FFC429" : "#555555" }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#FFC429";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = convo.isFavorite ? "#FFC429" : "#555555";
                              }}
                            >
                              <Star size={14} fill={convo.isFavorite ? "#FFC429" : "none"} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </>
          )}
        </div>
      </aside>

      {/* Right panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#0f0f0f",
          minWidth: 0,
        }}
      >
        {/* Mobile header with compose */}
        <div
          className="flex items-center justify-between border-b px-4 py-3 sm:hidden"
          style={{ borderColor: "#1e1e1e" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              aria-label={sidebarOpen ? "Hide conversations" : "Show conversations"}
              onClick={() => setSidebarOpen((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
              }}
            >
              <Menu size={20} aria-hidden />
            </button>
            <span style={{ fontWeight: 700, color: "#ffffff" }}>Messages</span>
          </div>
          <button
            type="button"
            onClick={openModal}
            style={{
              background: "none",
              border: "none",
              color: "#E51937",
              cursor: "pointer",
            }}
          >
            <SquarePen size={20} aria-hidden />
          </button>
        </div>

        {!activeConversation ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#555555",
              fontSize: "14px",
              padding: "24px",
              textAlign: "center",
            }}
          >
            Select a conversation
          </div>
        ) : (
          <>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 20px",
                borderBottom: "1px solid #1e1e1e",
                background: "#0f0f0f",
              }}
            >
              <Avatar
                url={
                  activeConversation.type === "group"
                    ? activeConversation.avatarUrl
                    : displayConversationAvatar(activeConversation)
                }
                name={displayConversationName(activeConversation)}
                size={40}
                rounded={
                  activeConversation.type === "group" &&
                  !activeConversation.avatarUrl
                    ? "group"
                    : "full"
                }
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "#ffffff",
                    }}
                  >
                    {displayConversationName(activeConversation)}
                  </h3>
                  {activeConversation.type === "group" &&
                  canEditGroupChat(activeConversation, userRole) ? (
                    <button
                      type="button"
                      onClick={openEditGroupModal}
                      aria-label="Edit group"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#888888",
                        cursor: "pointer",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#E51937";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#888888";
                      }}
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                  ) : null}
                </div>
                {activeConversation.type === "group" ? (
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "12px",
                      color: "#555555",
                    }}
                  >
                    {formatMemberCount(activeConversation.members.length)}
                  </p>
                ) : null}
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                  {(["all", "polls", "files"] as const).map((filter) => {
                    const active = chatContentFilter === filter;
                    const label =
                      filter === "all" ? "All" : filter === "polls" ? "Polls" : "Files";
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setChatContentFilter(filter)}
                        style={{
                          background: active ? "#E51937" : "#1a1a1a",
                          border: active ? "none" : "1px solid #242424",
                          color: active ? "#ffffff" : "#777777",
                          borderRadius: "20px",
                          padding: "4px 12px",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {canAddMembers ? (
                <button
                  type="button"
                  title="Add Members"
                  aria-label="Add Members"
                  onClick={() => setShowAddMembersModal(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#777777",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#777777";
                  }}
                >
                  <UserPlus size={16} aria-hidden />
                </button>
              ) : null}
            </header>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
              }}
            >
              {messagesLoading || pollsLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner label="Loading messages…" />
                </div>
              ) : filteredChatTimeline.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#555555",
                    fontSize: "13px",
                    marginTop: "40px",
                  }}
                >
                  {chatContentFilter === "all"
                    ? "No messages yet. Say hello!"
                    : chatContentFilter === "polls"
                      ? "No polls in this conversation."
                      : "No files shared in this conversation."}
                </p>
              ) : (
                filteredChatTimeline.map((item) =>
                  item.kind === "message" ? (
                    <MessageBubble
                      key={item.id}
                      msg={item.message}
                      isOwn={item.message.senderId === user?.id}
                      isGroupChat={activeConversation.type === "group"}
                      onReply={
                        activeConversation.type === "group" ? startReply : undefined
                      }
                      reaction={messageReactions[item.message.id]}
                      onToggleReaction={(id) => void toggleMessageReaction(id)}
                    />
                  ) : (
                    <PollBubble
                      key={item.id}
                      poll={item.poll}
                      currentUserId={user?.id}
                      onVote={(pollId, optionIndex) =>
                        void handlePollVote(pollId, optionIndex)
                      }
                      voting={votingPollId === item.poll.id}
                    />
                  ),
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            <div
              style={{
                background: "#111111",
                borderTop: "1px solid #1e1e1e",
                padding: "12px 16px",
                position: "relative",
              }}
            >
              {replyingTo ? (
                <div
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #242424",
                    borderLeft: "3px solid #E51937",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    marginBottom: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "12px", color: "#777777", margin: 0 }}>
                      Replying to {replyingTo.senderName}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#555555",
                        margin: "2px 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {replyingTo.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel reply"
                    onClick={() => setReplyingTo(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#777777",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      flexShrink: 0,
                    }}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  position: "relative",
                }}
              >
              {showMentionPopup && activeConversation ? (
                <div
                  ref={mentionPopupRef}
                  style={{
                    position: "absolute",
                    left: "16px",
                    right: "16px",
                    bottom: "100%",
                    marginBottom: "8px",
                    background: "#1a1a1a",
                    border: "1px solid #242424",
                    borderRadius: "8px",
                    padding: "8px",
                    maxHeight: "200px",
                    overflowY: "auto",
                    zIndex: 10,
                  }}
                >
                  {filteredMentionMembers.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "12px", color: "#555555", padding: "6px 10px" }}>
                      No members found
                    </p>
                  ) : (
                    filteredMentionMembers.map((member) => (
                      <button
                        key={member.userId}
                        type="button"
                        onClick={() => insertMention(member)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "6px 10px",
                          background: "transparent",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#252525";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Avatar
                          url={member.avatarUrl}
                          name={member.fullName ?? member.mentionUsername}
                          size={28}
                        />
                        <span style={{ fontSize: "13px", color: "#cccccc" }}>
                          {member.fullName ?? member.mentionUsername}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                style={{
                  background: "none",
                  border: "none",
                  color: "#555555",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#E51937";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#555555";
                }}
              >
                <PaperclipIcon />
              </button>
              <button
                type="button"
                onClick={() => setShowPollModal(true)}
                aria-label="Create poll"
                style={{
                  background: "none",
                  border: "none",
                  color: "#555555",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#E51937";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#555555";
                }}
              >
                <BarChart2 size={20} aria-hidden />
              </button>
              <input
                ref={messageInputRef}
                type="text"
                value={draft}
                onChange={handleDraftChange}
                placeholder="Message…"
                onKeyDown={handleMessageKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                style={{
                  flex: 1,
                  background: "#1a1a1a",
                  border: `1px solid ${inputFocused ? "#E51937" : "#2a2a2a"}`,
                  borderRadius: "24px",
                  padding: "10px 18px",
                  color: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || (!draft.trim() && !pendingFile)}
                aria-label="Send message"
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "50%",
                  width: "38px",
                  height: "38px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor:
                    sending || (!draft.trim() && !pendingFile)
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    sending || (!draft.trim() && !pendingFile) ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                <SendIcon />
              </button>
            </div>
            {pendingFile ? (
              <p
                style={{
                  fontSize: "11px",
                  color: "#888888",
                  padding: "0 16px 8px",
                  background: "#111111",
                }}
              >
                Attached: {pendingFile.name}
              </p>
            ) : null}
            {sendError ? (
              <p
                style={{
                  fontSize: "12px",
                  color: "#E51937",
                  padding: "0 16px 12px",
                  background: "#111111",
                }}
              >
                Failed to send. Please try again.
              </p>
            ) : null}
            </div>
          </>
        )}
      </div>

      {showPollModal && activeConversationId ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
          onClick={resetPollModal}
        >
          <div style={pollModalStyle} onClick={(e) => e.stopPropagation()}>
            <h3
              style={{
                fontWeight: 700,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              Create Poll
            </h3>

            <p
              style={{
                fontSize: "12px",
                color: "#888888",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Poll Type
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              {POLL_TYPE_OPTIONS.map((option) => (
                <PollTypePill
                  key={option.value}
                  label={option.label}
                  selected={pollType === option.value}
                  disabled={creatingPoll}
                  onClick={() => setPollType(option.value)}
                />
              ))}
            </div>

            <input
              type="text"
              required
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question..."
              disabled={creatingPoll}
              style={{ ...pollInputStyle, marginBottom: "16px" }}
            />

            <p
              style={{
                fontSize: "12px",
                color: "#888888",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Options
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {pollOptions.map((option, index) => (
                <div
                  key={index}
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type={pollType === "meeting_time" ? "datetime-local" : "text"}
                    value={option}
                    onChange={(e) => {
                      const next = [...pollOptions];
                      next[index] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={
                      pollType === "meeting_time"
                        ? "Propose a time slot"
                        : `Option ${index + 1}`
                    }
                    disabled={creatingPoll}
                    style={{ ...pollInputStyle, flex: 1 }}
                  />
                  {pollOptions.length > 2 ? (
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() =>
                        setPollOptions(pollOptions.filter((_, i) => i !== index))
                      }
                      disabled={creatingPoll}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#555555",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#E51937";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#555555";
                      }}
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {pollType === "meeting_time" ? (
              <p
                style={{
                  fontSize: "12px",
                  color: "#555555",
                  margin: "0 0 12px",
                }}
              >
                Members can select all times that work for them
              </p>
            ) : null}

            {pollOptions.length < 6 ? (
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ""])}
                disabled={creatingPoll}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#cccccc",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  marginBottom: "16px",
                }}
              >
                + Add Option
              </button>
            ) : null}

            <label
              htmlFor="poll-ends-at"
              style={{
                display: "block",
                fontSize: "12px",
                color: "#888888",
                marginBottom: "8px",
              }}
            >
              Poll ends at (optional)
            </label>
            <input
              id="poll-ends-at"
              type="datetime-local"
              value={pollEndsAt}
              onChange={(e) => setPollEndsAt(e.target.value)}
              disabled={creatingPoll}
              style={{ ...pollInputStyle, marginBottom: "20px" }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={resetPollModal}
                disabled={creatingPoll}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreatePoll()}
                disabled={
                  creatingPoll ||
                  !pollQuestion.trim() ||
                  pollOptions.filter((o) => o.trim()).length < 2
                }
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity:
                    creatingPoll ||
                    !pollQuestion.trim() ||
                    pollOptions.filter((o) => o.trim()).length < 2
                      ? 0.5
                      : 1,
                }}
              >
                {creatingPoll ? "Creating…" : "Create Poll"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* New conversation modal */}
      {showModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-conversation-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
          onClick={resetModal}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="new-conversation-title"
              style={{
                fontWeight: 700,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 20px",
              }}
            >
              New Conversation
            </h3>

            {modalStep === "type" ? (
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setChatType("direct");
                    setModalStep("members");
                    setSelectedMemberIds([]);
                  }}
                  style={{
                    flex: 1,
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #2a2a2a",
                    background: "#111111",
                    color: "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <PersonIcon />
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>
                    Direct Message
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!isPrivileged}
                  title={!isPrivileged ? "Executives only" : undefined}
                  onClick={() => {
                    if (!isPrivileged) return;
                    setChatType("group");
                    setModalStep("members");
                    setSelectedMemberIds([]);
                  }}
                  style={{
                    flex: 1,
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #2a2a2a",
                    background: "#111111",
                    color: isPrivileged ? "#ffffff" : "#555555",
                    cursor: isPrivileged ? "pointer" : "not-allowed",
                    opacity: isPrivileged ? 1 : 0.6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <PeopleIcon />
                  <span style={{ fontSize: "13px", fontWeight: 600 }}>
                    Group Chat
                  </span>
                  {!isPrivileged ? (
                    <span style={{ fontSize: "10px", color: "#555555" }}>
                      Executives only
                    </span>
                  ) : null}
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members…"
                  style={{
                    width: "100%",
                    background: "#111111",
                    border: "1px solid #2a2a2a",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    color: "#ffffff",
                    fontSize: "14px",
                    marginBottom: "12px",
                    boxSizing: "border-box",
                  }}
                />

                {chatType === "group" ? (
                  <>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Group name"
                      style={{
                        width: "100%",
                        background: "#111111",
                        border: "1px solid #2a2a2a",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        color: "#ffffff",
                        fontSize: "14px",
                        marginBottom: "12px",
                        boxSizing: "border-box",
                      }}
                    />
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        color: "#888888",
                        marginBottom: "12px",
                      }}
                    >
                      <span style={{ marginRight: "8px" }}>
                        Avatar (optional)
                      </span>
                      <input
                        ref={groupAvatarCreateRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) openAvatarCrop(file, "create-group");
                        }}
                      />
                    </label>
                  </>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    maxHeight: "160px",
                    overflowY: "auto",
                    marginBottom: "16px",
                  }}
                >
                  {filteredMembers.map((m) => {
                    const selected = selectedMemberIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => toggleMember(m.userId)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "20px",
                          border: selected
                            ? "1px solid #E51937"
                            : "1px solid #2a2a2a",
                          background: selected ? "#2a1518" : "#111111",
                          color: selected ? "#ffffff" : "#888888",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {m.fullName ?? "Member"}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setModalStep("type")}
                    style={{
                      background: "transparent",
                      border: "1px solid #333333",
                      color: "#888888",
                      borderRadius: "6px",
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={
                      creating ||
                      (chatType === "direct"
                        ? selectedMemberIds.length !== 1
                        : !groupName.trim() || selectedMemberIds.length === 0)
                    }
                    onClick={handleCreateConversation}
                    style={{
                      background: "#E51937",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "10px 24px",
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity:
                        creating ||
                        (chatType === "direct"
                          ? selectedMemberIds.length !== 1
                          : !groupName.trim() || selectedMemberIds.length === 0)
                          ? 0.5
                          : 1,
                    }}
                  >
                    {creating ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showEditGroupModal && activeConversation?.type === "group" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-group-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
          onClick={closeEditGroupModal}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "360px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="edit-group-title"
              style={{
                fontWeight: 700,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 20px",
              }}
            >
              Edit Group
            </h3>

            <label
              htmlFor="edit-group-name"
              style={{
                display: "block",
                fontSize: "12px",
                color: "#888888",
                marginBottom: "8px",
              }}
            >
              Group name
            </label>
            <input
              id="edit-group-name"
              type="text"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              style={{
                width: "100%",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#ffffff",
                fontSize: "14px",
                boxSizing: "border-box",
                marginBottom: "16px",
              }}
            />

            <p
              style={{
                fontSize: "12px",
                color: "#888888",
                margin: "0 0 8px",
              }}
            >
              Group avatar
            </p>
            <input
              ref={groupAvatarEditRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) openAvatarCrop(file, "edit-group");
              }}
            />
            <button
              type="button"
              onClick={() => groupAvatarEditRef.current?.click()}
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#2a2a2a",
                border: "2px dashed #333333",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                marginBottom: "20px",
              }}
            >
              {editGroupAvatarFile ? (
                <img
                  src={URL.createObjectURL(editGroupAvatarFile)}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : activeConversation.avatarUrl ? (
                <img
                  src={activeConversation.avatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span style={{ fontSize: "10px", color: "#888888" }}>Upload</span>
              )}
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={closeEditGroupModal}
                disabled={savingGroupEdit}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGroupEdit}
                disabled={savingGroupEdit || !editGroupName.trim()}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  opacity: savingGroupEdit || !editGroupName.trim() ? 0.5 : 1,
                }}
              >
                {savingGroupEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {avatarCropFile ? (
        <ImageCropModal
          imageFile={avatarCropFile}
          aspectRatio={1}
          circular
          onComplete={completeAvatarCrop}
          onCancel={cancelAvatarCrop}
        />
      ) : null}

      {showAddMembersModal && activeConversation ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
          onClick={() => setShowAddMembersModal(false)}
        >
          <div
            style={{
              position: "relative",
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowAddMembersModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
              }}
            >
              <X size={18} aria-hidden />
            </button>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              Add Members
            </h2>
            {membersAvailableToAdd.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                All club members are already in this chat.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {membersAvailableToAdd.map((member) => {
                  const wasAdded = recentlyAddedMemberIds.has(member.userId);
                  const isAdding = addingMemberId === member.userId;
                  return (
                    <div
                      key={member.userId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          minWidth: 0,
                        }}
                      >
                        <Avatar
                          url={member.avatarUrl}
                          name={member.fullName ?? member.mentionUsername}
                          size={32}
                        />
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#ffffff",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {member.fullName ?? member.mentionUsername}
                        </span>
                      </div>
                      {wasAdded ? (
                        <span style={{ fontSize: "12px", color: "#4ade80", flexShrink: 0 }}>
                          Added ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isAdding}
                          onClick={() => void handleAddMemberToChat(member.userId)}
                          style={{
                            background: "#E51937",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "4px 12px",
                            fontSize: "12px",
                            cursor: isAdding ? "not-allowed" : "pointer",
                            opacity: isAdding ? 0.6 : 1,
                            flexShrink: 0,
                          }}
                        >
                          {isAdding ? "Adding…" : "Add"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
