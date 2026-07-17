import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventRsvpPath } from "./eventNavigation";
import { filterRsvpQuestionsForLoggedInUser } from "./eventRsvpUtils";
import {
  notifyEventSignupPendingReview,
  resolveStudentDisplayName,
} from "./notifications";
import { supabase as defaultSupabase } from "./supabaseClient";
import type { RsvpStatus } from "../types";

export interface EventSignupContext {
  eventId: string;
  clubId: string;
  clubName: string;
  title: string;
  date: string;
  time: string;
  location: string;
  signupRequiresApproval: boolean;
}

export type EventSignupRequestedStatus = "going" | "maybe" | "not_going";

export type EventSignupOutcome =
  | {
      ok: true;
      outcome: "recorded";
      status: RsvpStatus;
      previousStatus: RsvpStatus | null;
    }
  | { ok: true; outcome: "unchanged"; status: RsvpStatus }
  | { ok: true; outcome: "needs_questionnaire"; redirectPath: string }
  | { ok: false; outcome: "already_registered" }
  | { ok: false; outcome: "error"; error: string };

export interface SubmitEventSignupParams {
  eventId: string;
  userId: string;
  requestedStatus: EventSignupRequestedStatus;
  userEmail?: string | null;
  registrantName?: string;
  context?: EventSignupContext;
  existingStatus?: RsvpStatus | null;
  skipQuestionnaireCheck?: boolean;
  formResponses?: Array<{ questionId: string; answer: string }>;
  persistRsvp?: (eventId: string, status: RsvpStatus) => Promise<boolean>;
}

export async function eventRequiresRsvpQuestionnaire(
  eventId: string,
  forLoggedInUser = true,
): Promise<boolean> {
  const { data, error } = await defaultSupabase
    .from("event_form_questions")
    .select("id, question")
    .eq("event_id", eventId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Failed to load RSVP questions:", error.message);
    return false;
  }

  const questions = (data ?? []).map((row) => ({
    question: (row.question as string) ?? "",
  }));

  if (!forLoggedInUser) {
    return questions.length > 0;
  }

  return filterRsvpQuestionsForLoggedInUser(questions).length > 0;
}

export function resolveEventSignupStatus(
  requestedStatus: EventSignupRequestedStatus,
  signupRequiresApproval: boolean,
): RsvpStatus {
  if (requestedStatus !== "going") {
    return requestedStatus;
  }
  return signupRequiresApproval ? "pending" : "going";
}

export async function loadEventSignupContext(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventSignupContext | null> {
  const { data, error } = await supabase
    .from("events")
    .select(`
      id,
      club_id,
      title,
      date,
      time,
      location,
      signup_requires_approval,
      clubs:club_id ( name )
    `)
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("Failed to load event signup context:", error.message);
    }
    return null;
  }

  const clubRaw = data.clubs as unknown;
  const club = (
    Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
  ) as Record<string, unknown>;

  return {
    eventId: data.id as string,
    clubId: data.club_id as string,
    clubName: (club.name as string) ?? "Club",
    title: (data.title as string) ?? "",
    date: (data.date as string) ?? "",
    time: (data.time as string) ?? "",
    location: (data.location as string) ?? "",
    signupRequiresApproval: Boolean(data.signup_requires_approval),
  };
}

async function fetchExistingRsvpStatus(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<RsvpStatus | null> {
  const { data } = await supabase
    .from("event_rsvps")
    .select("status")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.status as RsvpStatus | undefined) ?? null;
}

async function saveEventFormResponses(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  formResponses: Array<{ questionId: string; answer: string }>,
): Promise<boolean> {
  if (formResponses.length === 0) return true;

  const rows = formResponses.map((response) => ({
    event_id: eventId,
    user_id: userId,
    question_id: response.questionId,
    answer: response.answer.trim(),
  }));

  const { error } = await supabase.from("event_form_responses").upsert(rows, {
    onConflict: "event_id,user_id,question_id",
  });

  if (error) {
    console.error("Failed to save RSVP responses:", error.message);
    return false;
  }

  return true;
}

export async function clearEventFormResponses(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("event_form_responses")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to clear RSVP responses:", error.message);
    return false;
  }

  return true;
}

async function defaultPersistRsvp(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  status: RsvpStatus,
): Promise<boolean> {
  const { error } = await supabase.from("event_rsvps").upsert(
    { event_id: eventId, user_id: userId, status },
    { onConflict: "event_id,user_id" },
  );

  if (error) {
    console.error("Failed to set RSVP:", error.message);
    return false;
  }

  return true;
}

function formatEventRegistrationDate(date: string, time: string): string {
  const parsed = new Date(date);
  const datePart = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const rawTime = time.trim();
  let timePart: string | null = null;
  if (rawTime && rawTime.toUpperCase() !== "TBD") {
    const parsedTime = new Date(`1970-01-01T${rawTime}`);
    timePart = Number.isNaN(parsedTime.getTime())
      ? rawTime
      : parsedTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
  }
  return timePart ? `${datePart} · ${timePart}` : datePart;
}

function cleanEventLocation(value: string): string {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return "TBD";
  return raw;
}

async function notifyEventRegistrationConfirmed(
  supabase: SupabaseClient,
  context: EventSignupContext,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "club_update",
    message: `[Event Registration Confirmed] You're registered for ${context.title} on ${formatEventRegistrationDate(context.date, context.time)}. Location: ${cleanEventLocation(context.location)}`,
    club_id: context.clubId,
    reference_id: context.eventId,
  });

  if (error) {
    console.error("Failed to send RSVP notification:", error.message);
  }
}

async function resolveRegistrantName(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null,
  registrantName?: string,
): Promise<string> {
  if (registrantName?.trim()) {
    return registrantName.trim();
  }

  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  return resolveStudentDisplayName(
    (data?.full_name as string | null) ?? null,
    (data?.email as string | null) ?? userEmail,
  );
}

export async function submitEventSignup(
  supabase: SupabaseClient,
  params: SubmitEventSignupParams,
): Promise<EventSignupOutcome> {
  const {
    eventId,
    userId,
    requestedStatus,
    skipQuestionnaireCheck = false,
    formResponses,
  } = params;

  if (requestedStatus === "going" && !skipQuestionnaireCheck) {
    const needsQuestionnaire = await eventRequiresRsvpQuestionnaire(eventId, true);
    if (needsQuestionnaire) {
      return {
        ok: true,
        outcome: "needs_questionnaire",
        redirectPath: getEventRsvpPath(eventId),
      };
    }
  }

  const context =
    params.context ?? (await loadEventSignupContext(supabase, eventId));
  if (!context) {
    return { ok: false, outcome: "error", error: "Event not found." };
  }

  const previousStatus =
    params.existingStatus ??
    (await fetchExistingRsvpStatus(supabase, eventId, userId));

  if (
    requestedStatus === "going" &&
    (previousStatus === "going" || previousStatus === "pending")
  ) {
    return { ok: false, outcome: "already_registered" };
  }

  const finalStatus = resolveEventSignupStatus(
    requestedStatus,
    context.signupRequiresApproval,
  );

  if (previousStatus === finalStatus) {
    return { ok: true, outcome: "unchanged", status: finalStatus };
  }

  if (formResponses) {
    const responsesSaved = await saveEventFormResponses(
      supabase,
      eventId,
      userId,
      formResponses,
    );
    if (!responsesSaved) {
      return {
        ok: false,
        outcome: "error",
        error: "Failed to save your responses.",
      };
    }
  }

  const persist =
    params.persistRsvp ??
    ((id: string, status: RsvpStatus) =>
      defaultPersistRsvp(supabase, id, userId, status));

  const persisted = await persist(eventId, finalStatus);
  if (!persisted) {
    return { ok: false, outcome: "error", error: "Failed to save RSVP." };
  }

  if (finalStatus === "pending" && previousStatus !== "pending") {
    const registrantName = await resolveRegistrantName(
      supabase,
      userId,
      params.userEmail,
      params.registrantName,
    );
    void notifyEventSignupPendingReview(supabase, {
      clubId: context.clubId,
      clubName: context.clubName,
      eventId: context.eventId,
      eventTitle: context.title,
      registrantUserId: userId,
      registrantName,
    });
  } else if (finalStatus === "going" && previousStatus !== "going") {
    await notifyEventRegistrationConfirmed(supabase, context, userId);
  }

  return {
    ok: true,
    outcome: "recorded",
    status: finalStatus,
    previousStatus,
  };
}

export function clubEventToSignupContext(
  event: {
    id: string;
    clubId?: string;
    title: string;
    date: string;
    time: string;
    location: string;
    signupRequiresApproval?: boolean;
  },
  clubName = "Club",
): EventSignupContext {
  return {
    eventId: event.id,
    clubId: event.clubId ?? "",
    clubName,
    title: event.title,
    date: event.date,
    time: event.time,
    location: event.location,
    signupRequiresApproval: Boolean(event.signupRequiresApproval),
  };
}
