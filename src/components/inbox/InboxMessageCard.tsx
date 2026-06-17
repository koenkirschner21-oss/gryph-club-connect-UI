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
import {
  acceptExecutiveInvite,
  declineExecutiveInvite,
} from "../../lib/executiveInviteUtils";
import type { InboxMessage } from "../../lib/inboxUtils";
import { resolveInboxLink } from "../../lib/inboxUtils";
import {
  InboxMessageAvatar,
  InboxStatusBadgePill,
  OUTLINED_BUTTON_STYLE,
  SOLID_RED_BUTTON_STYLE,
  inboxCategoryLabel,
  inboxStatusBadge,
  normalizeInboxUiType,
} from "./inboxMessageUi";

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

type ActionButtonConfig = {
  label: string;
  variant: "solid" | "outlined" | "link";
};

function resolveActionButtons(message: InboxMessage): ActionButtonConfig[] {
  const uiType = normalizeInboxUiType(message);

  switch (uiType) {
    case "claim_approved":
    case "join_approved":
      return [{ label: "Open Club Dashboard", variant: "solid" }];
    case "claim_rejected":
      return [{ label: "View Club Profile", variant: "outlined" }];
    case "claim_submitted":
      return [{ label: "View Status", variant: "outlined" }];
    case "join_rejected":
      return [{ label: "View Club", variant: "outlined" }];
    case "new_join_request":
      return [{ label: "Review Request", variant: "outlined" }];
    case "application_update":
      return [{ label: "View Application", variant: "outlined" }];
    case "new_claim_request":
      return [{ label: "Review in Admin", variant: "outlined" }];
    default:
      return [{ label: "Open →", variant: "link" }];
  }
}

interface InboxMessageCardProps {
  message: InboxMessage;
  onMarkAsRead: (id: string) => Promise<void>;
  onRefresh: () => void;
  clubLogoUrl?: string;
}

export default function InboxMessageCard({
  message,
  onMarkAsRead,
  onRefresh,
  clubLogoUrl,
}: InboxMessageCardProps) {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasPendingActions =
    message.actionRequired &&
    !message.actionCompleted &&
    (message.actionType === "ownership_transfer_response" ||
      message.actionType === "former_owner_role_choice" ||
      message.actionType === "executive_invite_response");

  const transferId =
    typeof message.actionData.transferId === "string"
      ? message.actionData.transferId
      : message.referenceId;

  const inviteId =
    typeof message.actionData.inviteId === "string"
      ? message.actionData.inviteId
      : message.referenceId;

  const inviteToken =
    typeof message.actionData.token === "string" ? message.actionData.token : "";

  const inviterUserId =
    typeof message.actionData.invitedBy === "string"
      ? message.actionData.invitedBy
      : message.senderId;

  const statusBadge = inboxStatusBadge(message);
  const categoryLabel = inboxCategoryLabel(message);
  const clubLabel = message.clubName?.trim() || "Gryph Club Connect";

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

  async function handleAcceptExecutiveInvite() {
    if (!user?.id || !inviteToken || !user.email) return;
    setActing(true);
    setActionError(null);

    const result = await acceptExecutiveInvite(supabase, {
      token: inviteToken,
      recipientUserId: user.id,
      recipientEmail: user.email,
      inboxMessageId: message.id,
      clubName: message.clubName ?? "the club",
      inviterUserId,
    });

    setActing(false);
    if (!result.ok) {
      setActionError(result.error ?? "Failed to accept invite.");
      return;
    }

    if (result.clubId) {
      window.location.assign(`/app/clubs/${result.clubId}`);
      return;
    }

    onRefresh();
  }

  async function handleDeclineExecutiveInvite() {
    if (!user?.id || !inviteId || !user.email) return;
    setActing(true);
    setActionError(null);

    const result = await declineExecutiveInvite(supabase, {
      inviteId,
      recipientUserId: user.id,
      recipientEmail: user.email,
      inboxMessageId: message.id,
      clubName: message.clubName ?? "the club",
      inviterUserId,
      clubId: message.clubId,
    });

    setActing(false);
    if (!result.ok) {
      setActionError(result.error ?? "Failed to decline invite.");
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

  function renderDefaultActions() {
    const buttons = resolveActionButtons(message);

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "10px",
        }}
      >
        {buttons.map((button) => {
          if (button.variant === "solid") {
            return (
              <button
                key={button.label}
                type="button"
                onClick={() => void handleNavigate()}
                style={SOLID_RED_BUTTON_STYLE}
              >
                {button.label}
              </button>
            );
          }

          if (button.variant === "outlined") {
            return (
              <button
                key={button.label}
                type="button"
                onClick={() => void handleNavigate()}
                style={OUTLINED_BUTTON_STYLE}
              >
                {button.label}
              </button>
            );
          }

          return (
            <button
              key={button.label}
              type="button"
              onClick={() => void handleNavigate()}
              style={{
                background: "transparent",
                border: "none",
                color: "#E51937",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "8px 0",
              }}
            >
              {button.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "16px",
        borderBottom: "1px solid #1a1a1a",
        background: message.read ? "#141414" : "#161616",
      }}
    >
      <InboxMessageAvatar message={message} logoUrl={clubLogoUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              flex: 1,
              minWidth: 0,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.4,
              }}
            >
              {message.title}
            </p>
            {statusBadge ? <InboxStatusBadgePill badge={statusBadge} /> : null}
            {message.actionRequired && !message.actionCompleted ? (
              <span
                style={{
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
          <span
            style={{
              fontSize: "11px",
              color: "#555555",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {formatInboxTimestamp(message.createdAt)}
          </span>
        </div>

        <p
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            color: "#777777",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.message}
        </p>

        <p style={{ margin: "8px 0 0", fontSize: "11px", lineHeight: 1.4 }}>
          <span style={{ color: "#E51937" }}>{clubLabel}</span>
          <span style={{ color: "#555555" }}> · {categoryLabel}</span>
        </p>

        {actionError ? (
          <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#E51937" }}>{actionError}</p>
        ) : null}

        {hasPendingActions && message.actionType === "executive_invite_response" ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              disabled={acting}
              style={SOLID_RED_BUTTON_STYLE}
              onClick={() => void handleAcceptExecutiveInvite()}
            >
              {acting ? "Working…" : "Accept"}
            </button>
            <button
              type="button"
              disabled={acting}
              style={OUTLINED_BUTTON_STYLE}
              onClick={() => void handleDeclineExecutiveInvite()}
            >
              Decline
            </button>
          </div>
        ) : null}

        {hasPendingActions && message.actionType === "ownership_transfer_response" ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              disabled={acting}
              style={SOLID_RED_BUTTON_STYLE}
              onClick={() => void handleAcceptOwnership()}
            >
              {acting ? "Working…" : "Accept Ownership"}
            </button>
            <button
              type="button"
              disabled={acting}
              style={OUTLINED_BUTTON_STYLE}
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
              alignItems: "flex-end",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            {FORMER_OWNER_CHOICE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={acting}
                style={{
                  ...OUTLINED_BUTTON_STYLE,
                  minWidth: "220px",
                  textAlign: "left",
                }}
                onClick={() => void handleFormerOwnerChoice(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {!hasPendingActions ? renderDefaultActions() : null}
      </div>

      <div
        style={{
          width: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "center",
          flexShrink: 0,
        }}
      >
        {!message.read ? (
          <span
            aria-hidden
            style={{
              width: "8px",
              height: "8px",
              background: "#E51937",
              borderRadius: "50%",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
