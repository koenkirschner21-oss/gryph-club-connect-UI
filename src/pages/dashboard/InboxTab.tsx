import { useEffect, useMemo, useState } from "react";
import Spinner from "../../components/ui/Spinner";
import {
  filterInboxMessages,
  inboxEmptyMessage,
  type InboxFilter,
  type InboxMessage,
} from "../../lib/inboxUtils";
import type { UseInboxReturn } from "../../hooks/useInbox";
import { useIsMobile } from "../../hooks/useWindowWidth";
import InboxMessageCard from "../../components/inbox/InboxMessageCard";
import InboxMessageDetailModal from "../../components/inbox/InboxMessageDetailModal";
import { normalizeInboxUiType } from "../../components/inbox/inboxMessageUi";
import {
  InboxOverviewCard,
  InboxQuickActionsCard,
  InboxTipsCard,
  type InboxOverviewFilterTarget,
  type InboxOverviewStats,
} from "./InboxTabUI";

const STATUS_FILTERS: { id: "all" | "unread" | "action_required"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "action_required", label: "Action Required" },
];

export type InboxCategoryFilter =
  | "all"
  | "applications"
  | "invites"
  | "club_updates"
  | "admin"
  | "club_claims"
  | "tasks"
  | "events";

const CATEGORY_OPTIONS: { id: InboxCategoryFilter; label: string }[] = [
  { id: "all", label: "All Categories" },
  { id: "applications", label: "Applications" },
  { id: "invites", label: "Invites" },
  { id: "club_updates", label: "Club Updates" },
  { id: "admin", label: "Admin / Support" },
  { id: "club_claims", label: "Club Claims" },
  { id: "tasks", label: "Tasks" },
  { id: "events", label: "Events" },
];

const CLAIM_UI_TYPES = new Set([
  "claim_approved",
  "claim_rejected",
  "claim_submitted",
  "claim_more_info",
  "new_claim_request",
  "club_request_approved",
  "club_request_rejected",
  "club_request_submitted",
  "club_request_more_info",
  "new_club_request",
]);

function filterByCategory(
  messages: InboxMessage[],
  category: InboxCategoryFilter,
): InboxMessage[] {
  if (category === "all") return messages;

  if (category === "club_claims") {
    return messages.filter((message) => CLAIM_UI_TYPES.has(normalizeInboxUiType(message)));
  }

  if (category === "tasks") {
    return messages.filter((message) => message.referenceType === "task");
  }

  if (category === "events") {
    return messages.filter((message) => message.referenceType === "event");
  }

  return filterInboxMessages(messages, category as InboxFilter);
}

type ClubOption = { id: string; name: string };

type InboxTabProps = UseInboxReturn & {
  clubLogos?: Record<string, string>;
  joinedClubs?: ClubOption[];
  onViewMyClubs?: () => void;
  initialMessageId?: string | null;
  onInitialMessageConsumed?: () => void;
};

export default function InboxTab({
  loading,
  messages,
  markAsRead,
  markAllAsRead,
  filterMessages,
  unreadCount,
  actionRequiredMessages,
  refresh,
  clubLogos = {},
  joinedClubs = [],
  onViewMyClubs,
  initialMessageId = null,
  onInitialMessageConsumed,
}: InboxTabProps) {
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "action_required">("all");
  const [categoryFilter, setCategoryFilter] = useState<InboxCategoryFilter>("all");
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [missingMessageId, setMissingMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialMessageId || loading) return;

    const match = messages.find((message) => message.id === initialMessageId);
    if (match) {
      setSelectedMessage(match);
      setMissingMessageId(null);
      if (!match.read) {
        void markAsRead(match.id);
      }
    } else {
      setMissingMessageId(initialMessageId);
    }
    onInitialMessageConsumed?.();
  }, [
    initialMessageId,
    loading,
    messages,
    markAsRead,
    onInitialMessageConsumed,
  ]);

  const visibleMessages = useMemo(() => {
    const statusFiltered =
      statusFilter === "all" ? messages : filterMessages(statusFilter as InboxFilter);
    return filterByCategory(statusFiltered, categoryFilter);
  }, [categoryFilter, filterMessages, messages, statusFilter]);

  const overviewStats = useMemo<InboxOverviewStats>(
    () => ({
      total: messages.length,
      unread: unreadCount,
      actionRequired: actionRequiredMessages.length,
      applications: filterMessages("applications").length,
      invites: filterMessages("invites").length,
      clubUpdates: filterMessages("club_updates").length,
      admin: filterMessages("admin").length,
    }),
    [actionRequiredMessages.length, filterMessages, messages.length, unreadCount],
  );

  function handleOverviewFilterSelect(target: InboxOverviewFilterTarget) {
    if (target === "all") {
      setStatusFilter("all");
      setCategoryFilter("all");
      return;
    }

    if (target === "unread" || target === "action_required") {
      setStatusFilter(target);
      setCategoryFilter("all");
      return;
    }

    setStatusFilter("all");
    setCategoryFilter(target);
  }

  const detailMessage = useMemo(() => {
    if (!selectedMessage) return null;
    return messages.find((message) => message.id === selectedMessage.id) ?? selectedMessage;
  }, [messages, selectedMessage]);

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
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: isMobile ? "flex-start" : "space-between",
          gap: isMobile ? "12px" : "24px",
          marginBottom: "20px",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#555555",
            }}
          >
            Category
          </span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as InboxCategoryFilter)}
            aria-label="Filter by category"
            style={{
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              color: "#999999",
              cursor: "pointer",
              fontSize: "12px",
              padding: "6px 10px",
            }}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            width: isMobile ? "100%" : undefined,
          }}
        >
          {STATUS_FILTERS.map((chip) => {
            const selected = statusFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                style={{
                  background: selected ? "#E51937" : "#1a1a1a",
                  border: `1px solid ${selected ? "#E51937" : "#333333"}`,
                  borderRadius: "999px",
                  color: selected ? "#ffffff" : "#cccccc",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: selected ? 600 : 500,
                  padding: "7px 14px",
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {missingMessageId ? (
            <p
              style={{
                color: "#FFC429",
                fontSize: "13px",
                margin: "0 0 14px",
                padding: "12px 14px",
                border: "1px solid #3a2f00",
                borderRadius: "8px",
                background: "#1a1500",
              }}
            >
              That message is no longer available. It may have been removed or you may not have access.
              <button
                type="button"
                onClick={() => setMissingMessageId(null)}
                style={{
                  marginLeft: "10px",
                  background: "transparent",
                  border: "none",
                  color: "#cccccc",
                  cursor: "pointer",
                  fontSize: "12px",
                  textDecoration: "underline",
                }}
              >
                Dismiss
              </button>
            </p>
          ) : null}
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
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {visibleMessages.map((message) => (
                <InboxMessageCard
                  key={message.id}
                  message={message}
                  onMarkAsRead={markAsRead}
                  onRefresh={refresh}
                  clubLogoUrl={message.clubId ? clubLogos[message.clubId] : undefined}
                  onOpenDetail={setSelectedMessage}
                />
              ))}
            </div>
          )}
        </div>

        {!isMobile ? (
          <aside style={{ width: "260px", flexShrink: 0 }}>
            <InboxOverviewCard stats={overviewStats} onFilterSelect={handleOverviewFilterSelect} />
            <InboxQuickActionsCard
              clubs={joinedClubs}
              onViewMyClubs={() => onViewMyClubs?.()}
            />
            <InboxTipsCard />
          </aside>
        ) : null}
      </div>

      {detailMessage ? (
        <InboxMessageDetailModal
          message={detailMessage}
          clubLogoUrl={
            detailMessage.clubId ? clubLogos[detailMessage.clubId] : undefined
          }
          onMarkAsRead={markAsRead}
          onRefresh={refresh}
          onClose={() => setSelectedMessage(null)}
        />
      ) : null}
    </div>
  );
}
