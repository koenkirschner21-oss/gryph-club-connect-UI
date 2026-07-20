import {
  useState,
  useRef,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { isUploadedClubBanner, getClubInitials } from "../../lib/clubUtils";
import type { ExploreClubClaimState } from "../../lib/clubClaimUtils";
import type { Club } from "../../types";
import { useClubContext } from "../../context/useClubContext";
import { showToast } from "./Toast";
import { useAuthContext } from "../../context/useAuthContext";

const ACCENT_RED = "#E51937";

const exploreDescriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: "13px",
  color: "#999999",
  lineHeight: 1.5,
};

const EXPLORE_DESCRIPTION_MAX_LINES = 2;

function measureExploreDescription(
  measureEl: HTMLParagraphElement,
  description: string,
  maxLines: number,
): { text: string; truncated: boolean } {
  measureEl.textContent = description;
  const lineHeight = parseFloat(getComputedStyle(measureEl).lineHeight) || 19.5;
  const maxHeight = lineHeight * maxLines + 1;

  if (measureEl.scrollHeight <= maxHeight) {
    return { text: description, truncated: false };
  }

  let lo = 0;
  let hi = description.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const prefix = description.slice(0, mid).trimEnd();
    measureEl.textContent = "";
    measureEl.append(`${prefix}… `);
    const readMoreSpan = document.createElement("span");
    readMoreSpan.textContent = "Read more";
    measureEl.append(readMoreSpan);

    if (measureEl.scrollHeight <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    text: description.slice(0, best).trimEnd(),
    truncated: true,
  };
}

const claimBadgeStyle = (tone: "available" | "pending"): CSSProperties => ({
  background: tone === "available" ? "#1a1a1a" : "#1a1500",
  border: `1px solid ${tone === "available" ? "#333333" : "#3a3010"}`,
  color: tone === "available" ? "#cccccc" : "#FFC429",
  borderRadius: "4px",
  padding: "2px 8px",
  fontSize: "10px",
  fontWeight: 600,
  display: "inline-block",
});

function ExploreCardFooter({
  club,
  joined,
  claimFocused,
  claimState,
  userManagesClub,
}: {
  club: Club;
  joined: boolean;
  claimFocused: boolean;
  claimState: ExploreClubClaimState;
  userManagesClub: boolean;
}) {
  if (claimFocused && claimState === "loading") {
    return (
      <div
        style={{
          marginTop: "auto",
          paddingTop: "10px",
          borderTop: "1px solid #1e1e1e",
        }}
        aria-hidden="true"
      >
        <div
          style={{
            height: "10px",
            width: "72%",
            borderRadius: "4px",
            background: "#2a2a2a",
            marginBottom: "10px",
          }}
        />
        <div
          style={{
            height: "34px",
            width: "100%",
            borderRadius: "6px",
            background: "#222222",
          }}
        />
      </div>
    );
  }

  if (claimFocused && claimState === "claimable") {
    return (
      <div
        style={{
          marginTop: "auto",
          paddingTop: "10px",
          borderTop: "1px solid #1e1e1e",
          display: "flex",
          gap: "8px",
        }}
      >
        <Link
          to={`/clubs/${club.slug}/claim`}
          onClick={(event) => event.stopPropagation()}
          style={{
            flex: 1,
            textAlign: "center",
            background: ACCENT_RED,
            color: "#ffffff",
            borderRadius: "6px",
            padding: "8px 10px",
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Claim Club
        </Link>
        <Link
          to={`/clubs/${club.slug}`}
          onClick={(event) => event.stopPropagation()}
          style={{
            flex: 1,
            textAlign: "center",
            background: "transparent",
            color: "#ffffff",
            border: "1px solid #333333",
            borderRadius: "6px",
            padding: "8px 10px",
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          View Club
        </Link>
      </div>
    );
  }

  if (claimFocused && claimState === "user_pending") {
    return (
      <div
        style={{
          marginTop: "auto",
          paddingTop: "10px",
          borderTop: "1px solid #1e1e1e",
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#888888", lineHeight: 1.4 }}>
          Your claim is under review
        </p>
        <Link
          to={`/clubs/${club.slug}`}
          onClick={(event) => event.stopPropagation()}
          style={{
            display: "block",
            textAlign: "center",
            background: "transparent",
            color: "#ffffff",
            border: "1px solid #333333",
            borderRadius: "6px",
            padding: "8px 10px",
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          View Club
        </Link>
      </div>
    );
  }

  if (claimFocused && claimState === "pending") {
    return (
      <div
        style={{
          marginTop: "auto",
          paddingTop: "10px",
          borderTop: "1px solid #1e1e1e",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <span style={{ color: "#ffffff", fontSize: "12px", fontWeight: 500 }}>
          View Club →
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: "10px",
        borderTop: "1px solid #1e1e1e",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {userManagesClub ? (
          <span style={{ color: "#FFC429", fontSize: "12px", fontWeight: 600 }}>
            Managed by Me
          </span>
        ) : joined ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <Check size={12} strokeWidth={2.5} aria-hidden />
            Joined
          </span>
        ) : null}
      </div>
      <span
        style={{
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {userManagesClub ? "Open Workspace →" : "View Club →"}
      </span>
    </div>
  );
}

export default function ExploreClubCard({
  club,
  joined,
  claimState,
  userManagesClub = false,
  claimFocused = false,
}: {
  club: Club;
  joined: boolean;
  claimState: ExploreClubClaimState;
  userManagesClub?: boolean;
  claimFocused?: boolean;
}) {
  const { user } = useAuthContext();
  const { isSaved, toggleSaveClub } = useClubContext();
  const saved = isSaved(club.id);
  const [hovered, setHovered] = useState(false);
  const [descriptionPreview, setDescriptionPreview] = useState<{
    text: string;
    truncated: boolean;
  }>({ text: "", truncated: false });
  const descriptionContainerRef = useRef<HTMLDivElement>(null);
  const descriptionMeasureRef = useRef<HTMLParagraphElement>(null);
  const description = (club.shortDescription || club.description)?.trim();
  const bannerUrl = club.bannerUrl?.trim();
  const showBannerImage = isUploadedClubBanner(bannerUrl);
  const isClaimable = claimState === "claimable";
  const isClaimLoading = claimState === "loading";
  const useClaimActions = claimFocused && (isClaimable || claimState === "user_pending");
  const showClaimBadge =
    claimFocused &&
    (claimState === "claimable" ||
      claimState === "pending" ||
      claimState === "user_pending");
  const showClaimLoadingBadge = claimFocused && isClaimLoading;
  const cardHeight = claimFocused && isClaimable ? "340px" : "320px";
  const contentHeight = claimFocused && isClaimable ? "200px" : "180px";
  const workspaceHref = `/app/clubs/${club.id}`;
  const cardLinkTarget = userManagesClub ? workspaceHref : `/clubs/${club.slug}`;

  useLayoutEffect(() => {
    const container = descriptionContainerRef.current;
    const measure = descriptionMeasureRef.current;

    if (!description) {
      setDescriptionPreview({ text: "", truncated: false });
      return;
    }

    if (!container || !measure) return;

    function updatePreview() {
      if (!container || !measure) return;
      measure.style.width = `${container.clientWidth}px`;
      setDescriptionPreview(
        measureExploreDescription(
          measure,
          description,
          claimFocused && isClaimable ? 1 : EXPLORE_DESCRIPTION_MAX_LINES,
        ),
      );
    }

    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(container);
    return () => observer.disconnect();
  }, [description, claimFocused, isClaimable]);

  const article = (
    <article
      style={{
        width: "100%",
        minWidth: 0,
        height: cardHeight,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#1a1a1a",
        border: `1px solid ${hovered ? "#333333" : "#242424"}`,
        borderRadius: "12px",
        transition: "all 0.15s ease",
        transform: hovered ? "translateY(-2px)" : undefined,
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.4)" : undefined,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: "140px",
          flexShrink: 0,
          overflow: "hidden",
          width: "100%",
          position: "relative",
          background: "#0f0f0f",
        }}
      >
        {showBannerImage ? (
          <img
            src={bannerUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center center",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: isClaimable
                ? "linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)"
                : "linear-gradient(135deg, #141414 0%, #0f0f0f 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 16px",
              boxSizing: "border-box",
            }}
            aria-hidden="true"
          >
            <span
              style={{
                fontSize: isClaimable ? "28px" : "13px",
                fontWeight: 700,
                color: isClaimable ? "#666666" : "#ffffff",
                textAlign: "center",
                lineHeight: 1.35,
                letterSpacing: isClaimable ? "0.06em" : undefined,
                display: isClaimable ? "block" : "-webkit-box",
                WebkitLineClamp: isClaimable ? undefined : 3,
                WebkitBoxOrient: isClaimable ? undefined : "vertical",
                overflow: isClaimable ? undefined : "hidden",
              }}
            >
              {isClaimable ? getClubInitials(club) : club.name}
            </span>
          </div>
        )}
        {user ? (
          <button
            type="button"
            aria-label={saved ? "Unsave club" : "Save club"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const result = toggleSaveClub(club.id);
              if (result === true) showToast("Club saved", "success");
              if (result === false) {
                showToast("Club removed from saved clubs", "info");
              }
            }}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              width: "32px",
              height: "32px",
              borderRadius: "999px",
              border: "1px solid #333333",
              background: "rgba(15,15,15,0.85)",
              color: saved ? "#FFC429" : "#cccccc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            <svg
              width="16"
              height="16"
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <div
        style={{
          height: contentHeight,
          padding: "16px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 700,
            color: "#ffffff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {club.name}
        </h3>

        {description ? (
          <div ref={descriptionContainerRef} style={{ minWidth: 0, position: "relative" }}>
            <p
              ref={descriptionMeasureRef}
              aria-hidden
              style={{
                ...exploreDescriptionStyle,
                position: "absolute",
                visibility: "hidden",
                pointerEvents: "none",
                height: "auto",
                width: "100%",
                margin: 0,
                zIndex: -1,
              }}
            />
            <p style={exploreDescriptionStyle}>
              {descriptionPreview.text}
              {descriptionPreview.truncated ? (
                <>
                  …{" "}
                  <span style={{ color: ACCENT_RED, fontWeight: 500 }}>
                    Read more
                  </span>
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "#555555",
              lineHeight: 1.5,
            }}
          >
            No description available
          </p>
        )}

        {showClaimLoadingBadge ? (
          <div style={{ marginTop: "8px" }} aria-hidden="true">
            <span
              style={{
                display: "inline-block",
                width: "112px",
                height: "18px",
                borderRadius: "4px",
                background: "#2a2a2a",
              }}
            />
          </div>
        ) : showClaimBadge ? (
          <div style={{ marginTop: "8px" }}>
            <span
              style={claimBadgeStyle(
                claimState === "claimable" ? "available" : "pending",
              )}
            >
              {claimState === "claimable"
                ? "Available to claim"
                : "Claim Pending"}
            </span>
          </div>
        ) : null}

        {club.category ? (
          <div style={{ marginTop: showClaimBadge || showClaimLoadingBadge ? "6px" : "8px" }}>
            <span
              style={{
                background: "#1a1a1a",
                border: "1px solid #333333",
                color: "#666666",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "10px",
                fontWeight: 500,
                textTransform: "uppercase",
                display: "inline-block",
              }}
            >
              {club.category}
            </span>
          </div>
        ) : null}

        <ExploreCardFooter
          club={club}
          joined={joined}
          claimFocused={claimFocused}
          claimState={claimState}
          userManagesClub={userManagesClub}
        />
      </div>
    </article>
  );

  if (useClaimActions) {
    return (
      <div
        className="block"
        style={{
          width: "100%",
          minWidth: 0,
          display: "block",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {article}
      </div>
    );
  }

  return (
    <Link
      to={cardLinkTarget}
      className="block no-underline"
      style={{
        cursor: "pointer",
        width: "100%",
        minWidth: 0,
        display: "block",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {article}
    </Link>
  );
}
