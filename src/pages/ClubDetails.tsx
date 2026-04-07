import { useParams, Link } from "react-router-dom";
import { useClubContext } from "../context/useClubContext";
import { normalizeTags } from "../lib/normalizeTags";
import { getClubInitials } from "../lib/clubUtils";
import { useAuthContext } from "../context/useAuthContext";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";

export default function ClubDetails() {
  const { slug } = useParams<{ slug: string }>();
  const {
    getClubBySlug,
    getClubById,
    loading,
    isJoined,
    joinClub,
    leaveClub,
    isSaved,
    toggleSaveClub,
  } = useClubContext();
  const { user } = useAuthContext();

  // Look up by slug first (primary), fall back to id for legacy /explore/:id links
  const club = getClubBySlug(slug ?? "") ?? getClubById(slug ?? "");
  const joined = club ? isJoined(club.id) : false;
  const saved = club ? isSaved(club.id) : false;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading club details…" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-alt">
          <svg
            className="h-10 w-10 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="mt-5 text-3xl font-bold text-accent">Club Not Found</h1>
        <p className="mt-3 text-muted">
          The club you&apos;re looking for doesn&apos;t exist or may have been
          removed.
        </p>
        <Link to="/explore" className="mt-6 inline-block">
          <Button>Back to Explore</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Hero Banner */}
      <div className="relative h-56 w-full overflow-hidden bg-accent sm:h-72 lg:h-80">
        <img
          src={club.bannerUrl ?? club.imageUrl}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-accent via-accent/60 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Club identity row — overlaps hero */}
        <div className="-mt-16 mb-8 flex flex-col gap-5 sm:-mt-20 sm:flex-row sm:items-end sm:gap-6">
          {/* Club avatar / logo */}
          <div className="relative z-10 flex-shrink-0">
            <div
              className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface shadow-lg sm:h-28 sm:w-28"
              style={{ backgroundColor: club.brandColor ?? "var(--color-primary)" }}
            >
              {club.logoUrl ? (
                <img
                  src={club.logoUrl}
                  alt={club.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-extrabold text-white sm:text-3xl" aria-hidden="true">
                  {getClubInitials(club)}
                </span>
              )}
            </div>
          </div>

          {/* Name + meta */}
          <div className="relative z-10 flex-1 pb-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white shadow">
                {club.category}
              </span>
              {club.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
              {joined && (
                <span className="inline-block rounded-full bg-green-600 px-3 py-0.5 text-xs font-semibold text-white shadow">
                  Joined
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-accent sm:text-3xl lg:text-4xl">
              {club.name}
            </h1>
            {/* Quick meta */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {club.memberCount > 0 && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 text-primary"
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
                  {club.memberCount} members
                </span>
              )}
              {club.location && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 text-primary"
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
                  {club.location}
                </span>
              )}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="relative z-10 flex flex-shrink-0 flex-wrap items-center gap-3">
            {user && joined && (
              <Link to={`/app/clubs/${club.id}`}>
                <Button size="lg" variant="secondary">
                  Open Workspace
                </Button>
              </Link>
            )}
            <button
              type="button"
              onClick={() => toggleSaveClub(club.id)}
              aria-label={saved ? "Unsave club" : "Save club"}
              className="rounded-lg border-2 border-border bg-surface p-2.5 transition-colors hover:bg-surface-alt cursor-pointer"
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

        {/* Breadcrumb */}
        <nav className="mb-7 text-sm text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span className="mx-2 text-border">/</span>
          <Link to="/explore" className="hover:text-primary transition-colors">
            Explore
          </Link>
          <span className="mx-2 text-border">/</span>
          <span className="font-medium text-accent">{club.name}</span>
        </nav>

        <div className="grid gap-8 pb-16 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Description */}
            <Card className="p-6">
              <h2 className="mb-3 text-lg font-bold text-accent">About</h2>
              <p className="leading-relaxed text-muted">{club.longDescription ?? club.description}</p>
              {club.shortDescription && club.longDescription && (
                <p className="mt-3 text-sm font-medium text-accent/70 italic">
                  {club.shortDescription}
                </p>
              )}
            </Card>

            {/* Events */}
            <div>
              <h2 className="mb-4 text-xl font-bold text-accent">
                Upcoming Events
              </h2>
              {club.events.length > 0 ? (
                <div className="space-y-4">
                  {club.events.map((event) => (
                    <Card key={event.id} className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Date badge */}
                        <div className="flex-shrink-0 rounded-xl bg-primary/10 px-3 py-2 text-center min-w-[3.5rem]">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {new Date(event.date).toLocaleDateString("en-US", {
                              month: "short",
                            })}
                          </p>
                          <p className="text-2xl font-extrabold leading-none text-primary">
                            {new Date(event.date).getDate()}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-accent">
                            {event.title}
                          </h3>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                            <span className="flex items-center gap-1">
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
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {event.time}
                            </span>
                            <span className="text-border">·</span>
                            <span className="flex items-center gap-1">
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
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                              </svg>
                              {event.location}
                            </span>
                          </p>
                          {event.description && (
                            <p className="mt-2 text-sm text-muted">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt">
                    <svg
                      className="h-6 w-6 text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="font-medium text-accent">No upcoming events</p>
                  <p className="mt-1 text-sm text-muted">
                    Check back soon for new events.
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Details Card */}
            <Card className="overflow-hidden">
              <div className="border-b border-border bg-surface-alt px-5 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                  Club Details
                </h3>
              </div>
              <dl className="divide-y divide-border">
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
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
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Members
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-accent">
                      {club.memberCount} members
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Meeting Schedule
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-accent">
                      {club.meetingSchedule}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
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
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Location
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-accent">
                      {club.location}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Contact
                    </dt>
                    <dd className="mt-0.5 text-sm">
                      <a
                        href={`mailto:${club.contactEmail}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {club.contactEmail}
                      </a>
                    </dd>
                  </div>
                </div>
              </dl>
            </Card>

            {/* Tags Card */}
            {normalizeTags(club.tags).length > 0 && (
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {normalizeTags(club.tags).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border bg-surface-alt px-2.5 py-1 text-xs font-medium text-muted"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Social Links Card */}
            {club.socialLinks && (
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Connect
                </h3>
                <div className="space-y-2.5">
                  {club.socialLinks.website && (
                    <a
                      href={club.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-accent transition-colors hover:border-primary hover:text-primary"
                    >
                      <svg
                        className="h-4 w-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-accent transition-colors hover:border-primary hover:text-primary"
                    >
                      <svg
                        className="h-4 w-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-accent transition-colors hover:border-primary hover:text-primary"
                    >
                      <svg
                        className="h-4 w-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
    </>
  );
}

