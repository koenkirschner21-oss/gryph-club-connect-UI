import { useState, useMemo, useCallback, type CSSProperties } from "react";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import { useUserInterests } from "../hooks/useUserInterests";
import { normalizeTags } from "../lib/normalizeTags";
import { getClubInitials } from "../lib/clubUtils";
import ClubCard from "../components/ui/ClubCard";
import Spinner from "../components/ui/Spinner";
import type { Club } from "../types";

const PAGE_BG = "#0f0f0f";
const ACCENT_RED = "#E51937";
const ACCENT_GOLD = "#FFC429";
const MUTED = "#555555";

function ExploreSearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full">
      <svg
        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
        style={{ color: MUTED }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "8px",
          padding: "12px 16px 12px 44px",
          color: "#ffffff",
          fontSize: "14px",
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = ACCENT_RED;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#2a2a2a";
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1"
          style={{ color: MUTED, background: "transparent", border: "none" }}
          aria-label="Clear search"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function categoryTabStyle(active: boolean): CSSProperties {
  return active
    ? {
        backgroundColor: ACCENT_RED,
        color: "#ffffff",
        border: `1px solid ${ACCENT_RED}`,
        borderRadius: "6px",
        padding: "6px 14px",
        fontSize: "13px",
        cursor: "pointer",
      }
    : {
        backgroundColor: "#1a1a1a",
        border: "1px solid #222222",
        color: "#777777",
        borderRadius: "6px",
        padding: "6px 14px",
        fontSize: "13px",
        cursor: "pointer",
      };
}

function FeaturedSectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      <svg
        style={{ width: 20, height: 20, color: ACCENT_GOLD, flexShrink: 0 }}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <h2
        style={{
          fontWeight: 700,
          fontSize: "20px",
          color: "#ffffff",
          margin: 0,
          borderLeft: `3px solid ${ACCENT_GOLD}`,
          paddingLeft: "12px",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

const CATEGORY_BADGE_STYLE: CSSProperties = {
  backgroundColor: "#111111",
  color: "#747676",
  border: "1px solid #222222",
  borderRadius: "20px",
  padding: "3px 12px",
  fontSize: "11px",
};

// ─── Spotlight card (horizontal, larger) ────────────────────────────────────
function SpotlightCard({ club }: { club: Club }) {
  return (
    <a
      href={`/clubs/${club.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card card-glow-hover hover:border-border-light sm:flex-row"
    >
      <div
        className="flex w-full items-center justify-center p-8 sm:w-52 sm:flex-shrink-0"
        style={{
          backgroundColor: "#2a2a2a",
          borderRight: "1px solid #333",
        }}
      >
        {club.logoUrl ? (
          <img
            src={club.logoUrl}
            alt=""
            className="h-20 w-20 rounded-lg object-cover"
            style={{ border: "1px solid #333" }}
          />
        ) : (
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#888888",
            }}
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
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted/80">
          {club.shortDescription || club.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <span style={CATEGORY_BADGE_STYLE}>{club.category}</span>
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

// ─── Size filter options ─────────────────────────────────────────────────────
type SizeFilter = "all" | "small" | "medium" | "large";
const SIZE_LABELS: Record<SizeFilter, string> = {
  all: "Any Size",
  small: "Small (≤20)",
  medium: "Medium (21–49)",
  large: "Large (50+)",
};

function matchesSize(club: Club, filter: SizeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "small") return club.memberCount <= 20;
  if (filter === "medium") return club.memberCount > 20 && club.memberCount < 50;
  return club.memberCount >= 50;
}

// ─── Main Explore page ──────────────────────────────────────────────────────
export default function Explore() {
  const { clubs, categories, loading, error } = useClubContext();
  const { user } = useAuthContext();
  const { interests } = useUserInterests();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");

  const hasActiveFilters =
    search !== "" || activeCategory !== "All" || sizeFilter !== "all";

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveCategory("All");
    setSizeFilter("all");
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

  // Recommended clubs — match user interests (only when logged in with interests)
  const recommendedClubs = useMemo(() => {
    if (!user || interests.length === 0) return [];
    return clubs
      .filter((c) => interests.includes(c.category))
      .slice(0, 6);
  }, [clubs, user, interests]);

  // Trending clubs — sorted by member count (proxy for popularity)
  const trendingClubs = useMemo(
    () =>
      [...clubs]
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 6),
    [clubs],
  );

  // New clubs — sorted by creation date (most recent first)
  const newClubs = useMemo(
    () =>
      [...clubs]
        .filter((c) => c.createdAt)
        .sort(
          (a, b) =>
            new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime(),
        )
        .slice(0, 6),
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

      return matchesCategory && matchesSearch && matchesSize(club, sizeFilter);
    });
  }, [clubs, search, activeCategory, sizeFilter]);

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
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a0505 0%, #2d0808 50%, #1a0505 100%)",
        }}
      >
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-36">
          <div className="flex items-center gap-12 lg:gap-16">
            {/* Left: text content */}
            <div className="max-w-3xl flex-1">
              <div className="mb-5">
                <img
                  src="/assets/gryph-club-connect-logo.png"
                  alt="Gryph Club Connect"
                  className="h-10 w-auto sm:h-11"
                />
              </div>
              <h1
                className="text-5xl tracking-tight sm:text-6xl lg:text-7xl leading-[1.05]"
                style={{ fontWeight: 700 }}
              >
                <span className="text-white/60">Discover Your</span>{" "}
                <span style={{ color: ACCENT_GOLD }}>Club</span>
              </h1>
              <p
                className="mt-6 max-w-xl leading-relaxed"
                style={{ color: "#cccccc", fontSize: "16px" }}
              >
                Browse {clubs.length > 0 ? `${clubs.length}` : ""} student
                organizations — from academics and athletics to arts and culture.
                Find your people and get involved.
              </p>
            </div>

            {/* Right: visual anchor — decorative blurred panel */}
            <div className="hidden flex-shrink-0 lg:block" aria-hidden="true">
              <div className="relative w-64 xl:w-72">
                <div className="absolute -inset-4 rounded-3xl bg-[var(--red-dim)] blur-2xl" />
                <div className="relative rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur-sm shadow-elevated">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="skeleton h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-2.5 w-20 rounded-full" />
                      <div className="skeleton h-2 w-14 rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="skeleton h-2 w-full rounded-full" />
                    <div className="skeleton h-2 w-5/6 rounded-full" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <div className="skeleton h-5 w-14 rounded-full" />
                    <div className="skeleton h-5 w-10 rounded-full" />
                  </div>
                </div>
                <div className="relative -mt-1.5 ml-3 rounded-2xl border border-border/40 bg-surface-alt/60 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="skeleton h-7 w-7 rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-2 w-16 rounded-full" />
                      <div className="skeleton h-1.5 w-12 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search bar — more prominent */}
          <div className="mt-10 max-w-2xl">
            <ExploreSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search clubs by name, tag, or keyword…"
            />
          </div>

          {/* Quick stats */}
          {clubs.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-8 text-sm">
              <span>
                <strong style={{ fontWeight: 700, color: "#ffffff", fontSize: "1.5rem" }}>
                  {clubs.length}
                </strong>{" "}
                <span style={{ color: "#747676", marginLeft: "4px" }}>clubs</span>
              </span>
              <span>
                <strong style={{ fontWeight: 700, color: "#ffffff", fontSize: "1.5rem" }}>
                  {categories.length - 1}
                </strong>{" "}
                <span style={{ color: "#747676", marginLeft: "4px" }}>categories</span>
              </span>
              {featuredClubs.length > 0 && (
                <span>
                  <strong style={{ fontWeight: 700, color: "#ffffff", fontSize: "1.5rem" }}>
                    {featuredClubs.length}
                  </strong>{" "}
                  <span style={{ color: "#747676", marginLeft: "4px" }}>featured</span>
                </span>
              )}
            </div>
          )}
          <div className="mt-6 border-b border-[var(--border)]" />
        </div>
      </section>

      {/* ──────────── Featured Clubs ──────────── */}
      {!loading && featuredClubs.length > 0 && !hasActiveFilters && (
        <section style={{ backgroundColor: PAGE_BG, borderTop: "1px solid #222222" }}>
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <FeaturedSectionHeading title="Featured Clubs" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featuredClubs.map((club) => (
                <ClubCard key={club.id} club={club} variant="explore" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────── Verified Clubs ──────────── */}
      {!loading && spotlightClubs.length > 0 && !hasActiveFilters && (
        <section style={{ backgroundColor: PAGE_BG, borderTop: "1px solid #222222" }}>
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
      <section
        className="sticky top-16 z-30 border-t border-b backdrop-blur supports-[backdrop-filter]"
        style={{
          borderColor: "#222222",
          backgroundColor: "rgba(15, 15, 15, 0.95)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    style={categoryTabStyle(activeCategory === cat)}
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

            {/* Size filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">Size:</span>
              {(Object.keys(SIZE_LABELS) as SizeFilter[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSizeFilter(size)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    sizeFilter === size
                      ? "bg-secondary/20 text-secondary"
                      : "bg-surface text-muted hover:bg-surface-alt hover:text-white"
                  }`}
                >
                  {SIZE_LABELS[size]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ──────────── Discovery Sections ──────────── */}
      {!loading && !hasActiveFilters && (
        <div
          className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8"
          style={{ backgroundColor: PAGE_BG }}
        >
          {/* Recommended for You */}
          {recommendedClubs.length > 0 && (
            <section className="mb-12">
              <div className="mb-5 flex items-center gap-3">
                <span className="text-xl" aria-hidden="true">💡</span>
                <h2 className="text-xl font-bold text-white">
                  Recommended for You
                </h2>
                <div className="divider-gold ml-2" aria-hidden="true" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {recommendedClubs.map((club) => (
                  <ClubCard key={club.id} club={club} variant="explore" />
                ))}
              </div>
            </section>
          )}

          {/* Trending */}
          {trendingClubs.length > 0 && (
            <section className="mb-12">
              <div className="mb-5 flex items-center gap-3">
                <span className="text-xl" aria-hidden="true">🔥</span>
                <h2 className="text-xl font-bold text-white">
                  Trending Clubs
                </h2>
                <div className="divider-gold ml-2" aria-hidden="true" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {trendingClubs.map((club) => (
                  <ClubCard key={club.id} club={club} variant="explore" />
                ))}
              </div>
            </section>
          )}

          {/* New Clubs */}
          {newClubs.length > 0 && (
            <section className="mb-12">
              <div className="mb-5 flex items-center gap-3">
                <span className="text-xl" aria-hidden="true">✨</span>
                <h2 className="text-xl font-bold text-white">
                  Newly Created
                </h2>
                <div className="divider-gold ml-2" aria-hidden="true" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {newClubs.map((club) => (
                  <ClubCard key={club.id} club={club} variant="explore" />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ──────────── Main Results ──────────── */}
      <div
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
        style={{ backgroundColor: PAGE_BG }}
      >
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
            <div className="grid items-stretch gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club) => (
                <ClubCard key={club.id} club={club} variant="explore" />
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
