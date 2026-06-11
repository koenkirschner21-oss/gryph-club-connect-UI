import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/ui/Spinner";
import {
  inboxEmptyMessage,
  resolveInboxLink,
  type InboxFilter,
  type InboxMessage,
} from "../../lib/inboxUtils";
import type { UseInboxReturn } from "../../hooks/useInbox";

const FILTER_CHIPS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "action_required", label: "Action Required" },
  { id: "applications", label: "Applications" },
  { id: "invites", label: "Invites" },
  { id: "club_updates", label: "Club Updates" },
  { id: "admin", label: "Admin/Support" },
];

function formatInboxTimestamp(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface InboxTabProps extends UseInboxReturn {}

export default function InboxTab({
  loading,
  markAsRead,
  markAllAsRead,
  filterMessages,
  unreadCount,
}: InboxTabProps) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");

  const visibleMessages = useMemo(
    () => filterMessages(activeFilter),
    [activeFilter, filterMessages],
  );

  const handleMessageClick = async (message: InboxMessage) => {
    if (!message.read) {
      await markAsRead(message.id);
    }
    navigate(resolveInboxLink(message));
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "#ffffff",
          }}
        >
          Inbox
        </h2>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            style={{
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              color: "#999999",
              cursor: "pointer",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            Mark all as read
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        {FILTER_CHIPS.map((chip) => {
          const selected = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              style={{
                background: selected ? "#E51937" : "#111111",
                border: `1px solid ${selected ? "#E51937" : "#2a2a2a"}`,
                borderRadius: "999px",
                color: selected ? "#ffffff" : "#999999",
                cursor: "pointer",
                fontSize: "12px",
                padding: "6px 12px",
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <Spinner />
        </div>
      ) : visibleMessages.length === 0 ? (
        <p
          style={{
            color: "#555555",
            fontSize: "13px",
            margin: 0,
            textAlign: "center",
            padding: "48px 16px",
          }}
        >
          {inboxEmptyMessage(activeFilter)}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {visibleMessages.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => void handleMessageClick(message)}
              style={{
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: "8px",
                padding: "14px 16px",
                background: message.read ? "#111111" : "#161616",
                border: "1px solid #2a2a2a",
                borderLeft: message.read
                  ? "3px solid #2a2a2a"
                  : "3px solid #E51937",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.4,
                    flex: 1,
                  }}
                >
                  {message.title}
                </p>
                {message.actionRequired && !message.actionCompleted ? (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "#FFC429",
                      border: "1px solid #3a2f00",
                      background: "#1a1500",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Action Required
                  </span>
                ) : null}
              </div>

              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "13px",
                  color: "#999999",
                  lineHeight: 1.5,
                }}
              >
                {message.message}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginTop: "8px",
                }}
              >
                {message.clubName ? (
                  <span style={{ fontSize: "11px", color: "#E51937" }}>
                    {message.clubName}
                  </span>
                ) : (
                  <span />
                )}
                <span style={{ fontSize: "11px", color: "#555555" }}>
                  {formatInboxTimestamp(message.createdAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
