import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Briefcase, MoreHorizontal } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole } from "../../types";
import Spinner from "../../components/ui/Spinner";
import {
  POSITION_TYPES,
  PositionQuestionBuilder,
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

type ListingStatus = "open" | "filled" | "closed";
type PositionFilter = "all" | "open" | "pending_review" | "filled" | "closed";

const POSITION_FILTER_OPTIONS: { value: PositionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "pending_review", label: "Pending Review" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
];

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
  createdAt: string;
  answers: HiringApplicationAnswer[];
  profile: HiringApplicationProfile | null;
}

const HIRING_APPLICATION_STATUSES = [
  "pending",
  "reviewed",
  "accepted",
  "rejected",
] as const;

function parseHiringAnswers(raw: unknown): HiringApplicationAnswer[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => {
        const row = item as Record<string, unknown>;
        return {
          question_id: (row.question_id as string) ?? `a-${index}`,
          answer: String(row.answer ?? "").trim(),
        };
      })
      .filter((a) => a.answer);
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
  const match = listingQuestions.find((q) => q.id === questionId);
  if (match) return match.question;
  if (questionId === "default-why") return "Why do you want this position?";
  return "Response";
}

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
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
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysLeftMeta(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const end = new Date(deadline);
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

function applicationStatusColor(status: string): string {
  if (status === "accepted") return "#FFC429";
  if (status === "reviewed" || status === "shortlisted") return "#FFC429";
  if (status === "rejected") return "#E51937";
  return "#747676";
}

function applicationStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function daysAgoLabel(iso: string): string {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "Recently";
  const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Applied today";
  if (days === 1) return "Applied 1 day ago";
  return `Applied ${days} days ago`;
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
        flex: 1,
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

function ApplyModal({
  positionTitle,
  clubId,
  positionId,
  userId,
  onClose,
  onSubmitted,
}: {
  positionTitle: string;
  clubId: string;
  positionId: string;
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [whyText, setWhyText] = useState("");
  const [experienceText, setExperienceText] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!whyText.trim()) {
      setError("Please tell us why you want this role.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("job_applications").insert({
      position_id: positionId,
      applicant_id: userId,
      club_id: clubId,
      why_text: whyText.trim(),
      experience_text: experienceText.trim() || null,
      portfolio_url: portfolioUrl.trim() || null,
      status: "pending",
    });

    setSubmitting(false);

    if (insertError) {
      console.error("Failed to submit application:", insertError.message);
      setError("Could not submit application. Make sure job_applications is set up.");
      return;
    }

    onSubmitted();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={modalOverlayStyle}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "480px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 20px",
          }}
        >
          Apply for {positionTitle}
        </h2>

        <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
          Why do you want this role?
        </label>
        <textarea
          value={whyText}
          onChange={(e) => setWhyText(e.target.value)}
          style={{
            ...darkInputStyle,
            width: "100%",
            minHeight: "100px",
            marginBottom: "14px",
            resize: "vertical",
          }}
        />

        <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
          Relevant experience
        </label>
        <textarea
          value={experienceText}
          onChange={(e) => setExperienceText(e.target.value)}
          style={{
            ...darkInputStyle,
            width: "100%",
            minHeight: "80px",
            marginBottom: "14px",
            resize: "vertical",
          }}
        />

        <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
          Resume/Portfolio link
        </label>
        <input
          type="url"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="https://..."
          style={{ ...darkInputStyle, width: "100%", marginBottom: "16px" }}
        />

        {error ? (
          <p style={{ fontSize: "12px", color: "#E51937", margin: "0 0 12px" }}>{error}</p>
        ) : null}

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
            fontSize: "13px",
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
            marginBottom: "10px",
          }}
        >
          {submitting ? "Submitting…" : "Submit Application"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid #333333",
            color: "#888888",
            borderRadius: "6px",
            padding: "12px",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
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
  const { user } = useAuthContext();
  const { getClubById } = useClubContext();
  const clubName = getClubById(clubId ?? "")?.name ?? "Club";

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";

  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<ClubPosition[]>([]);
  const [myApplications, setMyApplications] = useState<Record<string, boolean>>({});

  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<ClubPosition | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [commitmentLevel, setCommitmentLevel] = useState<CommitmentLevel>("flexible");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [positionType, setPositionType] = useState<PositionType>("executive");
  const [deadline, setDeadline] = useState("");
  const [formQuestions, setFormQuestions] = useState<PositionQuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [savePositionError, setSavePositionError] = useState<string | null>(null);

  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);
  const [applications, setApplications] = useState<HiringApplicationRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const [applyPosition, setApplyPosition] = useState<ClubPosition | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");

  useEffect(() => {
    const fetchRole = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (data?.role) {
        setUserRole(normalizeUserRole(data.role));
      }
    };
    void fetchRole();
  }, [clubId, user?.id]);

  const loadPositions = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);

    let query = supabase
      .from("hiring_listings")
      .select(
        "id, title, description, requirements, role_type, commitment_level, weekly_hours, deadline, is_open, questions",
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

    if (ids.length > 0) {
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
  }, [clubId, isPrivileged, user?.id]);

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

  function resetPostForm() {
    setTitle("");
    setDescription("");
    setRequirements("");
    setCommitmentLevel("flexible");
    setWeeklyHours("");
    setPositionType("executive");
    setDeadline("");
    setFormQuestions([]);
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
      .select("id, listing_id, applicant_id, answers, status, created_at")
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
        createdAt: app.created_at as string,
        answers: parseHiringAnswers(app.answers),
        profile:
          profileRows.find((p) => p.id === app.applicant_id) ?? null,
      })),
    );
    setAppsLoading(false);
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

  async function updateApplicationStatus(applicationId: string, status: string) {
    const { error } = await supabase
      .from("hiring_applications")
      .update({ status })
      .eq("id", applicationId);

    if (!error) {
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status } : a)),
      );
      void loadPositions();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Spinner label="Loading hiring…" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6" style={{ maxWidth: "900px" }}>
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
              display: "flex",
              gap: "12px",
              marginBottom: "16px",
              flexWrap: "wrap",
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
              gap: "8px",
              marginBottom: "24px",
              flexWrap: "nowrap",
              overflowX: "auto",
            }}
          >
            {POSITION_FILTER_OPTIONS.map((option) => {
              const active = positionFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPositionFilter(option.value)}
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
        </>
      ) : null}

      {positions.length === 0 ? (
        isPrivileged ? (
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
              Post executive roles, committee positions, or volunteer opportunities to build
              your team.
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
              + Post Position
            </button>
          </div>
        ) : (
          <p style={{ fontSize: "14px", color: "#555555" }}>No positions posted yet.</p>
        )
      ) : filteredPositions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#333333", margin: 0 }}>
            No positions match this filter
          </p>
          <p style={{ fontSize: "13px", color: "#444444", marginTop: "4px" }}>
            Try a different filter or post a new position.
          </p>
        </div>
      ) : (
        filteredPositions.map((position) => {
          const deadline = daysLeftMeta(position.deadline);
          const closeDate = formatCloseDate(position.deadline);
          const hasApplied = Boolean(myApplications[position.id]);
          const isExpanded = expandedPositionId === position.id;
          const menuOpen = openMenuId === position.id;
          const cardHovered = hoveredCardId === position.id;
          const status = listingStatus(position);

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
          metaSegments.push(
            `${position.applicantCount} applicant${position.applicantCount === 1 ? "" : "s"}`,
          );

          return (
            <div key={position.id}>
              <div
                onMouseEnter={() => setHoveredCardId(position.id)}
                onMouseLeave={() => {
                  setHoveredCardId((prev) => (prev === position.id ? null : prev));
                  setOpenMenuId((prev) => (prev === position.id ? null : prev));
                }}
                style={{
                  background: "#141414",
                  borderTop: "1px solid #2a2a2a",
                  borderRight: "1px solid #2a2a2a",
                  borderBottom: "1px solid #2a2a2a",
                  borderLeft: "3px solid #E51937",
                  borderRadius: "12px",
                  padding: "20px 24px",
                  marginBottom: isExpanded ? 0 : "12px",
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
                    </div>
                  </div>

                  {isPrivileged ? (
                    <button
                      type="button"
                      onClick={() => void toggleApplications(position)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#555555",
                        fontSize: "12px",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#E51937";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#555555";
                      }}
                    >
                      View Applications
                    </button>
                  ) : position.isOpen && !hasApplied ? (
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
                  ) : hasApplied ? (
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
                    marginBottom: "10px",
                  }}
                >
                  {metaSegments.map((part, index) => (
                    <span key={index}>
                      {index > 0 ? " · " : null}
                      {part}
                    </span>
                  ))}
                </p>

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

                {isPrivileged ? (
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
                        background: "#E51937",
                        color: "#ffffff",
                        borderRadius: "8px",
                        padding: "8px 18px",
                        fontSize: "13px",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Review Applicants ({position.applicantCount})
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                ) : null}
              </div>

              {isPrivileged && isExpanded ? (
                <div
                  style={{
                    background: "#141414",
                    border: "1px solid #242424",
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    padding: "16px 20px 20px",
                    marginBottom: "12px",
                  }}
                >
                  {appsLoading ? (
                    <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>Loading…</p>
                  ) : applications.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                      No applications yet.
                    </p>
                  ) : (
                    applications.map((app) => (
                      <div
                        key={app.id}
                        style={{
                          borderTop: "1px solid #2a2a2a",
                          paddingTop: "14px",
                          marginTop: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "10px",
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
                              }}
                            >
                              {(app.profile?.full_name ?? "M")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: "140px" }}>
                            <p
                              style={{
                                fontSize: "14px",
                                fontWeight: 600,
                                color: "#ffffff",
                                margin: 0,
                              }}
                            >
                              {app.profile?.full_name ?? "Member"}
                            </p>
                            <p style={{ fontSize: "12px", color: "#555555", margin: "2px 0 0" }}>
                              {daysAgoLabel(app.createdAt)}
                            </p>
                          </div>
                          <select
                            value={app.status}
                            onChange={(e) =>
                              void updateApplicationStatus(app.id, e.target.value)
                            }
                            style={{
                              ...darkInputStyle,
                              color: applicationStatusColor(app.status),
                              fontSize: "12px",
                              width: "auto",
                            }}
                          >
                            {HIRING_APPLICATION_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {applicationStatusLabel(s)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginTop: "12px", paddingLeft: "46px" }}>
                          {app.profile?.email ? (
                            <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 10px" }}>
                              {app.profile.email}
                            </p>
                          ) : null}
                          {app.answers.length === 0 ? (
                            <p style={{ fontSize: "13px", color: "#cccccc", margin: 0 }}>—</p>
                          ) : (
                            app.answers.map((ans) => (
                              <div key={ans.question_id} style={{ marginBottom: "10px" }}>
                                <p
                                  style={{
                                    fontSize: "12px",
                                    color: "#888888",
                                    margin: "0 0 4px",
                                  }}
                                >
                                  {answerLabel(
                                    ans.question_id,
                                    listingQuestionsForApply(position.questions),
                                  )}
                                </p>
                                <p style={{ fontSize: "13px", color: "#cccccc", margin: 0 }}>
                                  {ans.answer}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          );
        })
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
            <h2 style={{ fontWeight: 700, fontSize: "18px", color: "#ffffff", margin: "0 0 16px" }}>
              {editingPosition ? "Edit Position" : "Post Position"}
            </h2>

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

      {applyPosition && user?.id && clubId ? (
        <ApplyModal
          positionTitle={applyPosition.title}
          clubId={clubId}
          positionId={applyPosition.id}
          userId={user.id}
          onClose={() => setApplyPosition(null)}
          onSubmitted={() => void loadPositions()}
        />
      ) : null}
    </div>
  );
}
