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

export default function Signup() {
  const { signUp } = useAuthContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
      showToast(`Only @${ALLOWED_DOMAIN} email addresses are permitted to sign up.`, "error");
      return;
    }

    setLoading(true);
    try {
      await signUp(normalizedEmail, password);
      navigate("/app/onboarding");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign up failed", "error");
    } finally {
      setLoading(false);
    }
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
              <AuthField
                id="email"
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

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
