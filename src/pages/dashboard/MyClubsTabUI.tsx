import type { CSSProperties } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Search,
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

export type ClubFilterOption = "all" | "saved";
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
  _filter: ClubFilterOption,
  _getUserRole: (clubId: string) => MemberRole | null,
): MyClubsTabClub[] {
  const query = search.trim().toLowerCase();

  return clubs.filter((club) => {
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
        Quick access to the clubs you belong to and manage.
      </p>
    </div>
  );
}

function MyClubsTabClubAvatar({
  name,
  abbreviation,
  logoUrl,
  size = 44,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  size?: number;
}) {
  const abbr = abbreviation?.trim() || deriveAbbreviation(name);
  const fontSize = size >= 72 ? "22px" : "12px";
  const radius = size >= 72 ? "14px" : "8px";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: radius,
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
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888888",
        fontSize,
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
  { value: "saved", label: "Saved", icon: Bookmark },
];

export function MyClubsFilterBar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  showSearch,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ClubFilterOption;
  onFilterChange: (value: ClubFilterOption) => void;
  sort: ClubSortOption;
  onSortChange: (value: ClubSortOption) => void;
  showSearch: boolean;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: showSearch ? "12px" : 0,
        }}
      >
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
                  fontSize: "13px",
                  padding: "7px 14px",
                }}
              >
                <Icon size={14} aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>

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

      {showSearch ? (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            maxWidth: "420px",
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
      ) : null}
    </div>
  );
}

function MyClubsTabCard({
  club,
  logoUrl,
  roleDisplay,
  statusLabel,
  onOpenWorkspace,
}: {
  club: MyClubsTabClub;
  logoUrl?: string;
  roleDisplay: ClubRoleDisplay;
  statusLabel: string | null;
  onOpenWorkspace: () => void;
}) {
  const category = club.category?.trim();
  const metadataParts = [
    `${club.memberCount} member${club.memberCount === 1 ? "" : "s"}`,
    category || null,
  ].filter(Boolean);
  const roleBorderColor = roleDisplay.borderColor ?? roleDisplay.color;

  return (
    <div
      style={{
        background: "#141414",
        border: "1px solid #2a2a2a",
        borderRadius: "12px",
        padding: "20px 18px 16px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "260px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          flex: 1,
          minHeight: 0,
        }}
      >
        <MyClubsTabClubAvatar
          name={club.name}
          abbreviation={club.abbreviation}
          logoUrl={logoUrl}
          size={76}
        />

        <h3
          style={{
            margin: "14px 0 0",
            fontSize: "20px",
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.25,
            width: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {club.name}
        </h3>

        <div style={{ marginTop: "10px" }}>
          <span
            style={{
              display: "inline-block",
              borderRadius: "20px",
              padding: "3px 9px",
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
            margin: "10px 0 0",
            fontSize: "11px",
            color: "#666666",
            lineHeight: 1.4,
          }}
        >
          {metadataParts.join(" · ")}
        </p>

        {statusLabel ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "11px",
              color: "#888888",
              fontWeight: 500,
            }}
          >
            {statusLabel}
          </p>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "18px",
        }}
      >
        <button
          type="button"
          onClick={onOpenWorkspace}
          style={{
            width: "100%",
            background: "#E51937",
            color: "#ffffff",
            borderRadius: "8px",
            padding: "11px 14px",
            fontSize: "14px",
            fontWeight: 600,
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
            display: "block",
            textAlign: "center",
            color: "#777777",
            fontSize: "12px",
            fontWeight: 500,
            textDecoration: "none",
            padding: "4px 0",
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
  formatClubRoleDisplay: (
    role: MemberRole | null | undefined,
    options?: { isPendingMembership?: boolean; isSavedOnly?: boolean },
  ) => ClubRoleDisplay;
  isPendingMembership: (clubId: string) => boolean;
  onOpenWorkspace: (clubId: string) => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "16px",
        alignItems: "stretch",
      }}
    >
      {clubs.map((club) => (
        <MyClubsTabCard
          key={club.id}
          club={club}
          logoUrl={clubLogos[club.id] ?? club.logoUrl}
          roleDisplay={formatClubRoleDisplay(getUserRole(club.id), {
            isPendingMembership: isPendingMembership(club.id),
            isSavedOnly:
              getUserRole(club.id) == null && !isPendingMembership(club.id),
          })}
          statusLabel={resolveClubStatusLabel(club, isPendingMembership(club.id))}
          onOpenWorkspace={() => onOpenWorkspace(club.id)}
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
