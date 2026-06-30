import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  notifyClubRequestSubmitted,
  resolveStudentDisplayName,
} from "../../lib/notifications";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

const STEP_LABELS = ["Basics", "Details", "Social"] as const;

const helperTextStyle = {
  fontSize: "12px",
  color: "#888888",
  marginTop: "6px",
  lineHeight: 1.5,
} as const;

export default function CreateClubPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [meetingSchedule, setMeetingSchedule] = useState("");
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittedClubName, setSubmittedClubName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const fieldErrorStyle = {
    fontSize: "12px",
    color: "#E51937",
    marginTop: "4px",
  } as const;

  const categories = [
    "Academic",
    "Arts",
    "Athletics",
    "Cultural",
    "Engineering",
    "Environmental",
    "Health",
    "Media",
    "Political",
    "Recreation",
    "Social",
    "Technology",
    "Volunteer",
  ];

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleNameChange(value: string) {
    setName(value);
    setSlug(generateSlug(value));
  }

  function validateBasics(): boolean {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const nextFieldErrors = {
      name: !trimmedName
        ? "Club name is required"
        : trimmedName.length < 3
          ? "Club name must be at least 3 characters"
          : "",
      category: !category.trim() ? "Category is required" : "",
      description: !trimmedDescription
        ? "Description is required"
        : trimmedDescription.length < 20
          ? "Description must be at least 20 characters"
          : "",
    };
    setFieldErrors(nextFieldErrors);
    return !(
      nextFieldErrors.name ||
      nextFieldErrors.category ||
      nextFieldErrors.description
    );
  }

  function handleNext() {
    if (step === 1 && !validateBasics()) {
      return;
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  }

  async function submitClubRequest() {
    if (step !== 3 || loading || successMessage) {
      return;
    }

    setError(null);

    if (!user?.id) {
      setError("You must be signed in to submit a club request.");
      return;
    }

    if (!validateBasics()) {
      setStep(1);
      return;
    }

    setLoading(true);

    try {
      const socialLinks: Record<string, string> = {};
      if (website.trim()) socialLinks.website = website.trim();
      if (instagram.trim()) socialLinks.instagram = instagram.trim();
      if (discord.trim()) socialLinks.discord = discord.trim();

      const longDescription = JSON.stringify({
        slug: slug || generateSlug(name),
        contact_email: contactEmail.trim(),
        meeting_schedule: meetingSchedule.trim(),
        meeting_location: meetingLocation.trim(),
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
      }

      setSubmittedClubName(name.trim());
      setSuccessMessage(
        "Your club request has been submitted and is pending review. You'll be notified once it's approved.",
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

  return (
    <div className="page-root mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-[26px] font-semibold tracking-[-0.5px] text-[var(--text-1)]">Create a club</h1>

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
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {submittedClubName
              ? `${submittedClubName} is pending review`
              : "Club request submitted"}
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#888888", lineHeight: 1.5 }}>
            {successMessage}
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
                The GryphClubConnect team reviews your submission to confirm club details.
              </li>
              <li style={{ marginBottom: "6px" }}>
                You&apos;ll receive a notification when your request is approved or if we need more information.
              </li>
              <li>
                Once approved, you can open your club workspace, invite members, and publish events.
              </li>
            </ol>
          </div>
          <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Button type="button" onClick={() => navigate("/app")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      ) : null}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-2)] px-4 py-3 text-sm text-[#f87171]"
        >
          {error}
        </div>
      )}

      {!successMessage ? (
      <div className="mb-8">
        <div className="flex items-center">
          {[1, 2, 3].map((dot, i) => (
            <div key={dot} className="flex flex-1 items-center">
              <div className="flex flex-1 justify-center">
                <div className={`step-dot ${step === dot ? "active" : step > dot ? "complete" : ""}`}>{dot}</div>
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
      <form onSubmit={handleFormSubmit} className="space-y-6 overflow-hidden rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-2)] p-6" noValidate>
        <div className="transition-all duration-200" style={{ transform: "translateX(0)", opacity: 1 }}>
          {step === 1 && (
            <fieldset className="space-y-4">
              <legend className="mb-4 text-[18px] font-medium text-[var(--text-1)]">Basics</legend>
              <FormInput id="name" label="Club Name" required value={name} onChange={(e) => { handleNameChange(e.target.value); if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" })); }} placeholder="e.g. Gryphon Robotics Club" />
              {fieldErrors.name ? <p style={fieldErrorStyle}>{fieldErrors.name}</p> : null}
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-1)]">Category <span className="ml-1 text-[var(--red)]">*</span></label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setCategory(item); if (fieldErrors.category) setFieldErrors((prev) => ({ ...prev, category: "" })); }}
                      className={`rounded-[var(--r-md)] border px-3 py-2 text-sm transition ${category === item ? "border-[var(--red)] bg-[var(--red-dim)] text-[var(--text-1)]" : "border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-2)] hover:bg-[var(--bg-4)]"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {fieldErrors.category ? <p style={fieldErrorStyle}>{fieldErrors.category}</p> : null}
              </div>
              <div>
                <label htmlFor="description" className="mb-1 block text-sm font-medium text-[var(--text-1)]">
                  Description <span className="ml-1 text-[var(--red)]">*</span>
                </label>
                <textarea id="description" value={description} onChange={(e) => { setDescription(e.target.value); if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: "" })); }} rows={4} placeholder="Tell students what your club is about..." className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--red)] focus:outline-none" />
                <p style={helperTextStyle}>
                  Write a short public summary of who your club is for, what you do, and why students should join. At least 20 characters.
                </p>
                {fieldErrors.description ? <p style={fieldErrorStyle}>{fieldErrors.description}</p> : null}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="space-y-4">
              <legend className="mb-4 text-[18px] font-medium text-[var(--text-1)]">Details</legend>
              <FormInput id="meetingSchedule" label="Meeting Schedule" value={meetingSchedule} onChange={(e) => setMeetingSchedule(e.target.value)} placeholder="e.g. Wednesdays 6:00 PM" />
              <FormInput id="meetingLocation" label="Meeting Location" value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} placeholder="e.g. Thornbrough Building, Room 1307" />
              <FormInput id="contactEmail" label="Contact Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="club@uoguelph.ca" />
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="space-y-4">
              <legend className="mb-1 text-[18px] font-medium text-[var(--text-1)]">Social</legend>
              <p style={{ ...helperTextStyle, marginTop: 0, marginBottom: "16px" }}>
                Social links are optional. Add any you have now — you can update them later from your club profile.
              </p>
              <FormInput id="website" label="Website URL (optional)" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
              <FormInput id="instagram" label="Instagram URL (optional)" type="url" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/yourclub" />
              <FormInput id="discord" label="Discord Invite (optional)" type="url" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/yourserver" />
            </fieldset>
          )}
        </div>

        <div className="flex justify-between gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => (step === 1 ? navigate(-1) : setStep((s) => (s - 1) as 1 | 2 | 3))}>
            Back
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={handleNext}>
              Next →
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading}
              onClick={() => void submitClubRequest()}
            >
              {loading ? "Submitting…" : "Create Club"}
            </Button>
          )}
        </div>
      </form>
      ) : null}
    </div>
  );
}
