import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Camera,
  Check,
  Compass,
  Users,
} from "lucide-react";
import ImageCropModal from "../components/ui/ImageCropModal";
import { useAuthContext } from "../context/useAuthContext";
import { notifyOnboardingCompleted, refreshUserProfile } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useWindowWidth";
import { ensureMinimalProfile } from "../lib/authProfile";
import { getProfileInitials } from "../lib/profileInitials";
import { supabase } from "../lib/supabaseClient";
import { uploadImage } from "../lib/uploadImage";
import Spinner from "../components/ui/Spinner";
import {
  cacheOnboardingIntent,
  cacheOnboardingStep,
  clearOnboardingStepCache,
  destinationForOnboardingIntent,
  persistOnboardingIntentDraft,
  readOnboardingIntentFromStorage,
  readOnboardingStepFromStorage,
  type OnboardingIntent,
  type OnboardingStep,
} from "../lib/onboardingIntent";
import {
  consumePendingRedirect,
  isSafeRedirectPath,
  storePendingRedirect,
} from "../lib/authRedirect";

const YEAR_OPTIONS = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year",
  "Graduate",
] as const;

const INTENT_OPTIONS: {
  value: OnboardingIntent;
  title: string;
  description: string;
  detail: string;
  icon: ReactNode;
  badge?: string;
}[] = [
  {
    value: "discover",
    title: "Join clubs",
    description: "Discover clubs, events, and opportunities.",
    detail: "Best for students looking to get involved.",
    icon: <Compass size={22} strokeWidth={1.75} aria-hidden />,
    badge: "Most common",
  },
  {
    value: "manage",
    title: "Manage a club",
    description: "Claim, create, or help run a club.",
    detail: "Best for presidents and executive teams.",
    icon: <Briefcase size={22} strokeWidth={1.75} aria-hidden />,
  },
  {
    value: "both",
    title: "Join and manage clubs",
    description: "Participate as a member while helping lead a club.",
    detail: "Best for students doing both.",
    icon: <Users size={22} strokeWidth={1.75} aria-hidden />,
  },
];

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#0f0f0f",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "48px 24px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "14px",
  boxSizing: "border-box",
  marginBottom: "16px",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#888888",
  marginBottom: "6px",
};

function intentCardStyle(selected: boolean): CSSProperties {
  return {
    position: "relative",
    background: selected ? "rgba(255, 255, 255, 0.04)" : "#141414",
    border: selected ? "2px solid #E51937" : "1px solid #2a2a2a",
    boxShadow: selected ? "inset 0 0 0 1px rgba(229, 25, 55, 0.25)" : "none",
    borderRadius: "12px",
    padding: "22px 20px",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
    outline: "none",
  };
}

export default function OnboardingPage() {
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pathGroupId = useId();

  const rawRedirect = searchParams.get("redirect");
  const redirectPath = isSafeRedirectPath(rawRedirect) ? rawRedirect : null;

  useEffect(() => {
    if (redirectPath) {
      storePendingRedirect(redirectPath);
    }
  }, [redirectPath]);

  const [checkingProfile, setCheckingProfile] = useState(true);
  const [step, setStep] = useState<OnboardingStep>(
    () => readOnboardingStepFromStorage() ?? 1,
  );
  const [intent, setIntent] = useState<OnboardingIntent | null>(
    () => readOnboardingIntentFromStorage(),
  );
  const [fullName, setFullName] = useState("");
  const [program, setProgram] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    void (async () => {
      const profileEnsure = await ensureMinimalProfile(user);
      if (profileEnsure.error) {
        console.error(
          "[auth] onboarding profile ensure failed:",
          profileEnsure.error,
        );
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "full_name, program, year_of_study, avatar_url, onboarding_completed, onboarding_intent",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error("Failed to load profile for onboarding:", profileError.message);
        setCheckingProfile(false);
        return;
      }

      if (data?.onboarding_completed) {
        notifyOnboardingCompleted();
        clearOnboardingStepCache();
        const pending = redirectPath ?? consumePendingRedirect();
        navigate(pending ?? "/app", { replace: true });
        return;
      }

      const storedIntent = readOnboardingIntentFromStorage();
      const profileIntent = data?.onboarding_intent as string | null | undefined;
      if (storedIntent) {
        setIntent(storedIntent);
      } else if (
        profileIntent === "discover" ||
        profileIntent === "manage" ||
        profileIntent === "both"
      ) {
        cacheOnboardingIntent(profileIntent);
        setIntent(profileIntent);
      }

      const storedStep = readOnboardingStepFromStorage();
      if (storedStep) setStep(storedStep);

      setFullName((data?.full_name as string) ?? "");
      setProgram((data?.program as string) ?? "");
      setYearOfStudy((data?.year_of_study as string) ?? "");
      setAvatarUrl((data?.avatar_url as string) ?? "");
      setCheckingProfile(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate, redirectPath]);

  function selectIntent(next: OnboardingIntent) {
    setIntent(next);
    cacheOnboardingIntent(next);
  }

  function handleIntentKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    optionValue: OnboardingIntent,
    index: number,
  ) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      selectIntent(optionValue);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (index + delta + INTENT_OPTIONS.length) % INTENT_OPTIONS.length;
    const next = INTENT_OPTIONS[nextIndex];
    selectIntent(next.value);
    const el = document.getElementById(`${pathGroupId}-${next.value}`);
    el?.focus();
  }

  async function handleContinue() {
    if (!intent || !user?.id) return;
    cacheOnboardingStep(2);
    setStep(2);
    await persistOnboardingIntentDraft(user.id, intent);
  }

  async function handleAvatarUpload(file: File) {
    if (!user?.id) return;
    setUploadingAvatar(true);
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${user.id}.${ext}`;
    const url = await uploadImage("profile-pictures", path, file);

    if (!url) {
      setError("Failed to upload photo. You can skip and add one later in Settings.");
      setUploadingAvatar(false);
      return;
    }

    setAvatarUrl(`${url}?t=${Date.now()}`);
    setUploadingAvatar(false);
  }

  async function handleComplete(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || !intent) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError("Full name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const pending = redirectPath ?? consumePendingRedirect();
    const destination = pending ?? destinationForOnboardingIntent(intent);

    try {
      cacheOnboardingIntent(intent);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          program: program.trim() || null,
          year_of_study: yearOfStudy || null,
          avatar_url: avatarUrl.trim() || null,
          onboarding_completed: true,
          onboarding_intent: intent,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      notifyOnboardingCompleted();
      await refreshUserProfile();
      clearOnboardingStepCache();
      navigate(destination, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingProfile) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#0f0f0f" }}
      >
        <Spinner label="Loading onboarding…" />
      </div>
    );
  }

  return (
    <div
      style={{
        ...shellStyle,
        padding: isMobile ? "24px 16px" : shellStyle.padding,
      }}
    >
      <div style={{ width: "100%", maxWidth: step === 1 ? "720px" : "480px" }}>
        {step === 1 ? (
          <>
            <h1
              style={{
                fontSize: isMobile ? "24px" : "28px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 8px",
                textAlign: "center",
              }}
            >
              How do you want to use ClubConnect?
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#777777",
                textAlign: "center",
                margin: "0 0 28px",
                lineHeight: 1.5,
              }}
            >
              Choose a starting path. This personalizes onboarding — it does not
              permanently restrict what you can do later.
            </p>

            <div
              role="radiogroup"
              aria-label="Onboarding path"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginBottom: "28px",
              }}
            >
              {INTENT_OPTIONS.map((option, index) => {
                const selected = intent === option.value;
                return (
                  <div
                    key={option.value}
                    id={`${pathGroupId}-${option.value}`}
                    role="radio"
                    tabIndex={selected || (!intent && index === 0) ? 0 : -1}
                    aria-checked={selected}
                    onClick={() => selectIntent(option.value)}
                    onKeyDown={(event) =>
                      handleIntentKeyDown(event, option.value, index)
                    }
                    style={intentCardStyle(selected)}
                    onFocus={(event) => {
                      event.currentTarget.style.boxShadow = selected
                        ? "inset 0 0 0 1px rgba(229, 25, 55, 0.25), 0 0 0 2px rgba(229, 25, 55, 0.35)"
                        : "0 0 0 2px rgba(229, 25, 55, 0.35)";
                    }}
                    onBlur={(event) => {
                      event.currentTarget.style.boxShadow = selected
                        ? "inset 0 0 0 1px rgba(229, 25, 55, 0.25)"
                        : "none";
                    }}
                  >
                    {option.badge ? (
                      <span
                        style={{
                          position: "absolute",
                          top: "14px",
                          right: selected ? "48px" : "16px",
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "#aaaaaa",
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          borderRadius: "4px",
                          padding: "3px 8px",
                        }}
                      >
                        {option.badge}
                      </span>
                    ) : null}
                    {selected ? (
                      <span
                        style={{
                          position: "absolute",
                          top: "14px",
                          right: "14px",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: "#E51937",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        aria-hidden
                      >
                        <Check size={14} color="#ffffff" />
                      </span>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        alignItems: "flex-start",
                        paddingRight: option.badge || selected ? "72px" : 0,
                      }}
                    >
                      <span
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "10px",
                          background: selected ? "#1a1214" : "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: selected ? "#E51937" : "#888888",
                          flexShrink: 0,
                        }}
                        aria-hidden
                      >
                        {option.icon}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: selected ? "#ffffff" : "#dddddd",
                            margin: "0 0 6px",
                          }}
                        >
                          {option.title}
                        </p>
                        <p
                          style={{
                            fontSize: "13px",
                            color: selected ? "#cccccc" : "#888888",
                            margin: "0 0 6px",
                            lineHeight: 1.5,
                          }}
                        >
                          {option.description}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#666666",
                            margin: 0,
                            lineHeight: 1.45,
                          }}
                        >
                          {option.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                disabled={!intent}
                onClick={() => void handleContinue()}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 32px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: intent ? "pointer" : "not-allowed",
                  opacity: intent ? 1 : 0.5,
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={(event) => void handleComplete(event)}>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 8px",
                textAlign: "center",
              }}
            >
              Tell us about yourself
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#777777",
                textAlign: "center",
                margin: "0 0 24px",
              }}
            >
              This helps clubs and teammates recognize you on campus.
            </p>

            {error ? (
              <p
                role="alert"
                style={{
                  color: "#E51937",
                  fontSize: "13px",
                  margin: "0 0 12px",
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            ) : null}

            <div style={{ marginBottom: "20px", textAlign: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) setAvatarCropFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Add profile photo (optional)"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  border: "1px solid #333333",
                  background: "#111111",
                  margin: "0 auto 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  cursor: uploadingAvatar ? "wait" : "pointer",
                  padding: 0,
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Camera size={24} color="#555555" aria-hidden />
                )}
              </button>
              <p style={{ fontSize: "12px", color: "#666666", margin: 0 }}>
                {uploadingAvatar
                  ? "Uploading photo…"
                  : avatarUrl
                    ? "Profile photo added (optional)"
                    : "Add a profile photo (optional)"}
              </p>
              {fullName.trim() && !avatarUrl ? (
                <p
                  style={{
                    fontSize: "11px",
                    color: "#444444",
                    margin: "6px 0 0",
                  }}
                >
                  Preview: {getProfileInitials(fullName, user?.email)}
                </p>
              ) : null}
            </div>

            <label htmlFor="onboarding-full-name" style={labelStyle}>
              Full Name
            </label>
            <input
              id="onboarding-full-name"
              type="text"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              style={inputStyle}
              autoComplete="name"
            />

            <label htmlFor="onboarding-program" style={labelStyle}>
              Program (optional)
            </label>
            <input
              id="onboarding-program"
              type="text"
              value={program}
              onChange={(event) => setProgram(event.target.value)}
              style={inputStyle}
              placeholder="e.g. Computer Science"
            />

            <label htmlFor="onboarding-year" style={labelStyle}>
              Year of Study (optional)
            </label>
            <select
              id="onboarding-year"
              value={yearOfStudy}
              onChange={(event) => setYearOfStudy(event.target.value)}
              style={{ ...inputStyle, appearance: "auto" }}
            >
              <option value="">Select year</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  cacheOnboardingStep(1);
                  setStep(1);
                }}
                disabled={submitting}
                style={{
                  background: "transparent",
                  color: "#888888",
                  border: "1px solid #333333",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 32px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: submitting ? "wait" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Saving…" : "Get Started"}
              </button>
            </div>
          </form>
        )}
      </div>

      {avatarCropFile ? (
        <ImageCropModal
          imageFile={avatarCropFile}
          aspectRatio={1}
          circular
          onComplete={(blob) => {
            const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
            setAvatarCropFile(null);
            void handleAvatarUpload(file);
          }}
          onCancel={() => {
            setAvatarCropFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      ) : null}
    </div>
  );
}
