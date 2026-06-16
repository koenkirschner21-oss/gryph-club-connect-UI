import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import { resolveStudentDisplayName } from "../lib/notifications";
import Spinner from "../components/ui/Spinner";

const PAGE_BG = "#0f0f0f";
const GOLD = "#FFC429";
const GRAY = "#555555";
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
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
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

type ClaimStatus = "pending" | "approved" | "rejected" | "more_info" | "canceled";

interface ClaimRecord {
  id: string;
  status: ClaimStatus;
  createdAt: string;
  clubId: string;
  clubName: string;
  clubSlug: string | null;
  submitterName: string;
}

function formatSubmittedAt(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isUnderReview(status: ClaimStatus): boolean {
  return status === "pending" || status === "more_info";
}

export default function ClaimStatusPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();
  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !claimId) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    async function loadClaim() {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from("club_claim_requests")
        .select(
          `
          id,
          status,
          created_at,
          submitted_by,
          club_id,
          clubs ( name, slug )
        `,
        )
        .eq("id", claimId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        console.error("Failed to load claim request:", error?.message);
        setNotFound(true);
        setClaim(null);
        setLoading(false);
        return;
      }

      const clubRaw = data.clubs as
        | { name?: string; slug?: string }
        | { name?: string; slug?: string }[]
        | null;
      const clubRecord = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", data.submitted_by as string)
        .maybeSingle();

      if (cancelled) return;

      setClaim({
        id: data.id as string,
        status: data.status as ClaimStatus,
        createdAt: data.created_at as string,
        clubId: data.club_id as string,
        clubName: (clubRecord?.name as string) ?? "Club",
        clubSlug: (clubRecord?.slug as string | undefined) ?? null,
        submitterName: resolveStudentDisplayName(
          profile?.full_name as string | null | undefined,
          profile?.email as string | null | undefined,
        ),
      });
      setLoading(false);
    }

    void loadClaim();

    return () => {
      cancelled = true;
    };
  }, [authLoading, claimId, navigate, user]);

  async function handleCancelClaim() {
    if (!claim || !isUnderReview(claim.status)) return;

    const confirmed = window.confirm(
      "Cancel this claim request? You can submit a new claim later if needed.",
    );
    if (!confirmed) return;

    setCanceling(true);
    setCancelError(null);

    const { error } = await supabase
      .from("club_claim_requests")
      .update({ status: "canceled" })
      .eq("id", claim.id)
      .eq("status", "pending");

    setCanceling(false);

    if (error) {
      console.error("Failed to cancel claim request:", error.message);
      setCancelError("Could not cancel this claim request. Please try again.");
      return;
    }

    setClaim((prev) => (prev ? { ...prev, status: "canceled" } : prev));
  }

  const clubProfilePath = claim?.clubSlug ? `/clubs/${claim.clubSlug}` : "/explore";

  if (authLoading || loading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        style={{ background: PAGE_BG }}
      >
        <Spinner label="Loading claim status…" />
      </div>
    );
  }

  if (notFound || !claim) {
    return (
      <div
        className="mx-auto max-w-7xl px-4 py-20 text-center"
        style={{ background: PAGE_BG, minHeight: "60vh" }}
      >
        <h1 className="text-3xl font-bold text-white">Claim Not Found</h1>
        <p className="mt-3 text-[#777777]">
          This claim request doesn&apos;t exist or you don&apos;t have access to view it.
        </p>
        <Link to="/explore" className="mt-6 inline-block text-[#E51937] hover:underline">
          Browse clubs
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
        <h1 className="text-2xl font-bold text-white">Claim Request Status</h1>

        <p className="mt-4 text-lg font-bold text-white">{claim.clubName}</p>

        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-[#777777]">Submitted by</dt>
            <dd className="mt-0.5 text-white">{claim.submitterName}</dd>
          </div>
          <div>
            <dt className="text-[#777777]">Submitted</dt>
            <dd className="mt-0.5 text-white">{formatSubmittedAt(claim.createdAt)}</dd>
          </div>
        </dl>

        <div className="mt-6">
          {claim.status === "approved" ? (
            <span
              className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: "rgba(255, 196, 41, 0.15)", color: GOLD }}
            >
              Approved ✓
            </span>
          ) : claim.status === "rejected" ? (
            <span
              className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: "rgba(85, 85, 85, 0.2)", color: GRAY }}
            >
              Not Approved
            </span>
          ) : claim.status === "canceled" ? (
            <span
              className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: "rgba(85, 85, 85, 0.2)", color: GRAY }}
            >
              Canceled
            </span>
          ) : (
            <span
              className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: "rgba(255, 196, 41, 0.15)", color: GOLD }}
            >
              Under Review
            </span>
          )}
        </div>

        {isUnderReview(claim.status) && (
          <p className="mt-4 text-sm leading-relaxed text-[#aaaaaa]">
            Your claim is currently under review. We&apos;ll notify you once a decision has
            been made.
          </p>
        )}

        {claim.status === "rejected" && (
          <p className="mt-4 text-sm leading-relaxed text-[#aaaaaa]">
            Your claim request was not approved at this time.
          </p>
        )}

        {claim.status === "canceled" && (
          <p className="mt-4 text-sm leading-relaxed text-[#aaaaaa]">
            You canceled this claim request.
          </p>
        )}

        {cancelError && (
          <p className="mt-4 text-sm text-[#E51937]" role="alert">
            {cancelError}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {claim.status === "approved" ? (
            <Link
              to={`/app/clubs/${claim.clubId}`}
              style={primaryButtonStyle}
            >
              Open Club Dashboard
            </Link>
          ) : (
            <Link to={clubProfilePath} style={primaryButtonStyle}>
              View Club Profile
            </Link>
          )}

          {isUnderReview(claim.status) && (
            <button
              type="button"
              onClick={() => void handleCancelClaim()}
              disabled={canceling}
              style={{
                ...secondaryButtonStyle,
                opacity: canceling ? 0.6 : 1,
                cursor: canceling ? "not-allowed" : "pointer",
              }}
            >
              {canceling ? "Canceling…" : "Cancel Claim Request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
