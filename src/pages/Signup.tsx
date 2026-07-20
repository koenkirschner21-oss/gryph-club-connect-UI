import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuthContext } from "../context/useAuthContext";
import { showToast } from "../components/ui/Toast";
import { useIsMobile } from "../hooks/useWindowWidth";
import {
  formatSignupError,
  isAllowedSignupEmail,
  signupEmailValidationMessage,
} from "../lib/authProfile";
import { isSafeRedirectPath, storePendingRedirect } from "../lib/authRedirect";

const AUTH_RED = "#E51937";
const AUTH_RED_HOVER = "#cc0020";

const labelStyle = {
  fontSize: "11px",
  fontWeight: 500,
  color: "#777777",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  display: "block",
  marginBottom: "6px",
};

const inputStyle = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "15px",
  width: "100%",
  boxSizing: "border-box" as const,
  outline: "none",
};

const cardStyle = {
  backgroundColor: "#141414",
  border: "1px solid #333333",
  borderRadius: "12px",
  padding: "40px",
  maxWidth: "420px",
  width: "100%",
  boxShadow:
    "0 0 0 1px #2a2a2a, 0 8px 40px rgba(229, 25, 55, 0.08), 0 4px 24px rgba(0,0,0,0.6)",
};

const headingStyle = {
  fontWeight: 700,
  fontSize: "24px",
  color: "#ffffff",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const primaryButtonStyle = {
  backgroundColor: AUTH_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "12px",
  width: "100%",
  fontWeight: 600,
  fontSize: "15px",
  cursor: "pointer",
};

function setInputFocus(el: HTMLInputElement, focused: boolean) {
  el.style.borderColor = focused ? AUTH_RED : "#2a2a2a";
}

const BRANDING_FEATURES = [
  "Explore U of G clubs",
  "RSVP to campus events",
  "Manage club workspaces",
];

function AuthBrandingPanel({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        flex: isMobile ? undefined : "0 0 40%",
        width: isMobile ? "100%" : undefined,
        minHeight: isMobile ? undefined : "100vh",
        background: isMobile
          ? "linear-gradient(180deg, #1a0a0a 0%, #0f0f0f 100%)"
          : "linear-gradient(to right, #1a0a0a, #0f0f0f)",
        borderRight: "none",
        boxShadow: isMobile ? undefined : "inset -40px 0 60px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "32px 24px" : "48px 32px",
        paddingBottom: isMobile ? undefined : "8%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: isMobile ? 0 : "8%",
        }}
      >
        <img
          src="/assets/gryph-icon.png"
          alt=""
          style={{
            width: isMobile ? "56px" : "96px",
            height: isMobile ? "56px" : "96px",
            objectFit: "contain",
          }}
        />
        <div
          style={{
            marginTop: isMobile ? "16px" : "20px",
            fontSize: isMobile ? "32px" : "44px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#ffffff" }}>Club</span>
          <span style={{ color: "#FFC429" }}>Connect</span>
        </div>
        <p
          style={{
            marginTop: isMobile ? "12px" : "16px",
            fontSize: isMobile ? "14px" : "16px",
            color: "#777777",
            maxWidth: isMobile ? "280px" : "320px",
            textAlign: "center",
            lineHeight: 1.5,
            marginBottom: 0,
          }}
        >
          Discover clubs, join events, and manage your student communities in one
          place.
        </p>
        {!isMobile ? (
          <div
            style={{
              marginTop: "36px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              width: "100%",
              maxWidth: "320px",
            }}
          >
            {BRANDING_FEATURES.map((feature) => (
              <div
                key={feature}
                style={{ display: "flex", alignItems: "baseline", gap: "10px" }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    backgroundColor: "#E51937",
                    flexShrink: 0,
                    marginTop: "7px",
                  }}
                />
                <span
                  style={{ fontSize: "15px", color: "#cccccc", lineHeight: 1.4 }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuthFormPanel({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        flex: isMobile ? 1 : "0 0 60%",
        width: isMobile ? "100%" : undefined,
        minHeight: isMobile ? undefined : "100vh",
        backgroundColor: "#0f0f0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "24px 16px 40px" : "24px 24px 24px 5%",
      }}
    >
      <div style={cardStyle}>{children}</div>
    </div>
  );
}

function AuthTextField({
  id,
  label,
  type,
  required,
  autoComplete,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="placeholder:text-[#444444]"
        style={inputStyle}
        onFocus={(e) => setInputFocus(e.currentTarget, true)}
        onBlur={(e) => setInputFocus(e.currentTarget, false)}
      />
    </div>
  );
}

function AuthPasswordField({
  id,
  label,
  required,
  autoComplete,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  autoComplete?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="placeholder:text-[#444444]"
          style={{ ...inputStyle, paddingRight: "44px" }}
          onFocus={(e) => setInputFocus(e.currentTarget, true)}
          onBlur={(e) => setInputFocus(e.currentTarget, false)}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "#777777",
            display: "flex",
            alignItems: "center",
          }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint ? (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "#555555" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const ALLOWED_DOMAIN = "uoguelph.ca";
const EMAIL_DOMAIN_ERROR = signupEmailValidationMessage();
void ALLOWED_DOMAIN;
void EMAIL_DOMAIN_ERROR;

export default function Signup() {
  const { signUp } = useAuthContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();

  const rawRedirect = searchParams.get("redirect");
  const redirectPath = isSafeRedirectPath(rawRedirect) ? rawRedirect : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (redirectPath) {
      storePendingRedirect(redirectPath);
    }
  }, [redirectPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isAllowedSignupEmail(normalizedEmail)) {
      setEmailError(EMAIL_DOMAIN_ERROR);
      return;
    }

    setEmailError(null);
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(
        normalizedEmail,
        password,
        redirectPath,
      );
      if (needsEmailConfirmation) {
        setPendingConfirmationEmail(normalizedEmail);
        return;
      }
      const onboardingDestination = redirectPath
        ? `/onboarding?redirect=${encodeURIComponent(redirectPath)}`
        : "/onboarding";
      console.info("[auth] signup redirect", {
        destination: onboardingDestination,
      });
      navigate(onboardingDestination);
    } catch (err) {
      console.error("[auth] signup failed:", err);
      showToast(formatSignupError(err), "error");
    } finally {
      setLoading(false);
    }
  }

  if (pendingConfirmationEmail) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          minHeight: "100vh",
          backgroundColor: "#0f0f0f",
        }}
      >
        <AuthBrandingPanel isMobile={isMobile} />
        <AuthFormPanel>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "24px",
              color: "#ffffff",
              textAlign: "center",
              margin: "0 0 16px",
            }}
          >
            Check your UofG email
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#777777",
              textAlign: "center",
              margin: "0 0 12px",
              lineHeight: 1.5,
            }}
          >
            We sent a confirmation link to {pendingConfirmationEmail}. Click it
            to activate your account.
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "#555555",
              textAlign: "center",
              margin: 0,
            }}
          >
            Check your spam folder if you don&apos;t see it
          </p>
        </AuthFormPanel>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        backgroundColor: "#0f0f0f",
      }}
    >
      <AuthBrandingPanel isMobile={isMobile} />
      <AuthFormPanel>
        <h1 style={headingStyle}>Sign Up</h1>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset
            disabled={loading}
            style={{ border: "none", margin: 0, padding: 0 }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <AuthTextField
                  id="email"
                  label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="you@uoguelph.ca"
                />
                {emailError ? (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "13px",
                      color: "#E51937",
                    }}
                  >
                    {emailError}
                  </p>
                ) : null}
              </div>

              <AuthPasswordField
                id="password"
                label="Password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                hint="Must be at least 6 characters"
              />

              <AuthPasswordField
                id="confirmPassword"
                label="Confirm Password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...primaryButtonStyle,
              marginTop: "20px",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = AUTH_RED_HOVER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = AUTH_RED;
            }}
          >
            {loading ? "Creating account…" : "Sign Up"}
          </button>
        </form>

        <p
          style={{
            color: "#777777",
            fontSize: "13px",
            textAlign: "center",
            margin: "24px 0 0",
          }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            style={{ color: "#FFC429", textDecoration: "none", fontWeight: 500 }}
          >
            Log In
          </Link>
        </p>
      </AuthFormPanel>
    </div>
  );
}
