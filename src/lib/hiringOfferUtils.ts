import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchHiringApplicationUpdated } from "./clubDataSyncEvents";

const NOT_APPLICANT_ERROR =
  "You can only respond to your own hiring offer.";
const OFFER_NOT_PENDING_ERROR =
  "This offer is no longer available to accept or decline.";

function mapHiringOfferRpcError(message: string): string {
  if (message.includes("not_authenticated")) {
    return "You must be signed in to respond to this offer.";
  }
  if (message.includes("not_applicant")) {
    return NOT_APPLICANT_ERROR;
  }
  if (message.includes("offer_not_pending")) {
    return OFFER_NOT_PENDING_ERROR;
  }
  if (message.includes("application_not_found")) {
    return "This application could not be found.";
  }
  return "Could not update this offer. Please try again.";
}

async function markOfferInboxCompleted(
  supabase: SupabaseClient,
  inboxMessageId: string | undefined,
  recipientUserId: string,
): Promise<void> {
  if (!inboxMessageId) return;

  await supabase
    .from("inbox_messages")
    .update({ action_completed: true, read: true })
    .eq("id", inboxMessageId)
    .eq("recipient_id", recipientUserId);
}

export async function acceptHiringOffer(
  supabase: SupabaseClient,
  params: {
    applicationId: string;
    recipientUserId: string;
    inboxMessageId?: string;
  },
): Promise<{ ok: boolean; clubId?: string; error?: string }> {
  const { data, error } = await supabase.rpc("accept_hiring_offer", {
    p_application_id: params.applicationId,
  });

  if (error) {
    console.error("Failed to accept hiring offer:", error.message);
    return { ok: false, error: mapHiringOfferRpcError(error.message) };
  }

  const payload = (data ?? {}) as { club_id?: string };
  await markOfferInboxCompleted(
    supabase,
    params.inboxMessageId,
    params.recipientUserId,
  );

  dispatchHiringApplicationUpdated({
    applicationId: params.applicationId,
    clubId: payload.club_id,
  });

  return { ok: true, clubId: payload.club_id };
}

export async function declineHiringOffer(
  supabase: SupabaseClient,
  params: {
    applicationId: string;
    recipientUserId: string;
    inboxMessageId?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("decline_hiring_offer", {
    p_application_id: params.applicationId,
  });

  if (error) {
    console.error("Failed to decline hiring offer:", error.message);
    return { ok: false, error: mapHiringOfferRpcError(error.message) };
  }

  await markOfferInboxCompleted(
    supabase,
    params.inboxMessageId,
    params.recipientUserId,
  );

  dispatchHiringApplicationUpdated({
    applicationId: params.applicationId,
  });

  return { ok: true };
}
