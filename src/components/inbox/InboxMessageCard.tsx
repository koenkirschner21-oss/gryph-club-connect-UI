import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  acceptOwnershipTransfer,
  applyFormerOwnerChoice,
  declineOwnershipTransfer,
  FORMER_OWNER_CHOICE_OPTIONS,
  type FormerOwnerChoice,
} from "../../lib/ownershipTransferUtils";
import type { InboxMessage } from "../../lib/inboxUtils";
import { resolveInboxLink } from "../../lib/inboxUtils";

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

const actionButtonStyle = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  color: "#cccccc",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  padding: "8px 10px",
} as const;

const primaryActionStyle = {
  ...actionButtonStyle,
  background: "#E51937",
  border: "1px solid #E51937",
  color: "#ffffff",
} as const;

interface InboxMessageCardProps {
  message: InboxMessage;
  onMarkAsRead: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export default function InboxMessageCard({
  message,
  onMarkAsRead,
  onRefresh,
}: InboxMessageCardProps) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasPendingActions =
    message.actionRequired &&
    !message.actionCompleted &&
    (message.actionType === "ownership_transfer_response" ||
      message.actionType === "former_owner_role_choice");

  const transferId =
    typeof message.actionData.transferId === "string"
      ? message.actionData.transferId
      : message.referenceId;

  async function handleNavigate() {
    if (!message.read) {
      await onMarkAsRead(message.id);
    }
    navigate(resolveInboxLink(message));
  }

  async function handleAcceptOwnership() {
    if (!user?.id || !transferId) return;
    setActing(true);
    setActionError(null);

    const result = await acceptOwnershipTransfer(supabase, {
      transferId,
      recipientUserId: user.id,
      inboxMessageId: message.id,
      clubName: message.clubName ?? "the club",
    });

    setActing(false);
    if (!result.ok) {
      setActionError(result.error ?? "Failed to accept ownership.");
      return;
    }

    onRefresh();
  }

  async function handleDeclineOwnership() {
    if (!user?.id || !transferId) return;
    setActing(true);
    setActionError(null);

    const result = await declineOwnershipTransfer(supabase, {
      transferId,
      recipientUserId: user.id,
      inboxMessageId: message.id,
      clubName: message.clubName ?? "the club",
    });

    setActing(false);
    if (!result.ok) {
      setActionError(result.error ?? "Failed to decline ownership.");
      return;
    }

    onRefresh();
  }

  async function handleFormerOwnerChoice(choice: FormerOwnerChoice) {
    if (!user?.id || !transferId) return;
    setActing(true);
    setActionError(null);

    const result = await applyFormerOwnerChoice(supabase, {
      transferId,
      userId: user.id,
      choice,
      inboxMessageId: message.id,
      clubName: message.clubName ?? "the club",
    });

    setActing(false);
    if (!result.ok) {
      setActionError(result.error ?? "Failed to update your role.");
      return;
    }

    if (choice === "leave") {
      navigate("/app");
      return;
    }

    onRefresh();
  }

  return (
    <div
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: "8px",
        padding: "14px 16px",
        background: message.read ? "#111111" : "#161616",
        border: "1px solid #2a2a2a",
        borderLeft: message.read ? "3px solid #2a2a2a" : "3px solid #E51937",
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
          whiteSpace: "pre-wrap",
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
          <span style={{ fontSize: "11px", color: "#E51937" }}>{message.clubName}</span>
        ) : (
          <span />
        )}
        <span style={{ fontSize: "11px", color: "#555555" }}>
          {formatInboxTimestamp(message.createdAt)}
        </span>
      </div>

      {actionError ? (
        <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#E51937" }}>{actionError}</p>
      ) : null}

      {hasPendingActions && message.actionType === "ownership_transfer_response" ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #2a2a2a",
          }}
        >
          <button
            type="button"
            disabled={acting}
            style={primaryActionStyle}
            onClick={() => void handleAcceptOwnership()}
          >
            {acting ? "Working…" : "Accept Ownership"}
          </button>
          <button
            type="button"
            disabled={acting}
            style={actionButtonStyle}
            onClick={() => void handleDeclineOwnership()}
          >
            Decline
          </button>
        </div>
      ) : null}

      {hasPendingActions && message.actionType === "former_owner_role_choice" ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #2a2a2a",
          }}
        >
          {FORMER_OWNER_CHOICE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={acting}
              style={{
                ...actionButtonStyle,
                width: "100%",
                textAlign: "left",
              }}
              onClick={() => void handleFormerOwnerChoice(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {!hasPendingActions ? (
        <button
          type="button"
          onClick={() => void handleNavigate()}
          style={{
            marginTop: "10px",
            background: "transparent",
            border: "none",
            color: "#777777",
            fontSize: "12px",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Open →
        </button>
      ) : null}
    </div>
  );
}
