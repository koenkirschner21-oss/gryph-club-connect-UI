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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-accent">Explore Clubs</h1>
        <p className="mt-2 text-muted">
          Browse and discover student organizations at the University of Guelph
        </p>
      </div>

      {/* Search & Filter */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar value={search} onChange={setSearch} />
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeCategory === cat
                  ? "bg-primary text-white"
                  : "bg-surface text-muted hover:bg-surface-alt"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"
        >
          Could not load clubs from the server. Please check your connection and
          try again.
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner label="Loading clubs…" />
        </div>
      ) : filteredClubs.length > 0 ? (
        /* Results */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted"
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
          <p className="mt-4 text-lg font-medium text-accent">
            {emptyStateMessage.title}
          </p>
          <p className="mt-2 text-sm text-muted">
            {emptyStateMessage.description}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Result Count */}
      {!loading && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted">
            Showing {filteredClubs.length} of {clubs.length} clubs
          </p>
          {hasActiveFilters && filteredClubs.length > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
