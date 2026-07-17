import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { useClubContext } from "../context/useClubContext";
import { supabase } from "../lib/supabaseClient";
import {
  CLAIM_ROLE_OPTIONS,
  canSubmitClubClaim,
  isClubClaimable,
  normalizeClaimStatus,
  resolveElevatedClaimStatus,
  resolveExploreClubClaimState,
  type ClaimRoleOption,
} from "../lib/clubClaimUtils";
import {
  notifyClaimRequestSubmitted,
  resolveStudentDisplayName,
} from "../lib/notifications";
import Spinner from "../components/ui/Spinner";
import PublicDetailBackButton from "../components/public/PublicDetailBackButton";
import { buildLoginPath, buildSignupPath } from "../lib/authRedirect";
import { darkInputStyle } from "./app/HiringBoardPage";

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
  border: "1px solid #333333",
  borderRadius: "8px",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

interface ClaimClubRow {
  id: string;
  name: string;
  slug: string;
  joinCode?: string;
  claimStatus: ReturnType<typeof normalizeClaimStatus>;
}

export default function ClubClaimPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuthContext();
  const { toggleSaveClub, isSaved } = useClubContext();

  const [club, setClub] = useState<ClaimClubRow | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [roleInClub, setRoleInClub] = useState<ClaimRoleOption>("President");
  const [message, setMessage] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeOwnerCount, setActiveOwnerCount] = useState(0);
  const [userPendingClaimId, setUserPendingClaimId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setPageLoading(false);
      return;
    }

    let cancelled = false;

    async function loadClub() {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, slug, join_code, claim_status")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setNotFound(true);
        setClub(null);
        setActiveOwnerCount(0);
        setUserPendingClaimId(null);
        setPageLoading(false);
        return;
      }

      const clubId = data.id as string;
      const baseClaimStatus = normalizeClaimStatus(data.claim_status);

      const [
        { count: ownerCount },
        pendingClaimCountResult,
        userPendingClaimResult,
      ] = await Promise.all([
        supabase
          .from("club_members")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("role", "owner")
          .eq("status", "active"),
        baseClaimStatus === "unclaimed"
          ? supabase
              .from("club_claim_requests")
              .select("id", { count: "exact", head: true })
              .eq("club_id", clubId)
              .in("status", ["pending", "more_info"])
          : Promise.resolve({ count: null }),
        user?.id
          ? supabase
              .from("club_claim_requests")
              .select("id")
              .eq("club_id", clubId)
              .eq("submitted_by", user.id)
              .in("status", ["pending", "more_info"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (cancelled) return;

      const hasOpenClubClaimRequests =
        baseClaimStatus === "claim_pending" ||
        (baseClaimStatus === "unclaimed" && (pendingClaimCountResult.count ?? 0) > 0);
      const userHasOpenClaimRequest = Boolean(userPendingClaimResult.data?.id);
      const elevatedClaimStatus = resolveElevatedClaimStatus(
        baseClaimStatus,
        hasOpenClubClaimRequests,
        userHasOpenClaimRequest,
      );

      setClub({
        id: clubId,
        name: (data.name as string) ?? "",
        slug: (data.slug as string) ?? slug,
        joinCode: (data.join_code as string) ?? undefined,
        claimStatus: elevatedClaimStatus,
      });
      setActiveOwnerCount(ownerCount ?? 0);
      setUserPendingClaimId((userPendingClaimResult.data?.id as string | undefined) ?? null);
      setNotFound(false);
      setPageLoading(false);
    }

    void loadClub();

    return () => {
      cancelled = true;
    };
  }, [slug, user?.id]);

  useEffect(() => {
    if (!user?.email) return;
    setContactEmail((prev) => prev || user.email || "");
  }, [user?.email]);

  const saved = club ? isSaved(club.id) : false;
  const ineligibleRole = !canSubmitClubClaim(roleInClub);

  function handleCopyInviteLink() {
    if (!club) return;
    const link = club.joinCode
      ? `${window.location.origin}/join/${club.joinCode}`
      : `${window.location.origin}/clubs/${club.slug}`;
    navigator.clipboard.writeText(link).then(
      () => {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 2000);
      },
      () => {
        setSubmitError("Failed to copy link.");
      },
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || !club || ineligibleRole) return;

    setSubmitting(true);
    setSubmitError(null);

    const { data: insertedClaim, error: insertError } = await supabase
      .from("club_claim_requests")
      .insert({
        club_id: club.id,
        submitted_by: user.id,
        role_in_club: roleInClub,
        message: message.trim() || null,
        proof_url: proofUrl.trim() || null,
        contact_email: contactEmail.trim() || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to submit claim request:", insertError.message);
      setSubmitError("Failed to submit claim request. Please try again.");
      setSubmitting(false);
      return;
    }

    const { error: clubError } = await supabase
      .from("clubs")
      .update({ claim_status: "claim_pending" })
      .eq("id", club.id)
      .eq("claim_status", "unclaimed");

    if (clubError) {
      console.error("Failed to update club claim status:", clubError.message);
    }

    const submitterName = resolveStudentDisplayName(
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
      user.email,
    );

    await notifyClaimRequestSubmitted(supabase, {
      clubId: club.id,
      clubName: club.name,
      clubSlug: club.slug,
      submitterName,
      submitterUserId: user.id,
      claimRequestId: insertedClaim?.id as string | undefined,
    });

    setSubmitted(true);
    setUserPendingClaimId((insertedClaim?.id as string | undefined) ?? null);
    setClub((prev) =>
      prev ? { ...prev, claimStatus: "claim_pending" } : prev,
    );
    setSubmitting(false);
  }

  function renderBlockedClaimState(
    title: string,
    body: string,
    action?: { label: string; to: string },
  ) {
    return (
      <div
        style={{
          background: PAGE_BG,
          minHeight: "calc(100vh - 64px)",
          padding: "32px 16px",
        }}
      >
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <PublicDetailBackButton fallbackTo={`/clubs/${club!.slug}`} />
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 8px",
            }}
          >
            {title}
          </h1>
          <div style={cardStyle}>
            <p style={{ fontSize: "15px", color: "#cccccc", margin: 0, lineHeight: 1.6 }}>
              {body}
            </p>
            {action ? (
              <Link
                to={action.to}
                className="inline-block rounded-lg px-5 py-2 text-sm font-semibold text-white"
                style={{
                  ...primaryButtonStyle,
                  display: "inline-block",
                  textDecoration: "none",
                  marginTop: "16px",
                }}
              >
                {action.label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || pageLoading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        style={{ background: PAGE_BG }}
      >
        <Spinner label="Loading claim page…" />
      </div>
    );
  }

  if (notFound || !club) {
    return (
      <div
        className="mx-auto max-w-7xl px-4 py-20 text-center"
        style={{ background: PAGE_BG, minHeight: "60vh" }}
      >
        <h1 className="text-3xl font-bold text-white">Club Not Found</h1>
        <p className="mt-3 text-[#777777]">
          The club you&apos;re looking for doesn&apos;t exist or may have been removed.
        </p>
        <Link
          to="/explore"
          className="mt-6 inline-block rounded-lg px-5 py-2 text-sm font-semibold text-white"
          style={{ background: ACCENT_RED }}
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  const claimReturnPath = `/clubs/${club.slug}/claim`;
  const loginRedirect = buildLoginPath(claimReturnPath);
  const signupRedirect = buildSignupPath(claimReturnPath);
  const claimable = isClubClaimable(club.claimStatus, activeOwnerCount);
  const claimState = resolveExploreClubClaimState(
    club.claimStatus,
    activeOwnerCount,
    club.claimStatus === "claim_pending",
    Boolean(userPendingClaimId) || submitted,
  );
  const pendingClaimId = userPendingClaimId;

  if (claimState === "user_pending") {
    return renderBlockedClaimState(
      club.name,
      submitted
        ? "Claim request submitted. We'll review your request and notify you once approved."
        : "Your claim request is under review. You can check its status anytime.",
      pendingClaimId
        ? { label: "View Claim Status", to: `/claim-status/${pendingClaimId}` }
        : undefined,
    );
  }

  if (claimState === "pending") {
    return renderBlockedClaimState(
      club.name,
      "A claim request is pending review for this club. Check back later if you believe you should manage this club.",
      { label: "View Club Profile", to: `/clubs/${club.slug}` },
    );
  }

  if (claimState === "claimed" || !claimable) {
    return renderBlockedClaimState(
      club.name,
      "This club has already been claimed and is managed by its executive team.",
      { label: "View Club Profile", to: `/clubs/${club.slug}` },
    );
  }

  return (
    <div
      style={{
        background: PAGE_BG,
        minHeight: "calc(100vh - 64px)",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <PublicDetailBackButton fallbackTo={`/clubs/${club.slug}`} />

        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 8px",
          }}
        >
          Claim {club.name}
        </h1>
        <p style={{ fontSize: "14px", color: "#777777", margin: "0 0 24px" }}>
          Submit a claim request if you are a president or executive who should manage this club.
        </p>

        {!user ? (
          <div style={cardStyle}>
            <p style={{ fontSize: "15px", color: "#cccccc", margin: "0 0 16px" }}>
              Sign in to claim this club. You&apos;ll return here after authentication.
              Anonymous users cannot submit a claim.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <Link
                to={loginRedirect}
                style={{ ...primaryButtonStyle, display: "inline-block", textDecoration: "none" }}
              >
                Sign In
              </Link>
              <Link
                to={signupRedirect}
                style={{ ...secondaryButtonStyle, display: "inline-block", textDecoration: "none" }}
              >
                Sign Up
              </Link>
            </div>
          </div>
        ) : ineligibleRole ? (
          <div style={cardStyle}>
            <p style={{ fontSize: "15px", color: "#cccccc", margin: "0 0 20px", lineHeight: 1.6 }}>
              Only a President, Co-President, or executive can claim this club.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                onClick={() => toggleSaveClub(club.id)}
                style={secondaryButtonStyle}
              >
                {saved ? "Saved" : "Save Club"}
              </button>
              <button type="button" onClick={handleCopyInviteLink} style={secondaryButtonStyle}>
                {copiedLink ? "Copied!" : "Copy Invite Link"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} style={cardStyle}>
            <label
              htmlFor="claim-role"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                marginBottom: "8px",
              }}
            >
              What is your role in this club?
            </label>
            <select
              id="claim-role"
              value={roleInClub}
              onChange={(event) =>
                setRoleInClub(event.target.value as ClaimRoleOption)
              }
              style={{ ...darkInputStyle, width: "100%", marginBottom: "16px" }}
            >
              {CLAIM_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label
              htmlFor="claim-message"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                marginBottom: "8px",
              }}
            >
              Message (optional)
            </label>
            <textarea
              id="claim-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Tell us why you should manage this club."
              style={{
                ...darkInputStyle,
                width: "100%",
                resize: "vertical",
                marginBottom: "16px",
              }}
            />

            <label
              htmlFor="claim-proof"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                marginBottom: "8px",
              }}
            >
              Proof URL (optional)
            </label>
            <input
              id="claim-proof"
              type="url"
              value={proofUrl}
              onChange={(event) => setProofUrl(event.target.value)}
              placeholder="https://..."
              style={{ ...darkInputStyle, width: "100%", marginBottom: "16px" }}
            />

            <label
              htmlFor="claim-email"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                marginBottom: "8px",
              }}
            >
              Contact email (optional)
            </label>
            <input
              id="claim-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="you@uoguelph.ca"
              style={{ ...darkInputStyle, width: "100%", marginBottom: "20px" }}
            />

            {submitError ? (
              <p role="alert" style={{ color: ACCENT_RED, fontSize: "13px", margin: "0 0 12px" }}>
                {submitError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              style={{
                ...primaryButtonStyle,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              {submitting ? "Submitting…" : "Submit Claim Request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
