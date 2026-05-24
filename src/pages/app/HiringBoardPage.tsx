import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useAuthContext } from "../../context/useAuthContext";
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

export interface BoardPosition {
  id: string;
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  title: string;
  description: string;
  positionType: string;
  deadline: string | null;
  applicantCount: number;
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

function PillChoice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      {label}
    </button>
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
  const [questions, setQuestions] = useState<PositionQuestion[]>([]);
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
      const [profileRes, questionsRes, appRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("position_questions")
          .select("*")
          .eq("position_id", position.id)
          .order("order_index", { ascending: true }),
        supabase
          .from("position_applications")
          .select("id")
          .eq("position_id", position.id)
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

      setQuestions(
        (questionsRes.data ?? []).map((row) => ({
          id: row.id as string,
          position_id: row.position_id as string,
          question: row.question as string,
          question_type: row.question_type as QuestionType,
          options: normalizeOptions(row.options),
          required: Boolean(row.required),
          order_index: (row.order_index as number) ?? 0,
        })),
      );
      setAlreadyApplied(!!appRes.data);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [position.id, user?.id]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const q of questions) {
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

    const answersPayload: Record<string, string> = {};
    for (const q of questions) {
      const value = (answers[q.id] ?? "").trim();
      if (value) answersPayload[q.id] = value;
    }

    const { error } = await supabase.from("position_applications").insert({
      position_id: position.id,
      applicant_id: user.id,
      answers: answersPayload,
      status: "applied",
    });

    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        setAlreadyApplied(true);
      } else {
        setErrors({ form: error.message });
      }
      return;
    }

    setSubmitted(true);
    onSubmitted?.();
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

            {questions.map((q) => (
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
                {q.question_type === "text" ? (
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    rows={3}
                    style={{ ...darkInputStyle, width: "100%", minHeight: "80px", resize: "vertical" }}
                  />
                ) : null}
                {q.question_type === "yes_no" ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <PillChoice
                      label="Yes"
                      selected={answers[q.id] === "Yes"}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: "Yes" }))}
                    />
                    <PillChoice
                      label="No"
                      selected={answers[q.id] === "No"}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: "No" }))}
                    />
                  </div>
                ) : null}
                {q.question_type === "multiple_choice" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(q.options ?? []).map((opt) => (
                      <PillChoice
                        key={opt}
                        label={opt}
                        selected={answers[q.id] === opt}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      />
                    ))}
                  </div>
                ) : null}
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
  const { user } = useAuthContext();
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [applyPosition, setApplyPosition] = useState<BoardPosition | null>(null);

  const loadPositions = useCallback(async () => {
    setLoading(true);

    const { data: rows, error } = await supabase
      .from("club_positions")
      .select(
        `
        id,
        club_id,
        title,
        description,
        position_type,
        deadline,
        is_open,
        clubs ( name, logo_url )
      `,
      )
      .eq("is_open", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load positions:", error.message);
      setPositions([]);
      setLoading(false);
      return;
    }

    const positionIds = (rows ?? []).map((r) => r.id as string);
    const counts: Record<string, number> = {};

    if (positionIds.length > 0) {
      const { data: apps } = await supabase
        .from("position_applications")
        .select("position_id")
        .in("position_id", positionIds);

      (apps ?? []).forEach((a) => {
        const pid = a.position_id as string;
        counts[pid] = (counts[pid] ?? 0) + 1;
      });
    }

    const mapped: BoardPosition[] = (rows ?? []).map((row) => {
      const club = row.clubs as { name?: string; logo_url?: string } | null;
      return {
        id: row.id as string,
        clubId: row.club_id as string,
        clubName: club?.name ?? "Club",
        clubLogoUrl: club?.logo_url ?? undefined,
        title: row.title as string,
        description: (row.description as string) ?? "",
        positionType: (row.position_type as string) ?? "executive",
        deadline: (row.deadline as string) ?? null,
        applicantCount: counts[row.id as string] ?? 0,
      };
    });

    setPositions(mapped);
    setLoading(false);
  }, []);

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

  const filterPills = [
    { value: "all", label: "All" },
    ...POSITION_TYPES.map((t) => ({ value: t.value, label: t.label })),
  ];

  return (
    <div style={{ background: "#0f0f0f", minHeight: "calc(100vh - 4rem)", padding: "32px" }}>
      <h1 style={{ fontWeight: 700, fontSize: "26px", color: "#ffffff", margin: "0 0 6px" }}>
        Hiring Board
      </h1>
      <p style={{ fontSize: "14px", color: "#555555", margin: "0 0 24px" }}>
        Open positions across all clubs
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <input
          type="search"
          placeholder="Search positions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: "8px",
            padding: "10px 16px",
            color: "#ffffff",
            width: "300px",
            maxWidth: "100%",
            fontSize: "14px",
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {filterPills.map((pill) => {
            const active = typeFilter === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => setTypeFilter(pill.value)}
                style={{
                  background: active ? "#E51937" : "#1a1a1a",
                  border: active ? "1px solid #E51937" : "1px solid #333333",
                  color: active ? "#ffffff" : "#777777",
                  borderRadius: "20px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#555555", fontSize: "14px" }}>Loading positions…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#555555", fontSize: "14px" }}>No open positions found.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          {filtered.map((position) => {
            const badge = deadlineLabel(position.deadline);
            return (
              <div
                key={position.id}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "12px",
                  padding: "20px",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#333333";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#242424";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    {position.clubLogoUrl ? (
                      <img
                        src={position.clubLogoUrl}
                        alt=""
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          objectFit: "cover",
                          background: "#2a2a2a",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "#2a2a2a",
                          color: "#747676",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {position.clubName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontSize: "13px", color: "#747676" }}>{position.clubName}</span>
                  </div>
                  {badge ? (
                    <span
                      style={{
                        background: "#1a0a0a",
                        border: "1px solid #3a1a1a",
                        color: "#E51937",
                        fontSize: "11px",
                        borderRadius: "20px",
                        padding: "2px 10px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {badge}
                    </span>
                  ) : null}
                </div>

                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "#ffffff",
                    margin: "8px 0 0",
                  }}
                >
                  {position.title}
                </h3>
                <span style={{ ...positionTypeBadgeStyle(position.positionType), marginTop: "8px" }}>
                  {positionTypeLabel(position.positionType)}
                </span>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#555555",
                    marginTop: "6px",
                    marginBottom: 0,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {position.description || "No description provided."}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "16px",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#555555" }}>
                    {position.applicantCount} applicant
                    {position.applicantCount === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApplyPosition(position)}
                    style={{
                      background: "#E51937",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 16px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {applyPosition ? (
        <ApplicationModal
          position={applyPosition}
          clubName={applyPosition.clubName}
          onClose={() => setApplyPosition(null)}
          onSubmitted={() => void loadPositions()}
        />
      ) : null}
    </div>
  );
}
