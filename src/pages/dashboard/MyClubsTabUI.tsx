import type { CSSProperties } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Crown,
  Grid3x3,
  MoreVertical,
  Search,
  Star,
  User,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Club, MemberRole } from "../../types";

const CLUBS_PER_PAGE = 6;

const CHIP_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid #2a2a2a",
};

const CONTROL_STYLE: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "8px 14px",
  color: "#cccccc",
  fontSize: "13px",
};

export type ClubFilterOption = "all" | "managed" | "member" | "president" | "saved";
export type ClubSortOption = "recent" | "name" | "role" | "members";

export type MyClubsTabClub = Club;

export type ClubRoleDisplay = {
  label: string;
  color: string;
  borderColor?: string;
};

function deriveAbbreviation(name: string, maxLen = 3): string {
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

function roleSortValue(role: MemberRole | null): number {
  if (role === "owner") return 0;
  if (role === "executive") return 1;
  return 2;
}

function formatCategorySubtitle(club: Club): string | null {
  const category = club.category?.trim();
  const tags = (club.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const parts = category ? [category, ...tags.filter((tag) => tag !== category)] : tags;
  if (parts.length === 0) return null;
  return parts.join(" | ");
}

function isClubActive(club: Club): boolean {
  if (club.setupCompleted === false) return false;
  if (club.isPublished === false) return false;
  return true;
}

function resolveClubStatusLabel(club: Club, isPendingMembership: boolean): string | null {
  if (club.claimStatus === "claim_pending") return "Claim Pending";
  if (isPendingMembership) return "Pending";
  if (club.isPublished === false) return "Archived";
  if (club.setupCompleted === false) return "Inactive";
  if (!isClubActive(club)) return "Inactive";
  return null;
}

export function filterMyClubs(
  clubs: MyClubsTabClub[],
  search: string,
  filter: ClubFilterOption,
  getUserRole: (clubId: string) => MemberRole | null,
): MyClubsTabClub[] {
  const query = search.trim().toLowerCase();

  return clubs.filter((club) => {
    const role = getUserRole(club.id);

    if (filter !== "all" && filter !== "saved") {
      if (filter === "president" && role !== "owner") return false;
      if (filter === "managed" && role !== "owner") return false;
      if (filter === "member" && role !== "member") return false;
    }

    if (query && !club.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function sortMyClubs(
  clubs: MyClubsTabClub[],
  sort: ClubSortOption,
  getUserRole: (clubId: string) => MemberRole | null,
): MyClubsTabClub[] {
  const next = [...clubs];

  next.sort((a, b) => {
    if (sort === "name") {
      return a.name.localeCompare(b.name);
    }

    if (sort === "role") {
      return (
        roleSortValue(getUserRole(a.id)) - roleSortValue(getUserRole(b.id)) ||
        a.name.localeCompare(b.name)
      );
    }

    if (sort === "members") {
      return b.memberCount - a.memberCount || a.name.localeCompare(b.name);
    }

    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime || a.name.localeCompare(b.name);
  });

  return next;
}

export function paginateClubs<T>(clubs: T[], page: number, perPage = CLUBS_PER_PAGE) {
  const totalPages = Math.max(1, Math.ceil(clubs.length / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * perPage;
  const end = Math.min(start + perPage, clubs.length);
  return {
    items: clubs.slice(start, end),
    totalPages,
    safePage,
    start: clubs.length === 0 ? 0 : start + 1,
    end,
    total: clubs.length,
  };
}

export function MyClubsHeader() {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: "22px",
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        My Clubs
      </h2>
      <p style={{ margin: 0, fontSize: "13px", color: "#777777", lineHeight: 1.5 }}>
        Clubs you&apos;ve joined, manage, or saved for later.
      </p>
    </div>
  );
}

function MyClubsTabClubAvatar({
  name,
  abbreviation,
  logoUrl,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
}) {
  const abbr = abbreviation?.trim() || deriveAbbreviation(name);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "8px",
          border: "1px solid #2a2a2a",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "44px",
        height: "44px",
        borderRadius: "8px",
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: "12px",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {abbr}
    </div>
  );
}

const FILTER_OPTIONS: {
  value: ClubFilterOption;
  label: string;
  icon: typeof Grid3x3;
}[] = [
  { value: "all", label: "All Clubs", icon: Grid3x3 },
  { value: "managed", label: "Managed by Me", icon: Crown },
  { value: "member", label: "Member", icon: User },
  { value: "president", label: "President", icon: Star },
  { value: "saved", label: "Saved", icon: Bookmark },
];

export function MyClubsFilterBar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ClubFilterOption;
  onFilterChange: (value: ClubFilterOption) => void;
  sort: ClubSortOption;
  onSortChange: (value: ClubSortOption) => void;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
            minWidth: "240px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "10px 14px",
          }}
        >
          <Search size={16} color="#555555" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search clubs..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#ffffff",
              fontSize: "13px",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onFilterChange(option.value)}
                style={{
                  ...CHIP_BASE,
                  background: selected ? "#E51937" : "transparent",
                  border: selected ? "1px solid #E51937" : "1px solid #2a2a2a",
                  color: selected ? "#ffffff" : "#999999",
                }}
              >
                <Icon size={14} aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ClubSortOption)}
          style={CONTROL_STYLE}
          aria-label="Sort clubs"
        >
          <option value="recent">Recently Active</option>
          <option value="name">Name A-Z</option>
          <option value="role">Role</option>
          <option value="members">Member Count</option>
        </select>
      </div>
    </div>
  );
}

function MyClubsTabCard({
  club,
  logoUrl,
  roleDisplay,
  statusLabel,
  onOpenWorkspace,
  isMobile,
}: {
  club: MyClubsTabClub;
  logoUrl?: string;
  roleDisplay: ClubRoleDisplay;
  statusLabel: string | null;
  onOpenWorkspace: () => void;
  isMobile: boolean;
}) {
  const categorySubtitle = formatCategorySubtitle(club);
  const descriptionText =
    club.shortDescription?.trim() || club.description?.trim() || null;
  const roleBorderColor = roleDisplay.borderColor ?? roleDisplay.color;

  return (
    <div
      style={{
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "280px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "10px",
          }}
        >
          <MyClubsTabClubAvatar
            name={club.name}
            abbreviation={club.abbreviation}
            logoUrl={logoUrl}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.3,
                }}
              >
                {club.name}
              </p>
              <button
                type="button"
                aria-label="Club options"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#777777",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <MoreVertical size={16} aria-hidden />
              </button>
            </div>

            <div style={{ marginTop: "6px" }}>
              <span
                style={{
                  display: "inline-block",
                  borderRadius: "20px",
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: roleDisplay.color,
                  border: `1px solid ${roleBorderColor}`,
                  background: "transparent",
                  whiteSpace: "nowrap",
                }}
              >
                {roleDisplay.label}
              </span>
            </div>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "12px",
                color: categorySubtitle ? "#777777" : "transparent",
                lineHeight: 1.35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minHeight: "16px",
              }}
              title={categorySubtitle ?? undefined}
            >
              {categorySubtitle ?? "\u00A0"}
            </p>
          </div>
        </div>

        <p
          style={{
            margin: "0 0 10px",
            fontSize: "12px",
            color: descriptionText ? "#999999" : "#555555",
            fontStyle: descriptionText ? "normal" : "italic",
            lineHeight: 1.5,
            minHeight: "36px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {descriptionText ?? "No description added yet."}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "11px",
              color: "#777777",
            }}
          >
            <Users size={13} aria-hidden />
            {club.memberCount} Member{club.memberCount === 1 ? "" : "s"}
          </span>
          {statusLabel ? (
            <span
              style={{
                fontSize: "11px",
                color: "#888888",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          gap: "8px",
          marginTop: "auto",
          paddingTop: "4px",
        }}
      >
        <button
          type="button"
          onClick={onOpenWorkspace}
          style={{
            background: "#E51937",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            flex: isMobile ? undefined : 1,
            textAlign: "center",
            cursor: "pointer",
            border: "none",
          }}
        >
          Open Workspace
        </button>

        <Link
          to={`/clubs/${club.slug}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #2a2a2a",
            background: "transparent",
            color: "#999999",
            borderRadius: "6px",
            padding: "7px 12px",
            fontSize: "12px",
            fontWeight: 500,
            flex: isMobile ? undefined : "0 0 auto",
            textAlign: "center",
            textDecoration: "none",
            boxSizing: "border-box",
            whiteSpace: "nowrap",
          }}
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}

export function MyClubsGrid({
  clubs,
  clubLogos,
  getUserRole,
  formatClubRoleDisplay,
  isPendingMembership,
  onOpenWorkspace,
  isMobile,
}: {
  clubs: MyClubsTabClub[];
  clubLogos: Record<string, string>;
  getUserRole: (clubId: string) => MemberRole | null;
  formatClubRoleDisplay: (role: MemberRole | null | undefined) => ClubRoleDisplay;
  isPendingMembership: (clubId: string) => boolean;
  onOpenWorkspace: (clubId: string) => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "12px",
        alignItems: "stretch",
      }}
    >
      {clubs.map((club) => (
        <MyClubsTabCard
          key={club.id}
          club={club}
          logoUrl={clubLogos[club.id] ?? club.logoUrl}
          roleDisplay={formatClubRoleDisplay(getUserRole(club.id))}
          statusLabel={resolveClubStatusLabel(club, isPendingMembership(club.id))}
          onOpenWorkspace={() => onOpenWorkspace(club.id)}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}

export function MyClubsPagination({
  page,
  totalPages,
  start,
  end,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= CLUBS_PER_PAGE) return null;

  const pageButtonStyle = (active: boolean): CSSProperties => ({
    minWidth: "36px",
    height: "36px",
    background: active ? "#E51937" : "#1a1a1a",
    border: `1px solid ${active ? "#E51937" : "#2a2a2a"}`,
    borderRadius: "8px",
    color: active ? "#ffffff" : "#cccccc",
    fontSize: "13px",
    cursor: active ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });

  return (
    <div style={{ marginTop: "24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          style={{
            ...pageButtonStyle(false),
            opacity: page <= 1 ? 0.5 : 1,
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            style={pageButtonStyle(pageNumber === page)}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{
            ...pageButtonStyle(false),
            opacity: page >= totalPages ? 0.5 : 1,
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>

      <p
        style={{
          margin: "12px 0 0",
          textAlign: "center",
          fontSize: "12px",
          color: "#555555",
        }}
      >
        Showing {start}-{end} of {total} clubs
      </p>
    </div>
  );
}
