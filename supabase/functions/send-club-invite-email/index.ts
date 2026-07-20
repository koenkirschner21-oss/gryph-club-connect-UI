import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = {
  inviteId?: string;
  clubId?: string;
  invitedEmail?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("CLUB_INVITE_FROM_EMAIL") ??
      Deno.env.get("RESEND_FROM_EMAIL") ??
      "ClubConnect <onboarding@resend.dev>";
    const appOrigin =
      Deno.env.get("PUBLIC_APP_ORIGIN") ?? "https://clubconnect.app";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing Supabase secrets." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Email delivery is not configured (RESEND_API_KEY).",
          delivered: false,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload;
    const inviteId = payload.inviteId?.trim();
    if (!inviteId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing inviteId." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: invite, error: inviteError } = await admin
      .from("club_invites")
      .select("id, club_id, invited_email, invited_by, token, status, expires_at")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invitation not found." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (invite.invited_by !== authData.user.id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not allowed to send this invitation." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (invite.status !== "pending") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `This invitation is ${invite.status}.`,
          delivered: false,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const [{ data: club }, { data: inviter }] = await Promise.all([
      admin
        .from("clubs")
        .select("id, name, logo_url")
        .eq("id", invite.club_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", invite.invited_by)
        .maybeSingle(),
    ]);

    const clubName = (club?.name as string | undefined)?.trim() || "a club";
    const clubLogo = (club?.logo_url as string | null) ?? null;
    const inviterName =
      (inviter?.full_name as string | undefined)?.trim() || "A club member";
    const inviteUrl = `${appOrigin.replace(/\/$/, "")}/invite/${invite.token}`;
    const expiryLabel = formatExpiry(invite.expires_at as string | null);

    const subject = `You're invited to join ${clubName} on ClubConnect`;
    const logoBlock = clubLogo
      ? `<img src="${escapeHtml(clubLogo)}" alt="" width="56" height="56" style="border-radius:12px;display:block;margin:0 auto 16px;object-fit:cover;" />`
      : "";

    const html = `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#0f0f0f;color:#f5f5f5;padding:32px 16px;">
        <div style="max-width:520px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:14px;padding:28px;">
          ${logoBlock}
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#ffffff;text-align:center;">
            Join ${escapeHtml(clubName)}
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#cccccc;text-align:center;">
            ${escapeHtml(inviterName)} invited you to join
            <strong style="color:#ffffff;">${escapeHtml(clubName)}</strong>
            on ClubConnect.
          </p>
          ${
            expiryLabel
              ? `<p style="margin:0 0 20px;font-size:13px;color:#888888;text-align:center;">This invitation expires on ${escapeHtml(expiryLabel)}.</p>`
              : ""
          }
          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(inviteUrl)}"
               style="display:inline-block;background:#E51937;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">
              Join Club
            </a>
          </div>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#777777;text-align:center;word-break:break-all;">
            Or open this link: ${escapeHtml(inviteUrl)}
          </p>
        </div>
      </div>
    `;

    const text = [
      `${inviterName} invited you to join ${clubName} on ClubConnect.`,
      expiryLabel ? `This invitation expires on ${expiryLabel}.` : null,
      `Join here: ${inviteUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [invite.invited_email],
        subject,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const detail = await resendResponse.text();
      console.error("Resend invite email failed:", detail);
      return new Response(
        JSON.stringify({
          ok: false,
          delivered: false,
          error: "Email provider rejected the invitation send.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, delivered: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("send-club-invite-email error:", error);
    return new Response(
      JSON.stringify({ ok: false, delivered: false, error: "Unexpected error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
