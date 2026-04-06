import { Link } from "react-router-dom";
import type { Club } from "../../types";
import { useClubContext } from "../../context/useClubContext";
import Card from "./Card";

interface ClubCardProps {
  club: Club;
}

export default function ClubCard({ club }: ClubCardProps) {
  const { isSaved, toggleSaveClub, isJoined } = useClubContext();
  const saved = isSaved(club.id);
  const joined = isJoined(club.id);

  return (
    <Link to={`/explore/${club.id}`} className="block">
      <Card className="overflow-hidden">
        <div className="relative">
          <img
            src={club.imageUrl}
            alt={club.name}
            className="h-40 w-full object-cover bg-surface-alt"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSaveClub(club.id);
            }}
            aria-label={saved ? "Unsave club" : "Save club"}
            className="absolute right-2 top-2 rounded-full bg-white/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-white cursor-pointer"
          >
            <svg
              className={`h-5 w-5 transition-colors ${saved ? "fill-primary text-primary" : "fill-none text-muted"}`}
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
        <div className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {club.category}
            </span>
            {joined && (
              <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Joined
              </span>
            )}
            <span className="text-xs text-muted">
              {club.memberCount} members
            </span>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-accent">
            {club.name}
          </h3>
          <p className="line-clamp-2 text-sm text-muted">{club.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {club.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-surface-alt px-2 py-0.5 text-xs text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
}
