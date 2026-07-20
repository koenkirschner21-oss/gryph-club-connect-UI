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
import {
  buildAuthCallbackUrl,
  isSafeRedirectPath,
  storePendingRedirect,
} from "../lib/authRedirect";
import {
  AuthContext,
  type AuthContextValue,
  type UserProfileSnapshot,
} from "./authContextValue";

const ALLOWED_EMAIL_DOMAIN = "uoguelph.ca";
void ALLOWED_EMAIL_DOMAIN; // preserved for UofG email restriction restore

let notifyOnboardingCompletedRef: (() => void) | null = null;
let refreshUserProfileRef: (() => Promise<void>) | null = null;

/** Called after onboarding finishes so auth state skips redirect loops. */
export function notifyOnboardingCompleted() {
  notifyOnboardingCompletedRef?.();
}

/** Reload profile fields used in the nav (name, avatar). */
export function refreshUserProfile() {
  return refreshUserProfileRef?.() ?? Promise.resolve();
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

async function loadUserProfile(userId: string): Promise<UserProfileSnapshot> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load user profile:", error.message);
    return { fullName: "", avatarUrl: null };
  }

  return {
    fullName: (data?.full_name as string) ?? "",
    avatarUrl: (data?.avatar_url as string) ?? null,
  };
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
  const [userProfile, setUserProfile] = useState<UserProfileSnapshot | null>(
    null,
  );

  notifyOnboardingCompletedRef = () => setOnboardingCompleted(true);

  const refreshUserProfile = useCallback(async () => {
    if (!user?.id) {
      setUserProfile(null);
      return;
    }
    const profile = await loadUserProfile(user.id);
    setUserProfile(profile);
  }, [user?.id]);

  refreshUserProfileRef = refreshUserProfile;

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
          void loadUserProfile(s.user.id).then(setUserProfile);
        } else {
          setOnboardingCompleted(null);
          setUserProfile(null);
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
        void loadUserProfile(s.user.id).then(setUserProfile);
      } else {
        setOnboardingCompleted(null);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshOnboardingStatus]);

  useEffect(() => {
    if (loading || !user || onboardingCompleted === null) return;
    if (location.pathname !== "/login" && location.pathname !== "/signup") {
      return;
    }

    const rawRedirect = new URLSearchParams(location.search).get("redirect");
    const safeRedirect = isSafeRedirectPath(rawRedirect) ? rawRedirect : null;
    if (safeRedirect) {
      storePendingRedirect(safeRedirect);
    }

    if (onboardingCompleted === false) {
      navigate(
        safeRedirect
          ? `/onboarding?redirect=${encodeURIComponent(safeRedirect)}`
          : "/onboarding",
        { replace: true },
      );
      return;
    }

    navigate(safeRedirect ?? "/app", { replace: true });
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

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      redirectPath?: string | null,
    ) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!isAllowedSignupEmail(normalizedEmail)) {
        throw new Error(
          `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are permitted to sign up.`,
        );
      }

      console.info("[auth] signup start", { email: normalizedEmail });

      if (redirectPath) {
        storePendingRedirect(redirectPath);
      }
      const emailRedirectTo = buildAuthCallbackUrl(redirectPath);
      console.info("[auth] signup emailRedirectTo", { emailRedirectTo });

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo,
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
    },
    [],
  );

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
    setUserProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      onboardingCompleted,
      userProfile,
      refreshUserProfile,
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
      userProfile,
      refreshUserProfile,
      signUp,
      signIn,
      signOut,
      postAuthRedirectPath,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
