import { Link } from "react-router-dom";
import type { Club } from "../../types";
import { useClubContext } from "../../context/useClubContext";

interface ClubCardProps {
  club: Club;
}

export default function ClubCard({ club }: ClubCardProps) {
  const { isSaved, toggleSaveClub, isJoined } = useClubContext();
  const saved = isSaved(club.id);
  const joined = isJoined(club.id);

  return (
    <Link to={`/clubs/${club.slug}`} className="group block focus:outline-none">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow duration-200 group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2">
        {/* Cover image */}
        <div className="relative overflow-hidden">
          <img
            src={club.imageUrl}
            alt={club.name}
            className="club-img-ratio bg-surface-alt transition-transform duration-300 group-hover:scale-105"
          />
          {/* Save button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSaveClub(club.id);
            }}
            aria-label={saved ? "Unsave club" : "Save club"}
            className="absolute right-3 top-3 rounded-full bg-white/85 p-2 shadow backdrop-blur-sm transition-colors hover:bg-white cursor-pointer"
          >
            <svg
              className={`h-4 w-4 transition-colors ${saved ? "fill-primary text-primary" : "fill-none text-muted"}`}
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
          {/* Joined badge */}
          {joined && (
            <span className="absolute left-3 top-3 rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow">
              Joined
            </span>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-1 flex-col p-5">
          {/* Category + members row */}
          <div className="mb-2.5 flex items-center gap-2">
            <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {club.category}
            </span>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted">
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
          </div>

          {/* Name */}
          <h3 className="mb-1.5 text-base font-bold leading-snug text-accent group-hover:text-primary transition-colors">
            {club.name}
          </h3>

          {/* Description */}
          <p className="line-clamp-2 text-sm leading-relaxed text-muted flex-1">
            {club.description}
          </p>

          {/* Tags */}
          {club.tags.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {club.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-muted"
                >
                  #{tag}
                </span>
              ))}
              {club.tags.length > 3 && (
                <span className="rounded-md bg-surface-alt px-2 py-0.5 text-xs text-muted">
                  +{club.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Location */}
          {club.location && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
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
          )}
        </div>
      </div>
    </Link>
  );
}

