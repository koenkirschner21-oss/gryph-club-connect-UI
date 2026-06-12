import { useMemo, useState } from "react";
import Spinner from "../../components/ui/Spinner";
import { inboxEmptyMessage, type InboxFilter } from "../../lib/inboxUtils";
import type { UseInboxReturn } from "../../hooks/useInbox";
import InboxMessageCard from "../../components/inbox/InboxMessageCard";

const FILTER_CHIPS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "action_required", label: "Action Required" },
  { id: "applications", label: "Applications" },
  { id: "invites", label: "Invites" },
  { id: "club_updates", label: "Club Updates" },
  { id: "admin", label: "Admin/Support" },
];

type InboxTabProps = UseInboxReturn;

export default function InboxTab({
  loading,
  markAsRead,
  markAllAsRead,
  filterMessages,
  unreadCount,
  refresh,
}: InboxTabProps) {
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");

  const visibleMessages = useMemo(
    () => filterMessages(activeFilter),
    [activeFilter, filterMessages],
  );

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
          {inboxEmptyMessage()}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {visibleMessages.map((message) => (
            <InboxMessageCard
              key={message.id}
              message={message}
              onMarkAsRead={markAsRead}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
