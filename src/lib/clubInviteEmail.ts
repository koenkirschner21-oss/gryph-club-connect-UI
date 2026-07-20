import type { SupabaseClient } from "@supabase/supabase-js";

export type ClubInviteSendResult =
  | {
      ok: true;
      inviteId: string;
      token: string;
      inviteLink: string;
      emailSent: boolean;
      reused: boolean;
    }
  | {
      ok: false;
      error: string;
      inviteLink?: string;
      emailSent?: boolean;
    };

function inviteLinkForToken(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://clubconnect.app";
  return `${origin}/invite/${token}`;
}

/**
 * Create or reuse a pending club invite token, then attempt branded email delivery
 * via the send-club-invite-email edge function. Never reports success if email fails.
 */
export async function sendClubInviteEmail(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    invitedEmail: string;
    invitedBy: string;
    resend?: boolean;
  },
): Promise<ClubInviteSendResult> {
  const email = params.invitedEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existingRows, error: existingError } = await supabase
    .from("club_invites")
    .select("id, token, status, expires_at")
    .eq("club_id", params.clubId)
    .eq("invited_email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingError) {
    console.error("Failed to look up club invite:", existingError.message);
    return { ok: false, error: "Could not prepare invitation. Please try again." };
  }

  let inviteId = "";
  let token = "";
  let reused = false;

  const existing = existingRows?.[0] as
    | { id: string; token: string; status: string; expires_at: string | null }
    | undefined;

  if (existing?.token) {
    const expired =
      existing.expires_at != null &&
      !Number.isNaN(Date.parse(existing.expires_at)) &&
      Date.parse(existing.expires_at) < Date.now();

    if (expired) {
      await supabase
        .from("club_invites")
        .update({ status: "expired" })
        .eq("id", existing.id);
    } else {
      reused = true;
      inviteId = existing.id;
      token = existing.token;
      if (params.resend) {
        await supabase
          .from("club_invites")
          .update({ expires_at: expiresAt })
          .eq("id", existing.id);
      }
    }
  }

  if (!reused) {
    const { data, error } = await supabase
      .from("club_invites")
      .insert({
        club_id: params.clubId,
        invited_email: email,
        invited_by: params.invitedBy,
        expires_at: expiresAt,
      })
      .select("id, token")
      .single();

    if (error || !data?.token) {
      console.error("Failed to create club invite:", error?.message);
      return {
        ok: false,
        error: error?.message ?? "Failed to create invite. Please try again.",
      };
    }

    inviteId = data.id as string;
    token = data.token as string;
  }

  const inviteLink = inviteLinkForToken(token);

  const { data: fnData, error: fnError } = await supabase.functions.invoke(
    "send-club-invite-email",
    {
      body: {
        inviteId,
        clubId: params.clubId,
        invitedEmail: email,
      },
    },
  );

  if (fnError) {
    console.error("Club invite email delivery failed:", fnError.message, fnData);
    return {
      ok: false,
      error:
        "Invitation link was created, but the email could not be sent. You can copy the link instead.",
      inviteLink,
      emailSent: false,
    };
  }

  const payload = (fnData ?? {}) as {
    ok?: boolean;
    error?: string;
    delivered?: boolean;
  };

  if (!payload.ok || payload.delivered === false) {
    return {
      ok: false,
      error:
        payload.error ??
        "Invitation link was created, but the email could not be sent. You can copy the link instead.",
      inviteLink,
      emailSent: false,
    };
  }

  return {
    ok: true,
    inviteId,
    token,
    inviteLink,
    emailSent: true,
    reused,
  };
}

/** Create/reuse invite token without sending email — for Copy Invite Link. */
export async function ensureClubInviteLink(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    invitedEmail: string;
    invitedBy: string;
  },
): Promise<{ ok: true; inviteLink: string } | { ok: false; error: string }> {
  const email = params.invitedEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existingRows } = await supabase
    .from("club_invites")
    .select("id, token, expires_at")
    .eq("club_id", params.clubId)
    .eq("invited_email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  const existing = existingRows?.[0] as
    | { id: string; token: string; expires_at: string | null }
    | undefined;

  if (existing?.token) {
    const expired =
      existing.expires_at != null &&
      !Number.isNaN(Date.parse(existing.expires_at)) &&
      Date.parse(existing.expires_at) < Date.now();
    if (!expired) {
      return { ok: true, inviteLink: inviteLinkForToken(existing.token) };
    }
    await supabase
      .from("club_invites")
      .update({ status: "expired" })
      .eq("id", existing.id);
  }

  const { data, error } = await supabase
    .from("club_invites")
    .insert({
      club_id: params.clubId,
      invited_email: email,
      invited_by: params.invitedBy,
      expires_at: expiresAt,
    })
    .select("token")
    .single();

  if (error || !data?.token) {
    return {
      ok: false,
      error: error?.message ?? "Failed to create invite link.",
    };
  }

  return { ok: true, inviteLink: inviteLinkForToken(data.token as string) };
}
