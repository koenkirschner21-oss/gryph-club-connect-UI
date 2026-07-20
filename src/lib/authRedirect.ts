/** Deployed Vercel app — fallback when VITE_APP_URL is unset in production builds. */
const DEFAULT_DEPLOYED_APP_URL =
  "https://gryph-club-connect-ui-git-main-gryph-club-connect-s-projects.vercel.app";

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

/**
 * Guards against open redirects: only same-origin, absolute paths are honored.
 * Rejects protocol-relative ("//host/...") and absolute URLs.
 */
export function isSafeRedirectPath(
  path: string | null | undefined,
): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}

export function buildAuthCallbackUrl(redirectPath?: string | null): string {
  const base = `${getAuthRedirectOrigin()}/auth/callback`;
  if (redirectPath && isSafeRedirectPath(redirectPath)) {
    return `${base}?redirect=${encodeURIComponent(redirectPath)}`;
  }
  return base;
}

export function buildAuthRedirectUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAuthRedirectOrigin()}${normalizedPath}`;
}

/**
 * Pending post-auth redirect, persisted across the signup -> email confirmation
 * -> callback -> onboarding hop chain (which can span browser tabs/devices, so
 * the URL query string alone isn't reliable). Keyed narrowly and always
 * revalidated with `isSafeRedirectPath` before use.
 */
const PENDING_REDIRECT_STORAGE_KEY = "cc_pending_redirect";

export function storePendingRedirect(path: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (isSafeRedirectPath(path)) {
      window.localStorage.setItem(PENDING_REDIRECT_STORAGE_KEY, path);
    }
  } catch {
    /* localStorage unavailable (private mode, etc.) — safe to ignore */
  }
}

export function peekPendingRedirect(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PENDING_REDIRECT_STORAGE_KEY);
    return isSafeRedirectPath(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingRedirect(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_REDIRECT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function consumePendingRedirect(): string | null {
  const value = peekPendingRedirect();
  clearPendingRedirect();
  return value;
}
