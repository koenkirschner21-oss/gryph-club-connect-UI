import { useState, useMemo } from "react";
import { mockClubs, categories } from "../data/clubs";
import SearchBar from "../components/ui/SearchBar";
import ClubCard from "../components/ui/ClubCard";

export default function Explore() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredClubs = useMemo(() => {
    return mockClubs.filter((club) => {
      const matchesSearch =
        club.name.toLowerCase().includes(search.toLowerCase()) ||
        club.description.toLowerCase().includes(search.toLowerCase()) ||
        club.tags.some((tag) =>
          tag.toLowerCase().includes(search.toLowerCase())
        );

      const matchesCategory =
        activeCategory === "All" || club.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
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

      {/* Results */}
      {filteredClubs.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center">
          <p className="text-lg font-medium text-accent">No clubs found</p>
          <p className="mt-2 text-sm text-muted">
            Try adjusting your search or filter to find what you&apos;re looking
            for.
          </p>
        </div>
      )}

      {/* Result Count */}
      <p className="mt-6 text-sm text-muted">
        Showing {filteredClubs.length} of {mockClubs.length} clubs
      </p>
    </div>
  );
}
