import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  normalizeJoinType,
  normalizeMembershipType,
  parseJoinQuestions,
} from "../lib/clubJoinUtils";
import { normalizeClaimStatus } from "../lib/clubClaimUtils";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import { normalizeTags } from "../lib/normalizeTags";
import { sortClubsByMemberActivity } from "../lib/clubUtils";
import {
  extractEmbeddedRequestMetadata,
  readClubContactEmailFromRow,
  readClubLongDescriptionFromRow,
  readClubMeetingLocationFromRow,
  readClubMeetingScheduleFromRow,
} from "../lib/clubRowMapping";
import { readSocialLinksFromClubRow } from "../lib/clubSocialLinks";
import { supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useWindowWidth";
import ExploreClubCard from "../components/ui/ExploreClubCard";
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
    <div className="relative w-full" style={fullWidth ? undefined : { maxWidth: "720px", width: "100%" }}>
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
          border: "2px solid #2a2a2a",
          borderRadius: "10px",
          padding: "0 20px 0 48px",
          color: "#ffffff",
          fontSize: "17px",
          width: "100%",
          height: "60px",
          boxSizing: "border-box",
          outline: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
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

const PREFERRED_QUICK_CHIP_LABELS = [
  "Academic",
  "Social",
  "Cultural",
  "Sports",
  "Professional",
  "Arts",
] as const;

const QUICK_CHIP_CATEGORY_ALIASES: Record<string, string[]> = {
  Academic: ["Academic", "Science"],
  Social: ["Social", "Community"],
  Cultural: ["Cultural", "Culture"],
  Sports: ["Sports"],
  Professional: ["Professional", "Business"],
  Arts: ["Arts", "Art"],
};

function resolveQuickCategoryChips(
  categories: string[],
): { label: string; value: string }[] {
  const nonAll = categories.filter((category) => category !== "All");

  return PREFERRED_QUICK_CHIP_LABELS.flatMap((label) => {
    const aliases = QUICK_CHIP_CATEGORY_ALIASES[label] ?? [label];
    const match = nonAll.find((category) =>
      aliases.some((alias) => category.toLowerCase() === alias.toLowerCase()),
    );
    return match ? [{ label, value: match }] : [];
  });
}

function HorizontalClubRow({
  clubs,
  joinedByClubId,
  highlightUnclaimed = false,
}: {
  clubs: Club[];
  joinedByClubId: (clubId: string) => boolean;
  highlightUnclaimed?: boolean;
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
          <ExploreClubCard
            club={club}
            joined={joinedByClubId(club.id)}
            highlightUnclaimed={highlightUnclaimed}
          />
        </div>
      ))}
    </div>
  );
}

function mapPublicClubRow(row: Record<string, unknown>): Club {
  const embeddedMeta = extractEmbeddedRequestMetadata(row);

  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    slug: (row.slug as string) ?? (row.id as string),
    description: (row.description as string) ?? "",
    shortDescription: (row.short_description as string) ?? undefined,
    longDescription: readClubLongDescriptionFromRow(row),
    category: (row.category as string) ?? "",
    memberCount: (row.member_count as number) ?? 0,
    meetingSchedule: readClubMeetingScheduleFromRow(row, embeddedMeta),
    meetingLocation: readClubMeetingLocationFromRow(row, embeddedMeta),
    location: (row.location as string) ?? "",
    imageUrl:
      (row.image_url as string) ??
      (row.logo_url as string) ??
      "/assets/placeholders/placeholder-rect.svg",
    logoUrl: (row.logo_url as string) ?? undefined,
    bannerUrl: (row.banner_url as string) ?? undefined,
    brandColor: (row.brand_color as string) ?? undefined,
    tags: normalizeTags(row.tags as string | string[] | null | undefined),
    contactEmail: readClubContactEmailFromRow(row, embeddedMeta),
    isPublic: (row.is_public as boolean) ?? true,
    isFeatured: (row.is_featured as boolean) ?? false,
    isVerified: (row.is_verified as boolean) ?? false,
    abbreviation: (row.abbreviation as string) ?? undefined,
    joinCode: (row.join_code as string) ?? undefined,
    socialLinks: readSocialLinksFromClubRow(row),
    events: (row.events as Club["events"]) ?? [],
    requiresApproval: (row.requires_approval as boolean) ?? false,
    joinType: normalizeJoinType(row.join_type),
    membershipType: normalizeMembershipType(row.membership_type),
    claimStatus: normalizeClaimStatus(row.claim_status),
    joinQuestions: parseJoinQuestions(row.join_questions),
    createdBy: (row.created_by as string) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

// ─── Main Explore page ──────────────────────────────────────────────────────
export default function Explore() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const claimMode = searchParams.get("claim") === "true";
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
    () => sortClubsByMemberActivity(clubs).slice(0, 6),
    [clubs],
  );

  const featuredCategoryRows = useMemo(() => {
    const order = ["Business", "Science", "Culture", "Sports", "Community"];
    return order
      .map((category) => ({
        category,
        clubs: sortClubsByMemberActivity(
          clubs.filter((club) => club.category.toLowerCase() === category.toLowerCase()),
        ).slice(0, 6),
      }))
      .filter((row) => row.clubs.length > 0)
      .slice(0, 2);
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
    return sortClubsByMemberActivity(filtered);
  }, [clubs, search, activeCategory]);

  const displayClubs = useMemo(() => {
    if (!claimMode) return filteredClubs;
    const unclaimed = filteredClubs.filter(
      (club) => club.claimStatus === "unclaimed",
    );
    const claimed = filteredClubs.filter(
      (club) => club.claimStatus !== "unclaimed",
    );
    return [...unclaimed, ...claimed];
  }, [filteredClubs, claimMode]);

  const categoryCount = Math.max(categories.length - 1, 0);
  const clubCountLabel =
    clubs.length >= 260 ? "260+" : clubs.length > 0 ? String(clubs.length) : "0";
  const quickCategoryChips = useMemo(
    () => resolveQuickCategoryChips(categories),
    [categories],
  );

  const emptyStateMessage = useMemo(() => {
    if (search || activeCategory !== "All") {
      return {
        title: "No clubs found",
        description: "Try searching a different keyword or clearing your filters.",
      };
    }
    return {
      title: "No clubs available",
      description: "There are no clubs to display right now.",
    };
  }, [search, activeCategory]);

  return (
    <div style={{ backgroundColor: PAGE_BG, minHeight: "100%" }}>
      {/* Hero */}
      <section style={{ backgroundColor: PAGE_BG }}>
        <div
          style={{
            padding: isMobile ? "24px 16px 12px" : "36px 48px 16px",
            textAlign: "left",
          }}
        >
          <h1
            style={{
              fontSize: isMobile ? "32px" : "52px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Find Your <span style={{ color: ACCENT_RED }}>Club</span>
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "#555555",
              marginTop: "8px",
              marginBottom: 0,
              lineHeight: 1.45,
            }}
          >
            Browse {clubCountLabel} student organizations at the University of Guelph
          </p>

          <div
            style={{
              marginTop: "12px",
              width: "100%",
              maxWidth: "760px",
            }}
          >
            <ExploreSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search clubs by name, interest, category, or keyword..."
              fullWidth
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px",
                marginTop: "8px",
              }}
            >
              <CategoryFilterDropdown
                categories={categories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
              />
              <p
                style={{
                  fontSize: "12px",
                  color: "#444444",
                  margin: 0,
                }}
              >
                {clubCountLabel} clubs · {categoryCount} categories
              </p>
            </div>

            {quickCategoryChips.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "10px",
                }}
              >
                {quickCategoryChips.map((chip) => {
                  const active = activeCategory === chip.value;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() =>
                        setActiveCategory(active ? "All" : chip.value)
                      }
                      style={{
                        background: active ? "rgba(229, 25, 55, 0.12)" : "#1a1a1a",
                        border: active ? `1px solid ${ACCENT_RED}` : "1px solid #2a2a2a",
                        color: active ? ACCENT_RED : "#777777",
                        borderRadius: "20px",
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: PAGE_BG, paddingTop: 0 }}
      >
        {claimMode ? (
          <div
            style={{
              marginBottom: "24px",
              background: "#141414",
              border: "1px solid #E51937",
              borderRadius: "10px",
              padding: "16px 20px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Claim a club profile
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#777777",
                lineHeight: 1.5,
              }}
            >
              Clubs highlighted in red are available to claim. Open a club and tap
              &quot;Claim This Club&quot; if you are a president or executive.
            </p>
          </div>
        ) : null}

        {/* Discovery rows */}
        {!loading && !hasActiveFilters ? (
          <>
            {mostActiveClubs.length > 0 ? (
              <section className="mb-6" style={{ backgroundColor: PAGE_BG }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h2 style={sectionHeadingStyle}>Most Active Clubs</h2>
                    <p style={sectionSubheadingStyle}>Ranked by member count</p>
                  </div>
                  <a
                    href="#all-clubs"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: ACCENT_RED,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Jump to All Clubs →
                  </a>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
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
              <section key={row.category} className="mb-8" style={{ backgroundColor: PAGE_BG }}>
                <h2 style={{ ...sectionHeadingStyle, marginBottom: "14px" }}>{row.category}</h2>
                <HorizontalClubRow
                  clubs={row.clubs}
                  joinedByClubId={isClubJoined}
                  highlightUnclaimed={claimMode}
                />
              </section>
            ))}
          </>
        ) : null}

        {/* Main grid */}
        <div id="all-clubs" className="pb-12 pt-2" style={{ backgroundColor: PAGE_BG }}>
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
                  <h2 style={sectionHeadingStyle}>
                    {claimMode ? "Clubs to Explore" : "All Clubs"}
                  </h2>
                  <p style={sectionSubheadingStyle}>
                    Showing{" "}
                    <span style={{ fontWeight: 600, color: "#ffffff" }}>{clubCountLabel}</span>{" "}
                    clubs
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
                {displayClubs.map((club) => (
                  <ExploreClubCard
                    key={club.id}
                    club={club}
                    joined={isClubJoined(club.id)}
                    highlightUnclaimed={claimMode}
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
