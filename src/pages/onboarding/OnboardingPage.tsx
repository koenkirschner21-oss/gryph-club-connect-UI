import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Users, Check } from "lucide-react";
import BrandLogo from "../../components/ui/BrandLogo";
import { useAuthContext } from "../../context/useAuthContext";
import { notifyOnboardingCompleted } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

type OnboardingPath = "explore" | "manage";
type Step = 1 | 2 | 3;

const INTEREST_OPTIONS = [
  "Academic",
  "Sports",
  "Arts",
  "Business",
  "Culture",
  "Politics",
  "Science",
  "Community",
  "Gaming",
  "Music",
  "Health",
  "Technology",
] as const;

const CLUB_REQUEST_CATEGORIES = [
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

const shellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#0f0f0f",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "60px 24px",
};

const innerStyle: CSSProperties = {
  width: "100%",
  maxWidth: "560px",
};

const stepLabelStyle: CSSProperties = {
  fontSize: "12px",
  color: "#555555",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 16px",
};

function ProgressDots({ step }: { step: Step }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "10px",
        marginBottom: "32px",
      }}
    >
      {([1, 2, 3] as const).map((n) => {
        const active = n === step;
        const completed = n < step;
        return (
          <span
            key={n}
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: active
                ? "#E51937"
                : completed
                  ? "#FFC429"
                  : "#333333",
            }}
          />
        );
      })}
    </div>
  );
}

function pathCardStyle(selected: boolean, hovered: boolean): CSSProperties {
  return {
    flex: 1,
    minWidth: "200px",
    background: selected ? "#1f0a0a" : "#1a1a1a",
    border: `1px solid ${selected || hovered ? "#E51937" : "#242424"}`,
    borderRadius: "12px",
    padding: "24px",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.15s ease, background 0.15s ease",
  };
}

const NEW_USER_WINDOW_MS = 2 * 60 * 1000;

function isNewUser(user: { created_at: string }): boolean {
  return (
    new Date(user.created_at) > new Date(Date.now() - NEW_USER_WINDOW_MS)
  );
}

async function markProfileOnboardingComplete(userId: string) {
  await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", userId);
}

export default function OnboardingPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [firstName, setFirstName] = useState("there");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [clubName, setClubName] = useState("");
  const [clubCategory, setClubCategory] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<OnboardingPath | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const authUser = user;

    let cancelled = false;

    async function checkProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        await markProfileOnboardingComplete(userId);
        notifyOnboardingCompleted();
        navigate("/app", { replace: true });
        return;
      }

      if (data?.onboarding_completed) {
        notifyOnboardingCompleted();
        navigate("/app", { replace: true });
        return;
      }

      if (!isNewUser(authUser)) {
        await markProfileOnboardingComplete(userId);
        notifyOnboardingCompleted();
        navigate("/app", { replace: true });
        return;
      }

      const full = (data?.full_name as string) ?? "";
      const name = full.trim().split(/\s+/)[0];
      if (name) setFirstName(name);
    }

    void checkProfile();

    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  function toggleInterest(cat: string) {
    setSelectedInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function handleStep2Submit(e?: FormEvent) {
    e?.preventDefault();
    if (!user?.id || !path) return;
    setSubmitting(true);
    setError(null);

    try {
      if (path === "explore") {
        if (selectedInterests.length < 3) {
          setError("Select at least 3 interests to continue.");
          setSubmitting(false);
          return;
        }

        await supabase.from("user_interests").delete().eq("user_id", user.id);
        const rows = selectedInterests.map((category) => ({
          user_id: user.id,
          category,
        }));
        const { error: insErr } = await supabase
          .from("user_interests")
          .insert(rows);
        if (insErr) throw insErr;
      } else {
        if (!clubName.trim()) {
          setError("Club name is required.");
          setSubmitting(false);
          return;
        }
        if (!clubCategory.trim()) {
          setError("Category is required.");
          setSubmitting(false);
          return;
        }

        const slug = clubName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const { error: reqErr } = await supabase.from("club_requests").insert({
          submitted_by: user.id,
          name: clubName.trim(),
          short_description: clubDescription.trim() || null,
          long_description: JSON.stringify({ slug }),
          category: clubCategory.trim(),
          status: "pending",
        });
        if (reqErr) throw reqErr;
      }

      setStep(3);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinish(destination: "/explore" | "/app") {
    if (!user?.id) return;
    await markProfileOnboardingComplete(user.id);
    notifyOnboardingCompleted();
    navigate(destination, { replace: true });
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    background: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "10px 14px",
    color: "#ffffff",
    fontSize: "14px",
    boxSizing: "border-box",
    marginBottom: "16px",
  };

  return (
    <div style={shellStyle}>
      <div style={innerStyle}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "40px" }}>
          <BrandLogo variant="hero" />
        </div>

        <ProgressDots step={step} />
        <p style={stepLabelStyle}>Step {step} of 3</p>

        {step === 1 ? (
          <>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 12px",
                textAlign: "center",
              }}
            >
              Welcome to GryphClubConnect, {firstName}!
            </h1>
            <p
              style={{
                fontSize: "15px",
                color: "#555555",
                textAlign: "center",
                margin: "0 0 32px",
              }}
            >
              The home for University of Guelph student clubs
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                marginBottom: "32px",
              }}
            >
              <button
                type="button"
                style={pathCardStyle(path === "explore", hoveredPath === "explore")}
                onClick={() => setPath("explore")}
                onMouseEnter={() => setHoveredPath("explore")}
                onMouseLeave={() => setHoveredPath(null)}
              >
                <Compass size={28} color="#E51937" style={{ marginBottom: "12px" }} />
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#ffffff",
                    margin: "0 0 8px",
                  }}
                >
                  I want to explore clubs
                </p>
                <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                  Browse and join clubs that match your interests
                </p>
              </button>
              <button
                type="button"
                style={pathCardStyle(path === "manage", hoveredPath === "manage")}
                onClick={() => setPath("manage")}
                onMouseEnter={() => setHoveredPath("manage")}
                onMouseLeave={() => setHoveredPath(null)}
              >
                <Users size={28} color="#E51937" style={{ marginBottom: "12px" }} />
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#ffffff",
                    margin: "0 0 8px",
                  }}
                >
                  I have a club to manage
                </p>
                <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                  Set up your club workspace and invite your team
                </p>
              </button>
            </div>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                disabled={!path}
                onClick={() => setStep(2)}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 32px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: path ? "pointer" : "not-allowed",
                  opacity: path ? 1 : 0.5,
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 2 && path === "explore" ? (
          <>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 8px",
              }}
            >
              What are you interested in?
            </h2>
            <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 20px" }}>
              Select at least 3 to continue
            </p>
            {error ? (
              <p style={{ color: "#E51937", fontSize: "13px" }}>{error}</p>
            ) : null}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "28px",
              }}
            >
              {INTEREST_OPTIONS.map((cat) => {
                const selected = selectedInterests.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleInterest(cat)}
                    style={{
                      background: selected ? "#E51937" : "#1a1a1a",
                      color: selected ? "#ffffff" : "#777777",
                      border: selected ? "none" : "1px solid #2a2a2a",
                      borderRadius: "20px",
                      padding: "8px 16px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                disabled={submitting || selectedInterests.length < 3}
                onClick={() => void handleStep2Submit()}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 32px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor:
                    submitting || selectedInterests.length < 3
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    submitting || selectedInterests.length < 3 ? 0.5 : 1,
                }}
              >
                {submitting ? "Saving…" : "Continue"}
              </button>
            </div>
          </>
        ) : null}

        {step === 2 && path === "manage" ? (
          <form onSubmit={(e) => void handleStep2Submit(e)}>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 20px",
              }}
            >
              Tell us about your club
            </h2>
            {error ? (
              <p style={{ color: "#E51937", fontSize: "13px" }}>{error}</p>
            ) : null}
            <label style={{ fontSize: "12px", color: "#888888" }}>Club name</label>
            <input
              type="text"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              style={inputStyle}
              required
            />
            <label style={{ fontSize: "12px", color: "#888888" }}>Category</label>
            <select
              value={clubCategory}
              onChange={(e) => setClubCategory(e.target.value)}
              style={{ ...inputStyle, appearance: "auto" }}
              required
            >
              <option value="">Select a category</option>
              {CLUB_REQUEST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label style={{ fontSize: "12px", color: "#888888" }}>
              Short description
            </label>
            <textarea
              value={clubDescription}
              onChange={(e) => setClubDescription(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 24px" }}>
              This will create a club request for admin approval
            </p>
            <div style={{ textAlign: "center" }}>
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
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Submitting…" : "Continue"}
              </button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <div style={{ textAlign: "center" }}>
            <div
              className="onboarding-checkmark"
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                border: "3px solid #E51937",
                margin: "0 auto 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "onboarding-pop 0.5s ease-out",
              }}
            >
              <Check size={32} color="#E51937" strokeWidth={3} />
            </div>
            <style>{`
              @keyframes onboarding-pop {
                0% { transform: scale(0.6); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              You&apos;re ready to go!
            </h2>
            <p style={{ fontSize: "15px", color: "#555555", margin: "0 0 28px" }}>
              {path === "explore"
                ? "Start by exploring clubs on campus"
                : "Your club request has been submitted. We'll review it shortly."}
            </p>
            <button
              type="button"
              onClick={() =>
                void handleFinish(path === "explore" ? "/explore" : "/app")
              }
              style={{
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 32px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {path === "explore" ? "Explore Clubs" : "Go to Dashboard"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
