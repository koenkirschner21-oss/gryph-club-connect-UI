/**
 * Paths an authenticated user may visit before finishing onboarding.
 * Everything else redirects to /onboarding (including Explore, Events, Hiring).
 */
export const ONBOARDING_ALLOWED_PREFIXES = [
  "/onboarding",
  "/login",
  "/signup",
  "/auth/callback",
  "/invite",
  "/executive-invite",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/app/profile",
  "/app/settings",
] as const;

export function isOnboardingAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return ONBOARDING_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Public RSVP deep links remain reachable without finishing onboarding. */
export function isPublicRsvpPath(pathname: string): boolean {
  return /^\/events\/[^/]+\/rsvp\/?$/.test(pathname);
}

export function onboardingRedirectTarget(location: {
  pathname: string;
  search: string;
}): string {
  const current = `${location.pathname}${location.search}`;
  if (
    current.startsWith("/onboarding") ||
    isOnboardingAllowedPath(location.pathname)
  ) {
    return "/onboarding";
  }
  return `/onboarding?redirect=${encodeURIComponent(current)}`;
}
