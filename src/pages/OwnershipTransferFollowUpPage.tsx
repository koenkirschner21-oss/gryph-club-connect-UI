import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import {
  acceptOwnershipTransfer,
  applyFormerOwnerChoice,
  declineOwnershipTransfer,
  FORMER_OWNER_CHOICE_OPTIONS,
  mapOwnershipTransferRow,
  ownershipRoleLabel,
  type FormerOwnerChoice,
  type OwnershipTransferRow,
} from "../lib/ownershipTransferUtils";
import Spinner from "../components/ui/Spinner";

const PAGE_BG = "#0f0f0f";
const ACCENT_RED = "#E51937";

const cardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  padding: "28px 24px",
  maxWidth: "560px",
  width: "100%",
};

const primaryButtonStyle: CSSProperties = {
  background: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "transparent",
  color: "#cccccc",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
};

export default function OwnershipTransferFollowUpPage() {
  const { transferId } = useParams<{ transferId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();

  const [transfer, setTransfer] = useState<OwnershipTransferRow | null>(null);
  const [clubName, setClubName] = useState("Club");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inboxMessageId, setInboxMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !transferId) return;
    if (!user) {
      navigate(
        `/login?redirect=${encodeURIComponent(`/ownership-transfer/${transferId}`)}`,
        { replace: true },
      );
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      const { data, error: loadError } = await supabase
        .from("ownership_transfers")
        .select("*")
        .eq("id", transferId)
        .maybeSingle();

      if (cancelled) return;

      if (loadError || !data) {
        setNotFound(true);
        setTransfer(null);
        setLoading(false);
        return;
      }

      const mapped = mapOwnershipTransferRow(data as Record<string, unknown>);
      if (mapped.fromUserId !== user!.id && mapped.toUserId !== user!.id) {
        setNotFound(true);
        setTransfer(null);
        setLoading(false);
        return;
      }

      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", mapped.clubId)
        .maybeSingle();

      const { data: inboxRow } = await supabase
        .from("inbox_messages")
        .select("id")
        .eq("recipient_id", user!.id)
        .eq("reference_id", mapped.id)
        .eq("action_completed", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      setClubName((club?.name as string | undefined) ?? "Club");
      setInboxMessageId((inboxRow?.id as string | undefined) ?? null);
      setTransfer(mapped);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, navigate, transferId, user]);

  const isRecipient = Boolean(user && transfer && transfer.toUserId === user.id);
  const isFormerOwner = Boolean(user && transfer && transfer.fromUserId === user.id);
  const needsAcceptDecline = Boolean(
    transfer && isRecipient && transfer.status === "pending",
  );
  const needsRoleChoice = Boolean(
    transfer &&
      isFormerOwner &&
      transfer.status === "accepted" &&
      !transfer.formerOwnerChoiceAt,
  );

  async function handleAccept() {
    if (!user?.id || !transfer) return;
    setActing(true);
    setError(null);
    const result = await acceptOwnershipTransfer(supabase, {
      transferId: transfer.id,
      recipientUserId: user.id,
      inboxMessageId: inboxMessageId ?? undefined,
      clubName,
    });
    setActing(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to accept ownership transfer.");
      return;
    }
    setSuccess(`You are now ${ownershipRoleLabel(transfer.newRole)} of ${clubName}.`);
    setTransfer((prev) => (prev ? { ...prev, status: "accepted" } : prev));
  }

  async function handleDecline() {
    if (!user?.id || !transfer) return;
    setActing(true);
    setError(null);
    const result = await declineOwnershipTransfer(supabase, {
      transferId: transfer.id,
      recipientUserId: user.id,
      inboxMessageId: inboxMessageId ?? undefined,
      clubName,
    });
    setActing(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to decline ownership transfer.");
      return;
    }
    setSuccess("Ownership transfer declined.");
    setTransfer((prev) => (prev ? { ...prev, status: "declined" } : prev));
  }

  async function handleChoice(choice: FormerOwnerChoice) {
    if (!user?.id || !transfer) return;
    setActing(true);
    setError(null);
    const result = await applyFormerOwnerChoice(supabase, {
      transferId: transfer.id,
      userId: user.id,
      choice,
      inboxMessageId: inboxMessageId ?? undefined,
      clubName,
    });
    setActing(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to update your role.");
      return;
    }
    setSuccess("Your next role is saved. Action Required is cleared.");
    setTransfer((prev) =>
      prev
        ? {
            ...prev,
            formerOwnerChoiceAt: new Date().toISOString(),
            formerOwnerChoice: choice,
          }
        : prev,
    );
    if (choice === "leave") {
      window.setTimeout(() => navigate("/app"), 1200);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" style={{ background: PAGE_BG }}>
        <Spinner label="Loading ownership transfer…" />
      </div>
    );
  }

  if (notFound || !transfer) {
    return (
      <div
        className="mx-auto max-w-7xl px-4 py-20 text-center"
        style={{ background: PAGE_BG, minHeight: "60vh" }}
      >
        <h1 className="text-3xl font-bold text-white">Transfer Not Found</h1>
        <p className="mt-3 text-[#777777]">
          This ownership transfer doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link to="/app?tab=inbox" className="mt-6 inline-block text-[#E51937] hover:underline">
          Back to Inbox
        </Link>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center px-4 py-12"
      style={{ background: PAGE_BG }}
    >
      <div style={cardStyle}>
        <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#555555", fontWeight: 600 }}>
          Ownership transfer
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
          {clubName}
        </h1>
        <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#cccccc", lineHeight: 1.6 }}>
          Transfer role: <strong style={{ color: "#ffffff" }}>{ownershipRoleLabel(transfer.newRole)}</strong>
          <br />
          Status: <strong style={{ color: "#ffffff" }}>{transfer.status}</strong>
        </p>

        {needsAcceptDecline ? (
          <>
            <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#888888", lineHeight: 1.6 }}>
              Accepting makes you {ownershipRoleLabel(transfer.newRole)}. Declining leaves the current
              president in place.
            </p>
            {transfer.optionalMessage ? (
              <p
                style={{
                  margin: "0 0 14px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  color: "#cccccc",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {transfer.optionalMessage}
              </p>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button type="button" disabled={acting} onClick={() => void handleAccept()} style={primaryButtonStyle}>
                {acting ? "Working…" : "Accept Ownership"}
              </button>
              <button type="button" disabled={acting} onClick={() => void handleDecline()} style={secondaryButtonStyle}>
                Decline
              </button>
            </div>
          </>
        ) : null}

        {needsRoleChoice ? (
          <>
            <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#cccccc", lineHeight: 1.6 }}>
              The transfer was accepted. Choose what role you want going forward.
            </p>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#888888", lineHeight: 1.5 }}>
              Previous role: President. Confirming a next role updates your club access and clears
              Action Required.
            </p>
            <div style={{ display: "grid", gap: "8px" }}>
              {FORMER_OWNER_CHOICE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={acting}
                  onClick={() => void handleChoice(option.value)}
                  style={{ ...secondaryButtonStyle, textAlign: "left" }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {!needsAcceptDecline && !needsRoleChoice ? (
          <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#888888", lineHeight: 1.6 }}>
            {transfer.formerOwnerChoiceAt
              ? "This transfer follow-up is complete."
              : "No action is required on this transfer right now."}
          </p>
        ) : null}

        {error ? <p style={{ margin: "14px 0 0", color: ACCENT_RED, fontSize: "13px" }}>{error}</p> : null}
        {success ? <p style={{ margin: "14px 0 0", color: "#4ade80", fontSize: "13px" }}>{success}</p> : null}

        <div style={{ marginTop: "18px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <Link to={`/app/clubs/${transfer.clubId}`} style={secondaryButtonStyle}>
            Open Club Workspace
          </Link>
          <Link to="/app?tab=inbox" style={secondaryButtonStyle}>
            Back to Inbox
          </Link>
        </div>
      </div>
    </div>
  );
}
