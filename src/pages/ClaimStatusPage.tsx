import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { cancelClubClaimRequest } from "../lib/clubPresidentMembership";
import { isClubPubliclyDiscoverableRow } from "../lib/clubPublicVisibility";
import { notifyClaimRequestCanceled } from "../lib/notifications";
import { supabase } from "../lib/supabaseClient";
import Spinner from "../components/ui/Spinner";

const PAGE_BG = "#0f0f0f";
const GOLD = "#FFC429";
const GRAY = "#777777";
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

type ClaimRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "more_info"
  | "canceled";

type ProgressPhase = "submitted" | "review" | "decision";

interface ClaimRecord {
  id: string;
  status: ClaimRequestStatus;
  createdAt: string;
  clubId: string;
  clubName: string;
  clubSlug: string | null;
  reviewNote: string | null;
  clubPublished: boolean;
  setupCompleted: boolean;
  claimStatus: string | null;
  isOwner: boolean;
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

function progressPhase(status: ClaimRequestStatus): ProgressPhase {
  if (status === "pending") return "review";
  if (status === "more_info") return "review";
  return "decision";
}

function statusLabel(status: ClaimRequestStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Declined";
    case "canceled":
      return "Cancelled";
    case "more_info":
      return "Changes Requested";
    default:
      return "Under Review";
  }
}

function statusBadgeStyle(status: ClaimRequestStatus): CSSProperties {
  if (status === "approved") {
    return { background: "rgba(255, 196, 41, 0.15)", color: GOLD };
  }
  if (status === "more_info") {
    return { background: "rgba(229, 25, 55, 0.12)", color: "#ff8a9a" };
  }
  if (status === "pending") {
    return { background: "rgba(255, 196, 41, 0.15)", color: GOLD };
  }
  return { background: "rgba(85, 85, 85, 0.25)", color: "#bbbbbb" };
}

function ProgressTracker({ status }: { status: ClaimRequestStatus }) {
  const phase = progressPhase(status);
  const steps: { id: ProgressPhase; label: string }[] = [
    { id: "submitted", label: "Submitted" },
    { id: "review", label: "Under Review" },
    { id: "decision", label: "Decision" },
  ];

  const phaseIndex = steps.findIndex((step) => step.id === phase);

  return (
    <ol
      style={{
        listStyle: "none",
        margin: "0 0 24px",
        padding: 0,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "8px",
      }}
      aria-label="Claim progress"
    >
      {steps.map((step, index) => {
        const complete = index < phaseIndex || (phase === "decision" && index <= phaseIndex);
        const active = index === phaseIndex && status !== "canceled";
        const decisionComplete =
          step.id === "decision" &&
          (status === "approved" || status === "rejected" || status === "canceled");

        let tone = GRAY;
        if (complete || decisionComplete || active) tone = "#ffffff";
        if (active) tone = GOLD;

        return (
          <li
            key={step.id}
            style={{
              textAlign: "center",
              borderTop: `2px solid ${
                complete || decisionComplete || active ? ACCENT_RED : "#2a2a2a"
              }`,
              paddingTop: "10px",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: active || decisionComplete ? 700 : 500,
                color: tone,
              }}
            >
              {step.id === "decision" && status === "approved"
                ? "Approved"
                : step.id === "decision" && status === "rejected"
                  ? "Declined"
                  : step.id === "decision" && status === "canceled"
                    ? "Cancelled"
                    : step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function ClaimStatusPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();
  const [claim, setClaim] = useState<ClaimRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !claimId) return;

    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/claim-status/${claimId}`)}`, {
        replace: true,
      });
      return;
    }

    let cancelled = false;

    async function loadClaim() {
      setLoading(true);
      setNotFound(false);
      setActionError(null);

      const { data, error } = await supabase
        .from("club_claim_requests")
        .select(
          `
          id,
          status,
          created_at,
          submitted_by,
          club_id,
          review_note,
          clubs ( name, slug, is_published, setup_completed, claim_status )
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

      if ((data.submitted_by as string) !== user!.id) {
        setNotFound(true);
        setClaim(null);
        setLoading(false);
        return;
      }

      const clubRaw = data.clubs as
        | {
            name?: string;
            slug?: string;
            is_published?: boolean;
            setup_completed?: boolean;
            claim_status?: string;
          }
        | {
            name?: string;
            slug?: string;
            is_published?: boolean;
            setup_completed?: boolean;
            claim_status?: string;
          }[]
        | null;
      const clubRecord = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;
      const clubId = data.club_id as string;

      const { data: membership } = await supabase
        .from("club_members")
        .select("role, access_level, status")
        .eq("club_id", clubId)
        .eq("user_id", user!.id)
        .eq("status", "active")
        .maybeSingle();

      if (cancelled) return;

      const isOwner =
        membership?.role === "owner" ||
        membership?.access_level === "president";

      const clubPublished = isClubPubliclyDiscoverableRow({
        is_published: clubRecord?.is_published === true,
        setup_completed: clubRecord?.setup_completed === true,
        claim_status: clubRecord?.claim_status ?? "unclaimed",
      });

      setClaim({
        id: data.id as string,
        status: data.status as ClaimRequestStatus,
        createdAt: data.created_at as string,
        clubId,
        clubName: (clubRecord?.name as string) ?? "Club",
        clubSlug: (clubRecord?.slug as string | undefined) ?? null,
        reviewNote: (data.review_note as string | null) ?? null,
        clubPublished,
        setupCompleted: clubRecord?.setup_completed === true,
        claimStatus: (clubRecord?.claim_status as string | null) ?? null,
        isOwner,
      });
      setLoading(false);
    }

    void loadClaim();

    return () => {
      cancelled = true;
    };
  }, [authLoading, claimId, navigate, user]);

  async function handleCancelClaim() {
    if (!claim || (claim.status !== "pending" && claim.status !== "more_info")) {
      return;
    }
    if (!user?.id) return;

    setCanceling(true);
    setActionError(null);
    setActionSuccess(null);

    const cancellation = await cancelClubClaimRequest(supabase, claim.id);

    if (!cancellation.ok) {
      setCanceling(false);
      setActionError("Could not cancel this claim request. Please try again.");
      return;
    }

    if (cancellation.result.outcome === "canceled") {
      void notifyClaimRequestCanceled(supabase, {
        clubId: claim.clubId,
        clubName: claim.clubName,
        submitterUserId: user.id,
        claimRequestId: claim.id,
      });
      setActionSuccess("Your claim request has been cancelled.");
    } else {
      setActionSuccess("This claim request was already cancelled.");
    }

    setClaim((prev) => (prev ? { ...prev, status: "canceled" } : prev));
    setCancelConfirmOpen(false);
    setCanceling(false);
  }

  const canCancel = claim?.status === "pending" || claim?.status === "more_info";
  const claimEditPath =
    claim?.clubSlug && claim
      ? `/clubs/${claim.clubSlug}/claim?edit=${claim.id}`
      : null;
  const submitAgainPath = claim?.clubSlug ? `/clubs/${claim.clubSlug}/claim` : null;
  const workspaceReady = claim?.status === "approved" && claim.isOwner;
  const setupReady = workspaceReady && !claim.setupCompleted;

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

        <ProgressTracker status={claim.status} />

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[#777777]">Current status</dt>
            <dd className="mt-1">
              <span
                className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
                style={statusBadgeStyle(claim.status)}
              >
                {statusLabel(claim.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[#777777]">Submitted</dt>
            <dd className="mt-0.5 text-white">{formatSubmittedAt(claim.createdAt)}</dd>
          </div>
        </dl>

        <div className="mt-5">
          {claim.status === "pending" ? (
            <p className="text-sm leading-relaxed text-[#aaaaaa]">
              Your claim is being reviewed. You&apos;ll receive a notification when a
              decision is made or if more information is needed.
            </p>
          ) : null}

          {claim.status === "more_info" ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-[#aaaaaa]">
                Reviewers asked for changes before this claim can continue. Update your
                submission and resubmit when ready.
              </p>
              {claim.reviewNote ? (
                <div
                  style={{
                    background: "#111111",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    padding: "12px 14px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#888888",
                    }}
                  >
                    Requested changes
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "14px",
                      color: "#e8e8e8",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {claim.reviewNote}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {claim.status === "approved" ? (
            <p className="text-sm leading-relaxed text-[#aaaaaa]">
              Your claim was approved. You can open the club workspace
              {setupReady ? " and finish setup" : ""} when ready.
            </p>
          ) : null}

          {claim.status === "rejected" ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-[#aaaaaa]">
                Your claim request was not approved at this time.
              </p>
              {claim.reviewNote ? (
                <div
                  style={{
                    background: "#111111",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    padding: "12px 14px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#888888",
                    }}
                  >
                    Reviewer message
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "14px",
                      color: "#e8e8e8",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {claim.reviewNote}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {claim.status === "canceled" ? (
            <p className="text-sm leading-relaxed text-[#aaaaaa]">
              This claim request was withdrawn and is no longer under review.
            </p>
          ) : null}
        </div>

        {actionError ? (
          <p className="mt-4 text-sm text-[#E51937]" role="alert">
            {actionError}
          </p>
        ) : null}
        {actionSuccess ? (
          <p className="mt-4 text-sm text-[#FFC429]" role="status">
            {actionSuccess}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {claim.status === "more_info" && claimEditPath ? (
            <Link to={claimEditPath} style={primaryButtonStyle}>
              Edit and Resubmit
            </Link>
          ) : null}

          {workspaceReady ? (
            <Link to={`/app/clubs/${claim.clubId}`} style={primaryButtonStyle}>
              Open Club Workspace
            </Link>
          ) : null}

          {setupReady ? (
            <Link
              to={`/app/clubs/${claim.clubId}`}
              style={secondaryButtonStyle}
            >
              Complete Club Setup
            </Link>
          ) : null}

          {claim.clubPublished && claim.clubSlug ? (
            <Link to={`/clubs/${claim.clubSlug}`} style={secondaryButtonStyle}>
              View Club Profile
            </Link>
          ) : null}

          {(claim.status === "rejected" || claim.status === "canceled") &&
          submitAgainPath &&
          (claim.claimStatus === "unclaimed" || claim.claimStatus === "claim_pending") ? (
            <Link to={submitAgainPath} style={primaryButtonStyle}>
              Submit Again
            </Link>
          ) : null}

          {claim.status === "rejected" ? (
            <a href="mailto:gryphclubconnect@gmail.com" style={secondaryButtonStyle}>
              Contact Support
            </a>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(true)}
              disabled={canceling}
              style={{
                ...secondaryButtonStyle,
                opacity: canceling ? 0.6 : 1,
                cursor: canceling ? "not-allowed" : "pointer",
              }}
            >
              Cancel Claim Request
            </button>
          ) : null}
        </div>
      </div>

      {cancelConfirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-claim-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 50,
          }}
          onClick={() => {
            if (!canceling) setCancelConfirmOpen(false);
          }}
        >
          <div
            style={{
              ...cardStyle,
              maxWidth: "440px",
              margin: 0,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="cancel-claim-title"
              style={{ margin: "0 0 10px", fontSize: "18px", color: "#ffffff" }}
            >
              Cancel this claim request?
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#aaaaaa", lineHeight: 1.5 }}>
              Your request will be withdrawn and will no longer be reviewed.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(false)}
                disabled={canceling}
                style={secondaryButtonStyle}
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={() => void handleCancelClaim()}
                disabled={canceling}
                style={{
                  ...primaryButtonStyle,
                  opacity: canceling ? 0.6 : 1,
                  cursor: canceling ? "not-allowed" : "pointer",
                }}
              >
                {canceling ? "Cancelling…" : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
