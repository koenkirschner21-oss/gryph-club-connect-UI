import { Link } from "react-router-dom";
import type { Club } from "../../types";
import { normalizeTags } from "../../lib/normalizeTags";
import { getClubInitials } from "../../lib/clubUtils";
import { useClubContext } from "../../context/useClubContext";

interface ClubCardProps {
  club: Club;
  /** When true, renders a wider horizontal layout for spotlight/featured sections. */
  variant?: "default" | "compact";
}

export default function ClubCard({ club, variant = "default" }: ClubCardProps) {
  const { isSaved, toggleSaveClub, isJoined } = useClubContext();
  const saved = isSaved(club.id);
  const joined = isJoined(club.id);

  const accent = club.brandColor ?? "var(--color-primary)";
  const displayDescription = club.shortDescription || club.description;
  const tags = normalizeTags(club.tags);

  return (
    <Link to={`/clubs/${club.slug}`} className="group block focus:outline-none">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-md transition-all duration-200 group-hover:shadow-xl group-hover:-translate-y-1 group-hover:border-border/80 group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-page-bg">
        {/* Accent top bar */}
        <div className="h-1 w-full" style={{ backgroundColor: accent }} />

        {/* Card body */}
        <div className={`flex flex-1 flex-col ${variant === "compact" ? "p-5" : "p-6"}`}>
          {/* Top row: logo/initials + meta */}
          <div className="mb-4 flex items-start gap-4">
            {/* Logo or initials */}
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              {club.logoUrl ? (
                <img
                  src={club.logoUrl}
                  alt=""
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <span aria-hidden="true">{getClubInitials(club)}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* Name + verified */}
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-base font-bold leading-snug text-text-primary group-hover:text-primary-light transition-colors">
                  {club.name}
                </h3>
                {club.isVerified && (
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-blue-400"
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
              <div className="mt-1 flex items-center gap-2.5 text-xs">
                <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 font-semibold text-primary-light">
                  {club.category}
                </span>
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
              className="flex-shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-overlay hover:text-primary-light cursor-pointer"
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
          <p className="line-clamp-2 text-sm leading-relaxed text-text-secondary flex-1">
            {displayDescription}
          </p>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-muted"
                >
                  #{tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="rounded-md bg-surface-alt px-2 py-0.5 text-xs text-muted">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Bottom row: location + badges */}
          <div className="mt-4 flex items-center justify-between">
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
