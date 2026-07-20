import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { useClubContext } from "../context/useClubContext";
import { supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useWindowWidth";
import InviteClubLogo from "../components/club/InviteClubLogo";
import {
  acceptExecutiveInvite,
  declineExecutiveInvite,
  executiveInviteRoleSummary,
  fetchExecutiveInviteByToken,
  isExecutiveInviteExpired,
  type ExecutiveInviteRow,
} from "../lib/executiveInviteUtils";
import Spinner from "../components/ui/Spinner";

function pageShellStyle(isMobile: boolean) {
  return {
    minHeight: "100vh",
    background: "#0f0f0f",
    display: "flex",
    alignItems: isMobile ? "flex-start" : "center",
    justifyContent: "center",
    padding: isMobile
      ? "max(24px, env(safe-area-inset-top)) 16px max(140px, calc(env(safe-area-inset-bottom) + 120px))"
      : "24px",
    boxSizing: "border-box" as const,
  };
}

const cardStyle = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "32px",
  maxWidth: "480px",
  width: "100%",
  textAlign: "center" as const,
};

function formatInviteExpiry(expiresAt: string | undefined): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ExecutiveInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signOut } = useAuthContext();
  useClubContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [invite, setInvite] = useState<ExecutiveInviteRow | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | undefined>();
  const [inviterName, setInviterName] = useState<string | null>(null);
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

    const inviteToken = token;

    async function load() {
      const row = await fetchExecutiveInviteByToken(supabase, inviteToken);

      if (cancelled) return;

      if (!row) {
        setInvalid(true);
        setLoading(false);
        return;
      }

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

      const [{ data: clubData }, { data: inviterProfile }] = await Promise.all([
        supabase
          .from("clubs")
          .select("name, logo_url")
          .eq("id", row.clubId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.invitedBy)
          .maybeSingle(),
      ]);

      if (!cancelled) {
        setClubName((clubData?.name as string) ?? "this club");
        setClubLogoUrl((clubData?.logo_url as string | null) ?? undefined);
        const name = (inviterProfile?.full_name as string | null)?.trim();
        setInviterName(name || null);
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
      recipientEmail: user.email ?? "",
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
      recipientEmail: user.email ?? "",
      clubName: clubName ?? "the club",
      inviterUserId: invite.invitedBy,
      clubId: invite.clubId,
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
      <div style={pageShellStyle(isMobile)}>
        <Spinner label="Loading invite…" />
      </div>
    );
  }

  if (expired) {
    return (
      <div style={pageShellStyle(isMobile)}>
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
      <div style={pageShellStyle(isMobile)}>
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

  const redirectPath = `/executive-invite/${token}`;
  const roleLabel = executiveInviteRoleSummary(invite);
  const expiryLabel = formatInviteExpiry(invite.expiresAt);

  if (!user) {
    return (
      <div style={pageShellStyle(isMobile)}>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <InviteClubLogo name={clubName ?? "Club"} logoUrl={clubLogoUrl} />
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
            {clubName}
          </h1>
          <p style={{ fontSize: "15px", color: "#cccccc", margin: "0 0 8px", lineHeight: 1.5 }}>
            <strong style={{ color: "#ffffff" }}>{clubName}</strong> has invited you to
            join their club on ClubConnect as {roleLabel}.
          </p>
          {inviterName || expiryLabel ? (
            <p style={{ fontSize: "13px", color: "#666666", margin: "0 0 20px", lineHeight: 1.6 }}>
              {inviterName ? <>Invited by {inviterName}</> : null}
              {inviterName && expiryLabel ? " · " : null}
              {expiryLabel ? <>Expires {expiryLabel}</> : null}
            </p>
          ) : (
            <div style={{ marginBottom: "12px" }} />
          )}
          {invite.optionalMessage ? (
            <p
              style={{
                fontSize: "13px",
                color: "#777777",
                margin: "0 0 20px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                textAlign: "left",
              }}
            >
              {invite.optionalMessage}
            </p>
          ) : null}
          <div style={{ paddingBottom: isMobile ? "16px" : 0 }}>
            <Link
              to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
              style={{
                display: "inline-block",
                width: "100%",
                boxSizing: "border-box",
                background: "#E51937",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign In to Join
            </Link>
            <Link
              to={`/signup?redirect=${encodeURIComponent(redirectPath)}`}
              style={{
                display: "inline-block",
                width: "100%",
                boxSizing: "border-box",
                background: "transparent",
                color: "#ffffff",
                border: "1px solid #333333",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                marginTop: "10px",
              }}
            >
              Create Account to Join
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (emailMismatch) {
    return (
      <div style={pageShellStyle(isMobile)}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
            Wrong account
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            This invite was sent to a specific email and cannot be used by this account.
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

  return (
    <div style={pageShellStyle(isMobile)}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <InviteClubLogo name={clubName ?? "Club"} logoUrl={clubLogoUrl} />
        </div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: "0 0 12px" }}>
          Executive invite
        </h1>
        <p style={{ fontSize: "14px", color: "#cccccc", margin: "0 0 8px", lineHeight: 1.5 }}>
          You have been invited to join <strong>{clubName}</strong> as {roleLabel}.
        </p>
        {inviterName || expiryLabel ? (
          <p style={{ fontSize: "13px", color: "#666666", margin: "0 0 16px", lineHeight: 1.6 }}>
            {inviterName ? <>Invited by {inviterName}</> : null}
            {inviterName && expiryLabel ? " · " : null}
            {expiryLabel ? <>Expires {expiryLabel}</> : null}
          </p>
        ) : null}
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
          {acting ? "Working…" : "Accept Invitation"}
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
            marginBottom: isMobile ? "16px" : 0,
          }}
        >
          Decline Invitation
        </button>
      </div>
    </div>
  );
}
