import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { useClubContext } from "../context/useClubContext";
import { supabase } from "../lib/supabaseClient";
import Spinner from "../components/ui/Spinner";

interface InviteRow {
  id: string;
  club_id: string;
  invited_email: string;
  token: string;
  status: string;
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

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuthContext();
  const { joinClub } = useClubContext();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
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
        .select("id, club_id, invited_email, token, status")
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

      setInvite(row);

      const { data: clubData } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", row.club_id)
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

  const handleAccept = useCallback(async () => {
    if (!user?.id || !invite) return;
    setAccepting(true);
    setError(null);

    try {
      const joined = await joinClub(invite.club_id);
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
  }, [invite, joinClub, navigate, user?.id]);

  if (loading || authLoading) {
    return (
      <div style={pageStyle}>
        <Spinner label="Loading invite…" />
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
            This invite is invalid or has expired.
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

  const loginHref = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
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

        {error ? (
          <p
            role="alert"
            style={{
              fontSize: "13px",
              color: "#E51937",
              marginBottom: "16px",
            }}
          >
            {error}
          </p>
        ) : null}

        {user ? (
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={accepting}
            style={{
              width: "100%",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: accepting ? "not-allowed" : "pointer",
              opacity: accepting ? 0.7 : 1,
            }}
          >
            {accepting ? "Joining…" : "Accept Invite"}
          </button>
        ) : (
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
            Sign in to accept this invite
          </Link>
        )}
      </div>
    </div>
  );
}
