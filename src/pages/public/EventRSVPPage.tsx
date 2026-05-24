import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type QuestionType = "text" | "multiple_choice" | "yes_no";

interface FormQuestion {
  id: string;
  question: string;
  question_type: QuestionType;
  options: string[] | null;
  required: boolean;
  order_index: number;
}

interface PublicEvent {
  id: string;
  clubId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: string;
  bannerUrl?: string;
}

const EVENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "weekly_meeting", label: "Weekly Meeting" },
  { value: "team_social", label: "Team Social" },
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "public_event", label: "Public Event" },
  { value: "fundraiser", label: "Fundraiser" },
];

const inputStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  fontSize: "12px",
  color: "#888888",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "6px",
  display: "block",
};

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v)).filter(Boolean);
  }
  return [];
}

function eventCategoryLabel(value: string): string {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.label ?? "General";
}

function categoryBadgeStyle(category: string): CSSProperties {
  const base: CSSProperties = {
    background: "#111111",
    border: "1px solid #222222",
    color: "#747676",
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    display: "inline-block",
    marginTop: "12px",
  };

  switch (category) {
    case "weekly_meeting":
      return { ...base, borderColor: "#2a2a3a", color: "#6b7cff" };
    case "team_social":
      return { ...base, borderColor: "#1a2a1a", color: "#4ade80" };
    case "conference":
    case "workshop":
      return { ...base, borderColor: "#2a1f00", color: "#FFC429" };
    case "public_event":
      return { ...base, borderColor: "#1a1a2a", color: "#E51937" };
    case "fundraiser":
      return { ...base, borderColor: "#2a1a2a", color: "#a78bfa" };
    default:
      return base;
  }
}

function formatEventDateTime(date: string, time: string): string {
  const parsed = new Date(date);
  const datePart = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  const timePart = time && time !== "TBD" ? time : null;
  return timePart ? `${datePart} · ${timePart}` : datePart;
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

function CalendarIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ marginRight: "6px", verticalAlign: "-2px" }}
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ marginRight: "6px", verticalAlign: "-2px" }}
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={48}
      height={48}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4ade80"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function EventRSVPPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [clubName, setClubName] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select("id, club_id, title, description, date, time, location, category")
        .eq("id", eventId)
        .maybeSingle();

      if (cancelled) return;

      if (eventError || !eventRow) {
        setNotFound(true);
        setEvent(null);
        setLoading(false);
        return;
      }

      const loadedEvent: PublicEvent = {
        id: eventRow.id as string,
        clubId: eventRow.club_id as string,
        title: (eventRow.title as string) ?? "",
        description: (eventRow.description as string) ?? "",
        date: (eventRow.date as string) ?? "",
        time: (eventRow.time as string) ?? "",
        location: (eventRow.location as string) ?? "",
        category: (eventRow.category as string) ?? "general",
      };

      setEvent(loadedEvent);

      const { data: clubRow } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", loadedEvent.clubId)
        .maybeSingle();

      if (!cancelled) {
        setClubName((clubRow?.name as string) ?? "");
      }

      const { data: questionRows } = await supabase
        .from("event_form_questions")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index", { ascending: true });

      if (!cancelled) {
        setQuestions(
          (questionRows ?? []).map((row) => ({
            id: row.id as string,
            question: row.question as string,
            question_type: row.question_type as QuestionType,
            options: normalizeOptions(row.options),
            required: Boolean(row.required),
            order_index: (row.order_index as number) ?? 0,
          })),
        );
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Full name is required.";
    if (!email.trim()) {
      next.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }

    for (const q of questions) {
      if (q.required && !(answers[q.id] ?? "").trim()) {
        next[q.id] = "This question is required.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !eventId || !validate()) return;

    setSubmitting(true);
    const answersPayload: Record<string, string> = {};
    for (const q of questions) {
      const value = (answers[q.id] ?? "").trim();
      if (value) answersPayload[q.id] = value;
    }

    const { error } = await supabase.from("event_external_rsvps").insert({
      event_id: eventId,
      name: name.trim(),
      email: email.trim(),
      answers: answersPayload,
    });

    setSubmitting(false);
    if (error) {
      setErrors({ form: error.message || "Could not submit RSVP. Please try again." });
      return;
    }

    setSubmitted(true);
  }

  if (loading) {
    return (
      <div
        style={{
          background: "#0f0f0f",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#747676",
          fontSize: "14px",
        }}
      >
        Loading…
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div
        style={{
          background: "#0f0f0f",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: 600,
        }}
      >
        Event not found
      </div>
    );
  }

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: "28px" }}>
          <p
            style={{
              fontWeight: 800,
              fontSize: "20px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Gryph
            <span style={{ color: "#E51937" }}>·</span>
            ClubConnect
          </p>
          {clubName ? (
            <p style={{ fontSize: "13px", color: "#747676", margin: "8px 0 0" }}>
              {clubName}
            </p>
          ) : null}
        </header>

        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          {event.bannerUrl ? (
            <img
              src={event.bannerUrl}
              alt=""
              style={{
                width: "100%",
                maxHeight: "180px",
                objectFit: "cover",
                borderRadius: "8px",
                marginBottom: "16px",
                display: "block",
              }}
            />
          ) : null}
          <h1
            style={{
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            {event.title}
          </h1>
          <p style={{ fontSize: "13px", color: "#747676", marginTop: "6px" }}>
            <CalendarIcon />
            {formatEventDateTime(event.date, event.time)}
          </p>
          {event.location ? (
            <p style={{ fontSize: "13px", color: "#747676", marginTop: "4px" }}>
              <MapPinIcon />
              {event.location}
            </p>
          ) : null}
          {event.description ? (
            <p
              style={{
                fontSize: "14px",
                color: "#aaaaaa",
                marginTop: "12px",
                lineHeight: 1.5,
                marginBottom: 0,
              }}
            >
              {event.description}
            </p>
          ) : null}
          <span style={categoryBadgeStyle(event.category)}>
            {eventCategoryLabel(event.category)}
          </span>
        </div>

        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          {submitted ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
                <CheckIcon />
              </div>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: "20px",
                  color: "#ffffff",
                  margin: "0 0 8px",
                }}
              >
                You&apos;re registered!
              </p>
              <p style={{ fontSize: "14px", color: "#747676", margin: 0 }}>
                We&apos;ll see you at {event.title}
              </p>
            </div>
          ) : (
            <>
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: "16px",
                  color: "#ffffff",
                  margin: "0 0 20px",
                }}
              >
                RSVP for this Event
              </h2>

              <form onSubmit={(e) => void handleSubmit(e)}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle} htmlFor="rsvp-name">
                    Full Name
                  </label>
                  <input
                    id="rsvp-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    autoComplete="name"
                  />
                  {errors.name ? (
                    <p style={{ color: "#E51937", fontSize: "12px", marginTop: "6px" }}>
                      {errors.name}
                    </p>
                  ) : null}
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle} htmlFor="rsvp-email">
                    Email Address
                  </label>
                  <input
                    id="rsvp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    autoComplete="email"
                  />
                  {errors.email ? (
                    <p style={{ color: "#E51937", fontSize: "12px", marginTop: "6px" }}>
                      {errors.email}
                    </p>
                  ) : null}
                </div>

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
                        style={{
                          ...inputStyle,
                          minHeight: "80px",
                          resize: "vertical",
                        }}
                      />
                    ) : null}

                    {q.question_type === "yes_no" ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <PillChoice
                          label="Yes"
                          selected={answers[q.id] === "Yes"}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: "Yes" }))
                          }
                        />
                        <PillChoice
                          label="No"
                          selected={answers[q.id] === "No"}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: "No" }))
                          }
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
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                            }
                          />
                        ))}
                      </div>
                    ) : null}

                    {errors[q.id] ? (
                      <p style={{ color: "#E51937", fontSize: "12px", marginTop: "6px" }}>
                        {errors[q.id]}
                      </p>
                    ) : null}
                  </div>
                ))}

                {errors.form ? (
                  <p style={{ color: "#E51937", fontSize: "13px", marginBottom: "12px" }}>
                    {errors.form}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    background: "#E51937",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "12px",
                    fontWeight: 600,
                    fontSize: "15px",
                    marginTop: "20px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Submitting…" : "Confirm RSVP"}
                </button>

                <p
                  style={{
                    fontSize: "11px",
                    color: "#333333",
                    textAlign: "center",
                    marginTop: "12px",
                    marginBottom: 0,
                  }}
                >
                  Powered by GryphClubConnect
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
