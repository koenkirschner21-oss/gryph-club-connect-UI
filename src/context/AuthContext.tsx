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
import { AuthContext, type AuthContextValue } from "./authContextValue";

const ALLOWED_EMAIL_DOMAIN = "uoguelph.ca";
const NEW_USER_WINDOW_MS = 2 * 60 * 1000;

let notifyOnboardingCompletedRef: (() => void) | null = null;

/** Called after onboarding finishes so auth state skips redirect loops. */
export function notifyOnboardingCompleted() {
  notifyOnboardingCompletedRef?.();
}

function isNewUser(user: User): boolean {
  return new Date(user.created_at) > new Date(Date.now() - NEW_USER_WINDOW_MS);
}

/**
 * Returns true when the user should skip onboarding (treat as completed).
 * Query failures and non-new accounts always skip onboarding.
 */
async function resolveOnboardingCompleted(user: User): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load onboarding status:", error.message);
    return true;
  }

  if (data?.onboarding_completed === true) {
    return true;
  }

  if (isNewUser(user) && !data?.onboarding_completed) {
    return false;
  }

  return true;
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

    if (isNewUser(user) && onboardingCompleted === false) {
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
    return isNewUser(user) ? "/onboarding" : "/app";
  }, [user, onboardingCompleted]);

  const signUp = useCallback(async (email: string, password: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain !== ALLOWED_EMAIL_DOMAIN) {
      throw new Error(
        `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are permitted to sign up.`,
      );
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    setOnboardingCompleted(false);
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
