import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  acceptOwnershipTransfer,
  applyFormerOwnerChoice,
  declineOwnershipTransfer,
  FORMER_OWNER_CHOICE_OPTIONS,
  syncFormerOwnerChoiceInboxIfCompleted,
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
  INBOX_ACTION_REQUIRED_BADGE_STYLE,
  InboxStatusBadgePill,
  OUTLINED_BUTTON_STYLE,
  SOLID_RED_BUTTON_STYLE,
  inboxCategoryLabel,
  inboxStatusBadge,
  resolveActionButtons,
  resolveInboxRowActionLabel,
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

function formatInboxFullTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface InboxMessageCardProps {
  message: InboxMessage;
  onMarkAsRead: (id: string) => Promise<void>;
  onRefresh: () => void;
  clubLogoUrl?: string;
  onOpenDetail: (message: InboxMessage) => void;
}

function useInboxMessageActions(
  message: InboxMessage,
  onMarkAsRead: (id: string) => Promise<void>,
  onRefresh: () => void,
) {
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

  useEffect(() => {
    if (
      message.actionType !== "former_owner_role_choice" ||
      message.actionCompleted ||
      !transferId ||
      !user?.id
    ) {
      return;
    }

    let cancelled = false;

    void syncFormerOwnerChoiceInboxIfCompleted(supabase, {
      transferId,
      inboxMessageId: message.id,
      userId: user.id,
    }).then((completed) => {
      if (!cancelled && completed) {
        onRefresh();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    message.actionCompleted,
    message.actionType,
    message.id,
    onRefresh,
    transferId,
    user?.id,
  ]);

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
          marginTop: "14px",
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

  function renderPendingActions() {
    if (!hasPendingActions) return null;

    if (message.actionType === "executive_invite_response") {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "14px",
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
      );
    }

    if (message.actionType === "ownership_transfer_response") {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "14px",
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
      );
    }

    if (message.actionType === "former_owner_role_choice") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "8px",
            marginTop: "14px",
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
      );
    }

    return null;
  }

  return {
    actionError,
    hasPendingActions,
    renderDefaultActions,
    renderPendingActions,
  };
}

export function InboxMessageDetailView({
  message,
  onMarkAsRead,
  onRefresh,
  clubLogoUrl,
}: {
  message: InboxMessage;
  onMarkAsRead: (id: string) => Promise<void>;
  onRefresh: () => void;
  clubLogoUrl?: string;
}) {
  const statusBadge = inboxStatusBadge(message);
  const categoryLabel = inboxCategoryLabel(message);
  const clubLabel = message.clubName?.trim() || "Gryph Club Connect";
  const { actionError, hasPendingActions, renderDefaultActions, renderPendingActions } =
    useInboxMessageActions(message, onMarkAsRead, onRefresh);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
      <InboxMessageAvatar message={message} logoUrl={clubLogoUrl} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.4,
              flex: "1 1 100%",
            }}
          >
            {message.title}
          </p>
          {statusBadge ? <InboxStatusBadgePill badge={statusBadge} /> : null}
          {message.actionRequired && !message.actionCompleted ? (
            <span style={INBOX_ACTION_REQUIRED_BADGE_STYLE}>Action Required</span>
          ) : null}
        </div>

        <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#555555" }}>
          {formatInboxFullTimestamp(message.createdAt)}
        </p>

        <p style={{ margin: "0 0 12px", fontSize: "12px", lineHeight: 1.4 }}>
          <span style={{ color: "#E51937" }}>{clubLabel}</span>
          <span style={{ color: "#555555" }}> · {categoryLabel}</span>
        </p>

        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: "#cccccc",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.message}
        </p>

        {actionError ? (
          <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#E51937" }}>{actionError}</p>
        ) : null}

        {hasPendingActions ? renderPendingActions() : renderDefaultActions()}
      </div>
    </div>
  );
}

export default function InboxMessageCard({
  message,
  onMarkAsRead,
  clubLogoUrl,
  onOpenDetail,
}: InboxMessageCardProps) {
  const [hovered, setHovered] = useState(false);

  const statusBadge = inboxStatusBadge(message);
  const categoryLabel = inboxCategoryLabel(message);
  const clubLabel = message.clubName?.trim() || "Gryph Club Connect";
  const actionLabel = resolveInboxRowActionLabel(message);

  async function handleOpen() {
    if (!message.read) {
      await onMarkAsRead(message.id);
    }
    onOpenDetail(message);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void handleOpen()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void handleOpen();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        padding: "18px",
        border: `1px solid ${hovered ? "#383838" : "#2e2e2e"}`,
        borderRadius: "10px",
        background: hovered
          ? message.read
            ? "#1a1a1a"
            : "#1c1c1c"
          : message.read
            ? "#161616"
            : "#181818",
        cursor: "pointer",
        transition: "border-color 0.15s ease, background 0.15s ease",
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
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
            marginBottom: "8px",
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
                lineHeight: 1.35,
              }}
            >
              {message.title}
            </p>
            {statusBadge ? <InboxStatusBadgePill badge={statusBadge} /> : null}
            {message.actionRequired && !message.actionCompleted ? (
              <span style={INBOX_ACTION_REQUIRED_BADGE_STYLE}>Action Required</span>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "#666666",
                whiteSpace: "nowrap",
              }}
            >
              {formatInboxTimestamp(message.createdAt)}
            </span>
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

        <p
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            color: "#888888",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {message.message}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <p style={{ margin: 0, fontSize: "11px", lineHeight: 1.4, minWidth: 0 }}>
            <span style={{ color: "#E51937" }}>{clubLabel}</span>
            <span style={{ color: "#555555" }}> · {categoryLabel}</span>
          </p>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: hovered ? "#ff4d66" : "#E51937",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {actionLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
