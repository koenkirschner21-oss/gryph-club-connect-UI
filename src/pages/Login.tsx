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

export default function Login() {
  const { signIn } = useAuthContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/app");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Login failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Log In</h1>

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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p style={{ ...footerTextStyle, marginTop: "12px" }}>
          <Link to="/forgot-password" className={linkClassName}>
            Forgot password?
          </Link>
        </p>

        <p style={{ ...footerTextStyle, marginTop: "24px" }}>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className={linkClassName}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
