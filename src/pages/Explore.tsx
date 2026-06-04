import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import {
  normalizeJoinType,
  parseJoinQuestions,
} from "../lib/clubJoinUtils";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import { normalizeTags } from "../lib/normalizeTags";
import {
  getClubBannerBrandBackground,
  isUploadedClubBanner,
} from "../lib/clubUtils";
import { supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useWindowWidth";
import Spinner from "../components/ui/Spinner";
import type { Club } from "../types";

const PAGE_BG = "#0f0f0f";
const ACCENT_RED = "#E51937";
const MUTED = "#555555";

const sectionHeadingStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#ffffff",
  margin: 0,
  borderLeft: "3px solid #E51937",
  paddingLeft: "12px",
};

const sectionSubheadingStyle: CSSProperties = {
  fontSize: "13px",
  color: "#555555",
  marginTop: "4px",
  marginBottom: 0,
};

const exploreDescriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: "13px",
  color: "#999999",
  lineHeight: 1.5,
};

const EXPLORE_DESCRIPTION_MAX_LINES = 2;

function measureExploreDescription(
  measureEl: HTMLParagraphElement,
  description: string,
  maxLines: number,
): { text: string; truncated: boolean } {
  measureEl.textContent = description;
  const lineHeight = parseFloat(getComputedStyle(measureEl).lineHeight) || 19.5;
  const maxHeight = lineHeight * maxLines + 1;

  if (measureEl.scrollHeight <= maxHeight) {
    return { text: description, truncated: false };
  }

  let lo = 0;
  let hi = description.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const prefix = description.slice(0, mid).trimEnd();
    measureEl.textContent = "";
    measureEl.append(`${prefix}… `);
    const readMoreSpan = document.createElement("span");
    readMoreSpan.textContent = "Read more";
    measureEl.append(readMoreSpan);

    if (measureEl.scrollHeight <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    text: description.slice(0, best).trimEnd(),
    truncated: true,
  };
}

function ExploreSearchBar({
  value,
  onChange,
  placeholder,
  fullWidth,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className="relative w-full" style={fullWidth ? undefined : { maxWidth: "560px" }}>
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
          backgroundColor: PAGE_BG,
          border: "1px solid #2a2a2a",
          borderRadius: "10px",
          padding: "0 20px 0 48px",
          color: "#ffffff",
          fontSize: "16px",
          width: "100%",
          height: "56px",
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

function CategoryFilterDropdown({
  categories,
  activeCategory,
  onSelect,
  fullWidth,
}: {
  categories: string[];
  activeCategory: string;
  onSelect: (category: string) => void;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const dropdownOptions = useMemo(
    () =>
      categories.map((cat) => ({
        value: cat,
        label: cat === "All" ? "All Categories" : cat,
      })),
    [categories],
  );

  return (
    <div ref={rootRef} style={{ position: "relative", display: fullWidth ? "block" : "inline-block", width: fullWidth ? "100%" : undefined }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          color: "#cccccc",
          borderRadius: "8px",
          padding: "10px 16px",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          width: fullWidth ? "100%" : undefined,
          justifyContent: fullWidth ? "space-between" : undefined,
          boxSizing: "border-box",
        }}
      >
        Filter by Category
        <ChevronDown
          size={16}
          aria-hidden
          style={{
            marginLeft: "2px",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 50,
            minWidth: "220px",
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: "10px",
            padding: "8px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          {dropdownOptions.map((option) => {
            const isActive = activeCategory === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "#252525";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: isActive ? ACCENT_RED : "#cccccc",
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
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
  const [descriptionPreview, setDescriptionPreview] = useState<{
    text: string;
    truncated: boolean;
  }>({ text: "", truncated: false });
  const descriptionContainerRef = useRef<HTMLDivElement>(null);
  const descriptionMeasureRef = useRef<HTMLParagraphElement>(null);
  const description = (club.shortDescription || club.description)?.trim();
  const bannerUrl = club.bannerUrl?.trim();
  const showBannerImage = isUploadedClubBanner(bannerUrl);
  const brandBannerBg = getClubBannerBrandBackground(club.name);

  useLayoutEffect(() => {
    const container = descriptionContainerRef.current;
    const measure = descriptionMeasureRef.current;

    if (!description) {
      setDescriptionPreview({ text: "", truncated: false });
      return;
    }

    if (!container || !measure) return;

    function updatePreview() {
      if (!container || !measure) return;
      measure.style.width = `${container.clientWidth}px`;
      setDescriptionPreview(
        measureExploreDescription(
          measure,
          description,
          EXPLORE_DESCRIPTION_MAX_LINES,
        ),
      );
    }

    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(container);
    return () => observer.disconnect();
  }, [description]);

  return (
    <Link
      to={`/clubs/${club.slug}`}
      className="block no-underline"
      style={{
        cursor: "pointer",
        width: "100%",
        minWidth: 0,
        display: "block",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article
        style={{
          width: "100%",
          minWidth: 0,
          height: "320px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#1a1a1a",
          border: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderRadius: "12px",
          transition: "all 0.15s ease",
          transform: hovered ? "translateY(-2px)" : undefined,
          boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.4)" : undefined,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            height: "140px",
            flexShrink: 0,
            overflow: "hidden",
            width: "100%",
            position: "relative",
            background: showBannerImage ? "#1a1a1a" : undefined,
          }}
        >
          {showBannerImage ? (
            <img
              src={bannerUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center center",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: brandBannerBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                boxSizing: "border-box",
              }}
              aria-hidden="true"
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#ffffff",
                  textAlign: "center",
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {club.name}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            height: "180px",
            padding: "16px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
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

          {description ? (
            <div ref={descriptionContainerRef} style={{ minWidth: 0, position: "relative" }}>
              <p
                ref={descriptionMeasureRef}
                aria-hidden
                style={{
                  ...exploreDescriptionStyle,
                  position: "absolute",
                  visibility: "hidden",
                  pointerEvents: "none",
                  height: "auto",
                  width: "100%",
                  margin: 0,
                  zIndex: -1,
                }}
              />
              <p style={exploreDescriptionStyle}>
                {descriptionPreview.text}
                {descriptionPreview.truncated ? (
                  <>
                    …{" "}
                    <span style={{ color: ACCENT_RED, fontWeight: 500 }}>
                      Read more
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#555555",
                lineHeight: 1.5,
              }}
            >
              No description available
            </p>
          )}

          {club.category ? (
            <div style={{ marginTop: "10px" }}>
              <span
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333333",
                  color: "#666666",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  display: "inline-block",
                }}
              >
                {club.category}
              </span>
            </div>
          ) : null}

          <div
            style={{
              marginTop: "auto",
              paddingTop: "10px",
              borderTop: "1px solid #1e1e1e",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              {joined ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  <Check size={12} strokeWidth={2.5} aria-hidden />
                  Joined
                </span>
              ) : null}
            </div>
            <span
              style={{
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              View Club →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function HorizontalClubRow({
  clubs,
  joinedByClubId,
}: {
  clubs: Club[];
  joinedByClubId: (clubId: string) => boolean;
}) {
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
        <div key={club.id} style={{ width: "min(240px, 72vw)", flexShrink: 0 }}>
          <ExploreClubCard club={club} joined={joinedByClubId(club.id)} />
        </div>
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
    joinType: normalizeJoinType(row.join_type),
    joinQuestions: parseJoinQuestions(row.join_questions),
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
  const isMobile = useIsMobile();
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

  const hasActiveFilters = search !== "" || activeCategory !== "All";

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveCategory("All");
  }, []);

  const isClubJoined = useCallback(
    (clubId: string) => Boolean(user && isJoined(clubId)),
    [user, isJoined],
  );

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
    <div style={{ backgroundColor: PAGE_BG, minHeight: "100%" }}>
      {/* Hero */}
      <section style={{ backgroundColor: PAGE_BG }}>
        <div
          style={{
            padding: isMobile ? "48px 16px 40px" : "120px 48px 88px",
            textAlign: "left",
          }}
        >
          <h1
            style={{
              fontSize: isMobile ? "36px" : "64px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1,
              margin: 0,
            }}
          >
            Find Your <span style={{ color: ACCENT_RED }}>Club</span>
          </h1>
          <p
            style={{
              fontSize: "16px",
              color: "#555555",
              marginTop: "12px",
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            Browse 260+ student organizations at the University of Guelph
          </p>

          <div style={{ marginTop: "28px", width: "100%" }}>
            <ExploreSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search clubs by name, tag, or keyword…"
              fullWidth={isMobile}
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
            260+ clubs · {categoryCount} categories
          </p>
        </div>
      </section>

      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: PAGE_BG, paddingTop: isMobile ? "8px" : "16px" }}
      >
        <div style={{ marginBottom: "24px" }}>
          <CategoryFilterDropdown
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            fullWidth={isMobile}
          />
        </div>

        {/* Discovery rows */}
        {!loading && !hasActiveFilters ? (
          <>
            {mostActiveClubs.length > 0 ? (
              <section className="mb-12" style={{ backgroundColor: PAGE_BG }}>
                <h2 style={sectionHeadingStyle}>Most Active Clubs</h2>
                <p style={{ ...sectionSubheadingStyle, marginBottom: "14px" }}>
                  Ranked by member activity
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "20px",
                    width: "100%",
                  }}
                >
                  {mostActiveClubs.map((club) => (
                    <ExploreClubCard
                      key={club.id}
                      club={club}
                      joined={isClubJoined(club.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {featuredCategoryRows.map((row) => (
              <section key={row.category} className="mb-12" style={{ backgroundColor: PAGE_BG }}>
                <h2 style={{ ...sectionHeadingStyle, marginBottom: "14px" }}>{row.category}</h2>
                <HorizontalClubRow clubs={row.clubs} joinedByClubId={isClubJoined} />
              </section>
            ))}
          </>
        ) : null}

        {/* Main grid */}
        <div className="pb-12 pt-2" style={{ backgroundColor: PAGE_BG }}>
          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: "32px",
                borderRadius: "12px",
                border: "1px solid rgba(229, 25, 55, 0.35)",
                background: PAGE_BG,
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
                  <h2 style={sectionHeadingStyle}>All Clubs</h2>
                  <p style={sectionSubheadingStyle}>
                    Showing{" "}
                    <span style={{ fontWeight: 600, color: "#ffffff" }}>{filteredClubs.length}</span>{" "}
                    of 260+ clubs
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "20px",
                  width: "100%",
                }}
              >
                {filteredClubs.map((club) => (
                  <ExploreClubCard
                    key={club.id}
                    club={club}
                    joined={isClubJoined(club.id)}
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
                  background: PAGE_BG,
                  border: "1px solid #242424",
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
      </div>
    </div>
  );
}
