import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMessages } from "../../hooks/useClubMessages";
import { useClubChannels } from "../../hooks/useClubChannels";
import { isPrivilegedClubRole } from "../../lib/clubRoles";
import Spinner from "../../components/ui/Spinner";


function channelItemClass(isActive: boolean) {
  const base =
    "flex w-full cursor-pointer items-center gap-1 rounded-md border-l-[3px] py-2 pl-3 pr-3 text-left text-[13px] transition-colors";
  if (isActive) {
    return `${base} border-l-[#E51937] bg-[#1f1f1f] pl-[9px] text-white`;
  }
  return `${base} border-l-transparent text-[#777777] hover:bg-[#1a1a1a] hover:text-[#cccccc]`;
}

export default function ClubChatPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getUserRole } = useClubContext();
  const { channels, loading: channelsLoading } = useClubChannels(clubId);
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const { messages, loading: messagesLoading, sendMessage } = useClubMessages(
    clubId,
    activeChannelId || undefined,
  );

  const role = getUserRole(clubId ?? "");
  const isPrivileged = isPrivilegedClubRole(role);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
  }, [activeChannelId, channels]);

  const activeChannel = channels.find((ch) => ch.id === activeChannelId);

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Announcements channel is read-only for regular members
  const canPost = activeChannel?.isAnnouncementOnly ? isPrivileged : true;

  async function handleSend() {
    if (!draft.trim() || !user || sending) return;
    if (!activeChannelId) return;
    setSending(true);
    setSendError(false);
    const ok = await sendMessage(activeChannelId, draft.trim());
    if (ok) {
      setDraft("");
    } else {
      setSendError(true);
    }
    setSending(false);
  }

  const awaitingChannel =
    !channelsLoading && channels.length > 0 && !activeChannelId;
  if (channelsLoading || awaitingChannel || (Boolean(activeChannelId) && messagesLoading)) {
    return (
      <div className="flex h-[60vh] items-center justify-center md:h-[calc(100vh-4rem)]">
        <Spinner label="Loading messages…" />
      </div>
    );
  }

  if (!channelsLoading && channels.length === 0) {
    return (
      <div
        className="flex h-[60vh] items-center justify-center p-6 md:h-[calc(100vh-4rem)]"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <p
          className="text-center text-sm"
          style={{ color: "#555555" }}
        >
          No channels are set up for this club yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]"
      style={{ backgroundColor: "#0f0f0f" }}
    >
      {/* Channel list */}
      <div
        className="hidden w-48 flex-shrink-0 border-r md:block"
        style={{ backgroundColor: "#111111", borderColor: "#1e1e1e" }}
      >
        <h3
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#555555",
            padding: "12px 16px 8px" }}
        >
          Channels
        </h3>
        <div className="px-2 pb-2">
          {channels.map((ch) => {
            const isActive = activeChannelId === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannelId(ch.id)}
                className={channelItemClass(isActive)}
                style={{ }}
              >
                <span style={{ color: isActive ? "#E51937" : "#555555" }}>#</span>
                <span>{ch.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Channel header */}
        <div
          className="flex items-center gap-3"
          style={{
            backgroundColor: "#0f0f0f",
            borderBottom: "1px solid #1e1e1e",
            padding: "14px 20px" }}
        >
          <h2
            className="flex items-center gap-1"
            style={{
              fontWeight: 600,
              fontSize: "16px",
              color: "#ffffff" }}
          >
            <span style={{ color: "#E51937" }}>#</span>
            {activeChannel?.name ?? "general"}
          </h2>

          {/* Mobile channel picker */}
          <select
            className="ml-auto rounded-md border px-3 py-2 text-sm md:hidden"
            style={{
              backgroundColor: "#1a1a1a",
              borderColor: "#2a2a2a",
              color: "#ffffff" }}
            value={activeChannelId}
            onChange={(e) => setActiveChannelId(e.target.value)}
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                # {ch.name}
              </option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto" style={{ backgroundColor: "#0f0f0f" }}>
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p
                  className="text-sm font-medium"
                  style={{ color: "#ffffff" }}
                >
                  No messages yet
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "#555555" }}
                >
                  Be the first to say something in #{activeChannel?.name ?? "general"}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex gap-3 hover:bg-[#111111]"
                  style={{ padding: "10px 20px" }}
                >
                  {msg.authorAvatar ? (
                    <img
                      src={msg.authorAvatar}
                      alt=""
                      className="shrink-0 object-cover"
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        border: "1px solid #2a2a2a" }}
                    />
                  ) : (
                    <div
                      className="flex shrink-0 items-center justify-center text-sm font-bold"
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        backgroundColor: "#1f1f1f",
                        border: "1px solid #2a2a2a",
                        color: "#E51937",
                        overflow: "hidden" }}
                    >
                      {(msg.authorName || "Unknown User").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline">
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "13px",
                          color: "#ffffff" }}
                      >
                        {msg.authorName || "Unknown User"}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#555555",
                          marginLeft: "8px" }}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit" })}
                      </span>
                    </div>
                    <p
                      className="mt-0.5"
                      style={{
                        fontSize: "14px",
                        color: "#cccccc",
                        lineHeight: 1.5 }}
                    >
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div
          style={{
            backgroundColor: "#111111",
            borderTop: "1px solid #1e1e1e",
            padding: "12px 16px" }}
        >
          {sendError && (
            <p
              className="mb-2 text-xs"
              style={{ color: "#E51937" }}
            >
              Failed to send message. Please try again.
            </p>
          )}
          {canPost ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message #${activeChannel?.name ?? "general"}`}
                className="w-full flex-1 rounded-lg border px-4 py-2.5 text-sm text-white placeholder:text-[#555555] focus:border-[#E51937] focus:outline-none"
                style={{
                  backgroundColor: "#1a1a1a",
                  borderColor: "#2a2a2a",
                  fontSize: "14px",
                  padding: "10px 16px" }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="shrink-0 cursor-pointer rounded-md border-none px-[18px] py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#cc0020] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: "#E51937" }}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          ) : (
            <p
              className="text-center text-sm"
              style={{ color: "#555555" }}
            >
              Only admins and execs can post in #{activeChannel?.name ?? "general"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
