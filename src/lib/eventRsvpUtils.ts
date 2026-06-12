import { normalizeVisibility } from "./contentVisibility";
import type { Visibility } from "../types";

const SYSTEM_QUESTION_PATTERNS = [
  /^email(\s+address)?$/i,
  /^e-?mail$/i,
  /^full\s*name$/i,
  /^your\s+name$/i,
  /^name$/i,
];

export function isSystemRsvpQuestion(question: string): boolean {
  const trimmed = question.trim();
  return SYSTEM_QUESTION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function filterRsvpQuestionsForLoggedInUser<T extends { question: string }>(
  questions: T[],
): T[] {
  return questions.filter((question) => !isSystemRsvpQuestion(question.question));
}

export interface RsvpAccessContext {
  isActiveMember: boolean;
  isPrivileged: boolean;
}

export interface RsvpAccessResult {
  canRsvp: boolean;
  showRsvpButton: boolean;
  blockedMessage?: string;
}

export function getEventRsvpAccess(
  visibility: Visibility | undefined,
  context: RsvpAccessContext,
): RsvpAccessResult {
  const level = normalizeVisibility(visibility, "public");

  if (level === "public") {
    return { canRsvp: true, showRsvpButton: true };
  }

  if (level === "members_only") {
    if (context.isActiveMember) {
      return { canRsvp: true, showRsvpButton: true };
    }
    return {
      canRsvp: false,
      showRsvpButton: false,
      blockedMessage: "Join the club to RSVP",
    };
  }

  if (context.isPrivileged) {
    return { canRsvp: true, showRsvpButton: true };
  }

  return { canRsvp: false, showRsvpButton: false };
}

export function formatGoingCount(going: number): string | null {
  return going > 0 ? `${going} going` : null;
}
