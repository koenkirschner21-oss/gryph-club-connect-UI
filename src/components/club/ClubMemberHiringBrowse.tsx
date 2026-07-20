import { useMemo, useState, type CSSProperties } from "react";
import { Briefcase, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../hooks/useWindowWidth";
import PublicDetailBackButton from "../public/PublicDetailBackButton";
import {
  ApplicationModal,
  HiringDetailApplyButton,
  HiringDetailPanel,
  SaveRoleButton,
  commitmentLabel,
  deadlineLabel,
  positionTypeLabel,
  type BoardPosition,
  type CommitmentLevel,
  type ListingQuestion,
} from "../../pages/app/HiringBoardPage";
import {
  type HiringUploadFields,
} from "../../lib/hiringUploadFields";

export type ClubMemberHiringPosition = {
  id: string;
  title: string;
  description: string;
  requirements: string;
  positionType: string;
  commitmentLevel: CommitmentLevel;
  weeklyHours: number | null;
  deadline: string | null;
  isOpen: boolean;
  questions: ListingQuestion[];
  uploadFields: HiringUploadFields;
};

type ListTab = "all" | "saved" | "applied";

const LIST_TAB_OPTIONS: { value: ListTab; label: string }[] = [
  { value: "all", label: "All Roles" },
  { value: "saved", label: "Saved Roles" },
  { value: "applied", label: "Applied" },
];

const ROLE_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "executive", label: "Executive" },
  { value: "volunteer", label: "Volunteer" },
  { value: "general", label: "General" },
  { value: "member", label: "Member" },
  { value: "marketing", label: "Marketing" },
  { value: "events", label: "Events" },
  { value: "finance", label: "Finance" },
  { value: "technology", label: "Technology" },
  { value: "other", label: "Other" },
] as const;

const COMMITMENT_FILTER_OPTIONS = [
  { value: "all", label: "All commitment" },
  { value: "flexible", label: "Flexible" },
  { value: "part_time", label: "Part-time" },
  { value: "weekly_hours", label: "Weekly hours" },
] as const;

const filterSelectStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  color: "#cccccc",
  borderRadius: "8px",
  padding: "9px 34px 9px 12px",
  fontSize: "12px",
  cursor: "pointer",
  width: "100%",
  minWidth: 0,
  outline: "none",
  boxSizing: "border-box",
};

function boardFilterPillStyle(active: boolean): CSSProperties {
  return {
    background: active ? "#1a0505" : "transparent",
    border: active ? "1px solid #E51937" : "1px solid #2a2a2a",
    color: active ? "#E51937" : "#777777",
    borderRadius: "999px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  };
}

const tagStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  color: "#747676",
  borderRadius: "4px",
  padding: "2px 8px",
  fontSize: "10px",
  fontWeight: 500,
  display: "inline-block",
};

function previewText(description: string, max = 140): string {
  const trimmed = description.trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max).trimEnd();
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 40 ? slice.slice(0, lastSpace) : slice}…`;
}

function toBoardPosition(
  position: ClubMemberHiringPosition,
  club: {
    id: string;
    name: string;
    logoUrl?: string;
    bannerUrl?: string;
    slug?: string;
    description?: string;
  },
): BoardPosition {
  return {
    id: position.id,
    clubId: club.id,
    clubName: club.name,
    clubLogoUrl: club.logoUrl,
    clubBannerUrl: club.bannerUrl,
    clubSlug: club.slug,
    clubDescription: club.description,
    title: position.title,
    description: position.description,
    requirements: position.requirements,
    positionType: position.positionType,
    commitmentLevel: position.commitmentLevel,
    weeklyHours: position.weeklyHours,
    deadline: position.deadline,
    createdAt: "",
    applicantCount: 0,
    questions: position.questions,
    uploadFields: position.uploadFields,
  };
}

function MemberRoleCard({
  position,
  selected,
  alreadyApplied,
  saved,
  user,
  onSelect,
  onApply,
  onToggleSave,
}: {
  position: ClubMemberHiringPosition;
  selected: boolean;
  alreadyApplied: boolean;
  saved: boolean;
  user: { id: string } | null;
  onSelect: () => void;
  onApply: () => void;
  onToggleSave: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const deadline = deadlineLabel(position.deadline);
  const preview = previewText(position.description);

  return (
    <article
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected || hovered ? "#1a1a1a" : "#111111",
        border: selected
          ? "1px solid #333333"
          : `1px solid ${hovered ? "#333333" : "#1e1e1e"}`,
        borderLeft: selected ? "3px solid #E51937" : undefined,
        borderRadius: "10px",
        marginBottom: "14px",
        cursor: "pointer",
        transition: "border-color 0.2s ease, background 0.2s ease",
        boxSizing: "border-box",
        padding: "20px",
      }}
    >
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        {position.title}
      </h3>

      <div
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          marginTop: "8px",
        }}
      >
        <span style={tagStyle}>{positionTypeLabel(position.positionType)}</span>
        <span style={tagStyle}>
          {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
        </span>
        {deadline ? <span style={tagStyle}>{deadline}</span> : null}
      </div>

      {preview ? (
        <p
          style={{
            fontSize: "13px",
            color: "#888888",
            margin: "10px 0 0",
            lineHeight: 1.45,
          }}
        >
          {preview}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "14px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {position.isOpen ? (
          <HiringDetailApplyButton
            user={user}
            alreadyApplied={alreadyApplied}
            onApply={onApply}
            size="compact"
          />
        ) : null}
        <SaveRoleButton
          compact
          saved={saved}
          disabled={!user}
          onToggle={onToggleSave}
        />
      </div>
    </article>
  );
}

export default function ClubMemberHiringBrowse({
  clubId,
  clubName,
  clubLogoUrl,
  clubBannerUrl,
  clubSlug,
  clubDescription,
  positions,
  myApplications,
  savedRoleIds,
  user,
  onToggleSave,
  onApplicationSubmitted,
}: {
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  clubBannerUrl?: string;
  clubSlug?: string;
  clubDescription?: string;
  positions: ClubMemberHiringPosition[];
  myApplications: Record<string, boolean>;
  savedRoleIds: Set<string>;
  user: { id: string } | null;
  onToggleSave: (positionId: string) => void;
  onApplicationSubmitted: (positionId: string) => void;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("all");
  const [roleTypeFilter, setRoleTypeFilter] = useState("all");
  const [commitmentFilter, setCommitmentFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [applyPosition, setApplyPosition] = useState<ClubMemberHiringPosition | null>(
    null,
  );

  const clubMeta = useMemo(
    () => ({
      id: clubId,
      name: clubName,
      logoUrl: clubLogoUrl,
      bannerUrl: clubBannerUrl,
      slug: clubSlug,
      description: clubDescription,
    }),
    [clubId, clubName, clubLogoUrl, clubBannerUrl, clubSlug, clubDescription],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return positions.filter((position) => {
      if (listTab === "saved" && !savedRoleIds.has(position.id)) return false;
      if (listTab === "applied" && !myApplications[position.id]) return false;
      if (roleTypeFilter !== "all" && position.positionType !== roleTypeFilter) {
        return false;
      }
      if (
        commitmentFilter !== "all" &&
        position.commitmentLevel !== commitmentFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        position.title.toLowerCase().includes(q) ||
        position.description.toLowerCase().includes(q) ||
        positionTypeLabel(position.positionType).toLowerCase().includes(q)
      );
    });
  }, [
    positions,
    listTab,
    savedRoleIds,
    myApplications,
    roleTypeFilter,
    commitmentFilter,
    search,
  ]);

  const activeSelectedId = useMemo(() => {
    if (filtered.length === 0) return null;
    if (selectedId && filtered.some((p) => p.id === selectedId)) {
      return selectedId;
    }
    return filtered[0]?.id ?? null;
  }, [filtered, selectedId]);

  const selectedPosition =
    activeSelectedId != null
      ? filtered.find((p) => p.id === activeSelectedId) ?? null
      : null;

  const selectedBoard = selectedPosition
    ? toBoardPosition(selectedPosition, clubMeta)
    : null;

  function openDetail(positionId: string) {
    setSelectedId(positionId);
    if (isMobile) setMobileDetailOpen(true);
  }

  function handleViewClub() {
    if (!clubSlug) return;
    navigate(`/clubs/${clubSlug}`);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 0,
          flex: 1,
          minHeight: isMobile ? undefined : "calc(100vh - 220px)",
          height: isMobile ? "auto" : "calc(100vh - 220px)",
        }}
      >
        <div
          style={{
            width: isMobile ? "100%" : "38%",
            minWidth: isMobile ? undefined : "280px",
            height: isMobile ? undefined : "100%",
            overflowY: "auto",
            borderRight: isMobile ? "none" : "1px solid #1a1a1a",
            paddingRight: isMobile ? 0 : "16px",
            boxSizing: "border-box",
            scrollbarWidth: "thin",
            scrollbarColor: "#333 transparent",
          }}
        >
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <Search
              size={16}
              aria-hidden
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#555555",
                pointerEvents: "none",
              }}
            />
            <input
              type="search"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: "100%",
                height: "44px",
                background: "#111111",
                border: `1px solid ${searchFocused ? "#E51937" : "#2a2a2a"}`,
                borderRadius: "8px",
                padding: "0 16px 0 40px",
                fontSize: "14px",
                color: "#ffffff",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            {LIST_TAB_OPTIONS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setListTab(tab.value)}
                style={boardFilterPillStyle(listTab === tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <select
              value={roleTypeFilter}
              onChange={(e) => setRoleTypeFilter(e.target.value)}
              aria-label="Filter by role type"
              style={filterSelectStyle}
            >
              {ROLE_TYPE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={commitmentFilter}
              onChange={(e) => setCommitmentFilter(e.target.value)}
              aria-label="Filter by commitment"
              style={filterSelectStyle}
            >
              {COMMITMENT_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "240px",
                textAlign: "center",
                padding: "24px 12px",
              }}
            >
              <Briefcase size={32} color="#333333" aria-hidden />
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#555555",
                  margin: "12px 0 0",
                }}
              >
                {listTab === "saved"
                  ? "No saved roles yet"
                  : listTab === "applied"
                    ? "No applications yet"
                    : "No open roles right now"}
              </p>
              <p style={{ fontSize: "13px", color: "#444444", marginTop: "6px" }}>
                {listTab === "all"
                  ? `Check back later for openings in ${clubName}.`
                  : "Try another filter or browse all roles."}
              </p>
            </div>
          ) : (
            filtered.map((position) => (
              <MemberRoleCard
                key={position.id}
                position={position}
                selected={!isMobile && activeSelectedId === position.id}
                alreadyApplied={Boolean(myApplications[position.id])}
                saved={savedRoleIds.has(position.id)}
                user={user}
                onSelect={() => openDetail(position.id)}
                onApply={() => setApplyPosition(position)}
                onToggleSave={() => onToggleSave(position.id)}
              />
            ))
          )}
        </div>

        {!isMobile ? (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              height: "100%",
              overflowY: "auto",
              paddingLeft: "16px",
              boxSizing: "border-box",
              scrollbarWidth: "thin",
              scrollbarColor: "#333 transparent",
            }}
          >
            {selectedBoard && selectedPosition ? (
              <div
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <HiringDetailPanel
                  position={selectedBoard}
                  user={user}
                  alreadyApplied={Boolean(myApplications[selectedPosition.id])}
                  saved={savedRoleIds.has(selectedPosition.id)}
                  canSave={Boolean(user)}
                  onApply={() => setApplyPosition(selectedPosition)}
                  onViewClub={handleViewClub}
                  onToggleSave={() => onToggleSave(selectedPosition.id)}
                  viewClubProfilePlacement="under-heading"
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "420px",
                  textAlign: "center",
                  background: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "12px",
                }}
              >
                <Briefcase size={36} color="#333333" aria-hidden />
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#555555",
                    margin: "12px 0 0",
                  }}
                >
                  Select a role
                </p>
                <p style={{ fontSize: "13px", color: "#444444", marginTop: "6px" }}>
                  Choose a position to read the full details and apply.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {isMobile && mobileDetailOpen && selectedBoard && selectedPosition ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "#111111",
            zIndex: 1000,
            overflowY: "auto",
            padding: "24px 16px",
            boxSizing: "border-box",
          }}
        >
          <PublicDetailBackButton
            label="Back to roles"
            onBack={() => setMobileDetailOpen(false)}
          />
          <HiringDetailPanel
            position={selectedBoard}
            user={user}
            alreadyApplied={Boolean(myApplications[selectedPosition.id])}
            saved={savedRoleIds.has(selectedPosition.id)}
            canSave={Boolean(user)}
            onApply={() => setApplyPosition(selectedPosition)}
            onViewClub={handleViewClub}
            onToggleSave={() => onToggleSave(selectedPosition.id)}
            viewClubProfilePlacement="under-heading"
          />
        </div>
      ) : null}

      {applyPosition && user?.id ? (
        <ApplicationModal
          position={toBoardPosition(applyPosition, clubMeta)}
          clubName={clubName}
          onClose={() => setApplyPosition(null)}
          onSubmitted={() => {
            onApplicationSubmitted(applyPosition.id);
          }}
        />
      ) : null}
    </>
  );
}
