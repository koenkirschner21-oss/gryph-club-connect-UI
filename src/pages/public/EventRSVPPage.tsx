import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { membershipRequiresApproval } from "../../lib/clubJoinUtils";
import {
  filterRsvpQuestionsForLoggedInUser,
  getEventRsvpAccess,
  isSystemRsvpQuestion,
} from "../../lib/eventRsvpUtils";
import { normalizeVisibility } from "../../lib/contentVisibility";
import { resolveEventDetailPath } from "../../lib/eventNavigation";
import { supabase } from "../../lib/supabaseClient";
import { submitEventSignup, clubEventToSignupContext, clearEventFormResponses } from "../../lib/eventRsvpActions";
import { resolveStudentDisplayName } from "../../lib/notifications";
import PublicDetailBackButton from "../../components/public/PublicDetailBackButton";
import { EventDetailClubHeader } from "../../components/events/EventDetailLayout";
import Spinner from "../../components/ui/Spinner";
import { useIsMobile } from "../../hooks/useWindowWidth";
import type { MembershipType, Visibility } from "../../types";

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
  visibility: Visibility;
  signupRequiresApproval?: boolean;
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

const PAGE_MAX_WIDTH = "1080px";
const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";

const cardStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
};

const inputStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "12px 14px",
  color: "#ffffff",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  lineHeight: 1.5,
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

const inputFocusStyle: CSSProperties = {
  borderColor: ACCENT_RED,
  boxShadow: "0 0 0 2px rgba(229, 25, 55, 0.2)",
  outline: "none",
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

function formatEventDate(date: string): string {
  const parsed = new Date(`${date.trim()}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime12h(time: string): string | null {
  const raw = time.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  const parsed = new Date(`1970-01-01T${raw}`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEventDateTime(date: string, time: string): string {
  const datePart = formatEventDate(date);
  const timePart = formatEventTime12h(time);
  return timePart ? `${datePart} · ${timePart}` : datePart;
}

function displayQuestionLabel(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "Additional details";
  // Soften incomplete trailing fragments like "If yes," / "Please explain"
  text = text.replace(/[:：]\s*$/, "").trim();
  if (/^(if yes|if no)\b/i.test(text) && text.length < 18) {
    return /^if no/i.test(text)
      ? "Please share more details"
      : "Please share more details";
  }
  if (!/[.?!]$/.test(text) && text.length > 3) {
    // Keep as-is; only capitalize first letter for clarity
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isConditionalFollowUp(
  question: FormQuestion,
  previous: FormQuestion | undefined,
): "yes" | "no" | null {
  if (!previous || previous.question_type !== "yes_no") return null;
  const text = question.question.trim().toLowerCase();
  if (/^if\s+no\b/.test(text)) return "no";
  if (/^if\s+yes\b/.test(text) || /^if\b/.test(text)) return "yes";
  if (
    /^(please\s+)?(explain|describe|provide|share)\b/.test(text) ||
    /^tell us more\b/.test(text) ||
    /^additional\b/.test(text)
  ) {
    return "yes";
  }
  if (!text.endsWith("?") && text.length < 40 && /^(why|how|what)\b/.test(text)) {
    return "yes";
  }
  return null;
}

function getVisibleSignupQuestions(
  questions: FormQuestion[],
  answers: Record<string, string>,
): FormQuestion[] {
  const ordered = [...questions].sort((a, b) => a.order_index - b.order_index);
  const visible: FormQuestion[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const question = ordered[i];
    const previous = ordered[i - 1];
    const trigger = isConditionalFollowUp(question, previous);
    if (!trigger) {
      visible.push(question);
      continue;
    }
    const previousAnswer = (answers[previous.id] ?? "").trim().toLowerCase();
    const shouldShow =
      trigger === "yes" ? previousAnswer === "yes" : previousAnswer === "no";
    if (shouldShow) visible.push(question);
  }
  return visible;
}

function friendlySubmitError(message: string | undefined): string {
  if (!message?.trim()) {
    return "Something went wrong while saving your sign-up. Please try again.";
  }
  if (
    message.toLowerCase().includes("duplicate") ||
    message.toLowerCase().includes("already registered")
  ) {
    return "You're already registered for this event.";
  }
  if (message.startsWith("Could not") || message.startsWith("Failed to")) {
    return message;
  }
  return "Something went wrong while saving your sign-up. Please try again.";
}

function mergeFieldStyle(
  base: CSSProperties,
  focused: boolean,
  hasError?: boolean,
): CSSProperties {
  if (hasError) {
    return {
      ...base,
      borderColor: ACCENT_RED,
      boxShadow: "0 0 0 2px rgba(229, 25, 55, 0.15)",
    };
  }
  return focused ? { ...base, ...inputFocusStyle } : base;
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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: selected ? ACCENT_RED : hovered ? "#242424" : "#1a1a1a",
        border: selected
          ? `1px solid ${ACCENT_RED}`
          : focused
            ? `1px solid ${ACCENT_RED}`
            : hovered
              ? "1px solid #555555"
              : "1px solid #333333",
        color: selected ? "#ffffff" : hovered ? "#cccccc" : "#888888",
        borderRadius: "20px",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: selected ? 600 : 500,
        cursor: "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
        boxShadow: focused && !selected ? "0 0 0 2px rgba(229, 25, 55, 0.2)" : undefined,
      }}
    >
      {label}
    </button>
  );
}

function UsersIcon() {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: PAGE_MAX_WIDTH,
          margin: "0 auto",
          padding: "32px 20px 48px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BrandedHeader({ clubName }: { clubName?: string }) {
  return (
    <header style={{ textAlign: "center", marginBottom: "28px" }}>
      <p
        style={{
          fontWeight: 800,
          fontSize: "20px",
          color: "#ffffff",
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        Gryph
        <span style={{ color: ACCENT_RED }}>·</span>
        ClubConnect
      </p>
      <p style={{ fontSize: "12px", color: "#666666", margin: "6px 0 0", lineHeight: 1.4 }}>
        Helping Guelph students discover clubs and events.
      </p>
      {clubName ? (
        <p style={{ fontSize: "13px", color: "#888888", margin: "10px 0 0" }}>{clubName}</p>
      ) : null}
    </header>
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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const { isJoined, isPending, isSaved, toggleSaveClub } = useClubContext();
  const [loading, setLoading] = useState(true);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [clubName, setClubName] = useState("");
  const [clubSlug, setClubSlug] = useState("");
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [clubAbbreviation, setClubAbbreviation] = useState<string | undefined>(undefined);
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [membershipType, setMembershipType] = useState<MembershipType>("open");
  const [isActiveMember, setIsActiveMember] = useState(false);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPostRsvpCta, setShowPostRsvpCta] = useState(false);
  const [cancellingSignup, setCancellingSignup] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const customQuestions = useMemo(() => {
    if (user?.id) {
      return filterRsvpQuestionsForLoggedInUser(questions);
    }
    return questions.filter((question) => !isSystemRsvpQuestion(question.question));
  }, [questions, user?.id]);

  const visibleQuestions = useMemo(
    () => getVisibleSignupQuestions(customQuestions, answers),
    [customQuestions, answers],
  );

  const rsvpAccess = useMemo(() => {
    if (!event) {
      return { canRsvp: false, showRsvpButton: false };
    }
    return getEventRsvpAccess(event.visibility, { isActiveMember, isPrivileged });
  }, [event, isActiveMember, isPrivileged]);

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
        .select("id, club_id, title, description, date, time, location, category, visibility, signup_requires_approval")
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
        visibility: normalizeVisibility(eventRow.visibility as string | null, "public"),
        signupRequiresApproval: Boolean(eventRow.signup_requires_approval),
      };

      setEvent(loadedEvent);

      const { data: clubRow } = await supabase
        .from("clubs")
        .select("name, slug, membership_type, logo_url, abbreviation")
        .eq("id", loadedEvent.clubId)
        .maybeSingle();

      if (!cancelled) {
        setClubName((clubRow?.name as string) ?? "");
        setClubSlug((clubRow?.slug as string) ?? "");
        setClubLogoUrl((clubRow?.logo_url as string | null) ?? null);
        setClubAbbreviation((clubRow?.abbreviation as string | undefined) ?? undefined);
        setMembershipType(
          (clubRow?.membership_type as MembershipType) ?? "open",
        );
      }

      if (user?.id && !cancelled) {
        const { data: membership } = await supabase
          .from("club_members")
          .select("role, status")
          .eq("club_id", loadedEvent.clubId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!cancelled) {
          const role = (membership?.role as string) ?? "";
          const status = (membership?.status as string) ?? "";
          setIsActiveMember(status === "active");
          setIsPrivileged(
            status === "active" &&
              (role === "owner" || role === "executive" || role === "exec"),
          );
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled) {
          setName((profile?.full_name as string) ?? "");
          setEmail((profile?.email as string) ?? user.email ?? "");
        }
      }

      const { data: questionRows } = await supabase
        .from("event_form_questions")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index", { ascending: true });

      const [{ data: rsvpRows }, { count: externalCount }] = await Promise.all([
        supabase.from("event_rsvps").select("status").eq("event_id", eventId),
        supabase
          .from("event_external_rsvps")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId),
      ]);

      if (!cancelled) {
        const goingFromMembers =
          (rsvpRows ?? []).filter((row) => (row.status as string) === "going").length;
        setGoingCount(goingFromMembers + (externalCount ?? 0));
      }

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
        if (user?.id) {
          const { data: existing } = await supabase
            .from("event_rsvps")
            .select("id")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!cancelled && existing) {
            setAlreadyRegistered(true);
          }
        }

        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, user?.id]);

  function validate(): boolean {
    setSubmitAttempted(true);
    const next: Record<string, string> = {};

    if (!user?.id) {
      if (!name.trim()) next.name = "Full name is required.";
      if (!email.trim()) {
        next.email = "Email address is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        next.email = "Enter a valid email address.";
      }
    }

    for (const q of visibleQuestions) {
      if (q.required && !(answers[q.id] ?? "").trim()) {
        next[q.id] = "This question is required.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!event || !eventId || !validate()) return;

    setSubmitting(true);
    const answersPayload: Record<string, string> = {};
    for (const q of customQuestions) {
      const value = (answers[q.id] ?? "").trim();
      if (value) answersPayload[q.id] = value;
    }

    if (user?.id) {
      const { data: existing } = await supabase
        .from("event_rsvps")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setSubmitting(false);
        setAlreadyRegistered(true);
        setSubmitted(true);
        return;
      }

      const result = await submitEventSignup(supabase, {
        eventId,
        userId: user.id,
        requestedStatus: "going",
        skipQuestionnaireCheck: true,
        userEmail: user.email,
        registrantName: resolveStudentDisplayName(name, user.email),
        context: clubEventToSignupContext(
          {
            id: event.id,
            clubId: event.clubId,
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location ?? "",
            signupRequiresApproval: event.signupRequiresApproval,
          },
          clubName || "Club",
        ),
        formResponses: visibleQuestions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] ?? "",
        })),
      });

      if (!result.ok) {
        setSubmitting(false);
        setErrors({
          form: friendlySubmitError(
            result.outcome === "error"
              ? result.error
              : "Could not submit signup. Please try again.",
          ),
        });
        return;
      }

      setSubmitting(false);
      setSubmitted(true);
      setAlreadyRegistered(true);
      setGoingCount((prev) => (prev == null ? 1 : prev + 1));
      if (!isActiveMember && !isJoined(event.clubId)) {
        setShowPostRsvpCta(true);
      }
      return;
    }

    const { data: existingExternal } = await supabase
      .from("event_external_rsvps")
      .select("id")
      .eq("event_id", eventId)
      .eq("email", email.trim())
      .maybeSingle();

    if (existingExternal) {
      setSubmitting(false);
      setErrors({ form: friendlySubmitError("You're already registered for this event.") });
      return;
    }

    const { error } = await supabase.from("event_external_rsvps").insert({
      event_id: eventId,
      name: name.trim(),
      email: email.trim(),
      answers: answersPayload,
    });

    setSubmitting(false);
    if (error) {
      setErrors({
        form: friendlySubmitError(error.message || "Could not submit signup. Please try again."),
      });
      return;
    }

    setSubmitted(true);
  }
  async function handleCancelSignup() {
    if (!user?.id || !eventId || cancellingSignup) return;

    setCancellingSignup(true);
    setErrors({});
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);

    if (error) {
      setCancellingSignup(false);
      setErrors({ form: "Could not cancel signup. Please try again." });
      return;
    }

    await clearEventFormResponses(supabase, eventId, user.id);

    setCancellingSignup(false);
    setSubmitted(false);
    setAlreadyRegistered(false);
    setShowPostRsvpCta(false);
    setSubmitAttempted(false);
    setAnswers({});
    setGoingCount((prev) => (prev == null || prev <= 0 ? 0 : prev - 1));
  }

  const clubJoined = event
    ? isJoined(event.clubId) || isActiveMember
    : false;
  const clubJoinPending = event ? isPending(event.clubId) : false;

  function renderSignupConfirmation() {
    if (!event) return null;

    const eventDetailPath = resolveEventDetailPath(
      event.id,
      event.clubId,
      isActiveMember,
    );
    const timeLabel = formatEventTime12h(event.time);
    const locationLabel = event.location?.trim() && event.location.toUpperCase() !== "TBD"
      ? event.location.trim()
      : null;

    return (
      <div style={{ padding: "4px 0" }}>
        <EventDetailClubHeader
          clubName={clubName || "Club"}
          logoUrl={clubLogoUrl ?? undefined}
          abbreviation={clubAbbreviation}
          clubSlug={clubSlug || undefined}
          compact
        />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
          <CheckIcon />
        </div>
        <p
          style={{
            fontWeight: 700,
            fontSize: "20px",
            color: "#ffffff",
            margin: "0 0 14px",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          You&apos;re signed up
        </p>
        <p
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 10px",
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          {event.title}
        </p>
        <p style={{ fontSize: "14px", color: "#bbbbbb", margin: "0 0 4px", textAlign: "center" }}>
          {formatEventDate(event.date)}
        </p>
        {timeLabel ? (
          <p style={{ fontSize: "14px", color: "#bbbbbb", margin: "0 0 4px", textAlign: "center" }}>
            {timeLabel}
          </p>
        ) : null}
        {locationLabel ? (
          <p style={{ fontSize: "14px", color: "#bbbbbb", margin: "0 0 20px", textAlign: "center" }}>
            {locationLabel}
          </p>
        ) : (
          <div style={{ marginBottom: "20px" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={() => navigate(eventDetailPath)}
            style={{
              width: "100%",
              background: ACCENT_RED,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            View Event
          </button>
          <button
            type="button"
            disabled={cancellingSignup}
            onClick={() => void handleCancelSignup()}
            style={{
              width: "100%",
              background: "transparent",
              color: "#cccccc",
              border: "1px solid #333333",
              borderRadius: "8px",
              padding: "11px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: cancellingSignup ? "wait" : "pointer",
            }}
          >
            {cancellingSignup ? "Cancelling…" : "Cancel Sign-Up"}
          </button>
          {isActiveMember ? (
            <button
              type="button"
              onClick={() => navigate(`/app/clubs/${event.clubId}`)}
              style={{
                width: "100%",
                background: "transparent",
                color: "#E51937",
                border: "1px solid #333333",
                borderRadius: "8px",
                padding: "11px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open Club Workspace
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate("/events")}
            style={{
              width: "100%",
              background: "transparent",
              color: "#777777",
              border: "none",
              padding: "8px",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Back to Events
          </button>
        </div>
        {showPostRsvpCta && !clubJoined && !clubJoinPending ? (
          <div
            style={{
              marginTop: "20px",
              paddingTop: "20px",
              borderTop: "1px solid #242424",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "14px", color: "#cccccc", margin: "0 0 12px" }}>
              Want to stay connected with {clubName}?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {renderMembershipPrimaryAction()}
              <button
                type="button"
                onClick={() => toggleSaveClub(event.clubId)}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "#ffffff",
                  border: "1px solid #333333",
                  borderRadius: "8px",
                  padding: "11px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {isSaved(event.clubId) ? "Club Saved ✓" : "Save Club"}
              </button>
              <button
                type="button"
                onClick={() => setShowPostRsvpCta(false)}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "#777777",
                  border: "none",
                  padding: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Not Now
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderMembershipPrimaryAction(disabled = false) {
    if (!event) return null;

    if (isActiveMember) {
      return (
        <button
          type="button"
          onClick={() => navigate(`/app/clubs/${event.clubId}`)}
          style={{
            width: "100%",
            background: ACCENT_RED,
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "11px 20px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open Club Workspace
        </button>
      );
    }

    if (clubJoinPending) {
      return (
        <button
          type="button"
          disabled
          style={{
            width: "100%",
            background: "#1a1200",
            color: "#FFC429",
            border: "1px solid #FFC429",
            borderRadius: "6px",
            padding: "11px 20px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "default",
            opacity: disabled ? 0.85 : 1,
          }}
        >
          Join Request Pending
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          if (clubSlug) {
            navigate(`/clubs/${clubSlug}`);
            return;
          }
          navigate("/app/join-club");
        }}
        style={{
          width: "100%",
          background: "#E51937",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          padding: "11px 20px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {membershipRequiresApproval(membershipType)
          ? "Request to Join"
          : "Join Club"}
      </button>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <PublicDetailBackButton fallbackTo="/events" label="Back to Events" />
        <BrandedHeader />
        <div
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            minHeight: "220px",
          }}
        >
          <Spinner label="Loading event details…" />
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>Loading event details…</p>
        </div>
      </PageShell>
    );
  }

  if (notFound || !event) {
    return (
      <PageShell>
        <PublicDetailBackButton fallbackTo="/events" label="Back to Events" />
        <BrandedHeader />
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px 24px" }}>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            Event not found
          </p>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#777777", lineHeight: 1.5 }}>
            This event may have been removed or the link is no longer valid.
          </p>
          <button
            type="button"
            onClick={() => navigate("/events")}
            style={{
              background: ACCENT_RED,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "11px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to Events
          </button>
        </div>
      </PageShell>
    );
  }

  const showSuccessState = submitted || alreadyRegistered;
  const hasCustomQuestions = visibleQuestions.length > 0;

  return (
    <PageShell>
      <PublicDetailBackButton fallbackTo="/events" label="Back to Events" />
      <BrandedHeader />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? "20px" : "24px",
          alignItems: "start",
        }}
      >
        <div style={cardStyle}>
          <EventDetailClubHeader
            clubName={clubName || "Club"}
            logoUrl={clubLogoUrl ?? undefined}
            abbreviation={clubAbbreviation}
            clubSlug={clubSlug || undefined}
          />
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
              fontSize: "24px",
              color: "#ffffff",
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            {event.title}
          </h1>
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <p style={{ fontSize: "14px", color: "#bbbbbb", margin: 0 }}>
              <CalendarIcon />
              {formatEventDateTime(event.date, event.time)}
            </p>
            {event.location ? (
              <p style={{ fontSize: "14px", color: "#bbbbbb", margin: 0 }}>
                <MapPinIcon />
                {event.location}
              </p>
            ) : null}
            {goingCount != null && goingCount > 0 ? (
              <p style={{ fontSize: "14px", color: GOLD, margin: 0, fontWeight: 600 }}>
                <UsersIcon />
                {goingCount} going
              </p>
            ) : null}
          </div>
          {event.description ? (
            <p
              style={{
                fontSize: "14px",
                color: "#cfcfcf",
                marginTop: "14px",
                lineHeight: 1.55,
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

        <div style={cardStyle}>
          {showSuccessState ? (
            renderSignupConfirmation()
          ) : !rsvpAccess.canRsvp ? (
            <div style={{ textAlign: "center", padding: "24px 8px" }}>
              <p style={{ fontSize: "15px", color: "#cccccc", margin: 0, lineHeight: 1.5 }}>
                {rsvpAccess.blockedMessage ??
                  "You do not have access to sign up for this event."}
              </p>
            </div>
          ) : (
            <>
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: "20px",
                  color: "#ffffff",
                  margin: "0 0 8px",
                  lineHeight: 1.3,
                }}
              >
                Sign up for {event.title}
              </h2>
              {hasCustomQuestions ? (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#777777",
                    margin: "0 0 20px",
                    lineHeight: 1.5,
                  }}
                >
                  Answer a few quick questions before confirming your spot.
                </p>
              ) : null}

              {!hasCustomQuestions ? (
                <div
                  style={{
                    background: "#111111",
                    border: "1px solid #242424",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    marginBottom: "20px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", color: "#aaaaaa", lineHeight: 1.5 }}>
                    No questions are required for this event. Confirm below to save your spot.
                  </p>
                </div>
              ) : null}

              <form onSubmit={(e) => void handleSubmit(e)}>
                {!user?.id ? (
                  <>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={labelStyle} htmlFor="rsvp-name">
                        Full Name
                      </label>
                      <input
                        id="rsvp-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        style={mergeFieldStyle(
                          inputStyle,
                          focusedField === "name",
                          submitAttempted && Boolean(errors.name),
                        )}
                        autoComplete="name"
                      />
                      {submitAttempted && errors.name ? (
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
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)}
                        style={mergeFieldStyle(
                          inputStyle,
                          focusedField === "email",
                          submitAttempted && Boolean(errors.email),
                        )}
                        autoComplete="email"
                      />
                      {submitAttempted && errors.email ? (
                        <p style={{ color: "#E51937", fontSize: "12px", marginTop: "6px" }}>
                          {errors.email}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {visibleQuestions.map((q) => (
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
                      {displayQuestionLabel(q.question)}
                      {q.required ? (
                        <span style={{ color: "#c45a68", marginLeft: "3px" }} aria-hidden>
                          *
                        </span>
                      ) : null}
                    </label>

                    {q.question_type === "text" ? (
                      <textarea
                        value={answers[q.id] ?? ""}
                        onChange={(e) => {
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                          if (errors[q.id]) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next[q.id];
                              return next;
                            });
                          }
                        }}
                        onFocus={() => setFocusedField(q.id)}
                        onBlur={() => setFocusedField(null)}
                        aria-invalid={submitAttempted && Boolean(errors[q.id])}
                        style={{
                          ...mergeFieldStyle(
                            inputStyle,
                            focusedField === q.id,
                            submitAttempted && Boolean(errors[q.id]),
                          ),
                          minHeight: "96px",
                          resize: "vertical",
                          fontFamily: "inherit",
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

                    {submitAttempted && errors[q.id] ? (
                      <p style={{ color: "#E51937", fontSize: "12px", marginTop: "6px" }}>
                        {errors[q.id]}
                      </p>
                    ) : null}
                  </div>
                ))}

                {errors.form ? (
                  <div
                    style={{
                      background: "rgba(229, 25, 55, 0.08)",
                      border: "1px solid rgba(229, 25, 55, 0.25)",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      marginBottom: "12px",
                    }}
                  >
                    <p style={{ color: "#f2a0aa", fontSize: "13px", margin: "0 0 8px", lineHeight: 1.45 }}>
                      {errors.form}
                    </p>
                    <button
                      type="button"
                      onClick={() => setErrors((prev) => ({ ...prev, form: "" }))}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => navigate("/events")}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "1px solid #333333",
                      color: "#888888",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting}
                    style={{
                      flex: 1,
                      background: ACCENT_RED,
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      fontWeight: 600,
                      fontSize: "14px",
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.75 : 1,
                    }}
                  >
                    {submitting ? "Submitting…" : "Confirm Sign Up"}
                  </button>
                </div>

                <p
                  style={{
                    fontSize: "12px",
                    color: "#666666",
                    textAlign: "center",
                    marginTop: "12px",
                    marginBottom: 0,
                    lineHeight: 1.45,
                  }}
                >
                  You can update or cancel your sign-up later if the club allows it.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
