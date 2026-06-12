import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { useClubContext } from "../context/useClubContext";
import { supabase } from "../lib/supabaseClient";
import ClubJoinAccessConfirmation from "../components/club/ClubJoinAccessConfirmation";
import {
  notifyExecutiveInviteRequest,
  resolveStudentDisplayName,
} from "../lib/notifications";
import type { AccessLevel } from "../types";
import Spinner from "../components/ui/Spinner";

interface InviteRow {
  id: string;
  club_id: string;
  invited_email: string;
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

  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [clubLogoUrl, setClubLogoUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [expired, setExpired] = useState(false);
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [accepting, setAccepting] = useState(false);
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
          "id, club_id, invited_email, token, status, created_at, expires_at",
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

      const { data: clubData } = await supabase
        .from("clubs")
        .select("name, logo_url")
        .eq("id", row.club_id)
        .maybeSingle();

      if (!cancelled) {
        setClubName((clubData?.name as string) ?? "this club");
        setClubLogoUrl((clubData?.logo_url as string | null) ?? undefined);
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

  const handleAccept = useCallback(async () => {
    if (!user?.id || !invite || emailMismatch) return;
    setAccepting(true);
    setError(null);

    try {
      const joined = await joinClub(invite.club_id, { viaJoinCode: true });
      if (!joined) {
        setError("Could not join the club. You may already be a member.");
        setAccepting(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from("club_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      if (updateErr) {
        console.error("Failed to update invite:", updateErr.message);
      }

      navigate(`/app/clubs/${invite.club_id}`, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setAccepting(false);
    }
  }, [emailMismatch, invite, joinClub, navigate, user?.id]);

  const handleRequestExecutiveInvite = useCallback(
    async (payload: {
      accessLevel: AccessLevel;
      roleTitle: string;
      message?: string;
    }) => {
      if (!user?.id || !invite || !clubName) return;

      const requesterName = resolveStudentDisplayName(
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
        user.email,
      );

      await notifyExecutiveInviteRequest(supabase, {
        clubId: invite.club_id,
        clubName,
        requesterUserId: user.id,
        requesterName,
        accessLevel: payload.accessLevel,
        roleTitle: payload.roleTitle,
        message: payload.message,
      });
    },
    [clubName, invite, user],
  );

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
      <div style={pageStyle}>
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

  return (
    <div style={pageStyle}>
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
          <ClubJoinAccessConfirmation
            clubName={clubName ?? "this club"}
            logoUrl={clubLogoUrl}
            joining={accepting}
            onJoinAsGeneralMember={() => void handleAccept()}
            onRequestExecutiveInvite={handleRequestExecutiveInvite}
          />
        ) : (
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
            <p style={{ fontSize: "15px", color: "#888888", margin: "0 0 24px" }}>
              You&apos;ve been invited to join{" "}
              <strong style={{ color: "#ffffff" }}>{clubName}</strong>!
            </p>
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
              Sign In
            </Link>
            <Link to={signupHref} style={secondaryButtonStyle}>
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
