import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Briefcase, Bookmark, Clipboard, MoreHorizontal } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import Spinner from "../../components/ui/Spinner";
import TemplatePickerModal from "../../components/club/TemplatePickerModal";
import CandidateReviewPanel, {
  type CandidateReviewPatch,
  type CandidateReviewPendingAction,
} from "../../components/club/CandidateReviewPanel";
import {
  APPLICANT_PIPELINE_FILTER_OPTIONS,
  applicantMoveStatusActions,
  matchesApplicantPipelineFilter,
  normalizeSubStatus,
  parseInterviewTimes,
  subStatusLabel,
  subStatusPillStyle,
  type ApplicantMoveStatusAction,
  type ApplicantPipelineFilter,
} from "../../lib/hiringPipelineUtils";
import {
  POSITION_TYPES,
  PositionQuestionBuilder,
  ApplicationModal,
  commitmentLabel,
  darkInputStyle,
  deadlineLabel,
  modalOverlayStyle,
  normalizeOptions,
  parseListingQuestions,
  parseOptionsText,
  listingQuestionsForApply,
  positionTypeLabel,
  type CommitmentLevel,
  type HiringApplicationAnswer,
  type ListingQuestion,
  type PositionQuestionDraft,
  type PositionType,
} from "./HiringBoardPage";
import {
  DEFAULT_HIRING_UPLOAD_FIELDS,
  HIRING_UPLOAD_SETTING_OPTIONS,
  HIRING_UPLOAD_SLOTS,
  HIRING_UPLOAD_SLOT_LABELS,
  hiringFileQuestionLabel,
  isHiringFileQuestionId,
  parseHiringUploadFields,
  type HiringUploadFields,
  type HiringUploadSetting,
} from "../../lib/hiringUploadFields";

type ListingStatus = "open" | "filled" | "closed";
type PositionFilter = "all" | "open" | "pending_review" | "filled" | "closed";

interface ClubPosition {
  id: string;
  title: string;
  description: string;
  requirements: string;
  positionType: string;
  commitmentLevel: CommitmentLevel;
  weeklyHours: number | null;
  deadline: string | null;
  isOpen: boolean;
  applicantCount: number;
  pendingCount: number;
  acceptedCount: number;
  questions: ListingQuestion[];
  uploadFields: HiringUploadFields;
}

function mapRoleType(positionType: string): "executive" | "volunteer" | "general" {
  if (positionType === "executive") return "executive";
  if (positionType === "volunteer") return "volunteer";
  return "general";
}

function formQuestionsToJson(drafts: PositionQuestionDraft[]): unknown[] {
  return drafts
    .filter((q) => q.question.trim())
    .map((q, index) => ({
      id: q.localId,
      question: q.question.trim(),
      type:
        q.question_type === "multiple_choice" || q.question_type === "yes_no"
          ? "text"
          : "textarea",
      question_type: q.question_type,
      options:
        q.question_type === "multiple_choice"
          ? parseOptionsText(q.optionsText)
          : null,
      required: q.required,
      order_index: index,
    }));
}

function formQuestionsFromJson(raw: unknown): PositionQuestionDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = item as Record<string, unknown>;
    const opts = normalizeOptions(row.options);
    const questionType = row.question_type as PositionQuestionDraft["question_type"];
    return {
      localId: (row.id as string) ?? crypto.randomUUID(),
      question: (row.question as string) ?? "",
      question_type:
        questionType === "multiple_choice" ||
        questionType === "yes_no" ||
        questionType === "text"
          ? questionType
          : "text",
      optionsText: opts.join(", "),
      required: Boolean(row.required),
      order_index: (row.order_index as number) ?? index,
    };
  });
}

interface HiringApplicationProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface HiringApplicationRow {
  id: string;
  listingId: string;
  applicantId: string;
  status: string;
  subStatus: string;
  createdAt: string;
  answers: HiringApplicationAnswer[];
  profile: HiringApplicationProfile | null;
  interviewTimes: string[];
  interviewType?: string;
  meetingLocation?: string;
  meetingLink?: string;
  offeredAccessLevel?: string;
  offeredRoleTitle?: string;
  positionHandling?: string;
}

function parseHiringAnswers(raw: unknown): HiringApplicationAnswer[] {
  if (Array.isArray(raw)) {
    const parsed: HiringApplicationAnswer[] = [];
    raw.forEach((item, index) => {
      const row = item as Record<string, unknown>;
      const answer = String(row.answer ?? "").trim();
      if (!answer) return;
      parsed.push({
        question_id: (row.question_id as string) ?? `a-${index}`,
        answer,
        ...(row.file_name ? { file_name: String(row.file_name) } : {}),
        ...(row.file_type ? { file_type: String(row.file_type) } : {}),
        ...(typeof row.file_size === "number" ? { file_size: row.file_size } : {}),
      });
    });
    return parsed;
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, string>)
      .map(([question_id, answer]) => ({
        question_id,
        answer: String(answer ?? "").trim(),
      }))
      .filter((a) => a.answer);
  }
  return [];
}

function answerLabel(
  questionId: string,
  listingQuestions: ListingQuestion[],
): string {
  if (isHiringFileQuestionId(questionId)) {
    return hiringFileQuestionLabel(questionId);
  }
  const match = listingQuestions.find((q) => q.id === questionId);
  if (match) return match.question;
  if (questionId === "default-why") return "Why do you want this position?";
  return "Response";
}

function MemberRoleDetailModal({
  position,
  clubName,
  hasApplied,
  saved,
  onClose,
  onApply,
  onToggleSave,
}: {
  position: ClubPosition;
  clubName: string;
  hasApplied: boolean;
  saved: boolean;
  onClose: () => void;
  onApply: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={modalOverlayStyle}
      onClick={onClose}
    >
      <div
        style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "640px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <p style={{ fontSize: "13px", color: "#777777", margin: "0 0 4px" }}>
              {clubName}
            </p>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "#ffffff",
                margin: 0,
              }}
            >
              {position.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <span style={roleTypeBadgeStyle()}>
            {positionTypeLabel(position.positionType)}
          </span>
          <span style={commitmentBadgeStyle()}>
            {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
          </span>
        </div>

        {position.description ? (
          <>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#cccccc", margin: "0 0 8px" }}>
              About the role
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "#aaaaaa",
                lineHeight: 1.6,
                margin: "0 0 16px",
                whiteSpace: "pre-wrap",
              }}
            >
              {position.description}
            </p>
          </>
        ) : null}

        {position.requirements ? (
          <>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#cccccc", margin: "0 0 8px" }}>
              Requirements
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "#aaaaaa",
                lineHeight: 1.6,
                margin: "0 0 16px",
                whiteSpace: "pre-wrap",
              }}
            >
              {position.requirements}
            </p>
          </>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid #242424",
          }}
        >
          {position.isOpen && !hasApplied ? (
            <button
              type="button"
              onClick={onApply}
              style={{
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Apply Now
            </button>
          ) : hasApplied ? (
            <span
              style={{
                background: "#1a1200",
                border: "1px solid #FFC429",
                color: "#FFC429",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Application Submitted ✓
            </span>
          ) : null}
          <button
            type="button"
            onClick={onToggleSave}
            style={{
              background: saved ? "#1a1500" : "transparent",
              border: saved ? "1px solid #3a2f00" : "1px solid #333333",
              color: saved ? "#FFC429" : "#cccccc",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Bookmark size={14} fill={saved ? "#FFC429" : "none"} />
            {saved ? "Saved" : "Save Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function roleTypeBadgeStyle(): CSSProperties {
  return {
    background: "transparent",
    border: "1px solid #E51937",
    color: "#E51937",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 600,
    display: "inline-block",
  };
}

function commitmentBadgeStyle(): CSSProperties {
  return {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    color: "#777777",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    display: "inline-block",
  };
}

function listingStatus(position: ClubPosition): ListingStatus {
  if (position.isOpen) return "open";
  if (position.acceptedCount > 0) return "filled";
  return "closed";
}

function statusPillStyle(status: ListingStatus): CSSProperties {
  if (status === "open" || status === "filled") {
    return {
      background: "#1a1200",
      border: "1px solid #FFC429",
      color: "#FFC429",
      borderRadius: "4px",
      padding: "2px 8px",
      fontSize: "11px",
      fontWeight: 600,
      display: "inline-block",
    };
  }
  return {
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#555555",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 600,
    display: "inline-block",
  };
}

function statusPillLabel(status: ListingStatus): string {
  if (status === "open") return "Open";
  if (status === "filled") return "Filled";
  return "Closed";
}

function formatCloseDate(deadline: string | null): string | null {
  if (!deadline) return null;
  const trimmed = deadline.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysLeftMeta(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const trimmed = deadline.trim();
  const end = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59`)
    : new Date(trimmed);
  if (Number.isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "0 days left", urgent: true };
  return {
    text: `${days} day${days === 1 ? "" : "s"} left`,
    urgent: days <= 14,
  };
}

function matchesPositionFilter(
  position: ClubPosition,
  filter: PositionFilter,
): boolean {
  const status = listingStatus(position);
  switch (filter) {
    case "all":
      return true;
    case "open":
      return status === "open";
    case "pending_review":
      return position.pendingCount > 0;
    case "filled":
      return status === "filled";
    case "closed":
      return status === "closed";
    default:
      return true;
  }
}

function daysAgoLabel(iso: string): string {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "Recently";
  const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Applied today";
  if (days === 1) return "Applied 1 day ago";
  return `Applied ${days} days ago`;
}

function positionApplicantSummary(position: ClubPosition): string {
  if (position.applicantCount === 0) return "No applicants yet";
  if (position.pendingCount > 0) {
    return `${position.pendingCount} pending review`;
  }
  return `${position.applicantCount} applicant${position.applicantCount === 1 ? "" : "s"}`;
}

function positionCardBorderStyle(isSelected: boolean): CSSProperties {
  if (isSelected) {
    return { border: "1px solid #E51937" };
  }
  return { border: "1px solid #2a2a2a" };
}

function moveStatusActionLabel(action: ApplicantMoveStatusAction): string {
  switch (action) {
    case "mark_reviewed":
      return "Mark Reviewed";
    case "schedule":
      return "Schedule Interview";
    case "accept":
      return "Accept Candidate";
    case "reject":
      return "Reject Candidate";
    case "send_update":
      return "Send Update";
    default:
      return action;
  }
}

function toPendingPanelAction(
  action: ApplicantMoveStatusAction,
): CandidateReviewPendingAction {
  if (action === "mark_reviewed") {
    return { type: "mark_reviewed" };
  }
  return { type: "modal", modal: action };
}

function StatCard({
  label,
  value,
  topColor,
  valueColor = "#ffffff",
}: {
  label: string;
  value: number;
  topColor: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: "#141414",
        borderRadius: "12px",
        padding: "18px 20px",
        minWidth: 0,
        borderTop: `3px solid ${topColor}`,
        borderRight: "1px solid #2a2a2a",
        borderBottom: "1px solid #2a2a2a",
        borderLeft: "1px solid #2a2a2a",
      }}
    >
      <p
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: valueColor,
          margin: 0,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#555555",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginTop: "4px",
          marginBottom: 0,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function PositionUploadFieldsEditor({
  value,
  onChange,
}: {
  value: HiringUploadFields;
  onChange: (next: HiringUploadFields) => void;
}) {
  return (
    <div style={{ marginTop: "16px", marginBottom: "8px" }}>
      <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 8px" }}>
        Application file uploads
      </p>
      {HIRING_UPLOAD_SLOTS.map((slot) => (
        <div
          key={slot}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "13px", color: "#cccccc", flexShrink: 0 }}>
            {HIRING_UPLOAD_SLOT_LABELS[slot]}
          </span>
          <select
            value={value[slot]}
            onChange={(e) =>
              onChange({
                ...value,
                [slot]: e.target.value as HiringUploadSetting,
              })
            }
            style={{
              ...darkInputStyle,
              minWidth: "140px",
              cursor: "pointer",
            }}
          >
            {HIRING_UPLOAD_SETTING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

const menuItemStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  color: "#cccccc",
  padding: "9px 12px",
  fontSize: "12px",
  cursor: "pointer",
};

export default function ClubRecruitingPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthContext();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");
  const clubName = club?.name ?? "Club";

  const memberAccess = useClubMemberAccess(clubId);
  const [isListingReviewer, setIsListingReviewer] = useState(false);
  const canManageHiring =
    memberAccess.isPresident ||
    memberAccess.can("manage_hiring") ||
    isListingReviewer;
  const isPrivileged = canManageHiring;

  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<ClubPosition[]>([]);
  const [myApplications, setMyApplications] = useState<Record<string, boolean>>({});

  const [showPostModal, setShowPostModal] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [editingPosition, setEditingPosition] = useState<ClubPosition | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [commitmentLevel, setCommitmentLevel] = useState<CommitmentLevel>("flexible");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [positionType, setPositionType] = useState<PositionType>("executive");
  const [deadline, setDeadline] = useState("");
  const [formQuestions, setFormQuestions] = useState<PositionQuestionDraft[]>([]);
  const [uploadFields, setUploadFields] = useState<HiringUploadFields>(
    DEFAULT_HIRING_UPLOAD_FIELDS,
  );
  const [saving, setSaving] = useState(false);
  const [savePositionError, setSavePositionError] = useState<string | null>(null);

  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);
  const [applications, setApplications] = useState<HiringApplicationRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const [applyPosition, setApplyPosition] = useState<ClubPosition | null>(null);
  const [viewRolePosition, setViewRolePosition] = useState<ClubPosition | null>(null);
  const [savedRoleIds, setSavedRoleIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [positionFilter] = useState<PositionFilter>("all");
  const [applicantSearch, setApplicantSearch] = useState("");
  const [applicantStatusFilter, setApplicantStatusFilter] =
    useState<ApplicantPipelineFilter>("all");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(
    null,
  );
  const [openApplicantMenuId, setOpenApplicantMenuId] = useState<string | null>(
    null,
  );
  const [pendingApplicantAction, setPendingApplicantAction] = useState<{
    appId: string;
    action: CandidateReviewPendingAction;
  } | null>(null);
  const [applicationNoteCounts, setApplicationNoteCounts] = useState<
    Record<string, number>
  >({});
  const skipApplicantFilterResetRef = useRef(false);

  useEffect(() => {
    if (!clubId || !user?.id) {
      setIsListingReviewer(false);
      return;
    }

    void supabase
      .from("hiring_listings")
      .select("id")
      .eq("club_id", clubId)
      .contains("reviewer_ids", [user.id])
      .limit(1)
      .then(({ data }) => {
        setIsListingReviewer((data ?? []).length > 0);
      });
  }, [clubId, user?.id]);

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
    void loadSavedRoles();
  }, [loadSavedRoles]);

  async function toggleSaveRole(positionId: string) {
    if (!user?.id) return;

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

  const loadPositions = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);

    let query = supabase
      .from("hiring_listings")
      .select(
        "id, title, description, requirements, role_type, commitment_level, weekly_hours, deadline, is_open, questions, upload_fields",
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (!isPrivileged) {
      query = query.eq("is_open", true);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("Failed to load positions:", error.message);
      setPositions([]);
      setLoading(false);
      return;
    }

    const ids = (rows ?? []).map((r) => r.id as string);
    const counts: Record<string, number> = {};
    const pendingCounts: Record<string, number> = {};
    const acceptedCounts: Record<string, number> = {};

    if (canManageHiring && ids.length > 0) {
      const { data: apps } = await supabase
        .from("hiring_applications")
        .select("listing_id, status")
        .in("listing_id", ids);

      (apps ?? []).forEach((a) => {
        const lid = a.listing_id as string;
        const appStatus = (a.status as string) ?? "pending";
        counts[lid] = (counts[lid] ?? 0) + 1;
        if (appStatus === "pending") {
          pendingCounts[lid] = (pendingCounts[lid] ?? 0) + 1;
        }
        if (appStatus === "accepted") {
          acceptedCounts[lid] = (acceptedCounts[lid] ?? 0) + 1;
        }
      });
    }

    setPositions(
      (rows ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        description: (row.description as string) ?? "",
        requirements: (row.requirements as string) ?? "",
        positionType: (row.role_type as string) ?? "general",
        commitmentLevel: ((row.commitment_level as CommitmentLevel) ?? "flexible"),
        weeklyHours: (row.weekly_hours as number | null) ?? null,
        deadline: (row.deadline as string) ?? null,
        isOpen: Boolean(row.is_open),
        applicantCount: counts[row.id as string] ?? 0,
        pendingCount: pendingCounts[row.id as string] ?? 0,
        acceptedCount: acceptedCounts[row.id as string] ?? 0,
        questions: parseListingQuestions(row.questions),
        uploadFields: parseHiringUploadFields(row.upload_fields),
      })),
    );

    if (user?.id && ids.length > 0) {
      const { data: myApps } = await supabase
        .from("hiring_applications")
        .select("listing_id")
        .eq("applicant_id", user.id)
        .in("listing_id", ids);

      const map: Record<string, boolean> = {};
      (myApps ?? []).forEach((a) => {
        map[a.listing_id as string] = true;
      });
      setMyApplications(map);
    } else {
      setMyApplications({});
    }

    setLoading(false);
  }, [clubId, canManageHiring, user?.id]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const stats = useMemo(() => {
    const openCount = positions.filter((p) => listingStatus(p) === "open").length;
    const filledCount = positions.filter((p) => listingStatus(p) === "filled").length;
    const totalApplicants = positions.reduce((sum, p) => sum + p.applicantCount, 0);
    const pendingReview = positions.reduce((sum, p) => sum + p.pendingCount, 0);
    return { openCount, filledCount, totalApplicants, pendingReview };
  }, [positions]);

  const filteredPositions = useMemo(
    () => positions.filter((p) => matchesPositionFilter(p, positionFilter)),
    [positions, positionFilter],
  );

  const isMobile = useIsMobile();
  const selectedPosition =
    positions.find((p) => p.id === expandedPositionId) ?? null;

  const filteredApplications = useMemo(() => {
    let list = applications;
    if (applicantStatusFilter !== "all") {
      list = list.filter((app) =>
        matchesApplicantPipelineFilter(
          app.status,
          app.subStatus,
          applicantStatusFilter,
        ),
      );
    }
    const query = applicantSearch.trim().toLowerCase();
    if (query) {
      list = list.filter((app) =>
        (app.profile?.full_name ?? "Member").toLowerCase().includes(query),
      );
    }
    return list;
  }, [applications, applicantStatusFilter, applicantSearch]);

  useEffect(() => {
    setSelectedApplicantId(null);
    setApplicantSearch("");
    if (skipApplicantFilterResetRef.current) {
      skipApplicantFilterResetRef.current = false;
    } else {
      setApplicantStatusFilter("all");
    }
  }, [expandedPositionId]);

  useEffect(() => {
    if (searchParams.get("openCreate") !== "true" || !isPrivileged || loading) return;
    openCreateModal();
    const next = new URLSearchParams(searchParams);
    next.delete("openCreate");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isPrivileged, loading]);

  useEffect(() => {
    if (searchParams.get("tab") !== "applications" || !isPrivileged || loading || positions.length === 0) {
      return;
    }

    const target =
      positions.find((position) => position.pendingCount > 0) ?? positions[0];

    skipApplicantFilterResetRef.current = true;
    setExpandedPositionId(target.id);
    void loadApplicationsForPosition(target.id).then(() => {
      setApplicantStatusFilter("pending");
    });

    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isPrivileged, loading, positions]);

  useEffect(() => {
    const listingId = searchParams.get("listing");
    if (!listingId || !isPrivileged || loading || positions.length === 0) {
      return;
    }

    const position = positions.find((item) => item.id === listingId);
    if (!position) return;

    const applicationId = searchParams.get("application");

    skipApplicantFilterResetRef.current = true;
    setExpandedPositionId(listingId);
    void loadApplicationsForPosition(listingId).then(() => {
      if (applicationId) {
        setSelectedApplicantId(applicationId);
      }
    });

    const next = new URLSearchParams(searchParams);
    next.delete("listing");
    next.delete("application");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isPrivileged, loading, positions]);

  function resetPostForm() {
    setTitle("");
    setDescription("");
    setRequirements("");
    setCommitmentLevel("flexible");
    setWeeklyHours("");
    setPositionType("executive");
    setDeadline("");
    setFormQuestions([]);
    setUploadFields(DEFAULT_HIRING_UPLOAD_FIELDS);
    setEditingPosition(null);
  }

  function openCreateModal() {
    resetPostForm();
    setSavePositionError(null);
    setShowPostModal(true);
  }

  async function openEditModal(position: ClubPosition) {
    setEditingPosition(position);
    setTitle(position.title);
    setDescription(position.description);
    setRequirements(position.requirements);
    setCommitmentLevel(position.commitmentLevel);
    setWeeklyHours(
      position.weeklyHours != null && position.weeklyHours > 0
        ? String(position.weeklyHours)
        : "",
    );
    setPositionType(position.positionType as PositionType);
    setDeadline(
      position.deadline
        ? String(position.deadline).slice(0, 10)
        : "",
    );

    const { data: listingRow } = await supabase
      .from("hiring_listings")
      .select("questions")
      .eq("id", position.id)
      .maybeSingle();

    setFormQuestions(formQuestionsFromJson(listingRow?.questions));
    setUploadFields(position.uploadFields);
    setSavePositionError(null);
    setShowPostModal(true);
    setOpenMenuId(null);
  }

  async function handleSavePosition() {
    if (!clubId || !user?.id || !title.trim()) return;
    setSaving(true);
    setSavePositionError(null);

    const parsedWeeklyHours =
      commitmentLevel === "weekly_hours" && weeklyHours.trim()
        ? Math.max(1, parseInt(weeklyHours, 10) || 0)
        : null;

    const deadlineValue = deadline.trim() || null;

    const listingFields = {
      title: title.trim(),
      description: description.trim(),
      role_type: mapRoleType(positionType),
      deadline: deadlineValue,
      questions: formQuestionsToJson(formQuestions),
      upload_fields: uploadFields,
      requirements: requirements.trim() || null,
      commitment_level: commitmentLevel,
      weekly_hours:
        commitmentLevel === "weekly_hours" ? parsedWeeklyHours : null,
    };

    if (editingPosition) {
      const { error } = await supabase
        .from("hiring_listings")
        .update(listingFields)
        .eq("id", editingPosition.id);

      if (error) {
        console.error("Failed to update hiring listing:", error.message, error);
        setSavePositionError(
          error.message || "Failed to save position. Please try again.",
        );
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("hiring_listings").insert({
        club_id: clubId,
        created_by: user.id,
        is_open: true,
        ...listingFields,
      });

      if (error) {
        console.error("Failed to create hiring listing:", error.message, error);
        setSavePositionError(
          error.message ||
            "Failed to save position. Check that hiring_listings is set up correctly.",
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowPostModal(false);
    setSavePositionError(null);
    resetPostForm();
    void loadPositions();
  }

  async function closePosition(position: ClubPosition) {
    const { error } = await supabase
      .from("hiring_listings")
      .update({ is_open: false })
      .eq("id", position.id);
    if (!error) {
      void loadPositions();
    }
    setOpenMenuId(null);
  }

  async function deletePosition(positionId: string) {
    if (!window.confirm("Delete this position and all applications?")) return;
    const { error } = await supabase
      .from("hiring_listings")
      .delete()
      .eq("id", positionId);
    if (!error) {
      if (expandedPositionId === positionId) {
        setExpandedPositionId(null);
        setApplications([]);
      }
      void loadPositions();
    }
    setOpenMenuId(null);
  }

  async function loadApplicationsForPosition(listingId: string) {
    setAppsLoading(true);

    const { data: applicationRows, error } = await supabase
      .from("hiring_applications")
      .select(
        "id, listing_id, applicant_id, answers, status, created_at, sub_status, interview_times, interview_type, meeting_location, meeting_link, offered_access_level, offered_role_title, position_handling",
      )
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load applications:", error);
      setApplications([]);
      setAppsLoading(false);
      return;
    }

    const rows = applicationRows ?? [];
    const applicantIds = rows
      .map((a) => a.applicant_id as string)
      .filter(Boolean);

    let profileRows: HiringApplicationProfile[] = [];

    if (applicantIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", applicantIds);

      if (profilesError) {
        console.error("Failed to load applicant profiles:", profilesError);
      } else {
        profileRows = (profiles ?? []).map((p) => ({
          id: p.id as string,
          full_name: (p.full_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
          avatar_url: (p.avatar_url as string | null) ?? null,
        }));
      }
    }

    setApplications(
      rows.map((app) => ({
        id: app.id as string,
        listingId: app.listing_id as string,
        applicantId: app.applicant_id as string,
        status: (app.status as string) ?? "pending",
        subStatus: normalizeSubStatus(app.sub_status as string | null),
        createdAt: app.created_at as string,
        answers: parseHiringAnswers(app.answers),
        profile:
          profileRows.find((p) => p.id === app.applicant_id) ?? null,
        interviewTimes: parseInterviewTimes(app.interview_times),
        interviewType: (app.interview_type as string | null) ?? undefined,
        meetingLocation: (app.meeting_location as string | null) ?? undefined,
        meetingLink: (app.meeting_link as string | null) ?? undefined,
        offeredAccessLevel:
          (app.offered_access_level as string | null) ?? undefined,
        offeredRoleTitle: (app.offered_role_title as string | null) ?? undefined,
        positionHandling: (app.position_handling as string | null) ?? undefined,
      })),
    );

    const applicationIds = rows.map((row) => row.id as string);
    if (applicationIds.length > 0) {
      const { data: noteRows } = await supabase
        .from("application_notes")
        .select("application_id")
        .in("application_id", applicationIds);

      const noteCounts: Record<string, number> = {};
      (noteRows ?? []).forEach((row) => {
        const appId = row.application_id as string;
        noteCounts[appId] = (noteCounts[appId] ?? 0) + 1;
      });
      setApplicationNoteCounts(noteCounts);
    } else {
      setApplicationNoteCounts({});
    }

    setAppsLoading(false);
  }

  function triggerApplicantAction(
    appId: string,
    action: ApplicantMoveStatusAction,
  ) {
    setSelectedApplicantId(appId);
    setPendingApplicantAction({
      appId,
      action: toPendingPanelAction(action),
    });
    setOpenApplicantMenuId(null);
  }

  async function toggleApplications(position: ClubPosition) {
    if (expandedPositionId === position.id) {
      setExpandedPositionId(null);
      setApplications([]);
      return;
    }
    setExpandedPositionId(position.id);
    await loadApplicationsForPosition(position.id);
  }

  useEffect(() => {
    if (
      !isPrivileged ||
      loading ||
      positions.length === 0 ||
      expandedPositionId !== null ||
      searchParams.get("listing")
    ) {
      return;
    }
    void toggleApplications(positions[0]);
  }, [isPrivileged, loading, positions, expandedPositionId, searchParams]);

  function patchApplication(applicationId: string, patch: CandidateReviewPatch) {
    setApplications((prev) =>
      prev.map((application) =>
        application.id === applicationId
          ? { ...application, ...patch }
          : application,
      ),
    );
  }

  function renderPositionsList(): ReactNode {
    if (positions.length === 0) {
      return isPrivileged ? (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <Briefcase
            size={36}
            color="#2a2a2a"
            aria-hidden
            style={{ marginBottom: "12px" }}
          />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#333333", margin: 0 }}>
            No positions posted yet
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#444444",
              marginTop: "4px",
              maxWidth: "280px",
              margin: "4px auto 16px",
            }}
          >
            Post your first role to start receiving applications from students.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Post Position
          </button>
        </div>
      ) : (
        <p style={{ fontSize: "14px", color: "#555555" }}>No positions posted yet.</p>
      );
    }

    if (filteredPositions.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#333333", margin: 0 }}>
            No positions match this filter
          </p>
          <p style={{ fontSize: "13px", color: "#444444", marginTop: "4px" }}>
            Try a different filter or post a new position.
          </p>
        </div>
      );
    }

    return filteredPositions.map((position) => {
      const deadline = daysLeftMeta(position.deadline);
      const closeDate = formatCloseDate(position.deadline);
      const hasApplied = Boolean(myApplications[position.id]);
      const isExpanded = expandedPositionId === position.id;
      const menuOpen = openMenuId === position.id;
      const cardHovered = hoveredCardId === position.id;
      const status = listingStatus(position);
      const showClosingSoonBadge = status === "open" && Boolean(deadline?.urgent);
      const applicantSummary = positionApplicantSummary(position);

      const metaSegments: ReactNode[] = [];
      if (closeDate) metaSegments.push(`Closes ${closeDate}`);
      if (deadline) {
        metaSegments.push(
          <span style={{ color: deadline.urgent ? "#FFC429" : "#444444" }}>
            {deadline.text}
          </span>,
        );
      } else if (!closeDate && position.deadline) {
        const legacy = deadlineLabel(position.deadline);
        if (legacy) metaSegments.push(legacy);
      }

      return (
        <div
          key={position.id}
          onMouseEnter={() => setHoveredCardId(position.id)}
          onMouseLeave={() => {
            setHoveredCardId((prev) => (prev === position.id ? null : prev));
            setOpenMenuId((prev) => (prev === position.id ? null : prev));
          }}
          style={{
            background: "#141414",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "12px",
            ...positionCardBorderStyle(isExpanded),
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div style={{ flex: 1, minWidth: "220px" }}>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                {position.title}
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "6px",
                }}
              >
                <span style={roleTypeBadgeStyle()}>
                  {positionTypeLabel(position.positionType)}
                </span>
                <span style={commitmentBadgeStyle()}>
                  {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
                </span>
                <span style={statusPillStyle(status)}>
                  {statusPillLabel(status)}
                </span>
                {showClosingSoonBadge ? (
                  <span
                    style={{
                      background: "#1a1200",
                      border: "1px solid #FFC429",
                      color: "#FFC429",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      display: "inline-block",
                    }}
                  >
                    Closing Soon
                  </span>
                ) : null}
              </div>
            </div>

            {canManageHiring && position.isOpen && !hasApplied ? (
              <button
                type="button"
                onClick={() => setApplyPosition(position)}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Apply Now
              </button>
            ) : canManageHiring && hasApplied ? (
              <span
                style={{
                  background: "#1a1200",
                  border: "1px solid #FFC429",
                  color: "#FFC429",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Applied ✓
              </span>
            ) : null}
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#444444",
              marginTop: "8px",
              marginBottom: "4px",
            }}
          >
            {metaSegments.map((part, index) => (
              <span key={index}>
                {index > 0 ? " · " : null}
                {part}
              </span>
            ))}
          </p>
          {canManageHiring ? (
            <p
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color:
                  position.pendingCount > 0
                    ? "#FFC429"
                    : position.applicantCount === 0
                      ? "#555555"
                      : "#888888",
                margin: "0 0 10px",
              }}
            >
              {applicantSummary}
            </p>
          ) : null}

          {position.description ? (
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                lineHeight: 1.6,
                margin: "0 0 16px",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {position.description}
            </p>
          ) : (
            <div style={{ marginBottom: "16px" }} />
          )}

          {canManageHiring ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => void toggleApplications(position)}
                style={{
                  background: isExpanded ? "transparent" : "#E51937",
                  color: isExpanded ? "#cccccc" : "#ffffff",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: isExpanded ? "1px solid #333333" : "none",
                  cursor: "pointer",
                }}
              >
                {isExpanded ? "Reviewing Applicants" : "Review Applicants"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {position.isOpen ? (
                  <Link
                    to={`/hiring?listing=${position.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: "transparent",
                      border: "1px solid #2a2a2a",
                      color: "#555555",
                      borderRadius: "8px",
                      padding: "8px 18px",
                      fontSize: "13px",
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#555555";
                      e.currentTarget.style.color = "#aaaaaa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#2a2a2a";
                      e.currentTarget.style.color = "#555555";
                    }}
                  >
                    View Public Posting
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void openEditModal(position)}
                  style={{
                    background: "transparent",
                    border: "1px solid #2a2a2a",
                    color: "#555555",
                    borderRadius: "8px",
                    padding: "8px 18px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#555555";
                    e.currentTarget.style.color = "#aaaaaa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#2a2a2a";
                    e.currentTarget.style.color = "#555555";
                  }}
                >
                  Edit Position
                </button>
                {cardHovered ? (
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      aria-label="Position options"
                      onClick={() =>
                        setOpenMenuId((prev) =>
                          prev === position.id ? null : position.id,
                        )
                      }
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#747676",
                        cursor: "pointer",
                        display: "flex",
                        padding: "2px",
                      }}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {menuOpen ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          marginTop: "4px",
                          background: "#151515",
                          border: "1px solid #2a2a2a",
                          borderRadius: "8px",
                          minWidth: "150px",
                          zIndex: 20,
                          overflow: "hidden",
                        }}
                      >
                        {position.isOpen ? (
                          <button
                            type="button"
                            onClick={() => void closePosition(position)}
                            style={menuItemStyle}
                          >
                            Close Position
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void deletePosition(position.id)}
                          style={{ ...menuItemStyle, color: "#E51937" }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {position.isOpen && !hasApplied ? (
                <button
                  type="button"
                  onClick={() => setApplyPosition(position)}
                  style={{
                    background: "#E51937",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Apply Now
                </button>
              ) : hasApplied ? (
                <span
                  style={{
                    background: "#1a1200",
                    border: "1px solid #FFC429",
                    color: "#FFC429",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Applied ✓
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setViewRolePosition(position)}
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
              <button
                type="button"
                onClick={() => void toggleSaveRole(position.id)}
                style={{
                  background: savedRoleIds.has(position.id) ? "#1a1500" : "transparent",
                  border: savedRoleIds.has(position.id)
                    ? "1px solid #3a2f00"
                    : "1px solid #333333",
                  color: savedRoleIds.has(position.id) ? "#FFC429" : "#cccccc",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Bookmark
                  size={12}
                  fill={savedRoleIds.has(position.id) ? "#FFC429" : "none"}
                />
                {savedRoleIds.has(position.id) ? "Saved" : "Save Role"}
              </button>
            </div>
          )}
        </div>
      );
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Spinner label="Loading hiring…" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6" style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: isPrivileged ? "16px" : "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "28px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            {isPrivileged ? "Hiring" : "We're Hiring"}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#555555",
              marginTop: "4px",
              marginBottom: 0,
            }}
          >
            {isPrivileged
              ? "Post open roles, review applicants, and build your club team."
              : `Open positions in ${clubName}`}
          </p>
        </div>
        {isPrivileged ? (
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Post Position
          </button>
        ) : null}
      </div>

      {isPrivileged ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <StatCard
              label="Open Positions"
              value={stats.openCount}
              topColor="#E51937"
            />
            <StatCard
              label="Pending Review"
              value={stats.pendingReview}
              topColor="#FFC429"
              valueColor="#FFC429"
            />
            <StatCard
              label="Total Applicants"
              value={stats.totalApplicants}
              topColor="#777777"
            />
            <StatCard
              label="Positions Filled"
              value={stats.filledCount}
              topColor="#FFC429"
              valueColor="#FFC429"
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
              flexDirection: isMobile ? "column" : "row",
              width: "100%",
            }}
          >
            <div
              style={{
                flex: isMobile ? "1 1 auto" : "0 0 40%",
                minWidth: 0,
                width: isMobile ? "100%" : undefined,
              }}
            >
              <h2
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#777777",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: "0 0 12px",
                }}
              >
                Open Positions
              </h2>
              {renderPositionsList()}
            </div>

            <div
              style={{
                flex: isMobile ? "1 1 auto" : "0 0 58%",
                minWidth: 0,
                width: isMobile ? "100%" : undefined,
                background: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "10px",
                padding: "20px",
                minHeight: "600px",
              }}
            >
              <h2
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#777777",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: "0 0 16px",
                }}
              >
                Applicants for Selected Position
              </h2>

              {!expandedPositionId || !selectedPosition ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "460px",
                    textAlign: "center",
                  }}
                >
                  <Clipboard
                    size={36}
                    color="#333333"
                    aria-hidden
                    style={{ marginBottom: "12px" }}
                  />
                  <p style={{ fontSize: "15px", fontWeight: 600, color: "#555555", margin: 0 }}>
                    Select a position
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#444444",
                      marginTop: "6px",
                      maxWidth: "320px",
                    }}
                  >
                    Choose a role to review applicants, internal notes, and next steps.
                  </p>
                </div>
              ) : (
                <>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: "16px",
                      color: "#ffffff",
                      margin: "0 0 16px",
                    }}
                  >
                    {selectedPosition.title}
                  </p>

                  {appsLoading ? (
                    <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                      Loading…
                    </p>
                  ) : applications.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "420px",
                        textAlign: "center",
                        padding: "24px 16px",
                      }}
                    >
                      <Briefcase
                        size={36}
                        color="#333333"
                        aria-hidden
                        style={{ marginBottom: "12px" }}
                      />
                      <p style={{ fontSize: "15px", fontWeight: 600, color: "#555555", margin: 0 }}>
                        No applicants yet
                      </p>
                      <p style={{ fontSize: "13px", color: "#444444", marginTop: "6px", maxWidth: "320px" }}>
                        Once students apply for this role, their applications will appear here for
                        review.
                      </p>
                    </div>
                  ) : (
                    <>
                  <input
                    type="search"
                    value={applicantSearch}
                    onChange={(e) => setApplicantSearch(e.target.value)}
                    placeholder="Search applicants..."
                    style={{
                      width: "100%",
                      background: "#1a1a1a",
                      border: "1px solid #2a2a2a",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "#ffffff",
                      fontSize: "13px",
                      marginBottom: "12px",
                      boxSizing: "border-box",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "16px",
                      flexWrap: "nowrap",
                      overflowX: "auto",
                    }}
                  >
                    {APPLICANT_PIPELINE_FILTER_OPTIONS.map((option) => {
                      const active = applicantStatusFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setApplicantStatusFilter(option.value)}
                          style={{
                            background: active ? "#E51937" : "transparent",
                            color: active ? "#ffffff" : "#777777",
                            border: active ? "none" : "1px solid #333333",
                            borderRadius: "20px",
                            padding: "6px 16px",
                            fontSize: "12px",
                            fontWeight: active ? 600 : 400,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {filteredApplications.length === 0 &&
                    applicantStatusFilter === "pending" &&
                    applications.length > 0 &&
                    !applicantSearch.trim() &&
                    !applications.some((app) =>
                      matchesApplicantPipelineFilter(
                        app.status,
                        app.subStatus,
                        "pending",
                      ),
                    ) ? (
                    <div style={{ textAlign: "center", padding: "48px 16px" }}>
                      <p style={{ fontSize: "15px", fontWeight: 600, color: "#555555", margin: 0 }}>
                        No pending review
                      </p>
                      <p style={{ fontSize: "13px", color: "#444444", marginTop: "6px" }}>
                        All applicants for this position have been reviewed.
                      </p>
                    </div>
                  ) : filteredApplications.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                      No applicants match your search or filter.
                    </p>
                  ) : (
                    <div>
                      {filteredApplications.map((app) => {
                        const isExpanded = selectedApplicantId === app.id;
                        const moveActions = applicantMoveStatusActions(
                          app.status,
                          app.subStatus,
                        );
                        const noteCount = applicationNoteCounts[app.id] ?? 0;
                        const menuOpen = openApplicantMenuId === app.id;

                        return (
                          <div key={app.id} style={{ marginBottom: "10px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                width: "100%",
                                padding: "10px 12px",
                                background: isExpanded ? "#1a1a1a" : "transparent",
                                border: isExpanded
                                  ? "1px solid #333"
                                  : "1px solid #2a2a2a",
                                borderRadius: isExpanded ? "8px 8px 0 0" : "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              {app.profile?.avatar_url ? (
                                <img
                                  src={app.profile.avatar_url}
                                  alt=""
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    background: "#242424",
                                    color: "#E51937",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    flexShrink: 0,
                                  }}
                                >
                                  {(app.profile?.full_name ?? "M")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: "120px" }}>
                                <p
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: "#ffffff",
                                    margin: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {app.profile?.full_name ?? "Member"}
                                </p>
                                <p
                                  style={{
                                    fontSize: "12px",
                                    color: "#555555",
                                    margin: "2px 0 0",
                                  }}
                                >
                                  {daysAgoLabel(app.createdAt)}
                                  {noteCount > 0
                                    ? ` · ${noteCount} note${noteCount === 1 ? "" : "s"}`
                                    : null}
                                </p>
                              </div>
                              <span style={subStatusPillStyle(app.subStatus)}>
                                {subStatusLabel(app.subStatus)}
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedApplicantId((prev) =>
                                      prev === app.id ? null : app.id,
                                    )
                                  }
                                  style={{
                                    background: "#E51937",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "7px 14px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  View Full Application
                                </button>
                                {moveActions.length > 0 ? (
                                  <div style={{ position: "relative" }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenApplicantMenuId((prev) =>
                                          prev === app.id ? null : app.id,
                                        )
                                      }
                                      style={{
                                        background: "transparent",
                                        border: "1px solid #333333",
                                        color: "#aaaaaa",
                                        borderRadius: "6px",
                                        padding: "7px 14px",
                                        fontSize: "12px",
                                        fontWeight: 500,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Move Status ▾
                                    </button>
                                    {menuOpen ? (
                                      <div
                                        style={{
                                          position: "absolute",
                                          right: 0,
                                          top: "100%",
                                          marginTop: "4px",
                                          background: "#151515",
                                          border: "1px solid #2a2a2a",
                                          borderRadius: "8px",
                                          minWidth: "180px",
                                          zIndex: 20,
                                          overflow: "hidden",
                                        }}
                                      >
                                        {moveActions.map((action) => (
                                          <button
                                            key={action}
                                            type="button"
                                            onClick={() =>
                                              triggerApplicantAction(app.id, action)
                                            }
                                            style={menuItemStyle}
                                          >
                                            {moveStatusActionLabel(action)}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {isExpanded && selectedPosition && clubId && user?.id ? (
                              <div
                                style={{
                                  background: "#1a1a1a",
                                  border: "1px solid #333",
                                  borderTop: "none",
                                  borderRadius: "0 0 8px 8px",
                                  padding: "12px 16px 16px",
                                }}
                              >
                                <CandidateReviewPanel
                                  application={app}
                                  positionTitle={selectedPosition.title}
                                  positionId={selectedPosition.id}
                                  clubId={clubId}
                                  clubName={clubName}
                                  userId={user.id}
                                  showActionBar={false}
                                  pendingAction={
                                    pendingApplicantAction?.appId === app.id
                                      ? pendingApplicantAction.action
                                      : null
                                  }
                                  onPendingActionHandled={() =>
                                    setPendingApplicantAction(null)
                                  }
                                  answerLabel={(questionId) =>
                                    answerLabel(
                                      questionId,
                                      listingQuestionsForApply(
                                        selectedPosition.questions,
                                      ),
                                    )
                                  }
                                  onApplicationUpdated={(patch) =>
                                    patchApplication(app.id, patch)
                                  }
                                  onStatusChanged={() => void loadPositions()}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {selectedApplicantId === null ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "32px 16px",
                            marginTop: "8px",
                            borderTop: "1px solid #242424",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#555555",
                              margin: 0,
                            }}
                          >
                            Select an applicant
                          </p>
                          <p style={{ fontSize: "13px", color: "#444444", marginTop: "6px" }}>
                            Choose an applicant to review their application, notes, and next
                            steps.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        renderPositionsList()
      )}

      {showPostModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => {
            setShowPostModal(false);
            resetPostForm();
          }}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ fontWeight: 700, fontSize: "18px", color: "#ffffff", margin: 0 }}>
                {editingPosition ? "Edit Position" : "Post Position"}
              </h2>
              {!editingPosition ? (
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(true)}
                  style={{
                    background: "transparent",
                    border: "1px solid #333333",
                    color: "#cccccc",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Use Template
                </button>
              ) : null}
            </div>

            <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
              Position title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ ...darkInputStyle, width: "100%", marginBottom: "14px" }}
            />

            <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                ...darkInputStyle,
                width: "100%",
                minHeight: "100px",
                marginBottom: "14px",
                resize: "vertical",
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "#cccccc",
                marginBottom: "4px",
              }}
            >
              Requirements
            </label>
            <p style={{ fontSize: "11px", color: "#555555", margin: "0 0 8px" }}>
              What skills or experience are you looking for?
            </p>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              style={{
                ...darkInputStyle,
                width: "100%",
                marginBottom: "14px",
                resize: "vertical",
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: "13px",
                color: "#cccccc",
                marginTop: "16px",
                marginBottom: "8px",
              }}
            >
              Commitment
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              {(
                [
                  { value: "flexible" as const, label: "Flexible" },
                  { value: "part_time" as const, label: "Part-time" },
                  { value: "weekly_hours" as const, label: "Set Hours/Week" },
                ] as const
              ).map((pill) => {
                const selected = commitmentLevel === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setCommitmentLevel(pill.value)}
                    style={{
                      background: selected ? "#E51937" : "#1a1a1a",
                      border: selected ? "1px solid #E51937" : "1px solid #333333",
                      color: selected ? "#ffffff" : "#777777",
                      borderRadius: "20px",
                      padding: "6px 16px",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {pill.label}
                  </button>
                );
              })}
              {commitmentLevel === "weekly_hours" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(e.target.value)}
                    style={{ ...darkInputStyle, width: "80px" }}
                  />
                  <span style={{ fontSize: "12px", color: "#777777" }}>
                    hours per week
                  </span>
                </div>
              ) : null}
            </div>

            <p style={{ fontSize: "12px", color: "#888888", marginBottom: "8px" }}>Position type</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
              {POSITION_TYPES.map((t) => {
                const selected = positionType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setPositionType(t.value)}
                    style={{
                      background: selected ? "#E51937" : "#1a1a1a",
                      border: selected ? "1px solid #E51937" : "1px solid #333333",
                      color: selected ? "#ffffff" : "#777777",
                      borderRadius: "20px",
                      padding: "6px 14px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ ...darkInputStyle, width: "100%", marginBottom: "16px" }}
            />

            <PositionUploadFieldsEditor
              value={uploadFields}
              onChange={setUploadFields}
            />

            <PositionQuestionBuilder
              questions={formQuestions}
              onChange={setFormQuestions}
            />

            {savePositionError ? (
              <p
                style={{
                  color: "#E51937",
                  fontSize: "13px",
                  marginTop: "16px",
                  marginBottom: 0,
                }}
              >
                {savePositionError}
              </p>
            ) : null}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                type="button"
                disabled={saving || !title.trim()}
                onClick={() => void handleSavePosition()}
                style={{
                  flex: 1,
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPostModal(false);
                  resetPostForm();
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "12px 20px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewRolePosition ? (
        <MemberRoleDetailModal
          position={viewRolePosition}
          clubName={clubName}
          hasApplied={Boolean(myApplications[viewRolePosition.id])}
          saved={savedRoleIds.has(viewRolePosition.id)}
          onClose={() => setViewRolePosition(null)}
          onApply={() => {
            setViewRolePosition(null);
            setApplyPosition(viewRolePosition);
          }}
          onToggleSave={() => void toggleSaveRole(viewRolePosition.id)}
        />
      ) : null}

      {applyPosition && user?.id && clubId ? (
        <ApplicationModal
          position={{
            id: applyPosition.id,
            clubId,
            clubName,
            title: applyPosition.title,
            description: applyPosition.description,
            requirements: applyPosition.requirements,
            positionType: applyPosition.positionType,
            commitmentLevel: applyPosition.commitmentLevel,
            weeklyHours: applyPosition.weeklyHours,
            deadline: applyPosition.deadline,
            createdAt: "",
            applicantCount: applyPosition.applicantCount,
            questions: applyPosition.questions,
            uploadFields: applyPosition.uploadFields,
          }}
          clubName={clubName}
          onClose={() => setApplyPosition(null)}
          onSubmitted={() => void loadPositions()}
        />
      ) : null}

      {showTemplatePicker ? (
        <TemplatePickerModal
          type="hiring"
          clubName={clubName}
          clubCategory={club?.category}
          onClose={() => setShowTemplatePicker(false)}
          onSelect={(template) => {
            if ("description" in template) {
              setTitle(template.title);
              setDescription(template.description);
            }
          }}
        />
      ) : null}
    </div>
  );
}
