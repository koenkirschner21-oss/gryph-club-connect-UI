import { useParams, Link } from "react-router-dom";
import { getClubById } from "../data/clubs";
import { useClubContext } from "../context/useClubContext";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

export default function ClubDetails() {
  const { clubId } = useParams<{ clubId: string }>();
  const club = getClubById(clubId ?? "");
  const { isJoined, joinClub, leaveClub, isSaved, toggleSaveClub } =
    useClubContext();

  const joined = club ? isJoined(club.id) : false;
  const saved = club ? isSaved(club.id) : false;

  if (!club) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-accent">Club Not Found</h1>
        <p className="mt-4 text-muted">
          The club you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link to="/explore" className="mt-6 inline-block">
          <Button>Back to Explore</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/explore" className="hover:text-primary">
          Explore
        </Link>
        <span className="mx-2">/</span>
        <span className="text-accent">{club.name}</span>
      </nav>

      {/* Club Header */}
      <div className="mb-10 overflow-hidden rounded-xl border border-border bg-surface">
        <img
          src={club.imageUrl}
          alt={club.name}
          className="h-48 w-full bg-surface-alt object-cover sm:h-64"
        />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {club.category}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-accent sm:text-3xl">
                {club.name}
              </h1>
              <p className="mt-3 max-w-2xl text-muted">{club.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleSaveClub(club.id)}
                aria-label={saved ? "Unsave club" : "Save club"}
                className="rounded-lg border border-border p-2.5 transition-colors hover:bg-surface-alt cursor-pointer"
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
              <Button
                size="lg"
                variant={joined ? "outline" : "primary"}
                onClick={() =>
                  joined ? leaveClub(club.id) : joinClub(club.id)
                }
              >
                {joined ? "Leave Club" : "Join Club"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Events */}
          <h2 className="mb-4 text-xl font-bold text-accent">
            Upcoming Events
          </h2>
          {club.events.length > 0 ? (
            <div className="space-y-4">
              {club.events.map((event) => (
                <Card key={event.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3 text-center">
                      <p className="text-xs font-medium text-primary">
                        {new Date(event.date).toLocaleDateString("en-US", {
                          month: "short",
                        })}
                      </p>
                      <p className="text-xl font-bold text-primary">
                        {new Date(event.date).getDate()}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-accent">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        {event.time} &middot; {event.location}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        {event.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted">No upcoming events scheduled.</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <Card className="p-5">
            <h3 className="mb-4 text-lg font-semibold text-accent">
              Club Details
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                  Members
                </dt>
                <dd className="mt-0.5 text-sm text-accent">
                  {club.memberCount} members
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                  Meeting Schedule
                </dt>
                <dd className="mt-0.5 text-sm text-accent">
                  {club.meetingSchedule}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                  Location
                </dt>
                <dd className="mt-0.5 text-sm text-accent">{club.location}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted">
                  Contact
                </dt>
                <dd className="mt-0.5 text-sm">
                  <a
                    href={`mailto:${club.contactEmail}`}
                    className="text-primary hover:underline"
                  >
                    {club.contactEmail}
                  </a>
                </dd>
              </div>
            </dl>
          </Card>

          {/* Tags Card */}
          <Card className="p-5">
            <h3 className="mb-3 text-lg font-semibold text-accent">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {club.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-surface-alt px-3 py-1 text-sm text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Card>

          {/* Social Links Card */}
          {club.socialLinks && (
            <Card className="p-5">
              <h3 className="mb-3 text-lg font-semibold text-accent">
                Connect
              </h3>
              <div className="space-y-2">
                {club.socialLinks.website && (
                  <a
                    href={club.socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                    Website
                  </a>
                )}
                {club.socialLinks.instagram && (
                  <a
                    href={club.socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                    Instagram
                  </a>
                )}
                {club.socialLinks.discord && (
                  <a
                    href={club.socialLinks.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                    </svg>
                    Discord
                  </a>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
