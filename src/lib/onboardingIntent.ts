import { supabase } from "./supabaseClient";

export type OnboardingIntent = "discover" | "manage" | "both";

export const ONBOARDING_INTENT_KEY = "gryph_onboarding_intent";

export function isOnboardingIntent(value: string | null | undefined): value is OnboardingIntent {
  return value === "discover" || value === "manage" || value === "both";
}

export function readOnboardingIntentFromStorage(): OnboardingIntent | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_INTENT_KEY);
    return isOnboardingIntent(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function cacheOnboardingIntent(intent: OnboardingIntent): void {
  try {
    localStorage.setItem(ONBOARDING_INTENT_KEY, intent);
  } catch {
    /* localStorage unavailable */
  }
}

/** Prefer localStorage; fall back to profile column for other devices/sessions. */
export async function resolveOnboardingIntent(
  userId: string,
): Promise<OnboardingIntent | null> {
  const fromStorage = readOnboardingIntentFromStorage();
  if (fromStorage) return fromStorage;

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_intent")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load onboarding intent:", error.message);
    return null;
  }

  const fromProfile = data?.onboarding_intent as string | null | undefined;
  if (isOnboardingIntent(fromProfile)) {
    cacheOnboardingIntent(fromProfile);
    return fromProfile;
  }

  return null;
}
