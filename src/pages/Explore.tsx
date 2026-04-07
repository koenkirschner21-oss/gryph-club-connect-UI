import { useState, useMemo, useCallback } from "react";
import { useClubContext } from "../context/useClubContext";
import SearchBar from "../components/ui/SearchBar";
import ClubCard from "../components/ui/ClubCard";
import Spinner from "../components/ui/Spinner";
import type { Club } from "../types";

/** Pick a contrasting text class for an arbitrary hex background. */
function contrastText(hex: string | undefined): string {
  if (!hex) return "text-white";
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "text-accent" : "text-white";
}

/** Initials helper shared with SpotlightCard. */
function getInitials(club: Club): string {
  if (club.abbreviation) return club.abbreviation.slice(0, 3).toUpperCase();
  return club.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Spotlight card (horizontal, larger) ────────────────────────────────────
function SpotlightCard({ club }: { club: Club }) {
  const accent = club.brandColor ?? "var(--color-primary)";
  return (
    <a
      href={`/clubs/${club.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 sm:flex-row"
    >
      {/* Left accent */}
      <div
        className="flex w-full items-center justify-center p-6 sm:w-48 sm:flex-shrink-0"
        style={{ backgroundColor: accent }}
      >
        {club.logoUrl ? (
          <img
            src={club.logoUrl}
            alt=""
            className="h-20 w-20 rounded-xl object-cover shadow"
          />
        ) : (
          <span
            className={`text-3xl font-extrabold ${contrastText(club.brandColor)}`}
            aria-hidden="true"
          >
            {getInitials(club)}
          </span>
        )}
      </div>

      {/* Right content */}
      <div className="flex flex-1 flex-col justify-center p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-accent group-hover:text-primary transition-colors">
            {club.name}
          </h3>
          {club.isVerified && (
            <svg
              className="h-4 w-4 text-blue-500"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-label="Verified"
            >
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">
          {club.shortDescription || club.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
            {club.category}
          </span>
          {club.memberCount > 0 && (
            <span className="text-muted">{club.memberCount} members</span>
          )}
          {club.location && (
            <span className="text-muted">· {club.location}</span>
          )}
        </div>
      </div>
    </a>
  );
}

// ─── Main Explore page ──────────────────────────────────────────────────────
export default function Explore() {
  const { clubs, categories, loading, error } = useClubContext();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const hasActiveFilters = search !== "" || activeCategory !== "All";

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveCategory("All");
  }, []);

  // Derived lists
  const featuredClubs = useMemo(
    () => clubs.filter((c) => c.isFeatured),
    [clubs],
  );

  const spotlightClubs = useMemo(
    () => clubs.filter((c) => c.isVerified).slice(0, 3),
    [clubs],
  );

  const filteredClubs = useMemo(() => {
    const query = search.toLowerCase();
    return clubs.filter((club) => {
      const matchesCategory =
        activeCategory === "All" || club.category === activeCategory;

      const matchesSearch =
        query === "" ||
        club.name.toLowerCase().includes(query) ||
        club.description.toLowerCase().includes(query) ||
        (club.shortDescription ?? "").toLowerCase().includes(query) ||
        club.tags.some((tag) => tag.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [clubs, search, activeCategory]);

  /** Build a contextual message for the empty state. */
  const emptyStateMessage = useMemo(() => {
    if (search && activeCategory !== "All") {
      return {
        title: "No matching clubs",
        description: `No clubs match "${search}" in the ${activeCategory} category.`,
      };
    }
    if (search) {
      return {
        title: "No search results",
        description: `No clubs match "${search}". Try a different search term.`,
      };
    }
    if (activeCategory !== "All") {
      return {
        title: "No clubs in this category",
        description: `There are no clubs in the ${activeCategory} category yet.`,
      };
    }
    return {
      title: "No clubs available",
      description: "There are no clubs to display right now.",
    };
  }, [search, activeCategory]);

  return (
    <>
      {/* ──────────── Dark Hero Section ──────────── */}
      <section className="relative overflow-hidden bg-accent">
        <div className="hero-overlay absolute inset-0" aria-hidden="true" />
        {/* Decorative dots */}
        <div className="absolute inset-0 opacity-[0.04] hero-dots" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-secondary">
              University of Guelph
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Discover Your Club
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Browse {clubs.length > 0 ? `${clubs.length}+` : ""} student
              organizations — from academics and athletics to arts and culture.
              Find your people and get involved.
            </p>
          </div>

          {/* Search inside hero */}
          <div className="mt-8 max-w-xl">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search clubs by name, tag, or keyword…"
            />
          </div>

          {/* Quick stats */}
          {clubs.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-white/60">
              <span>
                <strong className="text-white">{clubs.length}</strong> clubs
              </span>
              <span>
                <strong className="text-white">{categories.length - 1}</strong>{" "}
                categories
              </span>
              {featuredClubs.length > 0 && (
                <span>
                  <strong className="text-white">{featuredClubs.length}</strong>{" "}
                  featured
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ──────────── Featured Clubs Ribbon ──────────── */}
      {!loading && featuredClubs.length > 0 && !hasActiveFilters && (
        <section className="border-b border-border bg-surface-alt/60">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-secondary"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h2 className="text-lg font-bold text-accent">Featured Clubs</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featuredClubs.map((club) => (
                <ClubCard key={club.id} club={club} variant="compact" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────── Spotlight Section ──────────── */}
      {!loading && spotlightClubs.length > 0 && !hasActiveFilters && (
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-primary"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="text-lg font-bold text-accent">
                Verified Spotlight
              </h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {spotlightClubs.map((club) => (
                <SpotlightCard key={club.id} club={club} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────── Filter Bar ──────────── */}
      <section className="sticky top-16 z-30 border-b border-border bg-surface/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`filter-chip ${
                    activeCategory === cat
                      ? "filter-chip-active"
                      : "filter-chip-inactive"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="self-start text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer sm:self-center"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ──────────── Main Results ──────────── */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-primary/20 bg-primary/8 px-4 py-3 text-sm font-medium text-primary"
          >
            ⚠️ Could not load clubs from the server. Please check your
            connection and try again.
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner label="Loading clubs…" />
          </div>
        ) : filteredClubs.length > 0 ? (
          <>
            {/* Result count */}
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-muted">
                Showing{" "}
                <span className="font-semibold text-accent">
                  {filteredClubs.length}
                </span>{" "}
                of {clubs.length} clubs
                {activeCategory !== "All" && (
                  <span className="ml-1">
                    in{" "}
                    <span className="font-medium text-primary">
                      {activeCategory}
                    </span>
                  </span>
                )}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="rounded-2xl border border-border bg-surface py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-alt">
              <svg
                className="h-8 w-8 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p className="mt-5 text-xl font-bold text-accent">
              {emptyStateMessage.title}
            </p>
            <p className="mt-2 text-sm text-muted">
              {emptyStateMessage.description}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
