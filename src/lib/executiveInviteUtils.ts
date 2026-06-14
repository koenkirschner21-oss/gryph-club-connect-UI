import type { SupabaseClient } from "@supabase/supabase-js";
import { createInboxMessage } from "./inboxUtils";
import { createNotification } from "./notifications";
import {
  accessLevelBadgeLabel,
  resolveRoleTitleFromSelection,
} from "./memberRoleTitle";
import type { AccessLevel } from "../types";

export type ExecutiveInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "canceled";

export interface ExecutiveInviteRow {
  id: string;
  clubId: string;
  invitedBy: string;
  invitedEmail: string;
  invitedUserId?: string;
  accessLevel: AccessLevel;
  roleTitle?: string;
  optionalMessage?: string;
  status: ExecutiveInviteStatus;
  token: string;
  createdAt: string;
  expiresAt: string;
  inviteeName?: string;
}

export const EXECUTIVE_INVITE_ACCESS_OPTIONS: {
  value: AccessLevel;
  label: string;
}[] = [
  { value: "president", label: "Co-President" },
  { value: "managerial_executive", label: "Managerial Executive" },
  { value: "executive", label: "Executive" },
  { value: "member", label: "General Member" },
];

export function mapExecutiveInviteRow(
  row: Record<string, unknown>,
): ExecutiveInviteRow {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    invitedBy: row.invited_by as string,
    invitedEmail: row.invited_email as string,
    invitedUserId: (row.invited_user_id as string | null) ?? undefined,
    accessLevel: row.access_level as AccessLevel,
    roleTitle: (row.role_title as string | null) ?? undefined,
    optionalMessage: (row.optional_message as string | null) ?? undefined,
    status: row.status as ExecutiveInviteStatus,
    token: row.token as string,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    inviteeName: (row.invitee_name as string | undefined) ?? undefined,
  };
}

export function executiveInviteStatusLabel(status: ExecutiveInviteStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function executiveInviteStatusStyle(
  status: ExecutiveInviteStatus,
): { color: string; border: string; background: string } {
  switch (status) {
    case "accepted":
      return { color: "#FFC429", border: "1px solid #FFC429", background: "#1a1500" };
    case "declined":
      return { color: "#E51937", border: "1px solid #E51937", background: "#1a0505" };
    case "expired":
    case "canceled":
      return { color: "#555555", border: "1px solid #555555", background: "#1a1a1a" };
    default:
      return { color: "#FFC429", border: "1px solid #FFC429", background: "#1a1500" };
  }
}

export function isExecutiveInviteExpired(invite: ExecutiveInviteRow): boolean {
  if (invite.status !== "pending") return invite.status === "expired";
  return new Date(invite.expiresAt).getTime() < Date.now();
}

const WRONG_USER_ERROR =
  "This invite was sent to a specific email and cannot be used by this account.";

const EXPIRED_ERROR =
  "This invite has expired. Please ask your club President to send a new invite.";

export async function fetchExecutiveInviteByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<ExecutiveInviteRow | null> {
  const { data, error } = await supabase.rpc("get_executive_invite_by_token", {
    p_token: token,
  });

  if (error || !data) {
    return null;
  }

  return mapExecutiveInviteRow(data as Record<string, unknown>);
}

export function validateExecutiveInviteForRecipient(
  invite: ExecutiveInviteRow,
  recipientUserId: string,
  recipientEmail: string,
): { ok: true } | { ok: false; error: string } {
  if (invite.status !== "pending") {
    return { ok: false, error: "This invite is no longer available." };
  }

  if (isExecutiveInviteExpired(invite)) {
    return { ok: false, error: EXPIRED_ERROR };
  }

  if (invite.invitedUserId && invite.invitedUserId !== recipientUserId) {
    return { ok: false, error: WRONG_USER_ERROR };
  }

  const invitedEmail = invite.invitedEmail.trim().toLowerCase();
  const currentEmail = recipientEmail.trim().toLowerCase();
  if (!currentEmail || invitedEmail !== currentEmail) {
    return { ok: false, error: WRONG_USER_ERROR };
  }

  return { ok: true };
}

async function markExecutiveInviteExpired(
  supabase: SupabaseClient,
  inviteId: string,
): Promise<void> {
  await supabase
    .from("executive_invites")
    .update({ status: "expired" })
    .eq("id", inviteId)
    .eq("status", "pending");
}

async function lookupUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

export interface CreateExecutiveInviteInput {
  email: string;
  accessLevel: AccessLevel;
  roleTitle: string;
  optionalMessage?: string;
}

export async function createExecutiveInvite(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    invitedBy: string;
    invite: CreateExecutiveInviteInput;
    sharedMessage?: string;
  },
): Promise<ExecutiveInviteRow | null> {
  const email = params.invite.email.trim().toLowerCase();
  if (!email) return null;

  const invitedUserId = await lookupUserIdByEmail(supabase, email);
  const roleTitle = params.invite.roleTitle.trim() || null;
  const optionalMessage =
    params.sharedMessage?.trim() || params.invite.optionalMessage?.trim() || null;

  const { data, error } = await supabase
    .from("executive_invites")
    .insert({
      club_id: params.clubId,
      invited_by: params.invitedBy,
      invited_email: email,
      invited_user_id: invitedUserId,
      access_level: params.invite.accessLevel,
      role_title: roleTitle,
      optional_message: optionalMessage,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create executive invite:", error?.message);
    return null;
  }

  const row = mapExecutiveInviteRow(data as Record<string, unknown>);
  const roleLabel = roleTitle || accessLevelBadgeLabel(params.invite.accessLevel);
  const invitePath = `/executive-invite/${row.token}`;

  const inboxBody = [
    `You have been invited to join ${params.clubName} as ${roleLabel}.`,
    optionalMessage,
    "This is a single-use invite. Accept or decline in your Dashboard Inbox.",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (invitedUserId) {
    await createInboxMessage(supabase, {
      recipientId: invitedUserId,
      senderId: params.invitedBy,
      type: "executive_invite",
      title: `Executive invite — ${params.clubName}`,
      message: inboxBody,
      actionRequired: true,
      actionType: "executive_invite_response",
      actionData: {
        inviteId: row.id,
        token: row.token,
        clubId: params.clubId,
        invitedBy: params.invitedBy,
        path: invitePath,
      },
      clubId: params.clubId,
      referenceId: row.id,
      referenceType: "executive_invite",
    });

    await createNotification(supabase, {
      userId: invitedUserId,
      type: "club_update",
      message: `You have been invited to join ${params.clubName} as ${roleLabel}.`,
      clubId: params.clubId,
      referenceId: row.id,
    });
  }

  return row;
}

export async function createExecutiveInvites(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    invitedBy: string;
    invites: CreateExecutiveInviteInput[];
    sharedMessage?: string;
  },
): Promise<{ created: ExecutiveInviteRow[]; failed: number }> {
  const created: ExecutiveInviteRow[] = [];
  let failed = 0;

  for (const invite of params.invites) {
    const row = await createExecutiveInvite(supabase, { ...params, invite });
    if (row) {
      created.push(row);
    } else {
      failed += 1;
    }
  }

  return { created, failed };
}

export async function cancelExecutiveInvite(
  supabase: SupabaseClient,
  inviteId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("executive_invites")
    .update({ status: "canceled" })
    .eq("id", inviteId)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to cancel executive invite:", error.message);
    return false;
  }

  return true;
}

export async function resendExecutiveInvite(
  supabase: SupabaseClient,
  invite: ExecutiveInviteRow,
  clubName: string,
): Promise<boolean> {
  if (invite.status !== "pending") return false;

  const invitedUserId =
    invite.invitedUserId ??
    (await lookupUserIdByEmail(supabase, invite.invitedEmail));

  if (!invitedUserId) return true;

  const roleLabel = invite.roleTitle || accessLevelBadgeLabel(invite.accessLevel);
  const invitePath = `/executive-invite/${invite.token}`;

  await createInboxMessage(supabase, {
    recipientId: invitedUserId,
    senderId: invite.invitedBy,
    type: "executive_invite",
    title: `Reminder — executive invite for ${clubName}`,
    message: `Reminder: you have a pending invite to join ${clubName} as ${roleLabel}.`,
    actionRequired: true,
    actionType: "executive_invite_response",
    actionData: {
      inviteId: invite.id,
      token: invite.token,
      clubId: invite.clubId,
      invitedBy: invite.invitedBy,
      path: invitePath,
    },
    clubId: invite.clubId,
    referenceId: invite.id,
    referenceType: "executive_invite",
  });

  await createNotification(supabase, {
    userId: invitedUserId,
    type: "club_update",
    message: `Reminder: accept or decline your invite to ${clubName}.`,
    clubId: invite.clubId,
    referenceId: invite.id,
  });

  return true;
}

export async function acceptExecutiveInvite(
  supabase: SupabaseClient,
  params: {
    token: string;
    inboxMessageId?: string;
    recipientUserId: string;
    recipientEmail: string;
    clubName: string;
    inviterUserId?: string;
  },
): Promise<{ ok: boolean; clubId?: string; error?: string }> {
  const invite = await fetchExecutiveInviteByToken(supabase, params.token);

  if (!invite) {
    return { ok: false, error: "This invite is no longer available." };
  }

  const validation = validateExecutiveInviteForRecipient(
    invite,
    params.recipientUserId,
    params.recipientEmail,
  );
  if (!validation.ok) {
    if (validation.error === EXPIRED_ERROR) {
      await markExecutiveInviteExpired(supabase, invite.id);
    }
    return { ok: false, error: validation.error };
  }

  const { data, error } = await supabase.rpc("accept_executive_invite", {
    p_token: params.token,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("invite_expired")) {
      return { ok: false, error: EXPIRED_ERROR };
    }
    if (message.includes("invite_wrong_user")) {
      return { ok: false, error: WRONG_USER_ERROR };
    }
    console.error("Failed to accept executive invite:", message);
    return { ok: false, error: "Could not accept this invite. Please try again." };
  }

  const clubId = data as string;

  if (params.inboxMessageId) {
    await supabase
      .from("inbox_messages")
      .update({ action_completed: true, read: true })
      .eq("id", params.inboxMessageId)
      .eq("recipient_id", params.recipientUserId);
  }

  if (params.inviterUserId) {
    await createInboxMessage(supabase, {
      recipientId: params.inviterUserId,
      senderId: params.recipientUserId,
      type: "invite_accepted",
      title: `Executive invite accepted — ${params.clubName}`,
      message: `Your executive invite for ${params.clubName} was accepted.`,
      clubId,
      referenceId: invite.id,
      referenceType: "executive_invite",
    });

    await createNotification(supabase, {
      userId: params.inviterUserId,
      type: "club_update",
      message: `Your executive invite to ${params.clubName} was accepted.`,
      clubId,
      referenceId: invite.id,
    });
  }

  return { ok: true, clubId };
}

export async function declineExecutiveInvite(
  supabase: SupabaseClient,
  params: {
    inviteId: string;
    recipientUserId: string;
    recipientEmail: string;
    inboxMessageId?: string;
    clubName: string;
    inviterUserId?: string;
    clubId?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { data: inviteRow, error: fetchError } = await supabase
    .from("executive_invites")
    .select("*")
    .eq("id", params.inviteId)
    .maybeSingle();

  if (fetchError || !inviteRow) {
    return { ok: false, error: "This invite is no longer available." };
  }

  const invite = mapExecutiveInviteRow(inviteRow as Record<string, unknown>);
  const validation = validateExecutiveInviteForRecipient(
    invite,
    params.recipientUserId,
    params.recipientEmail,
  );

  if (!validation.ok) {
    if (validation.error === EXPIRED_ERROR) {
      await markExecutiveInviteExpired(supabase, invite.id);
    }
    return { ok: false, error: validation.error };
  }

  const { error } = await supabase
    .from("executive_invites")
    .update({ status: "declined", invited_user_id: params.recipientUserId })
    .eq("id", params.inviteId)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to decline executive invite:", error.message);
    return { ok: false, error: "Could not decline this invite." };
  }

  if (params.inboxMessageId) {
    await supabase
      .from("inbox_messages")
      .update({ action_completed: true, read: true })
      .eq("id", params.inboxMessageId)
      .eq("recipient_id", params.recipientUserId);
  }

  if (params.inviterUserId) {
    await createInboxMessage(supabase, {
      recipientId: params.inviterUserId,
      senderId: params.recipientUserId,
      type: "invite_declined",
      title: `Executive invite declined — ${params.clubName}`,
      message: `Your executive invite for ${params.clubName} was declined.`,
      clubId: params.clubId ?? invite.clubId,
      referenceId: params.inviteId,
      referenceType: "executive_invite",
    });

    await createNotification(supabase, {
      userId: params.inviterUserId,
      type: "club_update",
      message: `Your executive invite to ${params.clubName} was declined.`,
      clubId: params.clubId ?? invite.clubId,
      referenceId: params.inviteId,
    });
  }

  return { ok: true };
}

export function buildExecutiveInviteRowInput(
  email: string,
  accessLevel: AccessLevel,
  titleSelection: string,
  titleCustom: string,
): CreateExecutiveInviteInput {
  return {
    email: email.trim().toLowerCase(),
    accessLevel,
    roleTitle: resolveRoleTitleFromSelection(titleSelection, titleCustom),
  };
}

export function executiveInviteRoleSummary(invite: ExecutiveInviteRow): string {
  return invite.roleTitle || accessLevelBadgeLabel(invite.accessLevel);
}
