import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import {
  ensureMinimalProfile,
  formatSignupError,
  isAllowedSignupEmail,
} from "../lib/authProfile";
import { AuthContext, type AuthContextValue } from "./authContextValue";

const ALLOWED_EMAIL_DOMAIN = "uoguelph.ca";
void ALLOWED_EMAIL_DOMAIN; // preserved for UofG email restriction restore

let notifyOnboardingCompletedRef: (() => void) | null = null;

/** Called after onboarding finishes so auth state skips redirect loops. */
export function notifyOnboardingCompleted() {
  notifyOnboardingCompletedRef?.();
}

/**
 * Returns true when onboarding is complete (or should be skipped on query failure).
 */
async function resolveOnboardingCompleted(user: User): Promise<boolean> {
  await ensureMinimalProfile(user);

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load onboarding status:", error.message);
    return true;
  }

  return data?.onboarding_completed === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<
    boolean | null
  >(null);

  notifyOnboardingCompletedRef = () => setOnboardingCompleted(true);

  const refreshOnboardingStatus = useCallback(async (authUser: User) => {
    const completed = await resolveOnboardingCompleted(authUser);
    setOnboardingCompleted(completed);
    return completed;
  }, []);

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          void refreshOnboardingStatus(s.user);
        } else {
          setOnboardingCompleted(null);
        }
      })
      .catch((err) => {
        console.error("Failed to restore session:", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void refreshOnboardingStatus(s.user);
      } else {
        setOnboardingCompleted(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshOnboardingStatus]);

  useEffect(() => {
    if (loading || !user || onboardingCompleted === null) return;
    if (location.pathname !== "/login" && location.pathname !== "/signup") {
      return;
    }

    const redirect = new URLSearchParams(location.search).get("redirect");
    if (location.pathname === "/login" && redirect?.startsWith("/")) {
      navigate(redirect, { replace: true });
      return;
    }

    if (onboardingCompleted === false) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  }, [
    loading,
    user,
    onboardingCompleted,
    location.pathname,
    location.search,
    navigate,
  ]);

  const postAuthRedirectPath = useMemo(() => {
    if (!user || onboardingCompleted !== false) return "/app";
    return "/onboarding";
  }, [user, onboardingCompleted]);

  const signUp = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isAllowedSignupEmail(normalizedEmail)) {
      throw new Error(
        `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are permitted to sign up.`,
      );
    }

    console.info("[auth] signup start", { email: normalizedEmail });

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          email: normalizedEmail,
        },
      },
    });

    if (error) {
      console.error("[auth] signup auth error:", error.message, error);
      throw new Error(formatSignupError(error));
    }

    console.info("[auth] signup auth response", {
      userId: data.user?.id ?? null,
      hasSession: Boolean(data.session),
    });

    const needsEmailConfirmation = Boolean(data.user && !data.session);

    if (data.user && data.session) {
      const profileResult = await ensureMinimalProfile(data.user);
      if (profileResult.error) {
        console.error(
          "[auth] signup profile ensure failed:",
          profileResult.error,
        );
      } else if (profileResult.created) {
        console.info("[auth] signup created minimal profile");
      }
      setOnboardingCompleted(false);
    }

    return { needsEmailConfirmation };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setOnboardingCompleted(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      onboardingCompleted,
      signUp,
      signIn,
      signOut,
      postAuthRedirectPath,
    }),
    [
      user,
      session,
      loading,
      onboardingCompleted,
      signUp,
      signIn,
      signOut,
      postAuthRedirectPath,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
