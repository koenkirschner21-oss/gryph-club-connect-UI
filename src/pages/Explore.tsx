import { useState, useMemo, useCallback, useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import { normalizeTags } from "../lib/normalizeTags";
import { getClubInitials } from "../lib/clubUtils";
import { supabase } from "../lib/supabaseClient";
import Spinner from "../components/ui/Spinner";
import type { Club } from "../types";

const PAGE_BG = "#0f0f0f";
const ACCENT_RED = "#E51937";
const MUTED = "#555555";

const CLUB_AVATAR_BACKGROUNDS = ["#1a0505", "#1a1500", "#0a0a1a", "#0a1a0a", "#1a0a1a"] as const;

const CLUB_AVATAR_BORDERS: Record<(typeof CLUB_AVATAR_BACKGROUNDS)[number], string> = {
  "#1a0505": "#2a1515",
  "#1a1500": "#2a2510",
  "#0a0a1a": "#1a1a2a",
  "#0a1a0a": "#1a2a1a",
  "#1a0a1a": "#2a1a2a",
};

function getClubAvatarColors(clubName: string): { bg: string; border: string } {
  const bgIndex = clubName.charCodeAt(0) % CLUB_AVATAR_BACKGROUNDS.length;
  const bg = CLUB_AVATAR_BACKGROUNDS[bgIndex];
  return { bg, border: CLUB_AVATAR_BORDERS[bg] };
}

function exploreInitials(club: Pick<Club, "abbreviation" | "name">): string {
  return getClubInitials(club).slice(0, 3);
}

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
    <div className="relative w-full" style={{ maxWidth: "640px" }}>
      <svg
        className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2"
        style={{ color: "#555555" }}
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
          backgroundColor: "#111111",
          border: "1px solid #2a2a2a",
          borderRadius: "10px",
          padding: "14px 20px 14px 48px",
          color: "#ffffff",
          fontSize: "15px",
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
      {value ? (
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
      ) : null}
    </div>
  );
}

function filterPillStyle(active: boolean): CSSProperties {
  return active
    ? {
        backgroundColor: ACCENT_RED,
        color: "#ffffff",
        border: "none",
        borderRadius: "6px",
        padding: "7px 16px",
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        flexShrink: 0,
      }
    : {
        backgroundColor: "#1a1a1a",
        border: "1px solid #2a2a2a",
        color: "#777777",
        borderRadius: "6px",
        padding: "7px 16px",
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
        flexShrink: 0,
      };
}

function ClubExploreAvatar({ club }: { club: Club }) {
  const { bg, border } = getClubAvatarColors(club.name);
  return (
    <div
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "10px",
        background: bg,
        border: `1px solid ${border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
        {exploreInitials(club)}
      </span>
    </div>
  );
}

function ExploreClubCard({
  club,
  joined,
}: {
  club: Club;
  joined: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const description = club.shortDescription || club.description;

  return (
    <Link
      to={`/clubs/${club.slug}`}
      className="block no-underline"
      style={{ cursor: "pointer", height: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article
        style={{
          background: "#1a1a1a",
          border: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderRadius: "12px",
          padding: "20px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.15s ease",
          transform: hovered ? "translateY(-2px)" : undefined,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ClubExploreAvatar club={club} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#ffffff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {club.name}
              </h3>
            </div>
          </div>
        </div>

        {club.category ? (
          <span
            style={{
              display: "inline-block",
              marginTop: "12px",
              background: "#111111",
              border: "1px solid #222222",
              color: "#747676",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "11px",
            }}
          >
            {club.category}
          </span>
        ) : null}

        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            margin: "10px 0 0",
            fontSize: "12px",
            color: MUTED,
          }}
        >
          <Users size={12} aria-hidden />
          {club.memberCount} {club.memberCount === 1 ? "member" : "members"}
        </p>

        {description ? (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13px",
              color: "#666666",
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              flex: 1,
            }}
          >
            {description}
          </p>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        <div style={{ marginTop: "14px" }}>
          {joined ? (
            <span
              style={{
                display: "inline-block",
                background: "#1a0505",
                border: `1px solid ${ACCENT_RED}`,
                color: ACCENT_RED,
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Joined ✓
            </span>
          ) : (
            <span style={{ fontSize: "13px", fontWeight: 500, color: ACCENT_RED }}>
              View Club →
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}

function ExploreScrollCard({ club }: { club: Club }) {
  const [hovered, setHovered] = useState(false);
  const description = club.shortDescription || club.description;

  return (
    <Link
      to={`/clubs/${club.slug}`}
      className="block shrink-0 no-underline"
      style={{ width: "min(280px, 78vw)", cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article
        style={{
          background: "#1a1a1a",
          border: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderRadius: "12px",
          padding: "16px",
          height: "100%",
          transition: "all 0.15s ease",
          transform: hovered ? "translateY(-2px)" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <ClubExploreAvatar club={club} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#ffffff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {club.name}
              </h3>
            </div>
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                margin: "6px 0 0",
                fontSize: "12px",
                color: MUTED,
              }}
            >
              <Users size={12} aria-hidden />
              {club.memberCount} members
            </p>
          </div>
        </div>
        {club.category ? (
          <span
            style={{
              display: "inline-block",
              background: "#111111",
              border: "1px solid #222222",
              color: "#747676",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "11px",
            }}
          >
            {club.category}
          </span>
        ) : null}
        {description ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: "13px",
              color: "#666666",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </p>
        ) : null}
      </article>
    </Link>
  );
}

function HorizontalClubRow({ clubs }: { clubs: Club[] }) {
  return (
    <div
      className="scrollbar-thin"
      style={{
        display: "flex",
        gap: "16px",
        overflowX: "auto",
        paddingBottom: "4px",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {clubs.map((club) => (
        <ExploreScrollCard key={club.id} club={club} />
      ))}
    </div>
  );
}

function mapPublicClubRow(row: Record<string, unknown>): Club {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    slug: (row.slug as string) ?? (row.id as string),
    description: (row.description as string) ?? "",
    shortDescription: (row.short_description as string) ?? undefined,
    longDescription: (row.long_description as string) ?? undefined,
    category: (row.category as string) ?? "",
    memberCount: (row.member_count as number) ?? 0,
    meetingSchedule: (row.meeting_schedule as string) ?? "",
    meetingLocation: (row.meeting_location as string) ?? undefined,
    location: (row.location as string) ?? "",
    imageUrl:
      (row.image_url as string) ??
      (row.logo_url as string) ??
      "/assets/placeholders/placeholder-rect.svg",
    logoUrl: (row.logo_url as string) ?? undefined,
    bannerUrl: (row.banner_url as string) ?? undefined,
    brandColor: (row.brand_color as string) ?? undefined,
    tags: normalizeTags(row.tags as string | string[] | null | undefined),
    contactEmail: (row.contact_email as string) ?? "",
    isPublic: (row.is_public as boolean) ?? true,
    isFeatured: (row.is_featured as boolean) ?? false,
    isVerified: (row.is_verified as boolean) ?? false,
    abbreviation: (row.abbreviation as string) ?? undefined,
    joinCode: (row.join_code as string) ?? undefined,
    socialLinks: (row.social_links as Club["socialLinks"]) ?? undefined,
    events: (row.events as Club["events"]) ?? [],
    requiresApproval: (row.requires_approval as boolean) ?? false,
    createdBy: (row.created_by as string) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

function sortClubsByActivity(clubs: Club[]): Club[] {
  return [...clubs].sort((a, b) => {
    const memberDiff = b.memberCount - a.memberCount;
    if (memberDiff !== 0) return memberDiff;
    return a.name.localeCompare(b.name);
  });
}

// ─── Main Explore page ──────────────────────────────────────────────────────
export default function Explore() {
  const { clubs: contextClubs, loading: contextLoading, error: contextError, isJoined } =
    useClubContext();
  const { user } = useAuthContext();
  const [guestClubs, setGuestClubs] = useState<Club[]>([]);
  const [guestLoading, setGuestLoading] = useState(true);
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    if (user) return;

    let cancelled = false;

    async function loadPublicClubs() {
      setGuestLoading(true);
      setGuestError(null);

      const { data, error: fetchError } = await supabase
        .from("clubs")
        .select("*")
        .eq("is_public", true)
        .order("name");

      if (cancelled) return;

      if (fetchError) {
        console.error("Failed to load public clubs:", fetchError.message);
        setGuestError(fetchError.message);
        setGuestClubs([]);
      } else {
        setGuestClubs(
          (data ?? []).map((row) => mapPublicClubRow(row as Record<string, unknown>)),
        );
      }
      setGuestLoading(false);
    }

    void loadPublicClubs();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const clubs = user ? contextClubs : guestClubs;
  const loading = user ? contextLoading : guestLoading;
  const error = user ? contextError : guestError;

  const categories = useMemo(() => {
    const cats = new Set(
      clubs.map((club) => club.category).filter((value) => value.length > 0),
    );
    return ["All", ...Array.from(cats).sort((a, b) => a.localeCompare(b))];
  }, [clubs]);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const hasActiveFilters =
    search !== "" || activeCategory !== "All";

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveCategory("All");
  }, []);

  const mostActiveClubs = useMemo(
    () => sortClubsByActivity(clubs).slice(0, 6),
    [clubs],
  );

  const featuredCategoryRows = useMemo(() => {
    const order = ["Business", "Science", "Culture", "Sports", "Community"];
    return order
      .map((category) => ({
        category,
        clubs: sortClubsByActivity(
          clubs.filter((club) => club.category.toLowerCase() === category.toLowerCase()),
        ),
      }))
      .filter((row) => row.clubs.length > 0);
  }, [clubs]);

  const filteredClubs = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = clubs.filter((club) => {
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
    return sortClubsByActivity(filtered);
  }, [clubs, search, activeCategory]);

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
        description: `No search results for "${search}". Try a different search term.`,
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

  const categoryCount = Math.max(categories.length - 1, 0);

  return (
    <>
      {/* Hero */}
      <section style={{ backgroundColor: PAGE_BG }}>
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            padding: "80px 40px 48px",
          }}
        >
          <div className="min-w-0">
              <h1
                style={{
                  fontSize: "48px",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                Find Your Club
              </h1>
              <p
                style={{
                  fontSize: "15px",
                  color: "#555555",
                  marginTop: "10px",
                  marginBottom: 0,
                  lineHeight: 1.5,
                }}
              >
                Browse {clubs.length} student organizations at the University of Guelph
              </p>

              <div style={{ marginTop: "28px", maxWidth: "560px" }}>
                <ExploreSearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search clubs by name, tag, or keyword…"
                />
              </div>

              <p
                style={{
                  fontSize: "13px",
                  color: "#444444",
                  marginTop: "16px",
                  marginBottom: 0,
                }}
              >
                {clubs.length} clubs · {categoryCount} categories
              </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section
        className="sticky top-16 z-30 border-t border-b backdrop-blur supports-[backdrop-filter]"
        style={{
          borderColor: "#222222",
          backgroundColor: "rgba(15, 15, 15, 0.95)",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div
              className="scrollbar-thin flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={filterPillStyle(activeCategory === cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 cursor-pointer text-sm font-medium transition-colors"
                style={{
                  color: ACCENT_RED,
                  background: "transparent",
                  border: "none",
                  padding: "7px 4px",
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Discovery rows */}
      {!loading && !hasActiveFilters && (
        <div
          className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8"
          style={{ backgroundColor: PAGE_BG }}
        >
          {mostActiveClubs.length > 0 ? (
            <section className="mb-12">
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "0 0 4px",
                }}
              >
                Most Active Clubs
              </h2>
              <p style={{ fontSize: "12px", color: MUTED, margin: "0 0 14px" }}>
                Ranked by member activity
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mostActiveClubs.map((club) => (
                  <ExploreClubCard
                    key={club.id}
                    club={club}
                    joined={Boolean(user && isJoined(club.id))}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {featuredCategoryRows.map((row) => (
            <section key={row.category} className="mb-12">
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "0 0 14px",
                }}
              >
                {row.category}
              </h2>
              <HorizontalClubRow clubs={row.clubs} />
            </section>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
        style={{ backgroundColor: PAGE_BG }}
      >
        {error ? (
          <div
            role="alert"
            style={{
              marginBottom: "32px",
              borderRadius: "12px",
              border: "1px solid rgba(229, 25, 55, 0.35)",
              background: "rgba(229, 25, 55, 0.1)",
              padding: "16px 20px",
              fontSize: "14px",
              color: "#ff6b6b",
            }}
          >
            Could not load clubs from the server. Please check your connection and try again.
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner label="Loading clubs…" />
          </div>
        ) : filteredClubs.length > 0 ? (
          <>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 style={{ fontSize: "20px", color: "#ffffff", margin: 0, fontWeight: 700 }}>
                  All Clubs
                </h2>
                <p style={{ fontSize: "14px", color: MUTED, margin: "4px 0 0" }}>
                  Showing{" "}
                  <span style={{ fontWeight: 600, color: "#ffffff" }}>{filteredClubs.length}</span> of{" "}
                  {clubs.length} clubs
                  {activeCategory !== "All" ? (
                    <span>
                      {" "}
                      in <span style={{ color: ACCENT_RED }}>{activeCategory}</span>
                    </span>
                  ) : null}
                </p>
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="cursor-pointer text-sm font-medium"
                  style={{ color: ACCENT_RED, background: "transparent", border: "none" }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club) => (
                <ExploreClubCard
                  key={club.id}
                  club={club}
                  joined={Boolean(user && isJoined(club.id))}
                />
              ))}
            </div>
          </>
        ) : (
          <div
            style={{
              borderRadius: "12px",
              border: "1px solid #242424",
              background: "#1a1a1a",
              padding: "80px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                margin: "0 auto",
                display: "flex",
                height: "64px",
                width: "64px",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "#111111",
              }}
            >
              <svg
                style={{ height: "32px", width: "32px", color: MUTED }}
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
            <p style={{ marginTop: "20px", fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
              {emptyStateMessage.title}
            </p>
            <p style={{ marginTop: "8px", fontSize: "14px", color: MUTED }}>
              {emptyStateMessage.description}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: ACCENT_RED, border: "none" }}
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
