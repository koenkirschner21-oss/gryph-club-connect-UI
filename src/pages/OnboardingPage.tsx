import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check } from "lucide-react";
import BrandLogo from "../components/ui/BrandLogo";
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
  type OnboardingIntent,
} from "../lib/onboardingIntent";

type Step = 1 | 2;

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
  cta: string;
}[] = [
  {
    value: "discover",
    title: "Discover and join clubs",
    description:
      "Browse clubs, RSVP to events, and get involved on campus",
    cta: "Find Clubs",
  },
  {
    value: "manage",
    title: "Manage a club",
    description:
      "Claim an existing club, request a new one, or set up and manage your club profile as a president or executive.",
    cta: "Manage My Club",
  },
  {
    value: "both",
    title: "Both",
    description:
      "Join clubs as a member and manage one or more clubs as an executive",
    cta: "Set Up Both",
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
    background: selected ? "rgba(229, 25, 55, 0.1)" : "#141414",
    border: selected ? "2px solid #E51937" : "1px solid #2a2a2a",
    boxShadow: selected ? "0 0 0 1px rgba(229, 25, 55, 0.2)" : "none",
    borderRadius: "12px",
    padding: "24px",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
  };
}

function intentCtaStyle(selected: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 700,
    color: selected ? "#ffffff" : "#aaaaaa",
    background: selected ? "#E51937" : "#1a1a1a",
    border: selected ? "none" : "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "7px 14px",
  };
}

function redirectForIntent(intent: OnboardingIntent): string {
  if (intent === "manage") return "/explore?claim=true";
  if (intent === "both") return "/app";
  return "/explore";
}

export default function OnboardingPage() {
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [checkingProfile, setCheckingProfile] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [intent, setIntent] = useState<OnboardingIntent | null>(null);
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
        .select("full_name, program, year_of_study, avatar_url, onboarding_completed")
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
        navigate("/app", { replace: true });
        return;
      }

      setFullName((data?.full_name as string) ?? "");
      setProgram((data?.program as string) ?? "");
      setYearOfStudy((data?.year_of_study as string) ?? "");
      setAvatarUrl((data?.avatar_url as string) ?? "");
      setCheckingProfile(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

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
      navigate(redirectForIntent(intent), { replace: true });
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
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "32px",
          }}
        >
          <BrandLogo variant="hero" />
        </div>

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
              How do you want to use Gryph ClubConnect?
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#777777",
                textAlign: "center",
                margin: "0 0 28px",
              }}
            >
              Choose the path that fits you best. You can change this later.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginBottom: "28px",
              }}
            >
              {INTENT_OPTIONS.map((option) => {
                const selected = intent === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setIntent(option.value)}
                    style={intentCardStyle(selected)}
                  >
                    {selected ? (
                      <span
                        style={{
                          position: "absolute",
                          top: "16px",
                          right: "16px",
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
                    <p
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: selected ? "#ffffff" : "#dddddd",
                        margin: "0 0 8px",
                        paddingRight: "32px",
                      }}
                    >
                      {option.title}
                    </p>
                    <p
                      style={{
                        fontSize: "13px",
                        color: selected ? "#cccccc" : "#777777",
                        margin: "0 0 14px",
                        lineHeight: 1.5,
                      }}
                    >
                      {option.description}
                    </p>
                    <span style={intentCtaStyle(selected)}>{option.cta}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                disabled={!intent}
                onClick={() => setStep(2)}
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
                onClick={() => setStep(1)}
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
