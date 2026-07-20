import { Navigate, useLocation } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import {
  isOnboardingAllowedPath,
  isPublicRsvpPath,
  onboardingRedirectTarget,
} from "../lib/onboardingGate";
import Spinner from "./ui/Spinner";

/**
 * Blocks authenticated users who have not finished onboarding from protected
 * and browse destinations. Renders a spinner (never the protected page) while
 * onboarding status is unknown.
 */
export function RequireCompletedOnboarding({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, onboardingCompleted } = useAuthContext();
  const location = useLocation();

  if (loading || (user && onboardingCompleted === null)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Checking onboarding…" />
      </div>
    );
  }

  if (user && onboardingCompleted === false) {
    if (
      isOnboardingAllowedPath(location.pathname) ||
      isPublicRsvpPath(location.pathname)
    ) {
      return children;
    }
    return <Navigate to={onboardingRedirectTarget(location)} replace />;
  }

  return children;
}

/**
 * For public browse routes (Explore / Events / Hiring / club pages):
 * logged-out users may browse; incomplete authenticated users are gated.
 */
export function GateIncompleteOnboardingBrowse({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, onboardingCompleted } = useAuthContext();
  const location = useLocation();

  if (!user) return children;

  if (loading || onboardingCompleted === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Checking onboarding…" />
      </div>
    );
  }

  if (onboardingCompleted === false) {
    if (isPublicRsvpPath(location.pathname)) return children;
    return <Navigate to={onboardingRedirectTarget(location)} replace />;
  }

  return children;
}
