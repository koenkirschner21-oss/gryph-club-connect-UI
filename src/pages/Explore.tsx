import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  normalizeJoinType,
  normalizeMembershipType,
  parseJoinQuestions,
} from "../lib/clubJoinUtils";
import {
  normalizeClaimStatus,
  resolveExploreClubClaimState,
  resolveExploreClubClaimStatePreMeta,
  type ExploreClubClaimState,
} from "../lib/clubClaimUtils";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import { normalizeTags } from "../lib/normalizeTags";
import { sortClubsByMemberActivity } from "../lib/clubUtils";
import { isClubPubliclyDiscoverable } from "../lib/clubPublicVisibility";
import { clubCategoryFilterOptions } from "../lib/clubCategories";
import {
  extractEmbeddedRequestMetadata,
  readClubContactEmailFromRow,
  readClubLongDescriptionFromRow,
  readClubMeetingLocationFromRow,
  readClubMeetingScheduleFromRow,
} from "../lib/clubRowMapping";
import { readSocialLinksFromClubRow } from "../lib/clubSocialLinks";
import { supabase } from "../lib/supabaseClient";
import { resolveOnboardingIntent } from "../lib/onboardingIntent";
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
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
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
        ref={inputRef}
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

function HorizontalClubRow({
  clubs,
  joinedByClubId,
  claimStateForClub,
  managesClub,
}: {
  clubs: Club[];
  joinedByClubId: (clubId: string) => boolean;
  claimStateForClub: (club: Club) => ExploreClubClaimState;
  managesClub: (clubId: string) => boolean;
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
            claimState={claimStateForClub(club)}
            userManagesClub={managesClub(club.id)}
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
    setupCompleted: (row.setup_completed as boolean) ?? false,
    isPublished: (row.is_published as boolean) ?? false,
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    clubs: contextClubs,
    loading: contextLoading,
    error: contextError,
    isJoined,
    isPending,
    getUserRole,
  } = useClubContext();
  const { user } = useAuthContext();
  const [guestClubs, setGuestClubs] = useState<Club[]>([]);
  const [guestLoading, setGuestLoading] = useState(true);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [manageIntent, setManageIntent] = useState(false);
  const [claimCreateModalOpen, setClaimCreateModalOpen] = useState(false);
  const [claimCreateModalMode, setClaimCreateModalMode] =
    useState<"choose" | "claim">("choose");

  useEffect(() => {
    if (!user?.id) {
      setManageIntent(false);
      return;
    }

    let cancelled = false;
    void resolveOnboardingIntent(user.id).then((intent) => {
      if (!cancelled) setManageIntent(intent === "manage");
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isClaimFocusedExplore = claimMode || manageIntent;

  const focusClubSearch = useCallback(() => {
    searchInputRef.current?.focus();
    document.getElementById("all-clubs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToExploreTop = useCallback(() => {
    document.getElementById("explore-top")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

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
        .eq("is_published", true)
        .eq("setup_completed", true)
        .eq("claim_status", "active")
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

  const discoverableClubs = useMemo(() => {
    if (isClaimFocusedExplore) return clubs;

    return clubs.filter((club) => {
      if (isClubPubliclyDiscoverable(club)) return true;
      if (!user?.id) return false;
      if (isJoined(club.id) || isPending(club.id)) return true;
      const role = getUserRole(club.id);
      return role === "owner" || role === "executive";
    });
  }, [clubs, isClaimFocusedExplore, user?.id, isJoined, isPending, getUserRole]);

  const [claimMetaReady, setClaimMetaReady] = useState(false);
  const [activeOwnerCountByClubId, setActiveOwnerCountByClubId] = useState<
    Record<string, number>
  >({});
  const [pendingClaimClubIds, setPendingClaimClubIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [userPendingClaimClubIds, setUserPendingClaimClubIds] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    if (clubs.length === 0) {
      setActiveOwnerCountByClubId({});
      setPendingClaimClubIds(new Set());
      setUserPendingClaimClubIds(new Set());
      setClaimMetaReady(true);
      return;
    }

    let cancelled = false;
    setClaimMetaReady(false);

    void (async () => {
      const clubIds = clubs.map((club) => club.id);

      const [ownersRes, pendingRes, userPendingRes] = await Promise.all([
        supabase
          .from("club_members")
          .select("club_id")
          .eq("role", "owner")
          .eq("status", "active")
          .in("club_id", clubIds),
        supabase
          .from("club_claim_requests")
          .select("club_id")
          .in("club_id", clubIds)
          .in("status", ["pending", "more_info"]),
        user?.id
          ? supabase
              .from("club_claim_requests")
              .select("club_id")
              .eq("submitted_by", user.id)
              .in("club_id", clubIds)
              .in("status", ["pending", "more_info"])
          : Promise.resolve({ data: [] as { club_id: string }[] }),
      ]);

      if (cancelled) return;

      const ownerCounts: Record<string, number> = {};
      for (const row of ownersRes.data ?? []) {
        const clubId = row.club_id as string;
        ownerCounts[clubId] = (ownerCounts[clubId] ?? 0) + 1;
      }

      setActiveOwnerCountByClubId(ownerCounts);
      setPendingClaimClubIds(
        new Set((pendingRes.data ?? []).map((row) => row.club_id as string)),
      );
      setUserPendingClaimClubIds(
        new Set((userPendingRes.data ?? []).map((row) => row.club_id as string)),
      );
      setClaimMetaReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [clubs, user?.id]);

  const claimStateForClub = useCallback(
    (club: Club): ExploreClubClaimState => {
      if (!claimMetaReady) {
        return resolveExploreClubClaimStatePreMeta(club.claimStatus ?? "unclaimed");
      }

      return resolveExploreClubClaimState(
        club.claimStatus ?? "unclaimed",
        activeOwnerCountByClubId[club.id] ?? 0,
        pendingClaimClubIds.has(club.id),
        userPendingClaimClubIds.has(club.id),
      );
    },
    [
      claimMetaReady,
      activeOwnerCountByClubId,
      pendingClaimClubIds,
      userPendingClaimClubIds,
    ],
  );

  const managesClub = useCallback(
    (clubId: string) => {
      const role = getUserRole(clubId);
      return role === "owner" || role === "executive";
    },
    [getUserRole],
  );

  const categories = useMemo(() => {
    return [
      "All",
      ...clubCategoryFilterOptions(
        discoverableClubs
          .map((club) => club.category)
          .filter((value) => value.length > 0),
      ),
    ];
  }, [discoverableClubs]);

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
    () => sortClubsByMemberActivity(discoverableClubs).slice(0, 6),
    [discoverableClubs],
  );

  const featuredCategoryRows = useMemo(() => {
    const order = ["Business", "Science", "Culture", "Sports", "Community"];
    return order
      .map((category) => ({
        category,
        clubs: sortClubsByMemberActivity(
          discoverableClubs.filter(
            (club) => club.category.toLowerCase() === category.toLowerCase(),
          ),
        ).slice(0, 6),
      }))
      .filter((row) => row.clubs.length > 0)
      .slice(0, 2);
  }, [discoverableClubs]);

  const filteredClubs = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = discoverableClubs.filter((club) => {
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
  }, [discoverableClubs, search, activeCategory]);

  const displayClubs = useMemo(() => {
    if (!claimMode || !claimMetaReady) return filteredClubs;
    const unclaimed = filteredClubs.filter(
      (club) => claimStateForClub(club) === "claimable",
    );
    const claimed = filteredClubs.filter(
      (club) => claimStateForClub(club) !== "claimable",
    );
    return [...unclaimed, ...claimed];
  }, [filteredClubs, claimMode, claimMetaReady, claimStateForClub]);

  const claimableClubs = useMemo(
    () =>
      sortClubsByMemberActivity(
        clubs.filter((club) => claimStateForClub(club) === "claimable"),
      ),
    [clubs, claimStateForClub],
  );

  const categoryCount = Math.max(categories.length - 1, 0);
  const clubCountLabel =
    discoverableClubs.length >= 260
      ? "260+"
      : discoverableClubs.length > 0
        ? String(discoverableClubs.length)
        : "0";

  const emptyStateMessage = useMemo(() => {
    if (isClaimFocusedExplore && (search || activeCategory !== "All")) {
      return {
        title: "No matching clubs found",
        description: "Can't find your club? Create a new club profile.",
        showCreateClub: true,
      };
    }
    if (search || activeCategory !== "All") {
      return {
        title: "No clubs found",
        description: "Try searching a different keyword or clearing your filters.",
        showCreateClub: false,
      };
    }
    if (isClaimFocusedExplore) {
      return {
        title: "No clubs available to search yet",
        description: "Can't find your club? Create a new club profile.",
        showCreateClub: true,
      };
    }
    return {
      title: "No clubs available",
      description: "There are no clubs to display right now.",
      showCreateClub: false,
    };
  }, [search, activeCategory, isClaimFocusedExplore]);

  return (
    <div style={{ backgroundColor: PAGE_BG, minHeight: "100%" }}>
      {/* Hero */}
      <section id="explore-top" style={{ backgroundColor: PAGE_BG }}>
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
            Explore Clubs at <span style={{ color: ACCENT_RED }}>Guelph</span>
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "#555555",
              marginTop: "8px",
              marginBottom: 0,
              lineHeight: 1.45,
              maxWidth: "640px",
            }}
          >
            Find clubs to join, follow updates, and show interest — or claim a club profile if
            you&apos;re an executive.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              onClick={focusClubSearch}
              style={{
                background: ACCENT_RED,
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Browse Clubs
            </button>
            <button
              type="button"
              onClick={() => {
                setClaimCreateModalMode("choose");
                setClaimCreateModalOpen(true);
              }}
              style={{
                background: "transparent",
                color: "#888888",
                border: "1px solid #333333",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              Claim or Create a Club
            </button>
          </div>

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
              inputRef={searchInputRef}
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
          </div>
        </div>
      </section>

      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: PAGE_BG, paddingTop: 0 }}
      >
        {/* Discovery rows — hidden in claim-focused manage path */}
        {!isClaimFocusedExplore && !loading && !hasActiveFilters ? (
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
                      claimState={claimStateForClub(club)}
                      userManagesClub={managesClub(club.id)}
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
                  claimStateForClub={claimStateForClub}
                  managesClub={managesClub}
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
                    {search !== "" ? "Search Results" : "Clubs to Explore"}
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
                    claimState={claimStateForClub(club)}
                    userManagesClub={managesClub(club.id)}
                    claimFocused={isClaimFocusedExplore}
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
              {emptyStateMessage.showCreateClub ? (
                <Link
                  to={user ? "/app/create-club" : "/signup?redirect=/app/create-club"}
                  style={{
                    display: "inline-block",
                    marginTop: "20px",
                    background: ACCENT_RED,
                    color: "#ffffff",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Create a New Club
                </Link>
              ) : null}
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

          {!loading && !error ? (
            <div
              style={{
                marginTop: "32px",
                border: "1px solid #242424",
                borderRadius: "14px",
                background: "#141414",
                padding: isMobile ? "20px" : "24px",
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#ffffff",
                    fontSize: "18px",
                    fontWeight: 800,
                  }}
                >
                  Couldn&apos;t find your club?
                </h3>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#777777",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  Create a new club request or jump back to the top to search again.
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  justifyContent: isMobile ? "stretch" : "flex-end",
                }}
              >
                <Link
                  to={user ? "/app/create-club" : "/signup?redirect=/app/create-club"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: ACCENT_RED,
                    color: "#ffffff",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    textDecoration: "none",
                    flex: isMobile ? "1 1 auto" : undefined,
                  }}
                >
                  Create a Club
                </Link>
                <button
                  type="button"
                  onClick={scrollToExploreTop}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    color: "#cccccc",
                    border: "1px solid #333333",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    flex: isMobile ? "1 1 auto" : undefined,
                  }}
                >
                  Back to Top ↑
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {claimCreateModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-create-club-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.72)",
            padding: "18px",
          }}
          onClick={() => setClaimCreateModalOpen(false)}
        >
          <div
            role="presentation"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: claimCreateModalMode === "claim" ? "720px" : "560px",
              maxHeight: "86vh",
              overflowY: "auto",
              background: "#141414",
              border: "1px solid #2a2a2a",
              borderRadius: "16px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              padding: isMobile ? "20px" : "24px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "18px",
              }}
            >
              <div>
                <h2
                  id="claim-create-club-title"
                  style={{
                    margin: 0,
                    color: "#ffffff",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {claimCreateModalMode === "claim"
                    ? "Claim an Existing Club"
                    : "Claim or Create a Club"}
                </h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#777777",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  {claimCreateModalMode === "claim"
                    ? "Choose an unclaimed club profile to start the claim request."
                    : "Claim an existing club profile if your club is already listed, or create a new club request."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setClaimCreateModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  borderRadius: "999px",
                  color: "#999999",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {claimCreateModalMode === "choose" ? (
              <div style={{ display: "grid", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setClaimCreateModalMode("claim")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "18px",
                    width: "100%",
                    textAlign: "left",
                    background: "#1a1a1a",
                    border: "1px solid #333333",
                    borderRadius: "12px",
                    padding: "16px",
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <span>
                    <span style={{ display: "block", fontSize: "15px", fontWeight: 800 }}>
                      Claim a Club
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: "5px",
                        color: "#777777",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      See clubs that are available to claim and submit a request for admin review.
                    </span>
                  </span>
                  <span style={{ color: ACCENT_RED, fontWeight: 800 }}>→</span>
                </button>

                <Link
                  to={user ? "/app/create-club" : "/signup?redirect=/app/create-club"}
                  onClick={() => setClaimCreateModalOpen(false)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "18px",
                    width: "100%",
                    textAlign: "left",
                    background: ACCENT_RED,
                    border: "1px solid #E51937",
                    borderRadius: "12px",
                    padding: "16px",
                    color: "#ffffff",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <span>
                    <span style={{ display: "block", fontSize: "15px", fontWeight: 800 }}>
                      Create a Club
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: "5px",
                        color: "rgba(255,255,255,0.78)",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      Start the new club request process for a club that is not listed yet.
                    </span>
                  </span>
                  <span style={{ fontWeight: 800 }}>→</span>
                </Link>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setClaimCreateModalMode("choose")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#888888",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: 0,
                    cursor: "pointer",
                    marginBottom: "14px",
                  }}
                >
                  ← Back to options
                </button>

                {!claimMetaReady ? (
                  <div style={{ display: "grid", gap: "10px" }} aria-busy="true" aria-label="Loading claimable clubs">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        style={{
                          height: "52px",
                          borderRadius: "10px",
                          background: "#1f1f1f",
                          border: "1px solid #2a2a2a",
                        }}
                      />
                    ))}
                  </div>
                ) : claimableClubs.length === 0 ? (
                  <div
                    style={{
                      border: "1px solid #2a2a2a",
                      borderRadius: "12px",
                      padding: "22px",
                      textAlign: "center",
                      background: "#111111",
                    }}
                  >
                    <p style={{ margin: 0, color: "#ffffff", fontSize: "15px", fontWeight: 700 }}>
                      No clubs are currently available to claim.
                    </p>
                    <p style={{ margin: "8px 0 0", color: "#777777", fontSize: "13px" }}>
                      If your club is not listed, create a new club request instead.
                    </p>
                    <Link
                      to={user ? "/app/create-club" : "/signup?redirect=/app/create-club"}
                      onClick={() => setClaimCreateModalOpen(false)}
                      style={{
                        display: "inline-block",
                        marginTop: "16px",
                        background: ACCENT_RED,
                        color: "#ffffff",
                        borderRadius: "8px",
                        padding: "9px 16px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      Create a Club
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {claimableClubs.map((club) => (
                      <Link
                        key={club.id}
                        to={
                          user
                            ? `/clubs/${club.slug}/claim`
                            : `/signup?redirect=/clubs/${club.slug}/claim`
                        }
                        onClick={() => setClaimCreateModalOpen(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "14px",
                          border: "1px solid #2a2a2a",
                          borderRadius: "12px",
                          padding: "12px 14px",
                          background: "#111111",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              color: "#ffffff",
                              fontSize: "14px",
                              fontWeight: 800,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {club.name}
                          </span>
                          <span
                            style={{
                              display: "block",
                              marginTop: "3px",
                              color: "#777777",
                              fontSize: "12px",
                            }}
                          >
                            {club.category || "Club"} · {club.memberCount} member
                            {club.memberCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span
                          style={{
                            flexShrink: 0,
                            color: ACCENT_RED,
                            fontSize: "13px",
                            fontWeight: 800,
                          }}
                        >
                          Claim →
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
