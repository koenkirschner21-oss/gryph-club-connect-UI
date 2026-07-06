import type { SupabaseClient } from "@supabase/supabase-js";
import {
  notifyEventSignupApproved,
  notifyEventSignupRejected,
} from "./notifications";
import { getPublicEventDetailPath } from "./eventNavigation";

export interface EventSignupReviewResult {
  ok: boolean;
  outcome?: "approved" | "rejected";
  error?: string;
  eventId?: string;
  clubId?: string;
  userId?: string;
  eventTitle?: string;
}

function mapReviewRpcError(message: string | undefined, action: "approve" | "reject"): string {
  if (!message) {
    return action === "approve"
      ? "Failed to approve sign-up."
      : "Failed to reject sign-up.";
  }
  if (message.includes("not_authorized")) {
    return "You do not have permission to review sign-ups for this event.";
  }
  if (message.includes("rsvp_not_pending")) {
    return "This sign-up is no longer pending review.";
  }
  if (message.includes("rsvp_not_found") || message.includes("event_not_found")) {
    return "This sign-up request is no longer available.";
  }
  return action === "approve"
    ? "Failed to approve sign-up."
    : "Failed to reject sign-up.";
}

async function parseReviewRpcRow(
  supabase: SupabaseClient,
  data: unknown,
  action: "approve" | "reject",
): Promise<EventSignupReviewResult> {
  const row = (data ?? {}) as Record<string, unknown>;
  const eventId = row.event_id as string | undefined;
  const clubId = row.club_id as string | undefined;
  const userId = row.user_id as string | undefined;
  const eventTitle = (row.event_title as string | undefined) ?? "the event";

  if (!eventId || !clubId || !userId) {
    return { ok: false, error: mapReviewRpcError(undefined, action) };
  }

  if (action === "approve") {
    await notifyEventSignupApproved(supabase, {
      clubId,
      eventId,
      eventTitle,
      recipientUserId: userId,
    });
  } else {
    await notifyEventSignupRejected(supabase, {
      clubId,
      eventId,
      eventTitle,
      recipientUserId: userId,
    });
  }

  return {
    ok: true,
    outcome: action === "approve" ? "approved" : "rejected",
    eventId,
    clubId,
    userId,
    eventTitle,
  };
}

export async function approveEventSignup(
  supabase: SupabaseClient,
  rsvpId: string,
): Promise<EventSignupReviewResult> {
  const { data, error } = await supabase.rpc("approve_event_signup", {
    p_rsvp_id: rsvpId,
  });

  if (error) {
    return { ok: false, error: mapReviewRpcError(error.message, "approve") };
  }

  return parseReviewRpcRow(supabase, data, "approve");
}

export async function rejectEventSignup(
  supabase: SupabaseClient,
  rsvpId: string,
): Promise<EventSignupReviewResult> {
  const { data, error } = await supabase.rpc("reject_event_signup", {
    p_rsvp_id: rsvpId,
  });

  if (error) {
    return { ok: false, error: mapReviewRpcError(error.message, "reject") };
  }

  return parseReviewRpcRow(supabase, data, "reject");
}

export function eventSignupReviewEventPath(eventId: string): string {
  return getPublicEventDetailPath(eventId);
}
