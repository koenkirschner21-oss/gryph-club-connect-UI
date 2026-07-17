/** Deployed Vercel app — fallback when VITE_APP_URL is unset in production builds. */
const DEFAULT_DEPLOYED_APP_URL =
  "https://gryph-club-connect-ui-git-main-gryph-club-connect-s-projects.vercel.app";

const PENDING_AUTH_REDIRECT_KEY = "gryph_pending_auth_redirect";
const PENDING_AUTH_ACTION_KEY = "gryph_pending_auth_action";

function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Origin used in Supabase emailRedirectTo / redirectTo.
 * Prefers VITE_APP_URL (baked in at build) so confirmation links never point at localhost
 * when the production bundle is deployed, even if Supabase Site URL was misconfigured.
 */
export function getAuthRedirectOrigin(): string {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (typeof envUrl === "string" && envUrl.trim()) {
    return normalizeOrigin(envUrl);
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (import.meta.env.PROD) {
    return DEFAULT_DEPLOYED_APP_URL;
  }

  return "http://localhost:5173";
}

export function buildAuthCallbackUrl(): string {
  return `${getAuthRedirectOrigin()}/auth/callback`;
}

export function buildAuthRedirectUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAuthRedirectOrigin()}${normalizedPath}`;
}

/** Only allow same-origin relative paths (open-redirect safe). */
export function getSafeInternalRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/\\")) return null;
  return trimmed;
}

export function buildLoginPath(returnPath: string): string {
  const safe = getSafeInternalRedirect(returnPath) ?? "/app";
  return `/login?redirect=${encodeURIComponent(safe)}`;
}

export function buildSignupPath(returnPath: string): string {
  const safe = getSafeInternalRedirect(returnPath) ?? "/app";
  return `/signup?redirect=${encodeURIComponent(safe)}`;
}

export function storePendingAuthRedirect(path: string): void {
  const safe = getSafeInternalRedirect(path);
  if (!safe || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_AUTH_REDIRECT_KEY, safe);
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumePendingAuthRedirect(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PENDING_AUTH_REDIRECT_KEY);
    sessionStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
    return getSafeInternalRedirect(value);
  } catch {
    return null;
  }
}

export function peekPendingAuthRedirect(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return getSafeInternalRedirect(sessionStorage.getItem(PENDING_AUTH_REDIRECT_KEY));
  } catch {
    return null;
  }
}

export type PendingAuthAction =
  | { type: "save_role"; listingId: string }
  | { type: "save_club"; clubId: string };

export function storePendingAuthAction(action: PendingAuthAction): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_AUTH_ACTION_KEY, JSON.stringify(action));
  } catch {
    /* ignore */
  }
}

export function consumePendingAuthAction(): PendingAuthAction | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_AUTH_ACTION_KEY);
    sessionStorage.removeItem(PENDING_AUTH_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAuthAction;
    if (parsed?.type === "save_role" && typeof parsed.listingId === "string") {
      return parsed;
    }
    if (parsed?.type === "save_club" && typeof parsed.clubId === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Where to send the user after login/signup once auth + onboarding status are known.
 * Incomplete onboarding always goes to /onboarding (return path kept in sessionStorage).
 */
export function resolvePostAuthNavigation(options: {
  redirectParam?: string | null;
  onboardingCompleted: boolean | null;
}): { path: string; storeRedirectForOnboarding?: string } {
  const redirect =
    getSafeInternalRedirect(options.redirectParam) ?? peekPendingAuthRedirect();

  if (options.onboardingCompleted === false) {
    if (redirect) {
      storePendingAuthRedirect(redirect);
    }
    return { path: "/onboarding", storeRedirectForOnboarding: redirect ?? undefined };
  }

  if (redirect) {
    return { path: redirect };
  }

  return { path: "/app" };
}
