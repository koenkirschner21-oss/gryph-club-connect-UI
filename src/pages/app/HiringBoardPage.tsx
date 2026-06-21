import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Bookmark, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { getClubInitials } from "../../lib/clubUtils";
import { supabase } from "../../lib/supabaseClient";
import {
  notifyHiringApplicationSubmitted,
  resolveStudentDisplayName,
} from "../../lib/notifications";
import {
  activeUploadSlots,
  HIRING_UPLOAD_SLOT_LABELS,
  MAX_HIRING_FILE_BYTES,
  parseHiringUploadFields,
  uploadHiringApplicationFile,
  type HiringUploadFields,
  type HiringUploadSlot,
} from "../../lib/hiringUploadFields";

export const POSITION_TYPES = [
  { value: "executive", label: "Executive" },
  { value: "member", label: "Member" },
  { value: "marketing", label: "Marketing" },
  { value: "events", label: "Events" },
  { value: "finance", label: "Finance" },
  { value: "technology", label: "Technology" },
  { value: "other", label: "Other" },
] as const;

export type PositionType = (typeof POSITION_TYPES)[number]["value"];

export type QuestionType = "text" | "multiple_choice" | "yes_no";

export interface PositionQuestion {
  id: string;
  position_id: string;
  question: string;
  question_type: QuestionType;
  options: string[] | null;
  required: boolean;
  order_index: number;
}

export interface PositionQuestionDraft {
  localId: string;
  id?: string;
  question: string;
  question_type: QuestionType;
  optionsText: string;
  required: boolean;
  order_index: number;
}

export type CommitmentLevel = "flexible" | "part_time" | "weekly_hours";

export interface ListingQuestion {
  id: string;
  question: string;
  type: "text" | "textarea";
  required: boolean;
}

export interface HiringApplicationAnswer {
  question_id: string;
  answer: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

export interface BoardPosition {
  id: string;
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  clubBannerUrl?: string;
  clubSlug?: string;
  clubDescription?: string;
  clubCategory?: string;
  title: string;
  description: string;
  requirements?: string;
  positionType: string;
  commitmentLevel: CommitmentLevel;
  weeklyHours: number | null;
  deadline: string | null;
  createdAt: string;
  applicantCount: number;
  questions: ListingQuestion[];
  uploadFields: HiringUploadFields;
}

const DEFAULT_APPLICATION_QUESTION_ID = "default-why";

export function parseListingQuestions(raw: unknown): ListingQuestion[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const question = (row.question as string)?.trim() ?? "";
      if (!question) return null;

      const typeRaw =
        (row.type as string) ??
        (row.question_type as string) ??
        "textarea";
      const type: ListingQuestion["type"] =
        typeRaw === "text" ? "text" : "textarea";

      return {
        id: (row.id as string) ?? `question-${index}`,
        question,
        type,
        required: row.required !== false,
      };
    })
    .filter((q): q is ListingQuestion => q !== null);
}

export function listingQuestionsForApply(raw: unknown): ListingQuestion[] {
  const parsed = parseListingQuestions(raw);
  if (parsed.length > 0) return parsed;

  return [
    {
      id: DEFAULT_APPLICATION_QUESTION_ID,
      question: "Why do you want this position?",
      type: "textarea",
      required: true,
    },
  ];
}

export const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
};

export const darkInputStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#ffffff",
  fontSize: "13px",
  boxSizing: "border-box",
};

export function positionTypeLabel(value: string): string {
  return POSITION_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function positionTypeBadgeStyle(type: string): CSSProperties {
  const base: CSSProperties = {
    background: "#111111",
    border: "1px solid #222222",
    color: "#747676",
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    display: "inline-block",
  };

  switch (type) {
    case "marketing":
      return { ...base, borderColor: "#2a1f00", color: "#FFC429" };
    case "events":
      return { ...base, borderColor: "#1a1a2a", color: "#E51937" };
    case "finance":
      return { ...base, borderColor: "#1a2a1a", color: "#4ade80" };
    case "technology":
      return { ...base, borderColor: "#2a2a3a", color: "#6b7cff" };
    case "executive":
      return { ...base, borderColor: "#2a1a2a", color: "#a78bfa" };
    default:
      return base;
  }
}

export function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v)).filter(Boolean);
  }
  return [];
}

export function parseOptionsText(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function deadlineLabel(deadline: string | null): string | null {
  if (!deadline) return null;
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return "Closed";
  if (days <= 3) return "Closing soon";
  return `${days} days left`;
}

type ListTab = "all" | "saved" | "applied";

const ROLE_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All role types" },
  { value: "executive", label: "Executive" },
  { value: "volunteer", label: "Volunteer" },
  { value: "general", label: "General" },
] as const;

const COMMITMENT_FILTER_OPTIONS = [
  { value: "all", label: "All commitment" },
  { value: "flexible", label: "Flexible" },
  { value: "part_time", label: "Part-time" },
  { value: "weekly_hours", label: "Weekly hours" },
] as const;

const DEADLINE_FILTER_OPTIONS = [
  { value: "all", label: "Any deadline" },
  { value: "closing_soon", label: "Closing soon" },
  { value: "has_deadline", label: "Has deadline" },
  { value: "no_deadline", label: "No deadline" },
] as const;

const LIST_TAB_OPTIONS: { value: ListTab; label: string }[] = [
  { value: "all", label: "All Roles" },
  { value: "saved", label: "Saved Roles" },
  { value: "applied", label: "Applied" },
];

const BANNER_HEIGHT = 200;

const filterSelectStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  color: "#cccccc",
  borderRadius: "8px",
  padding: "8px 32px 8px 12px",
  fontSize: "12px",
  cursor: "pointer",
  flex: "1 1 140px",
  minWidth: "120px",
  outline: "none",
  boxSizing: "border-box",
};

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

const listingTypeBadgeStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  color: "#747676",
  borderRadius: "4px",
  padding: "2px 8px",
  fontSize: "10px",
  fontWeight: 500,
  display: "inline-block",
};

function boardPositionTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    executive: "Executive",
    volunteer: "Volunteer",
    general: "General",
  };
  return labels[value] ?? positionTypeLabel(value);
}

export function commitmentLabel(
  level: string,
  weeklyHours: number | null,
): string {
  if (level === "part_time") return "Part-time";
  if (level === "weekly_hours" && weeklyHours != null && weeklyHours > 0) {
    return `${weeklyHours} hrs/week`;
  }
  return "Flexible";
}

function parseDeadlineDate(deadline: string): Date | null {
  const trimmed = deadline.trim();
  const end = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  return Number.isNaN(end.getTime()) ? null : end;
}

function sortBoardPositions(
  positions: BoardPosition[],
  sortBy: "newest" | "closing_soon" | "a-z",
): BoardPosition[] {
  const sorted = [...positions];

  if (sortBy === "newest") {
    return sorted.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  if (sortBy === "closing_soon") {
    return sorted.sort((a, b) => {
      const aDeadline = a.deadline ? parseDeadlineDate(a.deadline) : null;
      const bDeadline = b.deadline ? parseDeadlineDate(b.deadline) : null;

      if (!aDeadline && !bDeadline) return 0;
      if (!aDeadline) return 1;
      if (!bDeadline) return -1;

      return aDeadline.getTime() - bDeadline.getTime();
    });
  }

  return sorted.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
}

function postedDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function listingDeadlineDisplay(deadline: string | null): {
  text: string;
  withinSevenDays: boolean;
  passed: boolean;
} {
  if (!deadline) {
    return { text: "No deadline", withinSevenDays: false, passed: false };
  }
  const end = parseDeadlineDate(deadline);
  if (!end) {
    return { text: "No deadline", withinSevenDays: false, passed: false };
  }
  if (end.getTime() < Date.now()) {
    return { text: "Closed", withinSevenDays: false, passed: true };
  }
  const formatted = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return {
    text: `Closes ${formatted}`,
    withinSevenDays: days <= 7,
    passed: false,
  };
}

function isClosingSoon(deadline: string | null): boolean {
  if (!deadline) return false;
  const end = parseDeadlineDate(deadline);
  if (!end || end.getTime() < Date.now()) return false;
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days <= 7;
}

function deadlineBadgeStyle(deadline: string | null): CSSProperties | null {
  if (!deadline) return null;
  const meta = listingDeadlineDisplay(deadline);
  if (meta.passed) {
    return {
      ...listingTypeBadgeStyle,
      background: "#1a0505",
      border: "1px solid #3a1515",
      color: "#E51937",
    };
  }
  if (meta.withinSevenDays) {
    return {
      ...listingTypeBadgeStyle,
      background: "#1a1500",
      border: "1px solid #3a2f00",
      color: "#FFC429",
    };
  }
  return { ...listingTypeBadgeStyle, color: "#555555" };
}

function DetailSectionHeading({
  children,
  first = false,
}: {
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div style={{ marginTop: first ? "28px" : "36px", marginBottom: "12px" }}>
      <div
        style={{
          width: "28px",
          height: "2px",
          background: "#E51937",
          marginBottom: "10px",
        }}
      />
      <h3
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {children}
      </h3>
    </div>
  );
}

const detailBodyTextStyle: CSSProperties = {
  fontSize: "15px",
  color: "#cccccc",
  lineHeight: 1.8,
  margin: 0,
  whiteSpace: "pre-wrap",
};

const boardFilterPillStyle = (active: boolean): CSSProperties => ({
  background: active ? "#E51937" : "transparent",
  border: active ? "none" : "1px solid #333333",
  color: active ? "#ffffff" : "#777777",
  borderRadius: "20px",
  padding: "5px 14px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
});

function ViewClubProfileLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        fontSize: "13px",
        color: "#E51937",
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      View Club Profile →
    </button>
  );
}

function SaveRoleButton({
  saved,
  onToggle,
  compact = false,
  disabled = false,
}: {
  saved: boolean;
  onToggle: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      style={{
        background: saved ? "#1a1500" : "transparent",
        border: saved ? "1px solid #3a2f00" : "1px solid #333333",
        color: saved ? "#FFC429" : "#cccccc",
        borderRadius: compact ? "6px" : "8px",
        padding: compact ? "6px 12px" : "10px 18px",
        fontSize: compact ? "11px" : "13px",
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Bookmark size={compact ? 12 : 14} fill={saved ? "#FFC429" : "none"} />
      {saved ? "Saved" : "Save Role"}
    </button>
  );
}

function ClubAvatar({
  clubName,
  logoUrl,
  size,
  borderRadius,
}: {
  clubName: string;
  logoUrl?: string;
  size: number;
  borderRadius: number;
}) {
  const { bg, border } = getClubAvatarColors(clubName);
  const initials = getClubInitials({ name: clubName }).slice(0, 3);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <span
        style={{
          fontSize: size <= 36 ? "12px" : size <= 44 ? "14px" : "16px",
          fontWeight: 700,
          color: border,
          letterSpacing: "0.04em",
        }}
      >
        {initials}
      </span>
    </div>
  );
}

function CompactPositionTagsRow({ position }: { position: BoardPosition }) {
  const deadlineStyle = deadlineBadgeStyle(position.deadline);
  const deadline = position.deadline ? listingDeadlineDisplay(position.deadline) : null;
  const showCommitment =
    position.commitmentLevel === "part_time" ||
    (position.commitmentLevel === "weekly_hours" &&
      position.weeklyHours != null &&
      position.weeklyHours > 0);

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
        marginTop: "8px",
      }}
    >
      <span style={listingTypeBadgeStyle}>
        {boardPositionTypeLabel(position.positionType)}
      </span>
      {showCommitment ? (
        <span style={listingTypeBadgeStyle}>
          {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
        </span>
      ) : null}
      {deadlineStyle && deadline && !deadline.passed ? (
        <span style={deadlineStyle}>
          {deadline.withinSevenDays ? "Closing soon" : deadline.text}
        </span>
      ) : null}
      {deadline?.passed ? (
        <span style={deadlineStyle ?? listingTypeBadgeStyle}>Closed</span>
      ) : null}
    </div>
  );
}

const detailTagBadgeStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  color: "#747676",
  borderRadius: "4px",
  padding: "4px 10px",
  fontSize: "11px",
  display: "inline-block",
};

function DetailPositionTagsRow({ position }: { position: BoardPosition }) {
  const deadline = position.deadline ? listingDeadlineDisplay(position.deadline) : null;
  const deadlineStyle = deadlineBadgeStyle(position.deadline);
  const showCommitment =
    position.commitmentLevel === "part_time" ||
    (position.commitmentLevel === "weekly_hours" &&
      position.weeklyHours != null &&
      position.weeklyHours > 0);

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: 0,
      }}
    >
      <span style={detailTagBadgeStyle}>
        {boardPositionTypeLabel(position.positionType)}
      </span>
      {showCommitment ? (
        <span style={detailTagBadgeStyle}>
          {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
        </span>
      ) : null}
      {deadlineStyle && deadline && !deadline.passed ? (
        <span
          style={{
            ...deadlineStyle,
            borderRadius: "4px",
            padding: "4px 10px",
            fontSize: "11px",
          }}
        >
          {deadline.withinSevenDays ? "Closing soon" : deadline.text}
        </span>
      ) : null}
      {deadline?.passed ? (
        <span
          style={{
            ...detailTagBadgeStyle,
            background: "#1a0505",
            border: "1px solid #3a1515",
            color: "#E51937",
          }}
        >
          Closed
        </span>
      ) : null}
    </div>
  );
}

const LISTING_DESC_READ_MORE = " Read more";
const LISTING_DESC_LINE_HEIGHT = 1.5;
const LISTING_DESC_FONT_SIZE = 12;
const LISTING_DESC_MAX_LINES = 3;

function computeListingDescriptionPreview(
  description: string,
  widthPx: number,
): { preview: string | null } {
  if (!description || widthPx <= 0) return { preview: null };

  const measurer = document.createElement("p");
  measurer.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "pointer-events:none",
    "margin:0",
    `width:${widthPx}px`,
    `font-size:${LISTING_DESC_FONT_SIZE}px`,
    `line-height:${LISTING_DESC_LINE_HEIGHT}`,
  ].join(";");
  document.body.appendChild(measurer);

  const maxHeight = LISTING_DESC_FONT_SIZE * LISTING_DESC_LINE_HEIGHT * LISTING_DESC_MAX_LINES;

  const fits = (text: string) => {
    measurer.textContent = text;
    return measurer.scrollHeight <= maxHeight + 1;
  };

  try {
    if (fits(description)) {
      return { preview: null };
    }

    let low = 0;
    let high = description.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const slice = description.slice(0, mid).trimEnd();
      const candidate = `${slice}…${LISTING_DESC_READ_MORE}`;
      if (fits(candidate)) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let trimmed = description.slice(0, best).trimEnd();
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > trimmed.length * 0.55) {
      trimmed = trimmed.slice(0, lastSpace);
    }

    return { preview: `${trimmed}…` };
  } finally {
    document.body.removeChild(measurer);
  }
}

function HiringListingCard({
  position,
  selected,
  saved,
  onSelect,
  onReadMore,
  onToggleSave,
  canSave,
}: {
  position: BoardPosition;
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  onReadMore: () => void;
  onToggleSave: () => void;
  canSave: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const descWrapperRef = useRef<HTMLDivElement>(null);
  const [descriptionPreview, setDescriptionPreview] = useState<string | null>(null);
  const posted = postedDateLabel(position.createdAt);
  const description = position.description?.trim();
  const deadlineMeta = position.deadline
    ? listingDeadlineDisplay(position.deadline)
    : null;

  useLayoutEffect(() => {
    const wrapper = descWrapperRef.current;
    if (!wrapper || !description) {
      setDescriptionPreview(null);
      return;
    }

    const updatePreview = () => {
      const { preview } = computeListingDescriptionPreview(
        description,
        wrapper.clientWidth,
      );
      setDescriptionPreview(preview);
    };

    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [description, selected, hovered]);

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
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <ClubAvatar
          clubName={position.clubName}
          logoUrl={position.clubLogoUrl}
          size={40}
          borderRadius={8}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: "13px",
              color: "#dddddd",
              fontWeight: 500,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {position.clubName}
          </span>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#ffffff",
              marginTop: "4px",
              marginBottom: 0,
              lineHeight: 1.25,
            }}
          >
            {position.title}
          </h3>
        </div>
      </div>

      <CompactPositionTagsRow position={position} />

      {description ? (
        <div ref={descWrapperRef} style={{ marginTop: "10px" }}>
          <p
            style={{
              fontSize: `${LISTING_DESC_FONT_SIZE}px`,
              color: "#888888",
              margin: 0,
              lineHeight: LISTING_DESC_LINE_HEIGHT,
            }}
          >
            {descriptionPreview !== null ? (
              <>
                {descriptionPreview}{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReadMore();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    font: "inherit",
                    fontWeight: 500,
                    color: "#E51937",
                    cursor: "pointer",
                    display: "inline",
                  }}
                >
                  Read more
                </button>
              </>
            ) : (
              description
            )}
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "12px",
          fontSize: "11px",
          color: "#666666",
        }}
      >
        {posted ? <span>Posted {posted}</span> : null}
        {deadlineMeta && !deadlineMeta.passed && deadlineMeta.text !== "No deadline" ? (
          <span>{deadlineMeta.text}</span>
        ) : null}
        {position.applicantCount > 0 ? (
          <span>
            {position.applicantCount} applicant
            {position.applicantCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "14px",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReadMore();
          }}
          style={{
            background: "transparent",
            border: "1px solid #333333",
            color: "#cccccc",
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          View Role
        </button>
        <SaveRoleButton
          compact
          saved={saved}
          disabled={!canSave}
          onToggle={onToggleSave}
        />
      </div>
    </article>
  );
}

function HiringDetailApplyButton({
  user,
  alreadyApplied,
  onApply,
  size = "default",
}: {
  user: { id: string } | null;
  alreadyApplied: boolean;
  onApply: () => void;
  size?: "default" | "compact";
}) {
  const baseStyle: CSSProperties = {
    background: "#E51937",
    color: "#ffffff",
    borderRadius: "8px",
    padding: size === "compact" ? "8px 20px" : "10px 24px",
    fontSize: size === "compact" ? "13px" : "14px",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
  };

  if (!user) {
    return (
      <button type="button" onClick={onApply} style={baseStyle}>
        Sign In to Apply
      </button>
    );
  }

  if (alreadyApplied) {
    return (
      <button
        type="button"
        disabled
        style={{
          background: "transparent",
          border: "1px solid #E51937",
          color: "#E51937",
          borderRadius: "8px",
          padding: "8px 16px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "default",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        Application Submitted ✓
      </button>
    );
  }

  return (
    <button type="button" onClick={onApply} style={baseStyle}>
      Apply Now
    </button>
  );
}

function HiringDetailActionRow({
  position,
  user,
  alreadyApplied,
  saved,
  canSave,
  onApply,
  onViewClub,
  onToggleSave,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  saved: boolean;
  canSave: boolean;
  onApply: () => void;
  onViewClub: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        alignItems: "center",
        marginTop: "16px",
      }}
    >
      <HiringDetailApplyButton
        user={user}
        alreadyApplied={alreadyApplied}
        onApply={onApply}
      />
      <SaveRoleButton saved={saved} disabled={!canSave} onToggle={onToggleSave} />
      {position.clubSlug ? <ViewClubProfileLink onClick={onViewClub} /> : null}
    </div>
  );
}

function HiringDetailContent({
  position,
  user,
  alreadyApplied,
  saved,
  canSave,
  onApply,
  onViewClub,
  onToggleSave,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  saved: boolean;
  canSave: boolean;
  onApply: () => void;
  onViewClub: () => void;
  onToggleSave: () => void;
}) {
  const deadline = listingDeadlineDisplay(position.deadline);
  const deadlineColor = deadline.passed
    ? "#E51937"
    : deadline.withinSevenDays
      ? "#FFC429"
      : "#cccccc";

  const deadlineText = deadline.passed
    ? "Closed"
    : position.deadline
      ? (() => {
          const end = parseDeadlineDate(position.deadline);
          return end
            ? end.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "No deadline listed";
        })()
      : "No deadline listed";

  return (
    <>
      <div
        style={{
          paddingBottom: "24px",
          borderBottom: "1px solid #1e1e1e",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <ClubAvatar
            clubName={position.clubName}
            logoUrl={position.clubLogoUrl}
            size={52}
            borderRadius={12}
          />
          <div>
            <p style={{ fontSize: "14px", color: "#777777", margin: 0 }}>
              {position.clubName}
            </p>
            {position.clubSlug ? (
              <div style={{ marginTop: "4px" }}>
                <ViewClubProfileLink onClick={onViewClub} />
              </div>
            ) : null}
          </div>
        </div>

        <h2
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#ffffff",
            marginTop: "16px",
            marginBottom: 0,
            lineHeight: 1.1,
          }}
        >
          {position.title}
        </h2>

        <DetailPositionTagsRow position={position} />

        <HiringDetailActionRow
          position={position}
          user={user}
          alreadyApplied={alreadyApplied}
          saved={saved}
          canSave={canSave}
          onApply={onApply}
          onViewClub={onViewClub}
          onToggleSave={onToggleSave}
        />
      </div>

      <div>
        <DetailSectionHeading first>About this role</DetailSectionHeading>
        <p
          style={{
            fontSize: "14px",
            color: "#cccccc",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {position.description || "No description provided."}
        </p>
        {!alreadyApplied ? (
          <div style={{ marginTop: "20px" }}>
            <HiringDetailApplyButton
              user={user}
              alreadyApplied={alreadyApplied}
              onApply={onApply}
              size="compact"
            />
          </div>
        ) : null}
      </div>

      {position.requirements?.trim() ? (
        <div>
          <DetailSectionHeading>Requirements</DetailSectionHeading>
          <p
            style={{
              fontSize: "14px",
              color: "#cccccc",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {position.requirements}
          </p>
        </div>
      ) : null}

      {(position.commitmentLevel === "part_time" ||
        (position.commitmentLevel === "weekly_hours" &&
          position.weeklyHours != null &&
          position.weeklyHours > 0)) ? (
        <div>
          <DetailSectionHeading>Time commitment</DetailSectionHeading>
          <p
            style={{
              fontSize: "14px",
              color: "#cccccc",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
          </p>
        </div>
      ) : null}

      {position.deadline ? (
        <div>
          <DetailSectionHeading>Application deadline</DetailSectionHeading>
          <p
            style={{
              fontSize: "14px",
              color: deadlineColor,
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {deadlineText}
          </p>
        </div>
      ) : null}

      {position.clubDescription?.trim() ? (
        <div>
          <DetailSectionHeading>About the club</DetailSectionHeading>
          <p
            style={{
              fontSize: "14px",
              color: "#cccccc",
              lineHeight: 1.7,
              marginBottom: "8px",
              whiteSpace: "pre-wrap",
            }}
          >
            {position.clubDescription}
          </p>
          {position.clubSlug ? (
            <ViewClubProfileLink onClick={onViewClub} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function HiringClubBannerFit({ bannerUrl }: { bannerUrl: string }) {
  return (
    <img
      src={bannerUrl}
      alt=""
      style={{
        width: "100%",
        height: BANNER_HEIGHT,
        objectFit: "cover",
        display: "block",
        background: "#1a1a1a",
      }}
    />
  );
}

function HiringDetailPanel({
  position,
  user,
  alreadyApplied,
  saved,
  canSave,
  onApply,
  onViewClub,
  onToggleSave,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  saved: boolean;
  canSave: boolean;
  onApply: () => void;
  onViewClub: () => void;
  onToggleSave: () => void;
}) {
  const deadline = position.deadline
    ? listingDeadlineDisplay(position.deadline)
    : null;
  const deadlineColor = deadline?.passed
    ? "#E51937"
    : deadline?.withinSevenDays
      ? "#FFC429"
      : "#cccccc";

  const deadlineText = deadline?.passed
    ? "Closed"
    : position.deadline
      ? (() => {
          const end = parseDeadlineDate(position.deadline);
          return end
            ? end.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "";
        })()
      : "";

  return (
    <div>
      <div
        style={{
          position: "relative",
          width: "100%",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            height: BANNER_HEIGHT,
            overflow: "hidden",
            position: "relative",
            backgroundColor: "#0f0f0f",
            backgroundImage: position.clubBannerUrl
              ? undefined
              : "linear-gradient(135deg, #1a0505 0%, #111111 60%, #0f0f0f 100%)",
          }}
        >
          {position.clubBannerUrl ? (
            <HiringClubBannerFit bannerUrl={position.clubBannerUrl} />
          ) : null}
        </div>
        <div
          style={{
            position: "absolute",
            left: "32px",
            bottom: 0,
            transform: "translateY(50%)",
            zIndex: 2,
            width: "56px",
            height: "56px",
            borderRadius: "12px",
            border: "3px solid #0f0f0f",
            overflow: "hidden",
            boxSizing: "border-box",
            background: "#0f0f0f",
          }}
        >
          <ClubAvatar
            clubName={position.clubName}
            logoUrl={position.clubLogoUrl}
            size={56}
            borderRadius={12}
          />
        </div>
      </div>

      <div
        style={{
          width: "100%",
          padding: "36px 24px 32px",
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            fontSize: "22px",
            color: "#dddddd",
            fontWeight: 600,
            margin: "0 0 6px",
            lineHeight: 1.2,
          }}
        >
          {position.clubName}
        </p>
        {position.clubSlug ? (
          <div style={{ marginBottom: "16px" }}>
            <ViewClubProfileLink onClick={onViewClub} />
          </div>
        ) : null}

        <h2
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 14px",
            lineHeight: 1.1,
          }}
        >
          {position.title}
        </h2>

        <div
          style={{
            borderBottom: "1px solid #1e1e1e",
            marginBottom: "8px",
            paddingBottom: "20px",
          }}
        >
          <DetailPositionTagsRow position={position} />
        </div>

        <HiringDetailActionRow
          position={position}
          user={user}
          alreadyApplied={alreadyApplied}
          saved={saved}
          canSave={canSave}
          onApply={onApply}
          onViewClub={onViewClub}
          onToggleSave={onToggleSave}
        />

        <DetailSectionHeading first>About this role</DetailSectionHeading>
        <p style={detailBodyTextStyle}>
          {position.description || "No description provided."}
        </p>
        {!alreadyApplied ? (
          <div style={{ marginTop: "20px" }}>
            <HiringDetailApplyButton
              user={user}
              alreadyApplied={alreadyApplied}
              onApply={onApply}
              size="compact"
            />
          </div>
        ) : null}

        {position.requirements?.trim() ? (
          <>
            <DetailSectionHeading>Requirements</DetailSectionHeading>
            <p style={detailBodyTextStyle}>{position.requirements}</p>
          </>
        ) : null}

        {(position.commitmentLevel === "part_time" ||
          (position.commitmentLevel === "weekly_hours" &&
            position.weeklyHours != null &&
            position.weeklyHours > 0)) ? (
          <>
            <DetailSectionHeading>Time commitment</DetailSectionHeading>
            <p style={detailBodyTextStyle}>
              {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
            </p>
          </>
        ) : null}

        {position.deadline && deadlineText ? (
          <>
            <DetailSectionHeading>Application deadline</DetailSectionHeading>
            <p style={{ ...detailBodyTextStyle, color: deadlineColor }}>
              {deadlineText}
            </p>
          </>
        ) : null}

        {position.clubDescription?.trim() ? (
          <>
            <DetailSectionHeading>About the club</DetailSectionHeading>
            <p style={{ ...detailBodyTextStyle, marginBottom: "8px" }}>
              {position.clubDescription}
            </p>
            {position.clubSlug ? (
              <ViewClubProfileLink onClick={onViewClub} />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function HiringListingDetailOverlay({
  position,
  user,
  alreadyApplied,
  saved,
  canSave,
  onClose,
  onApply,
  onViewClub,
  onToggleSave,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  saved: boolean;
  canSave: boolean;
  onClose: () => void;
  onApply: () => void;
  onViewClub: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${position.title} details`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 1100,
        overflowY: "auto",
        padding: "32px 24px",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "820px",
          margin: "0 auto",
          background: "#0f0f0f",
          borderRadius: "12px",
          overflow: "hidden",
          position: "relative",
          border: "1px solid #2a2a2a",
        }}
      >
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            zIndex: 10,
            background: "rgba(0,0,0,0.65)",
            border: "none",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#cccccc",
          }}
        >
          <X size={20} aria-hidden />
        </button>
        <HiringDetailPanel
          position={position}
          user={user}
          alreadyApplied={alreadyApplied}
          saved={saved}
          canSave={canSave}
          onApply={onApply}
          onViewClub={onViewClub}
          onToggleSave={onToggleSave}
        />
      </div>
    </div>
  );
}

function HiringDetailMobileModal({
  position,
  user,
  alreadyApplied,
  saved,
  canSave,
  onClose,
  onApply,
  onViewClub,
  onToggleSave,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  saved: boolean;
  canSave: boolean;
  onClose: () => void;
  onApply: () => void;
  onViewClub: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "#111111",
        zIndex: 1000,
        overflowY: "auto",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          marginBottom: "20px",
          fontSize: "13px",
          color: "#E51937",
          cursor: "pointer",
        }}
      >
        ← Back to listings
      </button>
      <HiringDetailContent
        position={position}
        user={user}
        alreadyApplied={alreadyApplied}
        saved={saved}
        canSave={canSave}
        onApply={onApply}
        onViewClub={onViewClub}
        onToggleSave={onToggleSave}
      />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function PositionQuestionBuilder({
  questions,
  onChange,
  heading = "Application Questions",
}: {
  questions: PositionQuestionDraft[];
  onChange: (questions: PositionQuestionDraft[]) => void;
  heading?: string;
}) {
  const update = (localId: string, patch: Partial<PositionQuestionDraft>) => {
    onChange(
      questions.map((q) => (q.localId === localId ? { ...q, ...patch } : q)),
    );
  };

  const remove = (localId: string) => {
    onChange(
      questions
        .filter((q) => q.localId !== localId)
        .map((q, i) => ({ ...q, order_index: i })),
    );
  };

  const add = () => {
    onChange([
      ...questions,
      {
        localId: crypto.randomUUID(),
        question: "",
        question_type: "text",
        optionsText: "",
        required: false,
        order_index: questions.length,
      },
    ]);
  };

  return (
    <div>
      <p
        style={{
          fontSize: "12px",
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "10px",
        }}
      >
        {heading}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {questions.map((q) => (
          <div
            key={q.localId}
            style={{
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <input
                type="text"
                value={q.question}
                onChange={(e) => update(q.localId, { question: e.target.value })}
                placeholder="Question text"
                style={{ ...darkInputStyle, flex: 1 }}
              />
              <select
                value={q.question_type}
                onChange={(e) =>
                  update(q.localId, {
                    question_type: e.target.value as QuestionType,
                  })
                }
                style={{ ...darkInputStyle, width: "160px" }}
              >
                <option value="text">Text</option>
                <option value="multiple_choice">Multiple choice</option>
                <option value="yes_no">Yes / No</option>
              </select>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "#888888",
                  whiteSpace: "nowrap",
                  paddingTop: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) =>
                    update(q.localId, { required: e.target.checked })
                  }
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => remove(q.localId)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                }}
                aria-label="Delete question"
              >
                <TrashIcon />
              </button>
            </div>
            {q.question_type === "multiple_choice" ? (
              <input
                type="text"
                value={q.optionsText}
                onChange={(e) =>
                  update(q.localId, { optionsText: e.target.value })
                }
                placeholder="Options (comma-separated)"
                style={{ ...darkInputStyle, width: "100%", marginTop: "10px" }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        style={{
          marginTop: "12px",
          background: "transparent",
          border: "1px solid #333333",
          color: "#cccccc",
          borderRadius: "6px",
          padding: "6px 14px",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        + Add Question
      </button>
    </div>
  );
}

export function ApplicationModal({
  position,
  clubName,
  onClose,
  onSubmitted,
}: {
  position: BoardPosition;
  clubName: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<{
    fullName: string;
    avatarUrl?: string;
  } | null>(null);
  const selectedListing = position;
  const displayQuestions = listingQuestionsForApply(selectedListing.questions);
  const uploadSlots = activeUploadSlots(selectedListing.uploadFields);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [uploadFiles, setUploadFiles] = useState<
    Partial<Record<HiringUploadSlot, File>>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      console.log("Questions:", selectedListing?.questions);

      const [profileRes, appRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("hiring_applications")
          .select("id")
          .eq("listing_id", selectedListing.id)
          .eq("applicant_id", userId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (profileRes.data) {
        setProfile({
          fullName: (profileRes.data.full_name as string) ?? "Member",
          avatarUrl: (profileRes.data.avatar_url as string) ?? undefined,
        });
      }

      setAlreadyApplied(!!appRes.data);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedListing.id, selectedListing.questions, user?.id]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const q of displayQuestions) {
      if (q.required && !(answers[q.id] ?? "").trim()) {
        next[q.id] = "This question is required.";
      }
    }
    for (const { slot, setting } of uploadSlots) {
      if (setting === "required" && !uploadFiles[slot]) {
        next[`upload_${slot}`] = `${HIRING_UPLOAD_SLOT_LABELS[slot]} is required.`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!user?.id || !validate()) return;
    setSubmitting(true);

    const answersPayload: HiringApplicationAnswer[] = displayQuestions.map((q) => ({
      question_id: q.id,
      answer: (answers[q.id] ?? "").trim(),
    }));

    for (const { slot } of uploadSlots) {
      const file = uploadFiles[slot];
      if (!file) continue;

      if (file.size > MAX_HIRING_FILE_BYTES) {
        setErrors({
          form: `${HIRING_UPLOAD_SLOT_LABELS[slot]} must be 50MB or smaller.`,
        });
        setSubmitting(false);
        return;
      }

      const uploaded = await uploadHiringApplicationFile(
        supabase,
        selectedListing.clubId,
        selectedListing.id,
        user.id,
        file,
      );

      if (!uploaded) {
        setErrors({
          form: `Failed to upload ${HIRING_UPLOAD_SLOT_LABELS[slot].toLowerCase()}. Please try again.`,
        });
        setSubmitting(false);
        return;
      }

      answersPayload.push({
        question_id: `upload_${slot}`,
        answer: uploaded.url,
        file_name: uploaded.name,
        file_type: uploaded.type,
        file_size: uploaded.size,
      });
    }

    const payload = {
      listing_id: selectedListing.id,
      applicant_id: user.id,
      answers: answersPayload,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("hiring_applications")
      .insert(payload)
      .select();

    setSubmitting(false);
    if (error) {
      console.error("Full error:", JSON.stringify(error, null, 2));
      console.error("Payload sent:", payload);
      if (error.code === "23505") {
        setAlreadyApplied(true);
      } else {
        setErrors({ form: error.message });
      }
      return;
    }

    if (!data?.length) {
      console.error("Insert succeeded but no row returned:", { payload, data });
    }

    const applicationId = (data?.[0]?.id as string | undefined) ?? undefined;
    if (applicationId && user?.id) {
      await notifyHiringApplicationSubmitted(supabase, {
        clubId: selectedListing.clubId,
        clubName,
        listingId: selectedListing.id,
        applicationId,
        roleTitle: selectedListing.title,
        applicantUserId: user.id,
        applicantName: resolveStudentDisplayName(
          profile?.fullName,
          user.email ?? null,
        ),
      });
    }

    setSubmitted(true);
    onSubmitted?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ ...modalOverlayStyle, zIndex: 1100 }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "28px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <svg
              width={48}
              height={48}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4ade80"
              strokeWidth={2.5}
              style={{ margin: "0 auto 12px" }}
              aria-hidden
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <p style={{ fontWeight: 700, fontSize: "18px", color: "#ffffff", margin: "0 0 8px" }}>
              Application Submitted!
            </p>
            <p style={{ fontSize: "14px", color: "#747676", margin: "0 0 20px" }}>
              We&apos;ll be in touch soon
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #333333",
                color: "#888888",
                borderRadius: "6px",
                padding: "10px 24px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : loading ? (
          <p style={{ color: "#555555", fontSize: "14px" }}>Loading…</p>
        ) : alreadyApplied ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 600, fontSize: "16px", color: "#ffffff", margin: "0 0 16px" }}>
              You&apos;ve already applied for this position
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #333333",
                color: "#888888",
                borderRadius: "6px",
                padding: "10px 24px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ fontWeight: 700, fontSize: "18px", color: "#ffffff", margin: "0 0 4px" }}>
              {position.title}
            </h2>
            <p style={{ fontSize: "13px", color: "#747676", margin: 0 }}>{clubName}</p>
            <div style={{ height: "1px", background: "#242424", margin: "16px 0" }} />

            {profile ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#2a2a2a",
                      color: "#E51937",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    {profile.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: "13px", color: "#cccccc" }}>
                  Applying as {profile.fullName}
                </span>
              </div>
            ) : null}

            {displayQuestions.map((q) => (
              <div key={q.id} style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#cccccc",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  {q.question}
                  {q.required ? (
                    <span style={{ color: "#E51937", marginLeft: "4px" }}>*</span>
                  ) : null}
                </label>
                {q.type === "text" ? (
                  <input
                    type="text"
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    style={{ ...darkInputStyle, width: "100%" }}
                  />
                ) : (
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    rows={4}
                    style={{
                      ...darkInputStyle,
                      width: "100%",
                      minHeight: "100px",
                      resize: "vertical",
                    }}
                  />
                )}
                {errors[q.id] ? (
                  <p style={{ color: "#E51937", fontSize: "12px", marginTop: "6px" }}>{errors[q.id]}</p>
                ) : null}
              </div>
            ))}

            {uploadSlots.map(({ slot, setting }) => (
              <div key={slot} style={{ marginBottom: "16px" }}>
                <label
                  htmlFor={`hiring-upload-${slot}`}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#cccccc",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  {HIRING_UPLOAD_SLOT_LABELS[slot]}
                  {setting === "required" ? (
                    <span style={{ color: "#E51937", marginLeft: "4px" }}>*</span>
                  ) : null}
                </label>
                <input
                  id={`hiring-upload-${slot}`}
                  type="file"
                  disabled={submitting}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? undefined;
                    setUploadFiles((prev) => {
                      const next = { ...prev };
                      if (file) next[slot] = file;
                      else delete next[slot];
                      return next;
                    });
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next[`upload_${slot}`];
                      return next;
                    });
                  }}
                  style={{ ...darkInputStyle, width: "100%", padding: "8px 12px" }}
                />
                {uploadFiles[slot] ? (
                  <p style={{ fontSize: "12px", color: "#777777", margin: "6px 0 0" }}>
                    Selected: {uploadFiles[slot]?.name}
                  </p>
                ) : null}
                {errors[`upload_${slot}`] ? (
                  <p style={{ color: "#E51937", fontSize: "12px", marginTop: "6px" }}>
                    {errors[`upload_${slot}`]}
                  </p>
                ) : null}
              </div>
            ))}

            {errors.form ? (
              <p style={{ color: "#E51937", fontSize: "13px" }}>{errors.form}</p>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                style={{
                  width: "100%",
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "12px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "10px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function filterBoardPositions(
  positions: BoardPosition[],
  options: {
    search: string;
    roleTypeFilter: string;
    commitmentFilter: string;
    clubCategoryFilter: string;
    deadlineFilter: string;
    listTab: ListTab;
    savedRoleIds: Set<string>;
    myApplications: Record<string, boolean>;
  },
): BoardPosition[] {
  const q = options.search.trim().toLowerCase();

  return positions.filter((p) => {
    if (options.listTab === "saved" && !options.savedRoleIds.has(p.id)) {
      return false;
    }
    if (options.listTab === "applied" && !options.myApplications[p.id]) {
      return false;
    }
    if (
      options.roleTypeFilter !== "all" &&
      p.positionType !== options.roleTypeFilter
    ) {
      return false;
    }
    if (
      options.commitmentFilter !== "all" &&
      p.commitmentLevel !== options.commitmentFilter
    ) {
      return false;
    }
    if (
      options.clubCategoryFilter !== "all" &&
      (p.clubCategory ?? "").toLowerCase() !==
        options.clubCategoryFilter.toLowerCase()
    ) {
      return false;
    }
    if (options.deadlineFilter === "closing_soon" && !isClosingSoon(p.deadline)) {
      return false;
    }
    if (options.deadlineFilter === "has_deadline" && !p.deadline) {
      return false;
    }
    if (options.deadlineFilter === "no_deadline" && p.deadline) {
      return false;
    }
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.clubName.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.clubCategory ?? "").toLowerCase().includes(q)
    );
  });
}

function BoardEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          color: "#888888",
          fontSize: "15px",
          fontWeight: 600,
          margin: "0 0 8px",
        }}
      >
        {title}
      </p>
      <p style={{ color: "#555555", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}

function BoardDetailEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: "280px",
        padding: "32px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "360px" }}>
        <p
          style={{
            color: "#888888",
            fontSize: "16px",
            fontWeight: 600,
            margin: "0 0 8px",
          }}
        >
          Select a role to learn more
        </p>
        <p style={{ color: "#555555", fontSize: "14px", margin: 0, lineHeight: 1.5 }}>
          Choose an open position from the list to view details, save it, or apply.
        </p>
      </div>
    </div>
  );
}

export default function HiringBoardPage() {
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [listTab, setListTab] = useState<ListTab>("all");
  const [roleTypeFilter, setRoleTypeFilter] = useState("all");
  const [commitmentFilter, setCommitmentFilter] = useState("all");
  const [clubCategoryFilter, setClubCategoryFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "closing_soon" | "a-z">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailOverlayId, setDetailOverlayId] = useState<string | null>(null);
  const [applyPosition, setApplyPosition] = useState<BoardPosition | null>(null);
  const [myApplications, setMyApplications] = useState<Record<string, boolean>>({});
  const [savedRoleIds, setSavedRoleIds] = useState<Set<string>>(new Set());

  const canSave = Boolean(user?.id);

  function handleApplyFromDetail(position: BoardPosition) {
    if (!user) {
      navigate("/login?redirect=/hiring");
      return;
    }
    setDetailOverlayId(null);
    setApplyPosition(position);
  }

  const loadPositions = useCallback(async () => {
    setLoading(true);

    const { data: rows, error } = await supabase
      .from("hiring_listings")
      .select(
        `
        id,
        club_id,
        title,
        description,
        requirements,
        role_type,
        commitment_level,
        weekly_hours,
        deadline,
        created_at,
        is_open,
        questions,
        upload_fields,
        clubs ( name, logo_url, banner_url, slug, description, category )
      `,
      )
      .eq("is_open", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load positions:", error.message);
      setPositions([]);
      setMyApplications({});
      setLoading(false);
      return;
    }

    const positionIds = (rows ?? []).map((r) => r.id as string);
    const counts: Record<string, number> = {};

    if (positionIds.length > 0) {
      const { data: apps } = await supabase
        .from("hiring_applications")
        .select("listing_id")
        .in("listing_id", positionIds);

      (apps ?? []).forEach((a) => {
        const pid = a.listing_id as string;
        counts[pid] = (counts[pid] ?? 0) + 1;
      });
    }

    if (user?.id && positionIds.length > 0) {
      const { data: myApps } = await supabase
        .from("hiring_applications")
        .select("listing_id")
        .eq("applicant_id", user.id)
        .in("listing_id", positionIds);

      const map: Record<string, boolean> = {};
      (myApps ?? []).forEach((a) => {
        map[a.listing_id as string] = true;
      });
      setMyApplications(map);
    } else {
      setMyApplications({});
    }

    const mapped: BoardPosition[] = (rows ?? []).map((row) => {
      const club = row.clubs as {
        name?: string;
        logo_url?: string;
        banner_url?: string;
        slug?: string;
        description?: string;
        category?: string;
      } | null;
      const commitment = (row.commitment_level as CommitmentLevel) ?? "flexible";
      return {
        id: row.id as string,
        clubId: row.club_id as string,
        clubName: club?.name ?? "Club",
        clubLogoUrl: club?.logo_url ?? undefined,
        clubBannerUrl: club?.banner_url ?? undefined,
        clubSlug: club?.slug ?? undefined,
        clubDescription: club?.description ?? undefined,
        clubCategory: club?.category ?? undefined,
        title: row.title as string,
        description: (row.description as string) ?? "",
        requirements: (row.requirements as string) ?? undefined,
        positionType: (row.role_type as string) ?? "executive",
        commitmentLevel: commitment,
        weeklyHours: (row.weekly_hours as number | null) ?? null,
        deadline: (row.deadline as string) ?? null,
        createdAt: (row.created_at as string) ?? new Date().toISOString(),
        applicantCount: counts[row.id as string] ?? 0,
        questions: parseListingQuestions(row.questions),
        uploadFields: parseHiringUploadFields(row.upload_fields),
      };
    });

    setPositions(mapped);
    setLoading(false);
  }, [user?.id]);

  const loadSavedRoles = useCallback(async () => {
    if (!user?.id) {
      setSavedRoleIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("saved_roles")
      .select("position_id")
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to load saved roles:", error.message);
      setSavedRoleIds(new Set());
      return;
    }

    setSavedRoleIds(
      new Set((data ?? []).map((row) => row.position_id as string)),
    );
  }, [user?.id]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    void loadSavedRoles();
  }, [loadSavedRoles]);

  const clubCategories = useMemo(() => {
    const categories = new Set<string>();
    positions.forEach((p) => {
      if (p.clubCategory?.trim()) categories.add(p.clubCategory.trim());
    });
    return Array.from(categories).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [positions]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    roleTypeFilter !== "all" ||
    commitmentFilter !== "all" ||
    clubCategoryFilter !== "all" ||
    deadlineFilter !== "all";

  function clearFilters() {
    setSearch("");
    setRoleTypeFilter("all");
    setCommitmentFilter("all");
    setClubCategoryFilter("all");
    setDeadlineFilter("all");
  }

  async function toggleSaveRole(positionId: string) {
    if (!user?.id) {
      navigate("/login?redirect=/hiring");
      return;
    }

    const isSaved = savedRoleIds.has(positionId);

    if (isSaved) {
      const { error } = await supabase
        .from("saved_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("position_id", positionId);

      if (error) {
        console.error("Failed to unsave role:", error.message);
        return;
      }

      setSavedRoleIds((prev) => {
        const next = new Set(prev);
        next.delete(positionId);
        return next;
      });
      return;
    }

    const { error } = await supabase.from("saved_roles").insert({
      user_id: user.id,
      position_id: positionId,
    });

    if (error) {
      console.error("Failed to save role:", error.message);
      return;
    }

    setSavedRoleIds((prev) => new Set(prev).add(positionId));
  }

  const filtered = useMemo(() => {
    const matches = filterBoardPositions(positions, {
      search,
      roleTypeFilter,
      commitmentFilter,
      clubCategoryFilter,
      deadlineFilter,
      listTab,
      savedRoleIds,
      myApplications,
    });
    return sortBoardPositions(matches, sortBy);
  }, [
    positions,
    search,
    roleTypeFilter,
    commitmentFilter,
    clubCategoryFilter,
    deadlineFilter,
    listTab,
    savedRoleIds,
    myApplications,
    sortBy,
  ]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      setMobileDetailOpen(false);
      setDetailOverlayId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && filtered.some((p) => p.id === current)) return current;
      return filtered[0].id;
    });
  }, [filtered]);

  useEffect(() => {
    if (loading) return;
    const listingId = searchParams.get("listing");
    if (!listingId) return;

    const match = filtered.find((position) => position.id === listingId);
    if (!match) return;

    setSelectedId(listingId);
    if (isMobile) {
      setMobileDetailOpen(true);
    } else {
      setDetailOverlayId(listingId);
    }
  }, [filtered, isMobile, loading, searchParams]);

  const activePosition =
    selectedId != null
      ? filtered.find((p) => p.id === selectedId) ?? null
      : null;

  const overlayPosition =
    detailOverlayId != null
      ? filtered.find((p) => p.id === detailOverlayId) ?? null
      : null;

  function openListingDetail(position: BoardPosition) {
    setSelectedId(position.id);
    if (isMobile) {
      setMobileDetailOpen(true);
    } else {
      setDetailOverlayId(position.id);
    }
  }

  function closeListingDetailOverlay() {
    setDetailOverlayId(null);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#0f0f0f",
      }}
    >
      <header style={{ padding: isMobile ? "32px 16px 20px" : "32px 48px 24px" }}>
        <h1
          style={{
            fontSize: isMobile ? "28px" : "40px",
            fontWeight: 800,
            color: "#ffffff",
            margin: 0,
            textAlign: "left",
          }}
        >
          Club{" "}
          <span style={{ color: "#E51937" }}>Hiring</span>
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#555555",
            marginTop: "6px",
            marginBottom: 0,
          }}
        >
          Open roles across University of Guelph student clubs
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: 0,
          flex: 1,
          height: isMobile ? "auto" : "calc(100vh - 130px)",
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: isMobile ? "100%" : "35%",
            minWidth: isMobile ? undefined : "300px",
            height: isMobile ? undefined : "calc(100vh - 130px)",
            overflowY: "auto",
            borderRight: isMobile ? "none" : "1px solid #1a1a1a",
            padding: "16px",
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
              placeholder="Search positions..."
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
              display: "flex",
              flexWrap: "wrap",
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
            {clubCategories.length > 0 ? (
              <select
                value={clubCategoryFilter}
                onChange={(e) => setClubCategoryFilter(e.target.value)}
                aria-label="Filter by club category"
                style={filterSelectStyle}
              >
                <option value="all">All club categories</option>
                {clubCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              aria-label="Filter by deadline"
              style={filterSelectStyle}
            >
              {DEADLINE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "newest" | "closing_soon" | "a-z")
              }
              aria-label="Sort positions"
              style={{ ...filterSelectStyle, flex: "0 1 auto", minWidth: "110px" }}
            >
              <option value="newest">Newest</option>
              <option value="closing_soon">Closing soon</option>
              <option value="a-z">A–Z</option>
            </select>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  flex: "0 0 auto",
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
          {loading ? (
            <p style={{ color: "#555555", fontSize: "14px" }}>Loading positions…</p>
          ) : listTab === "saved" && !user ? (
            <BoardEmptyState
              title="Sign in to save roles"
              description="Create an account or sign in to save roles you are interested in."
            />
          ) : filtered.length === 0 ? (
            <BoardEmptyState
              title={
                listTab === "saved"
                  ? "No saved roles yet"
                  : listTab === "applied"
                    ? "No applied roles yet"
                    : "No roles found"
              }
              description={
                listTab === "saved"
                  ? "Save roles you are interested in and come back later."
                  : listTab === "applied"
                    ? "Roles you apply to will appear here."
                    : "Try adjusting your filters or clearing your search."
              }
            />
          ) : (
            <>
              <p
                style={{
                  fontSize: "12px",
                  color: "#555555",
                  marginBottom: "12px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #1a1a1a",
                  marginTop: 0,
                }}
              >
                {filtered.length} open position{filtered.length === 1 ? "" : "s"}
              </p>
              {filtered.map((position) => (
                <HiringListingCard
                  key={position.id}
                  position={position}
                  selected={activePosition?.id === position.id}
                  saved={savedRoleIds.has(position.id)}
                  canSave={canSave}
                  onSelect={() => {
                    setSelectedId(position.id);
                    if (isMobile) setMobileDetailOpen(true);
                  }}
                  onReadMore={() => openListingDetail(position)}
                  onToggleSave={() => void toggleSaveRole(position.id)}
                />
              ))}
            </>
          )}
        </div>

        {!isMobile ? (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              height: "calc(100vh - 130px)",
              boxSizing: "border-box",
            }}
          >
            {activePosition ? (
              <HiringDetailPanel
                position={activePosition}
                user={user}
                alreadyApplied={Boolean(myApplications[activePosition.id])}
                saved={savedRoleIds.has(activePosition.id)}
                canSave={canSave}
                onApply={() => handleApplyFromDetail(activePosition)}
                onViewClub={() => {
                  if (activePosition.clubSlug) {
                    navigate(`/clubs/${activePosition.clubSlug}`);
                  }
                }}
                onToggleSave={() => void toggleSaveRole(activePosition.id)}
              />
            ) : (
              <BoardDetailEmptyState />
            )}
          </div>
        ) : null}
      </div>

      {overlayPosition ? (
        <HiringListingDetailOverlay
          position={overlayPosition}
          user={user}
          alreadyApplied={Boolean(myApplications[overlayPosition.id])}
          saved={savedRoleIds.has(overlayPosition.id)}
          canSave={canSave}
          onClose={closeListingDetailOverlay}
          onApply={() => handleApplyFromDetail(overlayPosition)}
          onViewClub={() => {
            if (overlayPosition.clubSlug) {
              navigate(`/clubs/${overlayPosition.clubSlug}`);
            }
          }}
          onToggleSave={() => void toggleSaveRole(overlayPosition.id)}
        />
      ) : null}

      {isMobile && mobileDetailOpen && activePosition ? (
        <HiringDetailMobileModal
          position={activePosition}
          user={user}
          alreadyApplied={Boolean(myApplications[activePosition.id])}
          saved={savedRoleIds.has(activePosition.id)}
          canSave={canSave}
          onClose={() => setMobileDetailOpen(false)}
          onApply={() => handleApplyFromDetail(activePosition)}
          onViewClub={() => {
            if (activePosition.clubSlug) {
              navigate(`/clubs/${activePosition.clubSlug}`);
            }
          }}
          onToggleSave={() => void toggleSaveRole(activePosition.id)}
        />
      ) : null}

      {applyPosition ? (
        <ApplicationModal
          position={applyPosition}
          clubName={applyPosition.clubName}
          onClose={() => setApplyPosition(null)}
          onSubmitted={() => {
            setMyApplications((prev) => ({ ...prev, [applyPosition.id]: true }));
            void loadPositions();
          }}
        />
      ) : null}
    </div>
  );
}
