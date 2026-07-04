import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { InboxMessage } from "../../lib/inboxUtils";
import { InboxMessageDetailView } from "./InboxMessageCard";
import PublicDetailBackButton from "../public/PublicDetailBackButton";

export default function InboxMessageDetailModal({
  message,
  clubLogoUrl,
  onMarkAsRead,
  onRefresh,
  onClose,
}: {
  message: InboxMessage;
  clubLogoUrl?: string;
  onMarkAsRead: (id: string) => Promise<void>;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const markedReadRef = useRef<string | null>(null);

  useEffect(() => {
    if (message.read || markedReadRef.current === message.id) {
      return;
    }

    markedReadRef.current = message.id;
    void onMarkAsRead(message.id);
  }, [message.id, message.read, onMarkAsRead]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={message.title}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          padding: "20px",
        }}
      >
        <PublicDetailBackButton
          label="Back to Inbox"
          onBack={onClose}
          style={{ marginBottom: "12px" }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.4,
            }}
          >
            Message Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              padding: "4px",
              flexShrink: 0,
            }}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <InboxMessageDetailView
          message={message}
          onMarkAsRead={onMarkAsRead}
          onRefresh={onRefresh}
          clubLogoUrl={clubLogoUrl}
        />
      </div>
    </div>
  );
}
