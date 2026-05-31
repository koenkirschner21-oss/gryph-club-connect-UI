import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { MoreHorizontal } from "lucide-react";
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
  parseOptionsText,
  type CommitmentLevel,
  type PositionQuestionDraft,
  type PositionType,
} from "./HiringBoardPage";

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
  hiringListingId: string | null;
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
      question: q.question.trim(),
      question_type: q.question_type,
      options:
        q.question_type === "multiple_choice"
          ? parseOptionsText(q.optionsText)
          : null,
      required: q.required,
      order_index: index,
    }));
}

interface JobApplicationRow {
  id: string;
  applicantId: string;
  fullName: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
  whyText: string;
  experienceText: string;
  portfolioUrl: string;
}

const JOB_APPLICATION_STATUSES = [
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
] as const;

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function roleTypeBadgeStyle(positionType: string): CSSProperties {
  if (positionType === "executive") {
    return {
      background: "#1a0a0a",
      border: "1px solid #E51937",
      color: "#E51937",
      borderRadius: "20px",
      padding: "2px 10px",
      fontSize: "11px",
      fontWeight: 500,
      display: "inline-block",
    };
  }
  return {
    background: "#111111",
    border: "1px solid #333333",
    color: "#747676",
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    fontWeight: 500,
    display: "inline-block",
  };
}

function roleTypeLabel(positionType: string): string {
  return positionType === "executive" ? "Executive" : "Member";
}

function openStatusPillStyle(isOpen: boolean): CSSProperties {
  if (isOpen) {
    return {
      background: "#0d2b0d",
      border: "1px solid #1a4a1a",
      color: "#4ade80",
      borderRadius: "20px",
      padding: "3px 10px",
      fontSize: "11px",
      fontWeight: 500,
      display: "inline-block",
    };
  }
  return {
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#555555",
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    display: "inline-block",
  };
}

function daysLeftMeta(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: "Closed", urgent: true };
  return {
    text: `${days} day${days === 1 ? "" : "s"} left`,
    urgent: days < 7,
  };
}

function applicationStatusColor(status: string): string {
  if (status === "accepted") return "#4ade80";
  if (status === "shortlisted") return "#FFC429";
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

function requirementLines(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function questionRowFromDraft(
  positionId: string,
  q: PositionQuestionDraft,
  index: number,
): Record<string, unknown> {
  const options =
    q.question_type === "multiple_choice"
      ? parseOptionsText(q.optionsText)
      : null;
  return {
    position_id: positionId,
    question: q.question.trim(),
    question_type: q.question_type,
    options: options && options.length > 0 ? options : null,
    required: q.required,
    order_index: index,
  };
}

function StatCard({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: number;
  accentColor: string;
}) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #242424",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "8px",
        padding: "16px",
        flex: 1,
        minWidth: "140px",
      }}
    >
      <p
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#747676",
          margin: "8px 0 0",
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

  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);
  const [applications, setApplications] = useState<JobApplicationRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const [applyPosition, setApplyPosition] = useState<ClubPosition | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

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
      .from("club_positions")
      .select(
        "id, title, description, requirements, position_type, commitment_level, weekly_hours, deadline, is_open, hiring_listing_id",
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

    if (ids.length > 0) {
      const { data: apps } = await supabase
        .from("job_applications")
        .select("position_id")
        .eq("club_id", clubId)
        .in("position_id", ids);

      (apps ?? []).forEach((a) => {
        const pid = a.position_id as string;
        counts[pid] = (counts[pid] ?? 0) + 1;
      });
    }

    setPositions(
      (rows ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        description: (row.description as string) ?? "",
        requirements: (row.requirements as string) ?? "",
        positionType: (row.position_type as string) ?? "executive",
        commitmentLevel: ((row.commitment_level as CommitmentLevel) ?? "flexible"),
        weeklyHours: (row.weekly_hours as number | null) ?? null,
        deadline: (row.deadline as string) ?? null,
        isOpen: Boolean(row.is_open),
        applicantCount: counts[row.id as string] ?? 0,
        hiringListingId: (row.hiring_listing_id as string | null) ?? null,
      })),
    );

    if (user?.id && ids.length > 0) {
      const { data: myApps } = await supabase
        .from("job_applications")
        .select("position_id")
        .eq("applicant_id", user.id)
        .eq("club_id", clubId)
        .in("position_id", ids);

      const map: Record<string, boolean> = {};
      (myApps ?? []).forEach((a) => {
        map[a.position_id as string] = true;
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
    const openCount = positions.filter((p) => p.isOpen).length;
    const filledCount = positions.filter((p) => !p.isOpen).length;
    const totalApplicants = positions.reduce((sum, p) => sum + p.applicantCount, 0);
    return { openCount, filledCount, totalApplicants };
  }, [positions]);

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
        ? new Date(position.deadline).toISOString().slice(0, 10)
        : "",
    );

    const { data } = await supabase
      .from("position_questions")
      .select("*")
      .eq("position_id", position.id)
      .order("order_index", { ascending: true });

    setFormQuestions(
      (data ?? []).map((row) => {
        const opts = normalizeOptions(row.options);
        return {
          localId: row.id as string,
          id: row.id as string,
          question: row.question as string,
          question_type: row.question_type as PositionQuestionDraft["question_type"],
          optionsText: opts.join(", "),
          required: Boolean(row.required),
          order_index: (row.order_index as number) ?? 0,
        };
      }),
    );
    setShowPostModal(true);
    setOpenMenuId(null);
  }

  async function savePositionQuestions(positionId: string, drafts: PositionQuestionDraft[]) {
    await supabase.from("position_questions").delete().eq("position_id", positionId);
    const rows = drafts
      .filter((q) => q.question.trim())
      .map((q, index) => questionRowFromDraft(positionId, q, index));
    if (rows.length > 0) {
      await supabase.from("position_questions").insert(rows);
    }
  }

  async function syncNewHiringListing(
    positionId: string,
    listingPayload: {
      title: string;
      description: string;
      requirements: string | null;
      position_type: string;
      commitment_level: CommitmentLevel;
      weekly_hours: number | null;
      deadline: string | null;
    },
  ) {
    if (!clubId || !user?.id) return;

    const { data: listing, error } = await supabase
      .from("hiring_listings")
      .insert({
        club_id: clubId,
        created_by: user.id,
        title: listingPayload.title,
        description: listingPayload.description,
        role_type: mapRoleType(listingPayload.position_type),
        deadline: deadline || null,
        is_open: true,
        questions: formQuestionsToJson(formQuestions),
        requirements: listingPayload.requirements,
        commitment_level: listingPayload.commitment_level || "flexible",
        weekly_hours: listingPayload.weekly_hours,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to sync hiring_listings:", error.message);
      return;
    }

    if (listing?.id) {
      const { error: linkError } = await supabase
        .from("club_positions")
        .update({ hiring_listing_id: listing.id })
        .eq("id", positionId);

      if (linkError) {
        console.error(
          "Failed to link club_positions to hiring_listings:",
          linkError.message,
        );
      }
    }
  }

  async function syncCloseHiringListing(position: ClubPosition) {
    if (!clubId) return;

    if (position.hiringListingId) {
      const { error } = await supabase
        .from("hiring_listings")
        .update({ is_open: false })
        .eq("id", position.hiringListingId);

      if (error) {
        console.error("Failed to close hiring_listings row:", error.message);
      }
      return;
    }

    const { error } = await supabase
      .from("hiring_listings")
      .update({ is_open: false })
      .eq("club_id", clubId)
      .eq("title", position.title);

    if (error) {
      console.error("Failed to close hiring_listings by title:", error.message);
    }
  }

  async function syncDeleteHiringListing(position: ClubPosition | undefined) {
    if (!clubId || !position) return;

    if (position.hiringListingId) {
      const { error } = await supabase
        .from("hiring_listings")
        .delete()
        .eq("id", position.hiringListingId);

      if (error) {
        console.error("Failed to delete hiring_listings row:", error.message);
      }
      return;
    }

    const { error } = await supabase
      .from("hiring_listings")
      .delete()
      .eq("club_id", clubId)
      .eq("title", position.title);

    if (error) {
      console.error("Failed to delete hiring_listings by title:", error.message);
    }
  }

  async function handleSavePosition() {
    if (!clubId || !user?.id || !title.trim()) return;
    setSaving(true);

    const parsedWeeklyHours =
      commitmentLevel === "weekly_hours" && weeklyHours.trim()
        ? Math.max(1, parseInt(weeklyHours, 10) || 0)
        : null;

    const payload = {
      club_id: clubId,
      title: title.trim(),
      description: description.trim(),
      requirements: requirements.trim() || null,
      position_type: positionType,
      commitment_level: commitmentLevel,
      weekly_hours:
        commitmentLevel === "weekly_hours" ? parsedWeeklyHours : null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      created_by: user.id,
    };

    if (editingPosition) {
      const { error } = await supabase
        .from("club_positions")
        .update({
          title: payload.title,
          description: payload.description,
          requirements: payload.requirements,
          position_type: payload.position_type,
          commitment_level: payload.commitment_level,
          weekly_hours: payload.weekly_hours,
          deadline: payload.deadline,
        })
        .eq("id", editingPosition.id);

      if (error) {
        console.error(error.message);
        setSaving(false);
        return;
      }
      await savePositionQuestions(editingPosition.id, formQuestions);
    } else {
      const { data, error } = await supabase
        .from("club_positions")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data) {
        console.error(error?.message);
        setSaving(false);
        return;
      }
      await savePositionQuestions(data.id as string, formQuestions);
      void syncNewHiringListing(data.id as string, {
        title: payload.title,
        description: payload.description,
        requirements: payload.requirements,
        position_type: payload.position_type,
        commitment_level: payload.commitment_level,
        weekly_hours: payload.weekly_hours,
        deadline: payload.deadline,
      });
    }

    setSaving(false);
    setShowPostModal(false);
    resetPostForm();
    void loadPositions();
  }

  async function closePosition(position: ClubPosition) {
    const { error } = await supabase
      .from("club_positions")
      .update({ is_open: false })
      .eq("id", position.id);
    if (!error) {
      void syncCloseHiringListing(position);
      void loadPositions();
    }
    setOpenMenuId(null);
  }

  async function deletePosition(positionId: string) {
    if (!window.confirm("Delete this position and all applications?")) return;
    const position = positions.find((p) => p.id === positionId);
    const { error } = await supabase.from("club_positions").delete().eq("id", positionId);
    if (!error) {
      void syncDeleteHiringListing(position);
      if (expandedPositionId === positionId) {
        setExpandedPositionId(null);
        setApplications([]);
      }
      void loadPositions();
    }
    setOpenMenuId(null);
  }

  async function loadApplicationsForPosition(positionId: string) {
    if (!clubId) return;
    setAppsLoading(true);

    const { data: apps, error } = await supabase
      .from("job_applications")
      .select(
        "id, applicant_id, status, created_at, why_text, experience_text, portfolio_url",
      )
      .eq("position_id", positionId)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load applications:", error.message);
      setApplications([]);
      setAppsLoading(false);
      return;
    }

    const applicantIds = (apps ?? []).map((a) => a.applicant_id as string);
    const profiles: Record<string, { fullName: string; avatarUrl?: string }> = {};

    if (applicantIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", applicantIds);

      (profileRows ?? []).forEach((p) => {
        profiles[p.id as string] = {
          fullName: (p.full_name as string) ?? "Member",
          avatarUrl: (p.avatar_url as string) ?? undefined,
        };
      });
    }

    setApplications(
      (apps ?? []).map((row) => {
        const pid = row.applicant_id as string;
        const prof = profiles[pid];
        return {
          id: row.id as string,
          applicantId: pid,
          fullName: prof?.fullName ?? "Member",
          avatarUrl: prof?.avatarUrl,
          status: (row.status as string) ?? "pending",
          createdAt: row.created_at as string,
          whyText: (row.why_text as string) ?? "",
          experienceText: (row.experience_text as string) ?? "",
          portfolioUrl: (row.portfolio_url as string) ?? "",
        };
      }),
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
      .from("job_applications")
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
          <h1 style={{ fontWeight: 700, fontSize: "22px", color: "#ffffff", margin: 0 }}>
            {isPrivileged ? "Hiring" : "We're Hiring"}
          </h1>
          <p style={{ fontSize: "13px", color: "#555555", margin: "6px 0 0" }}>
            {isPrivileged
              ? "Manage open positions and applications"
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
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <StatCard label="Open Positions" value={stats.openCount} accentColor="#E51937" />
          <StatCard label="Total Applicants" value={stats.totalApplicants} accentColor="#FFC429" />
          <StatCard label="Positions Filled" value={stats.filledCount} accentColor="#747676" />
        </div>
      ) : null}

      {positions.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#555555" }}>No positions posted yet.</p>
      ) : (
        positions.map((position) => {
          const deadline = daysLeftMeta(position.deadline);
          const legacyBadge = deadlineLabel(position.deadline);
          const hasApplied = Boolean(myApplications[position.id]);
          const reqs = requirementLines(position.requirements);
          const isExpanded = expandedPositionId === position.id;
          const menuOpen = openMenuId === position.id;
          const cardHovered = hoveredCardId === position.id;

          return (
            <div key={position.id}>
              <div
                onMouseEnter={() => setHoveredCardId(position.id)}
                onMouseLeave={() => {
                  setHoveredCardId((prev) => (prev === position.id ? null : prev));
                  setOpenMenuId((prev) => (prev === position.id ? null : prev));
                }}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "10px",
                  padding: "20px",
                  marginBottom: isExpanded ? 0 : "12px",
                  transition: "border-color 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#333333";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#242424";
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
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#ffffff",
                          margin: 0,
                        }}
                      >
                        {position.title}
                      </h3>
                      <span style={roleTypeBadgeStyle(position.positionType)}>
                        {roleTypeLabel(position.positionType)}
                      </span>
                      <span
                        style={{
                          background: "#111111",
                          border: "1px solid #1e1e1e",
                          color: "#747676",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          fontSize: "10px",
                          fontWeight: 500,
                          display: "inline-block",
                        }}
                      >
                        {commitmentLabel(position.commitmentLevel, position.weeklyHours)}
                      </span>
                      <span style={openStatusPillStyle(position.isOpen)}>
                        {position.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "12px",
                        marginTop: "8px",
                      }}
                    >
                      {deadline ? (
                        <span
                          style={{
                            fontSize: "12px",
                            color: deadline.urgent ? "#E51937" : "#555555",
                          }}
                        >
                          {deadline.text}
                        </span>
                      ) : legacyBadge ? (
                        <span style={{ fontSize: "12px", color: "#555555" }}>{legacyBadge}</span>
                      ) : null}
                      <span style={{ fontSize: "12px", color: "#555555" }}>
                        {position.applicantCount} applicant
                        {position.applicantCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    {position.description ? (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#cccccc",
                          lineHeight: 1.6,
                          marginTop: "8px",
                          marginBottom: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {position.description}
                      </p>
                    ) : null}

                    {reqs.length > 0 ? (
                      <ul
                        style={{
                          margin: "10px 0 0",
                          paddingLeft: "18px",
                          fontSize: "12px",
                          color: "#777777",
                        }}
                      >
                        {reqs.map((line) => (
                          <li key={line} style={{ marginBottom: "4px" }}>
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexShrink: 0,
                    }}
                  >
                    {isPrivileged ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void toggleApplications(position)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#E51937",
                            fontSize: "13px",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          View Applications ({position.applicantCount})
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
                              <button
                                type="button"
                                onClick={() => void openEditModal(position)}
                                style={menuItemStyle}
                              >
                                Edit
                              </button>
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
                      </>
                    ) : position.isOpen && !hasApplied ? (
                      <button
                        type="button"
                        onClick={() => setApplyPosition(position)}
                        style={{
                          background: "#E51937",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "8px 20px",
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Apply Now
                      </button>
                    ) : hasApplied ? (
                      <span
                        style={{
                          background: "#1a0505",
                          border: "1px solid #E51937",
                          color: "#E51937",
                          borderRadius: "20px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        Applied ✓
                      </span>
                    ) : null}
                  </div>
                </div>
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
                          {app.avatarUrl ? (
                            <img
                              src={app.avatarUrl}
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
                              {app.fullName.charAt(0).toUpperCase()}
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
                              {app.fullName}
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
                            {JOB_APPLICATION_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {applicationStatusLabel(s)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginTop: "12px", paddingLeft: "46px" }}>
                          <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 4px" }}>
                            Why do you want this role?
                          </p>
                          <p style={{ fontSize: "13px", color: "#cccccc", margin: "0 0 10px" }}>
                            {app.whyText || "—"}
                          </p>
                          <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 4px" }}>
                            Relevant experience
                          </p>
                          <p style={{ fontSize: "13px", color: "#cccccc", margin: "0 0 10px" }}>
                            {app.experienceText || "—"}
                          </p>
                          {app.portfolioUrl ? (
                            <>
                              <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 4px" }}>
                                Portfolio
                              </p>
                              <a
                                href={app.portfolioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: "13px", color: "#E51937" }}
                              >
                                {app.portfolioUrl}
                              </a>
                            </>
                          ) : null}
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
