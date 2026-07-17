import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  notifyClubRequestSubmitted,
  resolveStudentDisplayName,
} from "../../lib/notifications";
import { CLUB_CATEGORY_OPTIONS } from "../../lib/clubCategories";
import { getClubRequestStatusPath } from "../../lib/deepLinks";
import { isClubClaimable, normalizeClaimStatus } from "../../lib/clubClaimUtils";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

const STEP_LABELS = ["Basics", "Details", "Links"] as const;
const DESCRIPTION_MAX = 500;
const DESCRIPTION_MIN = 20;

const MEETING_FREQUENCIES = [
  "",
  "Weekly",
  "Biweekly",
  "Monthly",
  "As needed",
] as const;

const MEETING_DAYS = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const helperTextStyle = {
  fontSize: "12px",
  color: "#888888",
  marginTop: "6px",
  lineHeight: 1.5,
} as const;

const fieldErrorStyle = {
  fontSize: "12px",
  color: "#E51937",
  marginTop: "4px",
} as const;

type NameMatch =
  | { kind: "none" }
  | { kind: "checking" }
  | {
      kind: "existing";
      clubId: string;
      name: string;
      slug: string | null;
      claimable: boolean;
    };

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatStructuredMeetingSchedule(
  frequency: string,
  day: string,
  time: string,
): string {
  const parts: string[] = [];
  if (frequency.trim()) parts.push(frequency.trim());
  if (day.trim()) parts.push(day.trim());
  if (time.trim()) {
    const parsed = new Date(`1970-01-01T${time.trim()}`);
    const label = Number.isNaN(parsed.getTime())
      ? time.trim()
      : parsed.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
    parts.push(label);
  }
  return parts.join(" · ");
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default function CreateClubPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [meetingFrequency, setMeetingFrequency] = useState("");
  const [meetingDay, setMeetingDay] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [discord, setDiscord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    category: "",
    description: "",
  });
  const [touched, setTouched] = useState({
    name: false,
    category: false,
    description: false,
  });
  const [basicsAttempted, setBasicsAttempted] = useState(false);
  const [nameMatch, setNameMatch] = useState<NameMatch>({ kind: "none" });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittedClubName, setSubmittedClubName] = useState<string | null>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const nameCheckSeq = useRef(0);

  const showNameError = (touched.name || basicsAttempted) && Boolean(fieldErrors.name);
  const showCategoryError =
    (touched.category || basicsAttempted) && Boolean(fieldErrors.category);
  const showDescriptionError =
    (touched.description || basicsAttempted) && Boolean(fieldErrors.description);

  const checkClubName = useCallback(async (rawName: string) => {
    const trimmed = rawName.trim();
    if (trimmed.length < 3) {
      setNameMatch({ kind: "none" });
      return;
    }

    const seq = ++nameCheckSeq.current;
    setNameMatch({ kind: "checking" });

    const { data, error: lookupError } = await supabase
      .from("clubs")
      .select("id, name, slug, claim_status")
      .ilike("name", trimmed)
      .limit(12);

    if (seq !== nameCheckSeq.current) return;

    if (lookupError) {
      console.error("Failed to check club name:", lookupError.message);
      setNameMatch({ kind: "none" });
      return;
    }

    const exact = (data ?? []).find((row) =>
      namesMatch((row.name as string) ?? "", trimmed),
    );

    if (!exact) {
      setNameMatch({ kind: "none" });
      return;
    }

    const clubId = exact.id as string;
    const { count: ownerCount } = await supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "active")
      .or("role.eq.owner,access_level.eq.president");

    if (seq !== nameCheckSeq.current) return;

    const claimStatus = normalizeClaimStatus(exact.claim_status as string | null);
    setNameMatch({
      kind: "existing",
      clubId,
      name: (exact.name as string) ?? trimmed,
      slug: (exact.slug as string | null) ?? null,
      claimable: isClubClaimable(claimStatus, ownerCount ?? 0),
    });
  }, []);

  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setNameMatch({ kind: "none" });
      return;
    }
    const timer = window.setTimeout(() => {
      void checkClubName(trimmed);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [name, checkClubName]);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(generateSlug(value));
    setTouched((prev) => ({ ...prev, name: true }));
    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
  }

  function validateBasics(): boolean {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const nextFieldErrors = {
      name: !trimmedName
        ? "Club name is required"
        : trimmedName.length < 3
          ? "Club name must be at least 3 characters"
          : nameMatch.kind === "existing" && !nameMatch.claimable
            ? "A club with this name already exists. Choose a different name."
            : nameMatch.kind === "existing" && nameMatch.claimable
              ? "This club already exists and is available to claim."
              : "",
      category: !category.trim() ? "Category is required" : "",
      description: !trimmedDescription
        ? "Description is required"
        : trimmedDescription.length < DESCRIPTION_MIN
          ? `Description must be at least ${DESCRIPTION_MIN} characters`
          : trimmedDescription.length > DESCRIPTION_MAX
            ? `Description must be ${DESCRIPTION_MAX} characters or fewer`
            : "",
    };
    setFieldErrors(nextFieldErrors);
    setBasicsAttempted(true);
    return !(
      nextFieldErrors.name ||
      nextFieldErrors.category ||
      nextFieldErrors.description
    );
  }

  function handleNext() {
    if (step === 1) {
      if (nameMatch.kind === "checking") return;
      if (!validateBasics()) return;
      if (nameMatch.kind === "existing") return;
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  }

  async function submitClubRequest() {
    if (step !== 3 || loading || successMessage) return;

    setError(null);

    if (!user?.id) {
      setError("You must be signed in to submit a club request.");
      return;
    }

    if (nameMatch.kind === "checking") {
      setError("Still checking that club name. Please wait a moment.");
      return;
    }

    if (!validateBasics() || nameMatch.kind === "existing") {
      setStep(1);
      return;
    }

    setLoading(true);

    try {
      // Final duplicate guard at submit time.
      const { data: finalMatches } = await supabase
        .from("clubs")
        .select("id, name, slug, claim_status")
        .ilike("name", name.trim())
        .limit(12);

      const exact = (finalMatches ?? []).find((row) =>
        namesMatch((row.name as string) ?? "", name.trim()),
      );
      if (exact) {
        const clubId = exact.id as string;
        const { count: ownerCount } = await supabase
          .from("club_members")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("status", "active")
          .or("role.eq.owner,access_level.eq.president");
        const claimStatus = normalizeClaimStatus(exact.claim_status as string | null);
        const claimable = isClubClaimable(claimStatus, ownerCount ?? 0);
        setNameMatch({
          kind: "existing",
          clubId,
          name: (exact.name as string) ?? name.trim(),
          slug: (exact.slug as string | null) ?? null,
          claimable,
        });
        setFieldErrors((prev) => ({
          ...prev,
          name: claimable
            ? "This club already exists and is available to claim."
            : "A club with this name already exists. Choose a different name.",
        }));
        setBasicsAttempted(true);
        setStep(1);
        setLoading(false);
        return;
      }

      const socialLinks: Record<string, string> = {};
      if (website.trim()) socialLinks.website = website.trim();
      if (instagram.trim()) socialLinks.instagram = instagram.trim();
      if (discord.trim()) socialLinks.discord = discord.trim();

      const meetingSchedule = formatStructuredMeetingSchedule(
        meetingFrequency,
        meetingDay,
        meetingTime,
      );

      const longDescription = JSON.stringify({
        slug: slug || generateSlug(name),
        contact_email: contactEmail.trim(),
        meeting_schedule: meetingSchedule || undefined,
        meeting_frequency: meetingFrequency.trim() || undefined,
        meeting_day: meetingDay.trim() || undefined,
        meeting_time: meetingTime.trim() || undefined,
        meeting_location: meetingLocation.trim() || undefined,
        social_links:
          Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
      });

      const { data: insertedRequest, error: insertError } = await supabase
        .from("club_requests")
        .insert({
          submitted_by: user.id,
          name: name.trim(),
          short_description: description.trim() || null,
          long_description: longDescription,
          category: category.trim(),
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to submit club request:", insertError.message);
        setError("Failed to submit club request. Please try again.");
        return;
      }

      const requestId = insertedRequest?.id as string | undefined;
      if (requestId) {
        const submitterName = resolveStudentDisplayName(
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
          user.email,
        );

        await notifyClubRequestSubmitted(supabase, {
          clubName: name.trim(),
          submitterName,
          submitterUserId: user.id,
          clubRequestId: requestId,
        });
        setSubmittedRequestId(requestId);
      }

      setSubmittedClubName(name.trim());
      setSuccessMessage(
        `${name.trim()} is pending review. We'll email and notify you when it's approved or if we need more information.`,
      );
    } catch {
      setError("Failed to submit club request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
  }

  const selectStyle = {
    width: "100%",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--bg-3)",
    color: "var(--text-1)",
    padding: "10px 12px",
    fontSize: "14px",
  } as const;

  return (
    <div className="page-root mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-[26px] font-semibold tracking-[-0.5px] text-[var(--text-1)]">
        Create a club
      </h1>

      {successMessage ? (
        <div
          role="status"
          style={{
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
              padding: "4px 10px",
              borderRadius: "999px",
              background: "rgba(234, 179, 8, 0.12)",
              border: "1px solid rgba(234, 179, 8, 0.35)",
              fontSize: "12px",
              fontWeight: 600,
              color: "#facc15",
            }}
          >
            Pending Review
          </div>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "22px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {submittedClubName
              ? `${submittedClubName} is on its way.`
              : "Your club request is on its way."}
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#888888", lineHeight: 1.5 }}>
            {submittedClubName
              ? `Thanks — ${submittedClubName} was submitted successfully and is now pending review.`
              : "Your club request was submitted successfully and is now pending review."}
          </p>
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#cccccc",
              }}
            >
              What happens next
            </p>
            <ol
              style={{
                margin: 0,
                paddingLeft: "18px",
                fontSize: "13px",
                color: "#888888",
                lineHeight: 1.6,
              }}
            >
              <li style={{ marginBottom: "6px" }}>
                The GryphClubConnect team reviews{" "}
                {submittedClubName ? (
                  <strong style={{ color: "#cccccc" }}>{submittedClubName}</strong>
                ) : (
                  "your club"
                )}{" "}
                to confirm the details.
              </li>
              <li style={{ marginBottom: "6px" }}>
                You&apos;ll get a notification when the request is approved or if more
                information is needed.
              </li>
              <li>
                After approval, you can open the club workspace to add a logo, invites,
                and join settings.
              </li>
            </ol>
          </div>
          <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button type="button" onClick={() => navigate("/app")}>
              Back to Dashboard
            </Button>
            {submittedRequestId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(getClubRequestStatusPath(submittedRequestId))}
              >
                View Submission
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-2)] px-4 py-3 text-sm text-[#f87171]"
        >
          {error}
        </div>
      ) : null}

      {!successMessage ? (
        <div className="mb-8">
          <div className="flex items-center">
            {[1, 2, 3].map((dot, i) => (
              <div key={dot} className="flex flex-1 items-center">
                <div className="flex flex-1 justify-center">
                  <div
                    className={`step-dot ${step === dot ? "active" : step > dot ? "complete" : ""}`}
                  >
                    {dot}
                  </div>
                </div>
                {i < 2 ? <div className={`step-line ${step > dot ? "complete" : ""}`} /> : null}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {STEP_LABELS.map((label, index) => {
              const dot = (index + 1) as 1 | 2 | 3;
              const isActive = step === dot;
              const isComplete = step > dot;
              return (
                <span
                  key={label}
                  style={{
                    fontSize: "12px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#ffffff" : isComplete ? "#4ade80" : "#777777",
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {!successMessage ? (
        <form
          onSubmit={handleFormSubmit}
          className="space-y-6 overflow-hidden rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-2)] p-6"
          noValidate
        >
          <div className="transition-all duration-200" style={{ transform: "translateX(0)", opacity: 1 }}>
            {step === 1 ? (
              <fieldset className="space-y-4">
                <legend className="mb-4 text-[18px] font-medium text-[var(--text-1)]">Basics</legend>
                <FormInput
                  id="name"
                  label="Club Name"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                  placeholder="e.g. Gryphon Robotics Club"
                  className={
                    showNameError ? "border-[#E51937] focus:border-[#E51937]" : undefined
                  }
                />
                {showNameError ? <p style={fieldErrorStyle}>{fieldErrors.name}</p> : null}
                {nameMatch.kind === "checking" ? (
                  <p style={helperTextStyle}>Checking club name…</p>
                ) : null}
                {nameMatch.kind === "existing" && nameMatch.claimable ? (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,196,41,0.35)",
                      background: "rgba(255,196,41,0.08)",
                    }}
                  >
                    <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#ffd27a", lineHeight: 1.5 }}>
                      <strong style={{ color: "#ffffff" }}>{nameMatch.name}</strong> already
                      exists and is available to claim. Claim it instead of creating a duplicate.
                    </p>
                    {nameMatch.slug ? (
                      <Link
                        to={`/clubs/${nameMatch.slug}/claim`}
                        style={{
                          color: "#FFC429",
                          fontSize: "13px",
                          fontWeight: 600,
                          textDecoration: "underline",
                        }}
                      >
                        Claim this club →
                      </Link>
                    ) : (
                      <Link
                        to="/explore?claim=true"
                        style={{
                          color: "#FFC429",
                          fontSize: "13px",
                          fontWeight: 600,
                          textDecoration: "underline",
                        }}
                      >
                        Browse claimable clubs →
                      </Link>
                    )}
                  </div>
                ) : null}
                {nameMatch.kind === "existing" && !nameMatch.claimable ? (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(229,25,55,0.35)",
                      background: "rgba(229,25,55,0.08)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "13px", color: "#ffb4b4", lineHeight: 1.5 }}>
                      A club named <strong style={{ color: "#ffffff" }}>{nameMatch.name}</strong>{" "}
                      already exists. Please choose a different name.
                    </p>
                    {nameMatch.slug ? (
                      <Link
                        to={`/clubs/${nameMatch.slug}`}
                        style={{
                          display: "inline-block",
                          marginTop: "8px",
                          color: "#cccccc",
                          fontSize: "13px",
                          fontWeight: 600,
                          textDecoration: "underline",
                        }}
                      >
                        View existing club →
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--text-1)]">
                    Category <span className="ml-1 text-[var(--red)]">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CLUB_CATEGORY_OPTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setCategory(item);
                          setTouched((prev) => ({ ...prev, category: true }));
                          if (fieldErrors.category) {
                            setFieldErrors((prev) => ({ ...prev, category: "" }));
                          }
                        }}
                        className={`rounded-[var(--r-md)] border px-3 py-2 text-sm transition ${
                          category === item
                            ? "border-[var(--red)] bg-[var(--red-dim)] text-[var(--text-1)]"
                            : "border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-2)] hover:bg-[var(--bg-4)]"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {showCategoryError ? (
                    <p style={fieldErrorStyle}>{fieldErrors.category}</p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-1 block text-sm font-medium text-[var(--text-1)]"
                  >
                    Description <span className="ml-1 text-[var(--red)]">*</span>
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => {
                      const next = e.target.value.slice(0, DESCRIPTION_MAX);
                      setDescription(next);
                      setTouched((prev) => ({ ...prev, description: true }));
                      if (fieldErrors.description) {
                        setFieldErrors((prev) => ({ ...prev, description: "" }));
                      }
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
                    rows={4}
                    maxLength={DESCRIPTION_MAX}
                    placeholder="Tell students what your club is about..."
                    className={`w-full rounded-[var(--r-md)] border bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none ${
                      showDescriptionError
                        ? "border-[#E51937] focus:border-[#E51937]"
                        : "border-[var(--border)] focus:border-[var(--red)]"
                    }`}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginTop: "6px",
                    }}
                  >
                    <p style={{ ...helperTextStyle, marginTop: 0 }}>
                      Short public summary of who your club is for and what you do. At least{" "}
                      {DESCRIPTION_MIN} characters.
                    </p>
                    <p
                      style={{
                        ...helperTextStyle,
                        marginTop: 0,
                        flexShrink: 0,
                        color:
                          description.length >= DESCRIPTION_MAX ? "#E51937" : "#777777",
                      }}
                    >
                      {description.length}/{DESCRIPTION_MAX}
                    </p>
                  </div>
                  {showDescriptionError ? (
                    <p style={fieldErrorStyle}>{fieldErrors.description}</p>
                  ) : null}
                </div>
              </fieldset>
            ) : null}

            {step === 2 ? (
              <fieldset className="space-y-4">
                <legend className="mb-4 text-[18px] font-medium text-[var(--text-1)]">
                  Details
                </legend>
                <p style={{ ...helperTextStyle, marginTop: 0, marginBottom: "4px" }}>
                  Meeting details are optional. Add what you know now — you can update later.
                </p>
                <div>
                  <label
                    htmlFor="meetingFrequency"
                    className="mb-1.5 block text-sm font-medium text-white"
                  >
                    Meeting frequency
                  </label>
                  <select
                    id="meetingFrequency"
                    value={meetingFrequency}
                    onChange={(e) => setMeetingFrequency(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select frequency (optional)</option>
                    {MEETING_FREQUENCIES.filter(Boolean).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="meetingDay"
                    className="mb-1.5 block text-sm font-medium text-white"
                  >
                    Meeting day
                  </label>
                  <select
                    id="meetingDay"
                    value={meetingDay}
                    onChange={(e) => setMeetingDay(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select day (optional)</option>
                    {MEETING_DAYS.filter(Boolean).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="meetingTime"
                    className="mb-1.5 block text-sm font-medium text-white"
                  >
                    Meeting time
                  </label>
                  <input
                    id="meetingTime"
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
                <FormInput
                  id="meetingLocation"
                  label="Meeting Location"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="e.g. Thornbrough Building, Room 1307"
                />
                <FormInput
                  id="contactEmail"
                  label="Contact Email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="club@uoguelph.ca"
                />
              </fieldset>
            ) : null}

            {step === 3 ? (
              <fieldset className="space-y-4">
                <legend className="mb-1 text-[18px] font-medium text-[var(--text-1)]">
                  Links
                </legend>
                <p style={{ ...helperTextStyle, marginTop: 0, marginBottom: "16px" }}>
                  Links are optional. Add any you have now — you can update them later from your
                  club profile after approval.
                </p>
                <FormInput
                  id="website"
                  label="Website URL"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
                <FormInput
                  id="instagram"
                  label="Instagram URL"
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/yourclub"
                />
                <FormInput
                  id="discord"
                  label="Discord Invite"
                  type="url"
                  value={discord}
                  onChange={(e) => setDiscord(e.target.value)}
                  placeholder="https://discord.gg/yourserver"
                />
              </fieldset>
            ) : null}
          </div>

          <div className="flex justify-between gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                step === 1 ? navigate(-1) : setStep((s) => (s - 1) as 1 | 2 | 3)
              }
            >
              Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={step === 1 && nameMatch.kind === "checking"}
              >
                Next →
              </Button>
            ) : (
              <Button
                type="button"
                disabled={loading}
                onClick={() => void submitClubRequest()}
              >
                {loading ? "Submitting…" : "Submit for Review"}
              </Button>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}
