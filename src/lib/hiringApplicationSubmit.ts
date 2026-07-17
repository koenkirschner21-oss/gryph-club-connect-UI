import type { SupabaseClient } from "@supabase/supabase-js";

export type HiringApplicationAnswerPayload = {
  question_id: string;
  answer: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
};

export type ApplyToHiringListingOutcome = "created" | "already_applied";

export type ApplyToHiringListingResult =
  | {
      ok: true;
      outcome: ApplyToHiringListingOutcome;
      applicationId: string;
    }
  | {
      ok: false;
      error: string;
    };

function mapApplyToHiringListingError(message: string): string {
  if (message.includes("not_authenticated")) {
    return "You must be signed in to apply.";
  }
  if (message.includes("listing_not_found")) {
    return "This position could not be found.";
  }
  if (message.includes("listing_closed")) {
    return "This position is no longer accepting applications.";
  }
  if (message.includes("listing_deadline_passed")) {
    return "The application deadline for this position has passed.";
  }
  if (
    message.includes("missing_required_answers") ||
    message.includes("missing_required_upload")
  ) {
    return "Please complete all required questions and uploads before submitting.";
  }
  return "Could not submit your application. Please try again.";
}

export async function applyToHiringListing(
  supabase: SupabaseClient,
  params: {
    listingId: string;
    answers: HiringApplicationAnswerPayload[];
  },
): Promise<ApplyToHiringListingResult> {
  const { data, error } = await supabase.rpc("apply_to_hiring_listing", {
    p_listing_id: params.listingId,
    p_answers: params.answers,
  });

  if (error) {
    console.error("Failed to apply to hiring listing:", error.message);
    return { ok: false, error: mapApplyToHiringListingError(error.message) };
  }

  const payload = (data ?? {}) as {
    outcome?: ApplyToHiringListingOutcome;
    application_id?: string;
  };

  const outcome = payload.outcome;
  const applicationId = payload.application_id;

  if (
    (outcome !== "created" && outcome !== "already_applied") ||
    typeof applicationId !== "string" ||
    !applicationId
  ) {
    return {
      ok: false,
      error: "Could not submit your application. Please try again.",
    };
  }

  return { ok: true, outcome, applicationId };
}
