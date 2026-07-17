import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import { resolvePostAuthNavigation } from "../lib/authRedirect";
import Spinner from "../components/ui/Spinner";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading, onboardingCompleted } = useAuthContext();
  const [sessionReady, setSessionReady] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeAuthCallback() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const authError =
        searchParams.get("error_description") ??
        hashParams.get("error_description");

      if (authError) {
        if (!cancelled) {
          console.error("[auth] callback error from provider:", authError);
          setCallbackError(authError);
          setSessionReady(true);
        }
        return;
      }

      const code = searchParams.get("code");
      console.info("[auth] callback start", {
        hasCode: Boolean(code),
        origin: window.location.origin,
      });

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session) {
          throw new Error("No session found after email confirmation.");
        }

        console.info("[auth] callback session established", {
          userId: data.session.user.id,
        });
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Authentication failed.";
          console.error("[auth] callback failed:", message);
          setCallbackError(message);
        }
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    }

    void completeAuthCallback();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady || loading) return;

    if (callbackError) {
      navigate(`/login?error=${encodeURIComponent(callbackError)}`, {
        replace: true,
      });
      return;
    }

    if (!user) {
      navigate("/login?error=auth_callback_no_session", { replace: true });
      return;
    }

    if (onboardingCompleted === null) return;

    const next = resolvePostAuthNavigation({
      redirectParam: null,
      onboardingCompleted,
    });
    console.info("[auth] callback redirect", { destination: next.path });
    navigate(next.path, { replace: true });
  }, [
    sessionReady,
    loading,
    callbackError,
    user,
    onboardingCompleted,
    navigate,
  ]);

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "#0f0f0f" }}
    >
      <Spinner label="Completing sign in…" />
    </div>
  );
}
