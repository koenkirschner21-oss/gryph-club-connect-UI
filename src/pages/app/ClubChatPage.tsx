import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import {
  useConversations,
  type Conversation,
  type DirectMessage,
} from "../../hooks/useConversations";
import { uploadImage } from "../../lib/uploadImage";
import Spinner from "../../components/ui/Spinner";

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

function ComposeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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

function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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

function MessageBubble({
  msg,
  isOwn,
}: {
  msg: DirectMessage;
  isOwn: boolean;
}) {
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
      <Avatar
        url={msg.senderAvatar}
        name={msg.senderName ?? "User"}
        size={32}
      />
      <div
        style={{
          maxWidth: "70%",
          display: "flex",
          flexDirection: "column",
          alignItems: isOwn ? "flex-end" : "flex-start",
        }}
      >
        {!isOwn && (
          <span
            style={{
              fontSize: "11px",
              color: "#555555",
              marginBottom: "2px",
            }}
          >
            {msg.senderName ?? "Unknown"}
          </span>
        )}
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
          {msg.content}
          <MessageAttachment msg={msg} />
        </div>
        <span
          style={{
            fontSize: "10px",
            color: "#555555",
            marginTop: "2px",
            textAlign: isOwn ? "right" : "left",
          }}
        >
          {formatTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
}

type ModalStep = "type" | "members";

export default function ClubChatPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const {
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
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarEditRef = useRef<HTMLInputElement>(null);

  const isPrivileged = userRole === "owner" || userRole === "executive";

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return clubMembers;
    return clubMembers.filter((m) =>
      (m.fullName ?? "").toLowerCase().includes(q),
    );
  }, [clubMembers, memberSearch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeConversationId]);

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

    const ok = await sendMessage(activeConversationId, text, attachment);
    if (ok) {
      setDraft("");
      setPendingFile(null);
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
      style={{ backgroundColor: "#0f0f0f" }}
    >
      {/* Left panel */}
      <aside
        style={{
          width: "280px",
          flexShrink: 0,
          background: "#111111",
          borderRight: "1px solid #1e1e1e",
          display: "flex",
          flexDirection: "column",
        }}
        className="hidden sm:flex"
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
            <ComposeIcon />
          </button>
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
          ) : (
            conversations.map((convo) => {
              const isActive = convo.id === activeConversationId;
              const name = displayConversationName(convo);
              const avatar = listConversationAvatar(convo);
              const hasGroupAvatar = convo.type === "group" && Boolean(convo.avatarUrl);
              return (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => setActiveConversationId(convo.id)}
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
                    if (!isActive) {
                      e.currentTarget.style.background = "#1a1a1a";
                    }
                  }}
                  onMouseLeave={(e) => {
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
                          {formatTime(convo.lastMessage.createdAt)}
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
                    </div>
                  </div>
                </button>
              );
            })
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
          <span style={{ fontWeight: 700, color: "#ffffff" }}>Messages</span>
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
            <ComposeIcon />
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
            Select a conversation or start a new one
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
                      <PencilIcon size={14} />
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
              </div>
            </header>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
              }}
            >
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner label="Loading messages…" />
                </div>
              ) : messages.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#555555",
                    fontSize: "13px",
                    marginTop: "40px",
                  }}
                >
                  No messages yet. Say hello!
                </p>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.senderId === user?.id}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div
              style={{
                background: "#111111",
                borderTop: "1px solid #1e1e1e",
                padding: "12px 16px",
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
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
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
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
          </>
        )}
      </div>

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
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={(e) =>
                          setGroupAvatarFile(e.target.files?.[0] ?? null)
                        }
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
              onChange={(e) =>
                setEditGroupAvatarFile(e.target.files?.[0] ?? null)
              }
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
    </div>
  );
}
