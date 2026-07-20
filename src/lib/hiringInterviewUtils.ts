import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchHiringApplicationUpdated } from "./clubDataSyncEvents";
import { parseInterviewTimes } from "./hiringPipelineUtils";
import { notifyHiringManagerBells } from "./hiringNotificationRecipients";

const NOT_APPLICANT_ERROR =
  "You can only respond to interview invites on your own applications.";
const INTERVIEW_NOT_PENDING_ERROR =
  "This interview invite is no longer available to respond to.";

function mapInterviewTimeRpcError(message: string): string {
  if (message.includes("not_authenticated")) {
    return "You must be signed in to select an interview time.";
  }
  if (message.includes("not_applicant")) {
    return NOT_APPLICANT_ERROR;
  }
  if (message.includes("interview_not_pending")) {
    return INTERVIEW_NOT_PENDING_ERROR;
  }
  if (message.includes("selected_time_not_allowed")) {
    return "Please choose one of the proposed interview times.";
  }
  if (message.includes("selected_time_required")) {
    return "Select an interview time before confirming.";
  }
  if (message.includes("application_not_found")) {
    return "This application could not be found.";
  }
  return "Could not save your interview time. Please try again.";
}

export async function fetchHiringInterviewTimeOptions(
  supabase: SupabaseClient,
  applicationId: string,
  actionData?: { mode?: string; interviewTimes?: unknown },
): Promise<{
  mode: "ask_availability" | "specific_times" | null;
  interviewTimes: string[];
  subStatus: string | null;
}> {
  const embeddedTimes = parseInterviewTimes(actionData?.interviewTimes);
  if (embeddedTimes.length > 0) {
    return {
      mode: "specific_times",
      interviewTimes: embeddedTimes,
      subStatus: "interview_invite_sent",
    };
  }

  if (actionData?.mode === "ask_availability") {
    return {
      mode: "ask_availability",
      interviewTimes: [],
      subStatus: "interview_invite_sent",
    };
  }

  const { data, error } = await supabase
    .from("hiring_applications")
    .select("sub_status, interview_times")
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to load hiring interview options:", error?.message);
    return { mode: null, interviewTimes: [], subStatus: null };
  }

  const interviewTimes = parseInterviewTimes(data.interview_times);
  const mode =
    interviewTimes.length > 0 ? ("specific_times" as const) : ("ask_availability" as const);

  return {
    mode,
    interviewTimes,
    subStatus: (data.sub_status as string | null) ?? null,
  };
}

export async function selectHiringInterviewTime(
  supabase: SupabaseClient,
  params: {
    applicationId: string;
    selectedTime: string;
    recipientUserId: string;
    inboxMessageId?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("select_hiring_interview_time", {
    p_application_id: params.applicationId,
    p_selected_time: params.selectedTime,
  });

  if (error) {
    console.error("Failed to select hiring interview time:", error.message);
    return { ok: false, error: mapInterviewTimeRpcError(error.message) };
  }

  const { data: applicationRow } = await supabase
    .from("hiring_applications")
    .select("listing_id, applicant_id, hiring_listings(title, club_id)")
    .eq("id", params.applicationId)
    .maybeSingle();

  if (applicationRow) {
    const listing = applicationRow.hiring_listings as
      | { title?: string | null; club_id?: string | null }
      | null
      | undefined;
    const clubId = listing?.club_id ?? null;
    const listingId = applicationRow.listing_id as string | null;
    const roleTitle = (listing?.title as string | null) ?? "this role";
    const applicantId = applicationRow.applicant_id as string | null;

    if (clubId && listingId) {
      let applicantName = "An applicant";
      if (applicantId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", applicantId)
          .maybeSingle();
        applicantName = (profile?.full_name as string | null)?.trim() || applicantName;
      }

      await notifyHiringManagerBells(supabase, {
        clubId,
        listingId,
        referenceId: params.applicationId,
        message: `${applicantName} scheduled an interview for ${roleTitle} (${params.selectedTime}).`,
        excludeUserIds: [params.recipientUserId],
      });
    }
  }

  if (params.inboxMessageId) {
    await supabase
      .from("inbox_messages")
      .update({ action_completed: true, read: true })
      .eq("id", params.inboxMessageId)
      .eq("recipient_id", params.recipientUserId);
  }

  dispatchHiringApplicationUpdated({
    applicationId: params.applicationId,
  });

  return { ok: true };
}
