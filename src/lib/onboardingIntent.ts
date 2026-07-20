import { supabase } from "./supabaseClient";

export type OnboardingIntent = "discover" | "manage" | "both";

export const ONBOARDING_INTENT_KEY = "gryph_onboarding_intent";
export const ONBOARDING_STEP_KEY = "gryph_onboarding_step";

export type OnboardingStep = 1 | 2;

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

export function readOnboardingStepFromStorage(): OnboardingStep | null {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_STEP_KEY);
    if (raw === "1" || raw === "2") return Number(raw) as OnboardingStep;
    return null;
  } catch {
    return null;
  }
}

export function cacheOnboardingStep(step: OnboardingStep): void {
  try {
    sessionStorage.setItem(ONBOARDING_STEP_KEY, String(step));
  } catch {
    /* sessionStorage unavailable */
  }
}

export function clearOnboardingStepCache(): void {
  try {
    sessionStorage.removeItem(ONBOARDING_STEP_KEY);
  } catch {
    /* sessionStorage unavailable */
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

/** Persist intent before onboarding is marked complete (survives refresh / re-login). */
export async function persistOnboardingIntentDraft(
  userId: string,
  intent: OnboardingIntent,
): Promise<void> {
  cacheOnboardingIntent(intent);
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_intent: intent })
    .eq("id", userId);

  if (error) {
    console.error("Failed to persist onboarding intent draft:", error.message);
  }
}

export function destinationForOnboardingIntent(intent: OnboardingIntent): string {
  if (intent === "manage") return "/explore?claim=true";
  if (intent === "both") return "/app";
  return "/explore";
}
