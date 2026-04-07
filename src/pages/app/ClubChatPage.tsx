import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import type { Channel, Message } from "../../types";
import Button from "../../components/ui/Button";

// Default channels for demo / initial workspace
const defaultChannels: Channel[] = [
  {
    id: "ch-general",
    clubId: "",
    name: "general",
    type: "general",
    createdAt: new Date().toISOString(),
  },
  {
    id: "ch-announcements",
    clubId: "",
    name: "announcements",
    type: "announcements",
    createdAt: new Date().toISOString(),
  },
];

export default function ClubChatPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();

  const [channels] = useState<Channel[]>(
    defaultChannels.map((ch) => ({ ...ch, clubId: clubId ?? "" })),
  );
  const [activeChannel, setActiveChannel] = useState(channels[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!draft.trim() || !user) return;

    const msg: Message = {
      id: `msg-${Date.now()}`,
      channelId: activeChannel,
      userId: user.id,
      content: draft.trim(),
      createdAt: new Date().toISOString(),
      authorName: user.email?.split("@")[0] ?? "You",
    };

    setMessages((prev) => [...prev, msg]);
    setDraft("");
  }

  const channelMessages = messages.filter(
    (m) => m.channelId === activeChannel,
  );

  const activeChannelName =
    channels.find((c) => c.id === activeChannel)?.name ?? "general";

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
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  activeChannel === ch.id
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
            # {activeChannelName}
          </h2>

          {/* Mobile channel picker */}
          <select
            className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-xs text-white md:hidden"
            value={activeChannel}
            onChange={(e) => setActiveChannel(e.target.value)}
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
          {channelMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  No messages yet
                </p>
                <p className="mt-1 text-xs text-muted">
                  Be the first to say something in #{activeChannelName}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {channelMessages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(msg.authorName ?? "U")[0].toUpperCase()}
                  </div>
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
              placeholder={`Message #${activeChannelName}`}
              className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button type="submit" disabled={!draft.trim()}>
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
