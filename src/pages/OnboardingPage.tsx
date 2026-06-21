import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import BrandLogo from "../components/ui/BrandLogo";
import { useAuthContext } from "../context/useAuthContext";
import { notifyOnboardingCompleted } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useWindowWidth";
import { ensureMinimalProfile } from "../lib/authProfile";
import { supabase } from "../lib/supabaseClient";
import Spinner from "../components/ui/Spinner";

type OnboardingIntent = "discover" | "manage" | "both";
type Step = 1 | 2;

const ONBOARDING_INTENT_KEY = "gryph_onboarding_intent";

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
      "Claim, set up, and manage a club profile as a President or executive",
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
    background: "#141414",
    border: selected ? "1px solid #E51937" : "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "24px",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
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
        .select("full_name, program, year_of_study, onboarding_completed")
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
      setCheckingProfile(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

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
      localStorage.setItem(ONBOARDING_INTENT_KEY, intent);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          program: program.trim() || null,
          year_of_study: yearOfStudy || null,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      notifyOnboardingCompleted();
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
                    onClick={() => setIntent(option.value)}
                    style={intentCardStyle(selected)}
                  >
                    {selected ? (
                      <Check
                        size={18}
                        color="#E51937"
                        style={{
                          position: "absolute",
                          top: "16px",
                          right: "16px",
                        }}
                        aria-hidden
                      />
                    ) : null}
                    <p
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#ffffff",
                        margin: "0 0 8px",
                        paddingRight: "28px",
                      }}
                    >
                      {option.title}
                    </p>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#777777",
                        margin: "0 0 12px",
                        lineHeight: 1.5,
                      }}
                    >
                      {option.description}
                    </p>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: selected ? "#E51937" : "#555555",
                      }}
                    >
                      {option.cta}
                    </span>
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
    </div>
  );
}
