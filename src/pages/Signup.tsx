import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { showToast } from "../components/ui/Toast";
import {
  AuthField,
  AUTH_RED,
  AUTH_RED_HOVER,
  cardStyle,
  footerTextStyle,
  headingStyle,
  linkClassName,
  pageStyle,
  primaryButtonStyle,
} from "./authPageStyles";

const ALLOWED_DOMAIN = "uoguelph.ca";
const EMAIL_DOMAIN_ERROR =
  "Only University of Guelph email addresses are accepted (@uoguelph.ca)";

export default function Signup() {
  const { signUp } = useAuthContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setEmailError(EMAIL_DOMAIN_ERROR);
      return;
    }

    setEmailError(null);
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(normalizedEmail, password);
      if (needsEmailConfirmation) {
        setPendingConfirmationEmail(normalizedEmail);
        return;
      }
      navigate("/app/onboarding");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign up failed", "error");
    } finally {
      setLoading(false);
    }
  }

  if (pendingConfirmationEmail) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            ...cardStyle,
            maxWidth: "480px",
            borderTop: "1px solid #242424",
          }}
        >
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
              color: "#555555",
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
              color: "#444444",
              textAlign: "center",
              margin: 0,
            }}
          >
            Check your spam folder if you don&apos;t see it
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Sign Up</h1>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset
            disabled={loading}
            style={{ border: "none", margin: 0, padding: 0 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <AuthField
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
                  placeholder="you@example.com"
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

              <AuthField
                id="password"
                label="Password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                hint="Must be at least 6 characters"
              />

              <AuthField
                id="confirmPassword"
                label="Confirm Password"
                type="password"
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

        <p style={{ ...footerTextStyle, marginTop: "24px" }}>
          Already have an account?{" "}
          <Link to="/login" className={linkClassName}>
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
