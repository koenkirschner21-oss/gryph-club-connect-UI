import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMessages } from "../../hooks/useClubMessages";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

const CHANNELS = ["general", "announcements"] as const;
type ChannelName = (typeof CHANNELS)[number];

export default function ClubChatPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getUserRole } = useClubContext();
  const { messages, loading, sendMessage } = useClubMessages(clubId);

  const role = getUserRole(clubId ?? "");
  const isAdminOrExec = role === "admin" || role === "exec";

  const [activeChannel, setActiveChannel] = useState<ChannelName>("general");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channelMessages = messages.filter(
    (m) => m.channel === activeChannel,
  );

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length]);

  // Announcements channel is read-only for regular members
  const canPost =
    activeChannel === "general" || isAdminOrExec;

  async function handleSend() {
    if (!draft.trim() || !user || sending) return;
    setSending(true);
    setSendError(false);
    const ok = await sendMessage(activeChannel, draft.trim());
    if (ok) {
      setDraft("");
    } else {
      setSendError(true);
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Spinner label="Loading messages…" />
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
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setActiveChannel(ch)}
                className={`w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  activeChannel === ch
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted hover:bg-surface hover:text-white"
                }`}
              >
                # {ch}
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
            # {activeChannel}
          </h2>

          {/* Mobile channel picker */}
          <select
            className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-xs text-white md:hidden"
            value={activeChannel}
            onChange={(e) => setActiveChannel(e.target.value as ChannelName)}
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                # {ch}
              </option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4">
          {channelMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  No messages yet
                </p>
                <p className="mt-1 text-xs text-muted">
                  Be the first to say something in #{activeChannel}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {channelMessages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  {msg.authorAvatar ? (
                    <img
                      src={msg.authorAvatar}
                      alt=""
                      className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(msg.authorName ?? "U")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-white">
                        {msg.authorName ?? "Unknown"}
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
                placeholder={`Message #${activeChannel}`}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button type="submit" disabled={!draft.trim() || sending}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </form>
          ) : (
            <p className="text-center text-sm text-muted">
              Only admins and execs can post in #{activeChannel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

