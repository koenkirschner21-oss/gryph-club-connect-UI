import { useState } from "react";
import { X } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";

const UOFG_EMAIL_PATTERN = /@uoguelph\.ca$/i;
void UOFG_EMAIL_PATTERN; // preserved for UofG email restriction restore
const UOFG_EMAIL_ERROR =
  "Please enter a valid UofG email address ending in @uoguelph.ca.";

function isValidUofGEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  // TODO: re-enable UofG email restriction before launch — disabled temporarily for multi-account testing
  return true;
  // return UOFG_EMAIL_PATTERN.test(trimmed);
}

type ClubInviteModalProps = {
  open: boolean;
  onClose: () => void;
  clubId: string;
  joinCode?: string;
};

export default function ClubInviteModal({
  open,
  onClose,
  clubId,
  joinCode,
}: ClubInviteModalProps) {
  const { user } = useAuthContext();
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [emailValidationError, setEmailValidationError] = useState<string | null>(
    null,
  );
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  if (!open) return null;

  function handleClose() {
    setInviteEmail("");
    setInviteError(null);
    setEmailValidationError(null);
    setInviteLink(null);
    setInviteLinkCopied(false);
    setInviteCopied(false);
    onClose();
  }

  function handleCopyInviteCode() {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode).then(
      () => {
        setInviteCopied(true);
        window.setTimeout(() => setInviteCopied(false), 2000);
      },
      () => {},
    );
  }

  function handleCopyInviteLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(
      () => {
        setInviteLinkCopied(true);
        window.setTimeout(() => setInviteLinkCopied(false), 2000);
      },
      () => {},
    );
  }

  function handleInviteEmailChange(value: string) {
    setInviteEmail(value);
    const trimmed = value.trim();
    if (!trimmed || isValidUofGEmail(trimmed)) {
      setEmailValidationError(null);
      return;
    }
    setEmailValidationError(UOFG_EMAIL_ERROR);
  }

  const inviteEmailValid = isValidUofGEmail(inviteEmail);

  async function handleSendInvite() {
    if (!clubId || !user?.id || !inviteEmailValid) return;
    setInviteSending(true);
    setInviteError(null);
    setInviteLink(null);

    const { data, error } = await supabase
      .from("club_invites")
      .insert({
        club_id: clubId,
        invited_email: inviteEmail.trim().toLowerCase(),
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("token")
      .single();

    setInviteSending(false);

    if (error || !data?.token) {
      setInviteError(
        error?.message ?? "Failed to create invite. Please try again.",
      );
      return;
    }

    setInviteLink(`${window.location.origin}/invite/${data.token as string}`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-club-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "16px",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          position: "relative",
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "400px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "#777777",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={18} aria-hidden />
        </button>
        <h2
          id="invite-club-title"
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 20px",
          }}
        >
          Invite to Club
        </h2>
        {joinCode ? (
          <>
            <p
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#FFC429",
                letterSpacing: "0.15em",
                textAlign: "center",
                margin: "0 0 12px",
              }}
            >
              {joinCode}
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                textAlign: "center",
                margin: "0 0 20px",
              }}
            >
              Share this code with anyone to join your club
            </p>
            <button
              type="button"
              onClick={handleCopyInviteCode}
              style={{
                width: "100%",
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "10px 24px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {inviteCopied ? "Copied!" : "Copy Code"}
            </button>
          </>
        ) : (
          <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
            No invite code is set for this club yet. Generate one in club settings.
          </p>
        )}

        <div
          style={{
            marginTop: "28px",
            paddingTop: "24px",
            borderTop: "1px solid #242424",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              margin: "0 0 12px",
            }}
          >
            Or invite by email
          </p>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => handleInviteEmailChange(e.target.value)}
            placeholder="Enter UofG email address"
            disabled={inviteSending}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              padding: "10px 14px",
              color: "#ffffff",
              fontSize: "14px",
              marginBottom: emailValidationError || inviteError ? "8px" : "12px",
            }}
          />
          {emailValidationError ? (
            <p style={{ fontSize: "12px", color: "#E51937", margin: "0 0 12px" }}>
              {emailValidationError}
            </p>
          ) : null}
          {inviteError ? (
            <p style={{ fontSize: "12px", color: "#E51937", margin: "0 0 12px" }}>
              {inviteError}
            </p>
          ) : null}
          {inviteLink ? (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "13px", color: "#888888", margin: "0 0 8px" }}>
                Invite link created! Share this link:
              </p>
              <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  style={{
                    flex: 1,
                    background: "#111111",
                    border: "1px solid #2a2a2a",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    color: "#cccccc",
                    fontSize: "12px",
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  style={{
                    background: "#1f1f1f",
                    border: "1px solid #333333",
                    color: "#ffffff",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    fontSize: "12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {inviteLinkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSendInvite()}
            disabled={inviteSending || !inviteEmailValid}
            style={{
              width: "100%",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 500,
              cursor:
                inviteSending || !inviteEmailValid ? "not-allowed" : "pointer",
              opacity: inviteSending || !inviteEmailValid ? 0.6 : 1,
            }}
          >
            {inviteSending ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
