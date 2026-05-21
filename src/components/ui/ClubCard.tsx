import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Club } from "../../types";
import { normalizeTags } from "../../lib/normalizeTags";
import { getClubInitials } from "../../lib/clubUtils";
import { useClubContext } from "../../context/useClubContext";

interface ClubCardProps {
  club: Club;
  /** When true, renders a wider horizontal layout for spotlight/featured sections. */
  variant?: "default" | "compact" | "explore";
}

const EXPLORE_RED = "#E51937";

const CARD_SURFACE = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #242424",
  borderTop: "2px solid #E51937",
  borderRadius: "10px",
  transition: "box-shadow 0.15s ease, border-color 0.15s ease",
} as const;

const AVATAR_STYLE: CSSProperties = {
  backgroundColor: "#2a2a2a",
  color: "#888888",
  border: "1px solid #333",
  borderRadius: "8px",
};

const CATEGORY_BADGE_STYLE: CSSProperties = {
  backgroundColor: "#111111",
  color: "#747676",
  border: "1px solid #222222",
  borderRadius: "20px",
  padding: "3px 12px",
  fontSize: "11px",
};

export default function ClubCard({
  club,
  variant = "default",
}: ClubCardProps) {
  const { isSaved, toggleSaveClub, isJoined } = useClubContext();
  const saved = isSaved(club.id);
  const joined = isJoined(club.id);

  const displayDescription = club.shortDescription || club.description;
  const tags = normalizeTags(club.tags);

  if (variant === "explore") {
    return (
      <Link to={`/clubs/${club.slug}`} className="group block h-full focus:outline-none">
        <div
          className="h-full group-hover:border-[#333333] group-hover:shadow-[0_0_0_1px_#2a2a2a]"
          style={{
            ...CARD_SURFACE,
            padding: "16px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div
              style={{
                ...AVATAR_STYLE,
                width: "40px",
                height: "40px",
                fontSize: "14px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {club.logoUrl ? (
                <img
                  src={club.logoUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "8px",
                  }}
                />
              ) : (
                <span aria-hidden="true">{getClubInitials(club)}</span>
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h3
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "#ffffff",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                  className="line-clamp-2"
                >
                  {club.name}
                </h3>
                {club.isVerified && (
                  <svg
                    style={{ width: 16, height: 16, flexShrink: 0, color: EXPLORE_RED }}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-label="Verified club"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={CATEGORY_BADGE_STYLE}>{club.category}</span>
                {club.memberCount > 0 && (
                  <span style={{ fontSize: "11px", color: "#555555" }}>
                    {club.memberCount} members
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSaveClub(club.id);
              }}
              aria-label={saved ? "Unsave club" : "Save club"}
              className="flex-shrink-0 cursor-pointer rounded-full p-1.5 transition-colors hover:text-[#FFC429]"
              style={{ color: "#555555", background: "transparent", border: "none" }}
            >
              <svg
                className="h-4 w-4"
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
          </div>

          <p
            className="line-clamp-2"
            style={{
              fontSize: "12px",
              color: "#555555",
              lineHeight: 1.5,
              marginTop: "12px",
              marginBottom: 0,
              flex: 1,
            }}
          >
            {displayDescription}
          </p>

          {joined && (
            <span
              style={{
                marginTop: "10px",
                alignSelf: "flex-start",
                fontSize: "11px",
                color: "#4ade80",
              }}
            >
              Joined
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/clubs/${club.slug}`} className="group block h-full focus:outline-none">
      <div
        className="relative flex h-full flex-col overflow-hidden group-hover:border-[#333333] group-hover:shadow-[0_0_0_1px_#2a2a2a] group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-page-bg"
        style={CARD_SURFACE}
      >
        <div className={`flex flex-1 flex-col ${variant === "compact" ? "p-5" : "p-6"}`}>
          {/* Top row: logo/initials + meta */}
          <div className="mb-5 flex items-start gap-4">
            {/* Logo or initials */}
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center text-sm font-semibold"
              style={AVATAR_STYLE}
            >
              {club.logoUrl ? (
                <img
                  src={club.logoUrl}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <span aria-hidden="true">{getClubInitials(club)}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* Name + verified */}
              <div className="flex items-center gap-1.5">
                <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white transition-colors group-hover:text-primary-light">
                  {club.name}
                </h3>
                {club.isVerified && (
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-secondary"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-label="Verified club"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Category + member count */}
              <div className="mt-2 flex items-center gap-2.5 text-xs">
                <span style={CATEGORY_BADGE_STYLE}>{club.category}</span>
                {club.memberCount > 0 && (
                  <span className="flex items-center gap-1 text-muted">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {club.memberCount}
                  </span>
                )}
              </div>
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSaveClub(club.id);
              }}
              aria-label={saved ? "Unsave club" : "Save club"}
              className="flex-shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-primary-light cursor-pointer"
            >
              <svg
                className={`h-4 w-4 transition-colors ${saved ? "fill-primary text-primary" : "fill-none"}`}
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
          </div>

          {/* Description */}
          <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted/80">
            {displayDescription}
          </p>

          {/* Tags — limited to 2 visible + "+N" */}
          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-muted"
                >
                  #{tag}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="rounded-md bg-surface-alt px-2 py-0.5 text-xs text-muted">
                  +{tags.length - 2}
                </span>
              )}
            </div>
          )}

          {/* Bottom row: location + badges */}
          <div className="mt-5 flex items-center justify-between">
            {club.location ? (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="truncate">{club.location}</span>
              </div>
            ) : (
              <span />
            )}

            {joined && (
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                Joined
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
