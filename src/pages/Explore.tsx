import { useState, useMemo, useCallback } from "react";
import { useClubContext } from "../context/useClubContext";
import { normalizeTags } from "../lib/normalizeTags";
import { getClubInitials } from "../lib/clubUtils";
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
  return lum > 0.6 ? "text-black" : "text-white";
}

// ─── Spotlight card (horizontal, larger) ────────────────────────────────────
function SpotlightCard({ club }: { club: Club }) {
  const accent = club.brandColor ?? "var(--color-primary)";
  return (
    <a
      href={`/clubs/${club.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card card-glow-hover hover:border-border-light sm:flex-row"
    >
      {/* Left accent */}
      <div
        className="flex w-full items-center justify-center p-8 sm:w-52 sm:flex-shrink-0"
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
            {getClubInitials(club)}
          </span>
        )}
      </div>

      {/* Right content */}
      <div className="flex flex-1 flex-col justify-center p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white group-hover:text-primary-light transition-colors">
            {club.name}
          </h3>
          {club.isVerified && (
            <svg
              className="h-4 w-4 text-secondary"
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
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {club.shortDescription || club.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-semibold text-primary-light">
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
        normalizeTags(club.tags).some((tag) => tag.toLowerCase().includes(query));

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
      {/* ──────────── Hero Section ──────────── */}
      <section className="relative overflow-hidden bg-page-bg">
        {/* Layered warm gradient */}
        <div className="hero-overlay absolute inset-0" aria-hidden="true" />
        <div className="hero-glow absolute inset-0" aria-hidden="true" />
        <div className="hero-focal-glow absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-36">
          <div className="flex items-center gap-12 lg:gap-16">
            {/* Left: text content */}
            <div className="max-w-3xl flex-1">
              <div className="mb-5 flex items-center gap-3">
                <img
                  src="/assets/gryphon-logo.svg"
                  alt=""
                  className="h-12 w-12"
                  aria-hidden="true"
                />
                <span className="text-sm font-bold uppercase tracking-[0.15em] text-secondary">
                  Gryph Club Connect
                </span>
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.05]">
                <span className="text-white/80">Discover Your</span>{" "}
                <span className="text-primary">Club</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Browse {clubs.length > 0 ? `${clubs.length}` : ""} student
                organizations — from academics and athletics to arts and culture.
                Find your people and get involved.
              </p>
            </div>

            {/* Right: visual anchor — decorative blurred panel */}
            <div className="hidden flex-shrink-0 lg:block" aria-hidden="true">
              <div className="relative w-64 xl:w-72">
                <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl" />
                <div className="relative rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-sm shadow-elevated">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/20" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-20 rounded-full bg-white/15" />
                      <div className="h-2 w-14 rounded-full bg-white/8" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full rounded-full bg-white/8" />
                    <div className="h-2 w-5/6 rounded-full bg-white/6" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <div className="h-5 w-14 rounded-full bg-primary/15" />
                    <div className="h-5 w-10 rounded-full bg-secondary/10" />
                  </div>
                </div>
                <div className="relative -mt-1.5 ml-3 rounded-2xl border border-border/40 bg-surface-alt/60 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-secondary/15" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-16 rounded-full bg-white/12" />
                      <div className="h-1.5 w-12 rounded-full bg-white/6" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search bar — more prominent */}
          <div className="mt-10 max-w-2xl">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search clubs by name, tag, or keyword…"
            />
          </div>

          {/* Quick stats */}
          {clubs.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-8 text-sm">
              <span className="text-muted">
                <strong className="text-2xl font-bold text-white">{clubs.length}</strong>{" "}
                <span className="ml-1">clubs</span>
              </span>
              <span className="text-muted">
                <strong className="text-2xl font-bold text-white">{categories.length - 1}</strong>{" "}
                <span className="ml-1">categories</span>
              </span>
              {featuredClubs.length > 0 && (
                <span className="text-muted">
                  <strong className="text-2xl font-bold text-white">{featuredClubs.length}</strong>{" "}
                  <span className="ml-1">featured</span>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ──────────── Featured Clubs ──────────── */}
      {!loading && featuredClubs.length > 0 && !hasActiveFilters && (
        <section className="border-t border-border bg-surface-alt/50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center gap-3">
              <svg
                className="h-5 w-5 text-secondary"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h2 className="text-xl font-bold text-white">Featured Clubs</h2>
              <div className="divider-gold ml-2" aria-hidden="true" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featuredClubs.map((club) => (
                <ClubCard key={club.id} club={club} variant="compact" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────── Verified Clubs ──────────── */}
      {!loading && spotlightClubs.length > 0 && !hasActiveFilters && (
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center gap-3">
              <svg
                className="h-5 w-5 text-secondary"
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
              <h2 className="text-xl font-bold text-white">
                Verified Clubs
              </h2>
              <div className="divider-gold ml-2" aria-hidden="true" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {spotlightClubs.map((club) => (
                <SpotlightCard key={club.id} club={club} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────── Filter Bar ──────────── */}
      <section className="sticky top-16 z-30 border-t border-b border-border bg-page-bg/95 backdrop-blur supports-[backdrop-filter]:bg-page-bg/80">
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
                className="self-start text-sm font-medium text-primary-light transition-colors hover:text-primary cursor-pointer sm:self-center"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ──────────── Main Results ──────────── */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mb-8 rounded-xl border border-primary/30 bg-primary/10 px-5 py-4 text-sm font-medium text-primary-light"
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
            <div className="mb-8 flex items-center justify-between">
              <p className="text-sm text-muted">
                Showing{" "}
                <span className="font-semibold text-white">
                  {filteredClubs.length}
                </span>{" "}
                of {clubs.length} clubs
                {activeCategory !== "All" && (
                  <span className="ml-1">
                    in{" "}
                    <span className="font-medium text-primary-light">
                      {activeCategory}
                    </span>
                  </span>
                )}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-primary-light transition-colors hover:text-primary cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="rounded-2xl border border-border bg-card py-24 text-center">
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
            <p className="mt-5 text-xl font-bold text-white">
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
