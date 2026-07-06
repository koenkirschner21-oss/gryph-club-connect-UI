import type { SupabaseClient } from "@supabase/supabase-js";

export const PRESIDENT_MEMBER_TITLE = "President";

const PRESIDENT_VERIFY_ATTEMPTS = 4;
const PRESIDENT_VERIFY_DELAY_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function verifyPresidentMembership(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < PRESIDENT_VERIFY_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.rpc(
      "club_has_active_president_membership",
      {
        p_club_id: clubId,
        p_user_id: userId,
      },
    );

    if (error) {
      console.error("Failed to verify president membership:", error.message);
      return false;
    }

    if (data === true) {
      return true;
    }

    if (attempt < PRESIDENT_VERIFY_ATTEMPTS - 1) {
      await delay(PRESIDENT_VERIFY_DELAY_MS);
    }
  }

  return false;
}

/** Ensure active President membership for platform-admin approval flows. */
export async function ensurePresidentMembership(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
  title = PRESIDENT_MEMBER_TITLE,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_president_membership", {
    p_club_id: clubId,
    p_user_id: userId,
    p_title: title,
  });

  if (error) {
    const verifiedAfterError = await verifyPresidentMembership(
      supabase,
      clubId,
      userId,
    );
    if (verifiedAfterError) {
      return null;
    }
    return error.message;
  }

  if (data === true) {
    return null;
  }

  const verified = await verifyPresidentMembership(supabase, clubId, userId);
  if (verified) {
    return null;
  }

  return "President membership could not be confirmed for this club.";
}

export type ApproveClubClaimOutcome = "approved" | "already_approved";

export interface ApproveClubClaimResult {
  outcome: ApproveClubClaimOutcome;
  claimRequestId: string;
  clubId: string;
  submittedBy: string;
  claimStatus: string;
  siblingRequestsClosed: number;
}

function mapApproveClubClaimResult(
  data: Record<string, unknown>,
): ApproveClubClaimResult {
  return {
    outcome:
      data.outcome === "already_approved" ? "already_approved" : "approved",
    claimRequestId: data.claim_request_id as string,
    clubId: data.club_id as string,
    submittedBy: data.submitted_by as string,
    claimStatus: (data.claim_status as string) ?? "claimed",
    siblingRequestsClosed: Number(data.sibling_requests_closed ?? 0),
  };
}

/** Atomically approve a club claim request (platform admins only). */
export async function approveClubClaimRequest(
  supabase: SupabaseClient,
  claimRequestId: string,
): Promise<{ ok: true; result: ApproveClubClaimResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("approve_club_claim_request", {
    p_request_id: claimRequestId,
  });

  if (error) {
    console.error("Failed to approve club claim request:", error.message);
    return { ok: false, error: error.message };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "Claim approval returned no result." };
  }

  return {
    ok: true,
    result: mapApproveClubClaimResult(data as Record<string, unknown>),
  };
}
