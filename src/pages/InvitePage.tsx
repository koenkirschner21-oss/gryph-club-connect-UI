import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { useClubContext } from "../context/useClubContext";
import { supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useWindowWidth";
import InviteClubLogo from "../components/club/InviteClubLogo";
import Spinner from "../components/ui/Spinner";

interface InviteRow {
  id: string;
  club_id: string;
  invited_email: string;
  invited_by: string | null;
  token: string;
  status: string;
  created_at: string;
  expires_at: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isInviteExpired(row: InviteRow): boolean {
  if (row.status !== "pending") return false;
  const now = Date.now();
  if (row.expires_at && new Date(row.expires_at).getTime() < now) {
    return true;
  }
  const createdAt = new Date(row.created_at).getTime();
  return createdAt < now - SEVEN_DAYS_MS;
}

function formatInviteExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
  maxWidth: "440px",
  width: "100%",
  textAlign: "center" as const,
};

const secondaryButtonStyle = {
  display: "inline-block",
  width: "100%",
  boxSizing: "border-box" as const,
  background: "#1a1a1a",
  color: "#ffffff",
  border: "1px solid #333333",
  borderRadius: "6px",
  padding: "12px 24px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  marginTop: "10px",
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, signOut } = useAuthContext();
  const { joinClub } = useClubContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | undefined>();
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [expired, setExpired] = useState(false);
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
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
        .from("club_invites")
        .select(
          "id, club_id, invited_email, invited_by, token, status, created_at, expires_at",
        )
        .eq("token", token)
        .maybeSingle();

      if (cancelled) return;

      if (fetchErr || !data) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      const row = data as InviteRow;

      if (row.status !== "pending") {
        setInvalid(true);
        setLoading(false);
        return;
      }

      if (isInviteExpired(row)) {
        setExpired(true);
        setLoading(false);
        return;
      }

      setInvite(row);

      const [{ data: clubData }, inviterRow] = await Promise.all([
        supabase
          .from("clubs")
          .select("name, logo_url")
          .eq("id", row.club_id)
          .maybeSingle(),
        row.invited_by
          ? supabase
              .from("profiles")
              .select("full_name")
              .eq("id", row.invited_by)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (!cancelled) {
        setClubName((clubData?.name as string) ?? "this club");
        setClubLogoUrl((clubData?.logo_url as string | null) ?? undefined);
        const name = (inviterRow.data?.full_name as string | null)?.trim();
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
    const invited = invite.invited_email.trim().toLowerCase();
    const current = user.email.trim().toLowerCase();
    setEmailMismatch(invited !== current);
  }, [invite, user?.email]);

  useEffect(() => {
    if (!invite || !user?.id || emailMismatch) {
      setAlreadyMember(false);
      return;
    }

    let cancelled = false;

    async function checkMembership() {
      const { data } = await supabase
        .from("club_members")
        .select("id, status")
        .eq("club_id", invite!.club_id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (cancelled) return;
      setAlreadyMember(Boolean(data && data.status === "active"));
    }

    void checkMembership();
    return () => {
      cancelled = true;
    };
  }, [emailMismatch, invite, user?.id]);

  const markInviteAccepted = useCallback(async (inviteId: string) => {
    const { error: updateErr } = await supabase
      .from("club_invites")
      .update({ status: "accepted" })
      .eq("id", inviteId)
      .eq("status", "pending");

    if (updateErr) {
      console.error("Failed to update invite:", updateErr.message);
    }
  }, []);

  const handleAccept = useCallback(async () => {
    if (!user?.id || !invite || emailMismatch) return;
    setAccepting(true);
    setError(null);

    try {
      const { data: existing } = await supabase
        .from("club_members")
        .select("id, status, role, access_level")
        .eq("club_id", invite.club_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.status === "active") {
        await markInviteAccepted(invite.id);
        navigate(`/app/clubs/${invite.club_id}`, { replace: true });
        return;
      }

      const joined = await joinClub(invite.club_id, { viaJoinCode: true });
      if (!joined) {
        setError("Could not join the club. Please try again.");
        setAccepting(false);
        return;
      }

      await markInviteAccepted(invite.id);
      navigate(`/app/clubs/${invite.club_id}`, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setAccepting(false);
    }
  }, [emailMismatch, invite, joinClub, markInviteAccepted, navigate, user?.id]);

  const handleDecline = useCallback(() => {
    setDeclining(true);
    navigate("/app", { replace: true });
  }, [navigate]);

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
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 12px",
            }}
          >
            Invite expired
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            This invite has expired.
          </p>
          <Link
            to="/"
            style={{
              display: "inline-block",
              marginTop: "24px",
              color: "#E51937",
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
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
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
              margin: "0 0 12px",
            }}
          >
            Invalid invite
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", margin: 0 }}>
            This invite is invalid or has already been used.
          </p>
          <Link
            to="/"
            style={{
              display: "inline-block",
              marginTop: "24px",
              color: "#E51937",
              fontSize: "14px",
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const redirectPath = `/invite/${token}`;
  const loginHref = `/login?redirect=${encodeURIComponent(redirectPath)}`;
  const signupHref = `/signup?redirect=${encodeURIComponent(redirectPath)}`;
  const expiryLabel = formatInviteExpiry(invite.expires_at);

  return (
    <div style={pageShellStyle(isMobile)}>
      <div style={{ ...cardStyle, textAlign: "left" }}>
        {error ? (
          <p
            role="alert"
            style={{
              fontSize: "13px",
              color: "#E51937",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        ) : null}

        {user && emailMismatch ? (
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              Club invitation
            </h1>
            <p
              role="alert"
              style={{
                fontSize: "14px",
                color: "#888888",
                margin: "0 0 20px",
              }}
            >
              This invite was sent to a different email address.
            </p>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              style={{
                width: "100%",
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "12px 24px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        ) : user ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <InviteClubLogo name={clubName ?? "Club"} logoUrl={clubLogoUrl} />
            </div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              {clubName}
            </h1>
            <p style={{ fontSize: "15px", color: "#888888", margin: "0 0 16px" }}>
              <strong style={{ color: "#ffffff" }}>{clubName}</strong> has
              invited you to join their club on ClubConnect.
            </p>
            {inviterName || expiryLabel ? (
              <p
                style={{
                  fontSize: "13px",
                  color: "#666666",
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                {inviterName ? <>Invited by {inviterName}</> : null}
                {inviterName && expiryLabel ? " · " : null}
                {expiryLabel ? <>Expires {expiryLabel}</> : null}
              </p>
            ) : (
              <div style={{ marginBottom: "8px" }} />
            )}
            {alreadyMember ? (
              <p
                role="status"
                style={{
                  fontSize: "13px",
                  color: "#FFC429",
                  margin: "0 0 16px",
                }}
              >
                You are already a member of this club.
              </p>
            ) : null}
            <div style={{ paddingBottom: isMobile ? "16px" : 0 }}>
              <button
                type="button"
                disabled={accepting || declining}
                onClick={() => void handleAccept()}
                style={{
                  width: "100%",
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "12px 24px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: accepting || declining ? "wait" : "pointer",
                  opacity: accepting || declining ? 0.7 : 1,
                }}
              >
                {accepting
                  ? "Joining…"
                  : alreadyMember
                    ? "Open Club Workspace"
                    : "Accept Invitation"}
              </button>
              {!alreadyMember ? (
                <button
                  type="button"
                  disabled={accepting || declining}
                  onClick={handleDecline}
                  style={{
                    ...secondaryButtonStyle,
                    cursor: accepting || declining ? "wait" : "pointer",
                    opacity: accepting || declining ? 0.7 : 1,
                  }}
                >
                  Decline Invitation
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <InviteClubLogo name={clubName ?? "Club"} logoUrl={clubLogoUrl} />
            </div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              {clubName}
            </h1>
            <p style={{ fontSize: "15px", color: "#888888", margin: "0 0 16px" }}>
              <strong style={{ color: "#ffffff" }}>{clubName}</strong> has
              invited you to join their club on ClubConnect.
            </p>
            {inviterName || expiryLabel ? (
              <p
                style={{
                  fontSize: "13px",
                  color: "#666666",
                  margin: "0 0 24px",
                  lineHeight: 1.6,
                }}
              >
                {inviterName ? <>Invited by {inviterName}</> : null}
                {inviterName && expiryLabel ? " · " : null}
                {expiryLabel ? <>Expires {expiryLabel}</> : null}
              </p>
            ) : (
              <div style={{ marginBottom: "8px" }} />
            )}
            <div style={{ paddingBottom: isMobile ? "16px" : 0 }}>
              <Link
                to={loginHref}
                style={{
                  display: "inline-block",
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#E51937",
                  color: "#ffffff",
                  borderRadius: "6px",
                  padding: "12px 24px",
                  fontSize: "15px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign In to Join
              </Link>
              <Link to={signupHref} style={secondaryButtonStyle}>
                Create Account to Join
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
