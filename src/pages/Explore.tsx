import { useState, useMemo, useCallback } from "react";
import { useClubContext } from "../context/useClubContext";
import SearchBar from "../components/ui/SearchBar";
import ClubCard from "../components/ui/ClubCard";
import Spinner from "../components/ui/Spinner";

export default function Explore() {
  const { clubs, categories, loading, error } = useClubContext();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const hasActiveFilters = search !== "" || activeCategory !== "All";

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveCategory("All");
  }, []);

  const filteredClubs = useMemo(() => {
    const query = search.toLowerCase();
    return clubs.filter((club) => {
      const matchesCategory =
        activeCategory === "All" || club.category === activeCategory;

      const matchesSearch =
        query === "" ||
        club.name.toLowerCase().includes(query) ||
        club.description.toLowerCase().includes(query) ||
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
      {/* Hero / Page Header */}
      <section className="relative overflow-hidden bg-accent">
        <div className="hero-overlay absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Explore Clubs
            </h1>
            <p className="mt-4 text-lg text-white/75">
              Discover student organizations at the{" "}
              <span className="font-semibold text-secondary">
                University of Guelph
              </span>{" "}
              — find your community and get involved.
            </p>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="border-b border-border bg-surface shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} />
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

          {/* Category chips */}
          <div className="mt-4 flex flex-wrap gap-2">
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
        </div>
      </section>

      {/* Main Content */}
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
            {/* Result count + clear */}
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

