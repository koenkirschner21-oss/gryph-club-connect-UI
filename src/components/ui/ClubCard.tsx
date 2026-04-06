import { Link } from "react-router-dom";
import type { Club } from "../../types";
import Card from "./Card";

interface ClubCardProps {
  club: Club;
}

export default function ClubCard({ club }: ClubCardProps) {
  return (
    <Link to={`/explore/${club.id}`} className="block">
      <Card className="overflow-hidden">
        <img
          src={club.imageUrl}
          alt={club.name}
          className="h-40 w-full object-cover bg-surface-alt"
        />
        <div className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {club.category}
            </span>
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
