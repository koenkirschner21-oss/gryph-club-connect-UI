import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

/** Default true for user testing; set VITE_ALLOW_NON_UOFG_EMAILS=false before launch. */
export const ALLOW_NON_UOFG_EMAILS =
  import.meta.env.VITE_ALLOW_NON_UOFG_EMAILS !== "false";

const UOFG_EMAIL_SUFFIX = "@uoguelph.ca";

export function isAllowedSignupEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  if (ALLOW_NON_UOFG_EMAILS) return true;
  return normalized.endsWith(UOFG_EMAIL_SUFFIX);
}

export function signupEmailValidationMessage(): string {
  if (ALLOW_NON_UOFG_EMAILS) {
    return "Please enter a valid email address.";
  }
  return "Only University of Guelph email addresses are accepted (@uoguelph.ca).";
}

/**
 * Ensures a minimal profiles row exists (recovery after partial signup or trigger issues).
 */
export async function ensureMinimalProfile(
  user: User,
): Promise<{ created: boolean; error?: string }> {
  const { data, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("[auth] ensureMinimalProfile select failed:", selectError.message);
    return { created: false, error: selectError.message };
  }

  if (data) {
    return { created: false };
  }

  const payload = {
    id: user.id,
    email: user.email ?? null,
    onboarding_completed: false,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (upsertError) {
    console.error("[auth] ensureMinimalProfile upsert failed:", upsertError.message);
    return { created: false, error: upsertError.message };
  }

  console.info("[auth] ensureMinimalProfile created missing profile for", user.id);
  return { created: true };
}

export function formatSignupError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Signup failed. Please try again or use a different email.";

  const lower = message.toLowerCase();

  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists")
  ) {
    return "An account with this email may already exist. Try logging in.";
  }

  if (lower.includes("database error saving new user")) {
    return "Signup failed due to a server error. Please try again in a moment or contact support.";
  }

  if (lower.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  if (lower.includes("password")) {
    return message;
  }

  return message || "Signup failed. Please try again or use a different email.";
}
