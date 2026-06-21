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

export function buildAuthCallbackUrl(): string {
  return `${getAuthRedirectOrigin()}/auth/callback`;
}

export function buildAuthRedirectUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAuthRedirectOrigin()}${normalizedPath}`;
}
