import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMessages } from "../../hooks/useClubMessages";
import { useClubChannels } from "../../hooks/useClubChannels";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

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
  const isAdminOrExec = role === "admin" || role === "exec";

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
  const canPost = activeChannel?.isAnnouncementOnly ? isAdminOrExec : true;

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
      <div className="flex h-[60vh] items-center justify-center p-6 md:h-[calc(100vh-4rem)]">
        <p className="text-center text-sm text-muted">No channels are set up for this club yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      {/* Channel list */}
      <div className="hidden w-48 flex-shrink-0 border-r border-border bg-surface-alt md:block">
        <div className="p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Channels
          </h3>
          <div className="space-y-0.5">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannelId(ch.id)}
                className={`w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted hover:bg-surface hover:text-white"
                }`}
              >
                # {ch.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Channel header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-white">
            # {activeChannel?.name ?? "general"}
          </h2>

          {/* Mobile channel picker */}
          <select
            className="ml-auto rounded-md border border-border bg-surface px-3 py-2 text-sm text-white md:hidden"
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
        <div className="flex-1 overflow-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  No messages yet
                </p>
                <p className="mt-1 text-xs text-muted">
                  Be the first to say something in #{activeChannel?.name ?? "general"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  {msg.authorAvatar ? (
                    <img
                      src={msg.authorAvatar}
                      alt=""
                      className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(msg.authorName || "Unknown User").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-white">
                        {msg.authorName || "Unknown User"}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-white">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="border-t border-border p-4">
          {sendError && (
            <p className="mb-2 text-xs text-primary">
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
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button type="submit" disabled={!draft.trim() || sending}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </form>
          ) : (
            <p className="text-center text-sm text-muted">
              Only admins and execs can post in #{activeChannel?.name ?? "general"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

