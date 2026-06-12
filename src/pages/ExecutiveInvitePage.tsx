import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { useClubContext } from "../context/useClubContext";
import { supabase } from "../lib/supabaseClient";
import {
  acceptExecutiveInvite,
  declineExecutiveInvite,
  executiveInviteRoleSummary,
  isExecutiveInviteExpired,
  mapExecutiveInviteRow,
  type ExecutiveInviteRow,
} from "../lib/executiveInviteUtils";
import Spinner from "../components/ui/Spinner";

const pageStyle = {
  minHeight: "100vh",
  background: "#0f0f0f",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
} as const;

const cardStyle = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "32px",
  maxWidth: "480px",
  width: "100%",
  textAlign: "center" as const,
};

export default function ExecutiveInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signOut } = useAuthContext();
  useClubContext();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<ExecutiveInviteRow | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [expired, setExpired] = useState(false);
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error: fetchErr } = await supabase
        .from("executive_invites")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (cancelled) return;

      if (fetchErr || !data) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      const row = mapExecutiveInviteRow(data as Record<string, unknown>);

      if (row.status !== "pending") {
        setInvalid(true);
        setLoading(false);
        return;
      }

      if (isExecutiveInviteExpired(row)) {
        setExpired(true);
        setLoading(false);
        return;
      }

      setInvite(row);

      const { data: clubData } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", row.clubId)
        .maybeSingle();

      if (!cancelled) {
        setClubName((clubData?.name as string) ?? "this club");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!invite || !user?.email) {
      setEmailMismatch(false);
      return;
    }
    const invited = invite.invitedEmail.trim().toLowerCase();
    const current = user.email.trim().toLowerCase();
    setEmailMismatch(invited !== current);
  }, [invite, user?.email]);

  const handleAccept = useCallback(async () => {
    if (!user?.id || !invite || !token || emailMismatch) return;
    setActing(true);
    setError(null);

    const result = await acceptExecutiveInvite(supabase, {
      token,
      recipientUserId: user.id,
      clubName: clubName ?? "the club",
      inviterUserId: invite.invitedBy,
    });

    setActing(false);

    if (!result.ok || !result.clubId) {
      setError(result.error ?? "Could not accept this invite.");
      if (result.error?.includes("expired")) {
        setExpired(true);
      }
      return;
    }

    window.location.assign(`/app/clubs/${result.clubId}`);
  }, [clubName, emailMismatch, invite, token, user?.id]);

  const handleDecline = useCallback(async () => {
    if (!user?.id || !invite || emailMismatch) return;
    setActing(true);
    setError(null);

    const result = await declineExecutiveInvite(supabase, {
      inviteId: invite.id,
      recipientUserId: user.id,
      clubName: clubName ?? "the club",
      inviterUserId: invite.invitedBy,
    });

    setActing(false);

    if (!result.ok) {
      setError(result.error ?? "Could not decline this invite.");
      return;
    }

    navigate("/app", { replace: true });
  }, [clubName, emailMismatch, invite, navigate, user?.id]);

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      /* non-critical */
    }
  }

  if (loading || authLoading) {
    return (
      <div style={pageStyle}>
        <Spinner label="Loading invite…" />
      </div>
    );
  }

  if (expired) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
            Invite expired
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            This invite has expired. Please ask your club President to send a new invite.
          </p>
          <Link to="/" style={{ display: "inline-block", marginTop: "24px", color: "#E51937", fontSize: "14px" }}>
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (invalid || !invite) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
            Invalid invite
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            This invite link is not valid.
          </p>
          <Link to="/" style={{ display: "inline-block", marginTop: "24px", color: "#E51937", fontSize: "14px" }}>
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
            Sign in to respond
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            Sign in with {invite.invitedEmail} to accept this executive invite.
          </p>
          <Link
            to={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
            style={{
              display: "inline-block",
              marginTop: "24px",
              background: "#E51937",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (emailMismatch) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
            Wrong account
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            This invite was sent to a specific user and cannot be used by this account.
          </p>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            style={{
              marginTop: "20px",
              background: "transparent",
              border: "1px solid #333333",
              color: "#cccccc",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Sign out and switch account
          </button>
        </div>
      </div>
    );
  }

  const roleLabel = executiveInviteRoleSummary(invite);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
          Executive invite
        </h1>
        <p style={{ fontSize: "14px", color: "#cccccc", margin: "0 0 8px", lineHeight: 1.5 }}>
          You have been invited to join <strong>{clubName}</strong> as {roleLabel}.
        </p>
        {invite.optionalMessage ? (
          <p
            style={{
              fontSize: "13px",
              color: "#777777",
              margin: "0 0 16px",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {invite.optionalMessage}
          </p>
        ) : null}
        {error ? (
          <p style={{ fontSize: "13px", color: "#E51937", margin: "0 0 12px" }}>{error}</p>
        ) : null}
        <button
          type="button"
          disabled={acting}
          onClick={() => void handleAccept()}
          style={{
            width: "100%",
            background: "#E51937",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "12px 20px",
            fontSize: "15px",
            fontWeight: 600,
            cursor: acting ? "wait" : "pointer",
            opacity: acting ? 0.7 : 1,
          }}
        >
          {acting ? "Working…" : "Accept Invite"}
        </button>
        <button
          type="button"
          disabled={acting}
          onClick={() => void handleDecline()}
          style={{
            width: "100%",
            marginTop: "10px",
            background: "transparent",
            border: "1px solid #333333",
            color: "#aaaaaa",
            borderRadius: "8px",
            padding: "12px 20px",
            fontSize: "14px",
            cursor: acting ? "wait" : "pointer",
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
