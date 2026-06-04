import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { getClubInitials } from "../../lib/clubUtils";
import { supabase } from "../../lib/supabaseClient";

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
}

export interface BoardPosition {
  id: string;
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  clubSlug?: string;
  clubDescription?: string;
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

const BOARD_FILTER_PILLS = [
  { value: "all", label: "All" },
  { value: "executive", label: "Executive" },
  { value: "volunteer", label: "Volunteer" },
  { value: "general", label: "General" },
] as const;

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

function deadlineBadgeStyle(
  deadline: string | null,
): CSSProperties {
  const meta = listingDeadlineDisplay(deadline);
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

const sectionHeadingStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#555555",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "10px",
  marginTop: 0,
};

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
  const deadline = listingDeadlineDisplay(position.deadline);

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
        marginTop: "6px",
      }}
    >
      <span style={listingTypeBadgeStyle}>
        {boardPositionTypeLabel(position.positionType)}
      </span>
      <span style={listingTypeBadgeStyle}>
        {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
      </span>
      <span style={deadlineBadgeStyle(position.deadline)}>{deadline.text}</span>
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
  const deadline = listingDeadlineDisplay(position.deadline);
  const deadlineStyle = deadline.withinSevenDays
    ? {
        ...detailTagBadgeStyle,
        background: "#1a1500",
        border: "1px solid #3a2f00",
        color: "#FFC429",
      }
    : { ...detailTagBadgeStyle, color: "#555555" };

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: "12px",
      }}
    >
      <span style={detailTagBadgeStyle}>
        {boardPositionTypeLabel(position.positionType)}
      </span>
      <span style={detailTagBadgeStyle}>
        {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
      </span>
      <span style={deadlineStyle}>{deadline.text}</span>
    </div>
  );
}

function HiringListingCard({
  position,
  selected,
  onSelect,
}: {
  position: BoardPosition;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const posted = postedDateLabel(position.createdAt);
  const description = position.description?.trim();

  return (
    <article
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: selected ? "#1a1a1a" : hovered ? "#1a1a1a" : "#111111",
        border: selected
          ? "1px solid #333333"
          : `1px solid ${hovered ? "#333333" : "#1e1e1e"}`,
        borderLeft: selected ? "3px solid #E51937" : undefined,
        borderRadius: "10px",
        padding: "18px",
        marginBottom: "12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <ClubAvatar
          clubName={position.clubName}
          logoUrl={position.clubLogoUrl}
          size={36}
          borderRadius={8}
        />
        <span style={{ fontSize: "12px", color: "#777777" }}>
          {position.clubName}
        </span>
        {posted ? (
          <span
            style={{
              fontSize: "11px",
              color: "#444444",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            {posted}
          </span>
        ) : null}
      </div>

      <h3
        style={{
          fontSize: "15px",
          fontWeight: 700,
          color: "#ffffff",
          marginTop: "8px",
          marginBottom: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {position.title}
      </h3>

      <CompactPositionTagsRow position={position} />

      {description ? (
        <p
          style={{
            fontSize: "12px",
            color: "#555555",
            marginTop: "8px",
            marginBottom: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      ) : null}
    </article>
  );
}

function HiringDetailApplyButton({
  user,
  alreadyApplied,
  onApply,
  fullWidth = false,
}: {
  user: { id: string } | null;
  alreadyApplied: boolean;
  onApply: () => void;
  fullWidth?: boolean;
}) {
  const baseStyle: CSSProperties = {
    background: "#E51937",
    color: "#ffffff",
    borderRadius: "8px",
    padding: fullWidth ? "14px" : "12px 32px",
    fontSize: fullWidth ? "15px" : "14px",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    width: fullWidth ? "100%" : undefined,
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
          ...baseStyle,
          background: "#1a1500",
          border: "1px solid #FFC429",
          color: "#FFC429",
          cursor: "not-allowed",
          width: fullWidth ? "100%" : undefined,
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

function HiringDetailContent({
  position,
  user,
  alreadyApplied,
  onApply,
  onViewClub,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  onApply: () => void;
  onViewClub: () => void;
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
              <button
                type="button"
                onClick={onViewClub}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#E51937",
                  cursor: "pointer",
                }}
              >
                View Club →
              </button>
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

        <div style={{ marginTop: "20px" }}>
          <HiringDetailApplyButton
            user={user}
            alreadyApplied={alreadyApplied}
            onApply={onApply}
          />
        </div>
      </div>

      <div style={{ paddingTop: "24px" }}>
        <p style={sectionHeadingStyle}>About this role</p>
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
      </div>

      {position.requirements?.trim() ? (
        <div style={{ paddingTop: "24px" }}>
          <p style={sectionHeadingStyle}>Requirements</p>
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

      <div style={{ paddingTop: "24px" }}>
        <p style={sectionHeadingStyle}>Commitment</p>
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

      <div style={{ paddingTop: "24px" }}>
        <p style={sectionHeadingStyle}>Application Deadline</p>
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

      {position.clubDescription?.trim() ? (
        <div style={{ paddingTop: "24px" }}>
          <p style={sectionHeadingStyle}>About the club</p>
          <p
            style={{
              fontSize: "13px",
              color: "#666666",
              lineHeight: 1.6,
              marginBottom: "8px",
              whiteSpace: "pre-wrap",
            }}
          >
            {position.clubDescription}
          </p>
          {position.clubSlug ? (
            <button
              type="button"
              onClick={onViewClub}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "13px",
                color: "#E51937",
                cursor: "pointer",
              }}
            >
              View Club Profile →
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function HiringDetailPanel({
  position,
  user,
  alreadyApplied,
  onApply,
  onViewClub,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  onApply: () => void;
  onViewClub: () => void;
}) {
  return (
    <HiringDetailContent
      position={position}
      user={user}
      alreadyApplied={alreadyApplied}
      onApply={onApply}
      onViewClub={onViewClub}
    />
  );
}

function HiringDetailMobileModal({
  position,
  user,
  alreadyApplied,
  onClose,
  onApply,
  onViewClub,
}: {
  position: BoardPosition;
  user: { id: string } | null;
  alreadyApplied: boolean;
  onClose: () => void;
  onApply: () => void;
  onViewClub: () => void;
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
        onApply={onApply}
        onViewClub={onViewClub}
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
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

export default function HiringBoardPage() {
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [applyPosition, setApplyPosition] = useState<BoardPosition | null>(null);
  const [myApplications, setMyApplications] = useState<Record<string, boolean>>({});

  function handleApplyFromDetail(position: BoardPosition) {
    if (!user) {
      navigate("/login?redirect=/hiring");
      return;
    }
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
        clubs ( name, logo_url, slug, description )
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
        slug?: string;
        description?: string;
      } | null;
      const commitment = (row.commitment_level as CommitmentLevel) ?? "flexible";
      return {
        id: row.id as string,
        clubId: row.club_id as string,
        clubName: club?.name ?? "Club",
        clubLogoUrl: club?.logo_url ?? undefined,
        clubSlug: club?.slug ?? undefined,
        clubDescription: club?.description ?? undefined,
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
      };
    });

    setPositions(mapped);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions, user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return positions.filter((p) => {
      if (typeFilter !== "all" && p.positionType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.clubName.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [positions, search, typeFilter]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      setMobileDetailOpen(false);
      return;
    }
    setSelectedId((current) => {
      if (current && filtered.some((p) => p.id === current)) return current;
      return filtered[0].id;
    });
  }, [filtered]);

  const activePosition =
    filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#0f0f0f",
      }}
    >
      <header style={{ padding: isMobile ? "32px 16px 20px" : "40px 48px 24px" }}>
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
        <p style={{ fontSize: "15px", color: "#555555", marginTop: "8px", marginBottom: 0 }}>
          Open roles across University of Guelph student clubs
        </p>
        <input
          type="search"
          placeholder="Search positions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            display: "block",
            marginTop: "16px",
            background: "#111111",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
            padding: "0 16px",
            color: "#ffffff",
            width: "100%",
            maxWidth: isMobile ? "none" : "480px",
            height: "52px",
            fontSize: "15px",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "12px",
          padding: isMobile ? "0 16px 16px" : "0 48px 16px",
        }}
      >
        {BOARD_FILTER_PILLS.map((pill) => {
          const active = typeFilter === pill.value;
          return (
            <button
              key={pill.value}
              type="button"
              onClick={() => setTypeFilter(pill.value)}
              style={{
                background: active ? "#E51937" : "#1a1a1a",
                border: active ? "none" : "1px solid #2a2a2a",
                color: active ? "#ffffff" : "#777777",
                borderRadius: "6px",
                padding: "7px 18px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 0,
          flex: 1,
          height: "calc(100vh - 200px)",
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: isMobile ? "100%" : "40%",
            minWidth: isMobile ? undefined : "320px",
            overflowY: "auto",
            borderRight: isMobile ? "none" : "1px solid #1e1e1e",
            padding: "16px",
            boxSizing: "border-box",
            scrollbarWidth: "thin",
            scrollbarColor: "#333 transparent",
          }}
        >
          {loading ? (
            <p style={{ color: "#555555", fontSize: "14px" }}>Loading positions…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: "#555555", fontSize: "14px" }}>No open positions found.</p>
          ) : (
            filtered.map((position) => (
              <HiringListingCard
                key={position.id}
                position={position}
                selected={activePosition?.id === position.id}
                onSelect={() => {
                  setSelectedId(position.id);
                  if (isMobile) setMobileDetailOpen(true);
                }}
              />
            ))
          )}
        </div>

        {!isMobile ? (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "32px",
              position: "sticky",
              top: 0,
              height: "calc(100vh - 200px)",
              boxSizing: "border-box",
            }}
          >
            {activePosition ? (
              <HiringDetailPanel
                position={activePosition}
                user={user}
                alreadyApplied={Boolean(myApplications[activePosition.id])}
                onApply={() => handleApplyFromDetail(activePosition)}
                onViewClub={() => {
                  if (activePosition.clubSlug) {
                    navigate(`/clubs/${activePosition.clubSlug}`);
                  }
                }}
              />
            ) : (
              <p
                style={{
                  color: "#444444",
                  fontSize: "14px",
                  textAlign: "center",
                  marginTop: "48px",
                }}
              >
                Select a position to view details
              </p>
            )}
          </div>
        ) : null}
      </div>

      {isMobile && mobileDetailOpen && activePosition ? (
        <HiringDetailMobileModal
          position={activePosition}
          user={user}
          alreadyApplied={Boolean(myApplications[activePosition.id])}
          onClose={() => setMobileDetailOpen(false)}
          onApply={() => handleApplyFromDetail(activePosition)}
          onViewClub={() => {
            if (activePosition.clubSlug) {
              navigate(`/clubs/${activePosition.clubSlug}`);
            }
          }}
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
