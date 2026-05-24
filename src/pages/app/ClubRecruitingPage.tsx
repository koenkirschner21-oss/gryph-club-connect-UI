import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole } from "../../types";
import Spinner from "../../components/ui/Spinner";
import {
  ApplicationModal,
  POSITION_TYPES,
  PositionQuestionBuilder,
  darkInputStyle,
  deadlineLabel,
  modalOverlayStyle,
  normalizeOptions,
  parseOptionsText,
  positionTypeBadgeStyle,
  positionTypeLabel,
  type BoardPosition,
  type PositionQuestionDraft,
  type PositionType,
} from "./HiringBoardPage";

interface ClubPosition {
  id: string;
  title: string;
  description: string;
  requirements: string;
  positionType: string;
  deadline: string | null;
  isOpen: boolean;
  applicantCount: number;
}

interface ApplicationRow {
  id: string;
  applicantId: string;
  fullName: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
  answers: Record<string, string>;
}

const APPLICATION_STATUSES = [
  "applied",
  "under_review",
  "interview",
  "accepted",
  "rejected",
] as const;

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function statusBadgeStyle(status: string): CSSProperties {
  const colors: Record<string, string> = {
    applied: "#747676",
    under_review: "#FFC429",
    interview: "#6b7cff",
    accepted: "#4ade80",
    rejected: "#E51937",
  };
  const color = colors[status] ?? "#747676";
  return {
    background: "#111111",
    border: `1px solid ${color}33`,
    color,
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    textTransform: "capitalize",
  };
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
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

export default function ClubRecruitingPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getClubById } = useClubContext();
  const clubName = getClubById(clubId ?? "")?.name ?? "Club";
  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";

  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<ClubPosition[]>([]);
  const [myApplications, setMyApplications] = useState<Record<string, string>>({});

  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<ClubPosition | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [positionType, setPositionType] = useState<PositionType>("executive");
  const [deadline, setDeadline] = useState("");
  const [formQuestions, setFormQuestions] = useState<PositionQuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const [applicationsModal, setApplicationsModal] = useState<ClubPosition | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [questionLabels, setQuestionLabels] = useState<Record<string, string>>({});
  const [expandedApplicant, setExpandedApplicant] = useState<string | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);

  const [applyPosition, setApplyPosition] = useState<BoardPosition | null>(null);

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
      .select("id, title, description, requirements, position_type, deadline, is_open")
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
        .from("position_applications")
        .select("position_id")
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
        deadline: (row.deadline as string) ?? null,
        isOpen: Boolean(row.is_open),
        applicantCount: counts[row.id as string] ?? 0,
      })),
    );

    if (user?.id && ids.length > 0) {
      const { data: myApps } = await supabase
        .from("position_applications")
        .select("position_id, status")
        .eq("applicant_id", user.id)
        .in("position_id", ids);

      const map: Record<string, string> = {};
      (myApps ?? []).forEach((a) => {
        map[a.position_id as string] = a.status as string;
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

  function resetPostForm() {
    setTitle("");
    setDescription("");
    setRequirements("");
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

  async function handleSavePosition() {
    if (!clubId || !user?.id || !title.trim()) return;
    setSaving(true);

    const payload = {
      club_id: clubId,
      title: title.trim(),
      description: description.trim(),
      requirements: requirements.trim() || null,
      position_type: positionType,
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
    }

    setSaving(false);
    setShowPostModal(false);
    resetPostForm();
    void loadPositions();
  }

  async function toggleOpen(position: ClubPosition) {
    const { error } = await supabase
      .from("club_positions")
      .update({ is_open: !position.isOpen })
      .eq("id", position.id);
    if (!error) void loadPositions();
  }

  async function deletePosition(positionId: string) {
    if (!window.confirm("Delete this position and all applications?")) return;
    const { error } = await supabase.from("club_positions").delete().eq("id", positionId);
    if (!error) void loadPositions();
  }

  async function openApplicationsModal(position: ClubPosition) {
    setApplicationsModal(position);
    setAppsLoading(true);
    setExpandedApplicant(null);

    const [{ data: questions }, { data: apps }] = await Promise.all([
      supabase
        .from("position_questions")
        .select("id, question")
        .eq("position_id", position.id),
      supabase
        .from("position_applications")
        .select("id, applicant_id, answers, status, created_at")
        .eq("position_id", position.id)
        .order("created_at", { ascending: false }),
    ]);

    const labels: Record<string, string> = {};
    (questions ?? []).forEach((q) => {
      labels[q.id as string] = q.question as string;
    });
    setQuestionLabels(labels);

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
          status: row.status as string,
          createdAt: row.created_at as string,
          answers: (row.answers as Record<string, string>) ?? {},
        };
      }),
    );
    setAppsLoading(false);
  }

  async function updateApplicationStatus(applicationId: string, status: string) {
    const { error } = await supabase
      .from("position_applications")
      .update({ status })
      .eq("id", applicationId);

    if (!error) {
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status } : a)),
      );
    }
  }

  function toBoardPosition(p: ClubPosition): BoardPosition {
    return {
      id: p.id,
      clubId: clubId ?? "",
      clubName: "",
      title: p.title,
      description: p.description,
      positionType: p.positionType,
      deadline: p.deadline,
      applicantCount: p.applicantCount,
    };
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Spinner label="Loading recruiting…" />
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
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontWeight: 700, fontSize: "22px", color: "#ffffff", margin: 0 }}>
            Recruiting
          </h1>
          <p style={{ fontSize: "13px", color: "#555555", margin: "6px 0 0" }}>
            Manage open positions and applications
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

      {positions.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#555555" }}>No positions posted yet.</p>
      ) : (
        positions.map((position) => {
          const badge = deadlineLabel(position.deadline);
          const myStatus = myApplications[position.id];

          return (
            <div
              key={position.id}
              style={{
                background: "#1a1a1a",
                border: "1px solid #242424",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <h3 style={{ fontWeight: 600, fontSize: "16px", color: "#ffffff", margin: 0 }}>
                    {position.title}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      alignItems: "center",
                      marginTop: "8px",
                    }}
                  >
                    <span style={positionTypeBadgeStyle(position.positionType)}>
                      {positionTypeLabel(position.positionType)}
                    </span>
                    {badge ? (
                      <span style={{ fontSize: "12px", color: "#E51937" }}>{badge}</span>
                    ) : null}
                    <span style={{ fontSize: "12px", color: "#555555" }}>
                      {position.applicantCount} applicant
                      {position.applicantCount === 1 ? "" : "s"}
                    </span>
                    {myStatus ? (
                      <span style={statusBadgeStyle(myStatus)}>{statusLabel(myStatus)}</span>
                    ) : null}
                  </div>
                  {position.description ? (
                    <p style={{ fontSize: "13px", color: "#555555", marginTop: "8px", marginBottom: 0 }}>
                      {position.description}
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                  {isPrivileged ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void toggleOpen(position)}
                        style={{
                          background: "transparent",
                          border: position.isOpen
                            ? "1px solid #4ade80"
                            : "1px solid #555555",
                          color: position.isOpen ? "#4ade80" : "#777777",
                          borderRadius: "20px",
                          padding: "4px 12px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        {position.isOpen ? "Open" : "Closed"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openApplicationsModal(position)}
                        style={{
                          background: "transparent",
                          border: "1px solid #333333",
                          color: "#cccccc",
                          borderRadius: "6px",
                          padding: "6px 14px",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        View Applications
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEditModal(position)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#888888",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePosition(position.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#E51937",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : position.isOpen ? (
                    <button
                      type="button"
                      onClick={() => setApplyPosition(toBoardPosition(position))}
                      disabled={!!myStatus}
                      style={{
                        background: myStatus ? "#333333" : "#E51937",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 16px",
                        fontSize: "13px",
                        cursor: myStatus ? "not-allowed" : "pointer",
                      }}
                    >
                      {myStatus ? "Applied" : "Apply"}
                    </button>
                  ) : null}
                </div>
              </div>
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

            <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
              Requirements (optional)
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              style={{
                ...darkInputStyle,
                width: "100%",
                minHeight: "80px",
                marginBottom: "14px",
                resize: "vertical",
              }}
            />

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

      {applicationsModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => setApplicationsModal(null)}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2 style={{ fontWeight: 700, fontSize: "16px", color: "#ffffff", margin: "0 0 16px" }}>
              Applications — {applicationsModal.title}
            </h2>

            {appsLoading ? (
              <p style={{ color: "#555555", fontSize: "13px" }}>Loading…</p>
            ) : applications.length === 0 ? (
              <p style={{ color: "#555555", fontSize: "13px" }}>No applications yet.</p>
            ) : (
              applications.map((app) => {
                const expanded = expandedApplicant === app.id;
                return (
                  <div
                    key={app.id}
                    style={{
                      borderTop: "1px solid #2a2a2a",
                      paddingTop: "12px",
                      marginTop: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        alignItems: "center",
                      }}
                    >
                      {app.avatarUrl ? (
                        <img
                          src={app.avatarUrl}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#242424",
                            color: "#E51937",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                        >
                          {app.fullName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedApplicant(expanded ? null : app.id)
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ffffff",
                          fontWeight: 600,
                          fontSize: "14px",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {app.fullName}
                      </button>
                      <span style={{ fontSize: "12px", color: "#555555" }}>
                        {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                      <span style={statusBadgeStyle(app.status)}>{statusLabel(app.status)}</span>
                      <select
                        value={app.status}
                        onChange={(e) =>
                          void updateApplicationStatus(app.id, e.target.value)
                        }
                        style={{
                          ...darkInputStyle,
                          marginLeft: "auto",
                          width: "auto",
                          fontSize: "12px",
                        }}
                      >
                        {APPLICATION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {expanded ? (
                      <div style={{ marginTop: "10px", paddingLeft: "42px" }}>
                        {Object.entries(app.answers).map(([qid, answer]) => (
                          <div key={qid} style={{ marginBottom: "8px" }}>
                            <p style={{ fontSize: "12px", color: "#888888", margin: "0 0 2px" }}>
                              {questionLabels[qid] ?? "Question"}
                            </p>
                            <p style={{ fontSize: "13px", color: "#cccccc", margin: 0 }}>
                              {answer || "—"}
                            </p>
                          </div>
                        ))}
                        {Object.keys(app.answers).length === 0 ? (
                          <p style={{ fontSize: "13px", color: "#555555" }}>No answers recorded.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {applyPosition ? (
        <ApplicationModal
          position={applyPosition}
          clubName={clubName}
          onClose={() => setApplyPosition(null)}
          onSubmitted={() => void loadPositions()}
        />
      ) : null}
    </div>
  );
}
