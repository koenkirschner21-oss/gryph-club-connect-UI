import type { SupabaseClient } from "@supabase/supabase-js";
import { createInboxMessage } from "./inboxUtils";
import { createNotification } from "./notifications";
import type { AccessLevel, MemberRole } from "../types";

export type OwnershipTransferRole = "owner" | "co_president";
export type OwnershipTransferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "canceled"
  | "expired";

export type FormerOwnerChoice =
  | "stay_co_president"
  | "executive"
  | "member"
  | "leave";

export interface OwnershipTransferRow {
  id: string;
  clubId: string;
  fromUserId: string;
  toUserId: string;
  newRole: OwnershipTransferRole;
  optionalMessage: string | null;
  status: OwnershipTransferStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
}

export function ownershipRoleLabel(role: OwnershipTransferRole | string): string {
  return role === "co_president" ? "Co-President" : "President";
}

export function mapOwnershipTransferRow(
  row: Record<string, unknown>,
): OwnershipTransferRow {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    fromUserId: row.from_user_id as string,
    toUserId: row.to_user_id as string,
    newRole: row.new_role as OwnershipTransferRole,
    optionalMessage: (row.optional_message as string | null) ?? null,
    status: row.status as OwnershipTransferStatus,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    respondedAt: (row.responded_at as string | null) ?? null,
  };
}

export function isPresidentMember(member: {
  role: string;
  status?: string;
}): boolean {
  return member.status !== "pending" && member.role === "owner";
}

export async function markInboxActionCompleted(
  supabase: SupabaseClient,
  inboxMessageId: string,
  userId: string,
): Promise<void> {
  await supabase
    .from("inbox_messages")
    .update({ action_completed: true, read: true })
    .eq("id", inboxMessageId)
    .eq("recipient_id", userId);
}

export async function sendOwnershipTransferInvite(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    fromUserId: string;
    toUserId: string;
    newRole: OwnershipTransferRole;
    optionalMessage?: string;
  },
): Promise<OwnershipTransferRow | null> {
  const { data: existingPending } = await supabase
    .from("ownership_transfers")
    .select("id")
    .eq("club_id", params.clubId)
    .eq("from_user_id", params.fromUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    console.error("A pending ownership transfer already exists for this club.");
    return null;
  }

  const { data, error } = await supabase
    .from("ownership_transfers")
    .insert({
      club_id: params.clubId,
      from_user_id: params.fromUserId,
      to_user_id: params.toUserId,
      new_role: params.newRole,
      optional_message: params.optionalMessage?.trim() || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create ownership transfer:", error?.message);
    return null;
  }

  const transfer = mapOwnershipTransferRow(data as Record<string, unknown>);
  const roleLabel = ownershipRoleLabel(params.newRole);
  const body = [
    `You have been invited to become ${roleLabel} of ${params.clubName}.`,
    params.optionalMessage?.trim() || null,
    "Accept or decline this transfer in your Dashboard Inbox.",
  ]
    .filter(Boolean)
    .join("\n\n");

  await createInboxMessage(supabase, {
    recipientId: params.toUserId,
    senderId: params.fromUserId,
    type: "ownership_transfer",
    title: `Ownership transfer — ${params.clubName}`,
    message: body,
    actionRequired: true,
    actionType: "ownership_transfer_response",
    actionData: {
      transferId: transfer.id,
      clubId: params.clubId,
      newRole: params.newRole,
      path: "/app",
    },
    clubId: params.clubId,
    referenceId: transfer.id,
    referenceType: "ownership_transfer",
  });

  await createNotification(supabase, {
    userId: params.toUserId,
    type: "club_update",
    message: `You have been invited to become ${roleLabel} of ${params.clubName}.`,
    clubId: params.clubId,
    referenceId: transfer.id,
  });

  return transfer;
}

export async function resendOwnershipTransferReminder(
  supabase: SupabaseClient,
  transfer: OwnershipTransferRow,
  clubName: string,
): Promise<boolean> {
  const roleLabel = ownershipRoleLabel(transfer.newRole);
  const body = [
    `Reminder: your invitation to become ${roleLabel} of ${clubName} is still pending.`,
    transfer.optionalMessage || null,
  ]
    .filter(Boolean)
    .join("\n\n");

  await createInboxMessage(supabase, {
    recipientId: transfer.toUserId,
    senderId: transfer.fromUserId,
    type: "ownership_transfer",
    title: `Reminder — ownership transfer for ${clubName}`,
    message: body,
    actionRequired: true,
    actionType: "ownership_transfer_response",
    actionData: {
      transferId: transfer.id,
      clubId: transfer.clubId,
      newRole: transfer.newRole,
      path: "/app",
    },
    clubId: transfer.clubId,
    referenceId: transfer.id,
    referenceType: "ownership_transfer",
  });

  await createNotification(supabase, {
    userId: transfer.toUserId,
    type: "club_update",
    message: `Reminder: accept or decline the ${roleLabel} role for ${clubName}.`,
    clubId: transfer.clubId,
    referenceId: transfer.id,
  });

  return true;
}

export async function cancelOwnershipTransfer(
  supabase: SupabaseClient,
  transferId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("ownership_transfers")
    .update({
      status: "canceled",
      responded_at: new Date().toISOString(),
    })
    .eq("id", transferId)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to cancel ownership transfer:", error.message);
    return false;
  }

  return true;
}

export async function acceptOwnershipTransfer(
  supabase: SupabaseClient,
  params: {
    transferId: string;
    recipientUserId: string;
    inboxMessageId?: string;
    clubName: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { data: transferRow, error: fetchError } = await supabase
    .from("ownership_transfers")
    .select("*")
    .eq("id", params.transferId)
    .eq("to_user_id", params.recipientUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError || !transferRow) {
    return { ok: false, error: "This transfer request is no longer available." };
  }

  const transfer = mapOwnershipTransferRow(transferRow as Record<string, unknown>);
  const now = new Date().toISOString();

  const { error: transferError } = await supabase
    .from("ownership_transfers")
    .update({ status: "accepted", responded_at: now })
    .eq("id", transfer.id);

  if (transferError) {
    return { ok: false, error: "Failed to accept ownership transfer." };
  }

  const { error: memberError } = await supabase
    .from("club_members")
    .update({ role: "owner", access_level: "president" })
    .eq("club_id", transfer.clubId)
    .eq("user_id", transfer.toUserId);

  if (memberError) {
    return { ok: false, error: "Transfer accepted but member role could not be updated." };
  }

  const recipientTitle =
    transfer.newRole === "co_president" ? "Co-President" : "President";
  await supabase
    .from("club_members")
    .update({ title: recipientTitle })
    .eq("club_id", transfer.clubId)
    .eq("user_id", transfer.toUserId);

  if (params.inboxMessageId) {
    await markInboxActionCompleted(supabase, params.inboxMessageId, params.recipientUserId);
  }

  const roleLabel = ownershipRoleLabel(transfer.newRole);

  await createInboxMessage(supabase, {
    recipientId: transfer.fromUserId,
    senderId: transfer.toUserId,
    type: "ownership_transfer",
    title: `Ownership transfer accepted — ${params.clubName}`,
    message: `${params.clubName}'s transfer was accepted. Choose what role you would like going forward.`,
    actionRequired: true,
    actionType: "former_owner_role_choice",
    actionData: {
      transferId: transfer.id,
      clubId: transfer.clubId,
      path: "/app",
    },
    clubId: transfer.clubId,
    referenceId: transfer.id,
    referenceType: "ownership_transfer",
  });

  await createNotification(supabase, {
    userId: transfer.fromUserId,
    type: "club_update",
    message: `Your ownership transfer for ${params.clubName} was accepted. Choose your next role in Inbox.`,
    clubId: transfer.clubId,
    referenceId: transfer.id,
  });

  await createNotification(supabase, {
    userId: transfer.toUserId,
    type: "club_update",
    message: `You are now ${roleLabel} of ${params.clubName}.`,
    clubId: transfer.clubId,
    referenceId: transfer.id,
  });

  return { ok: true };
}

export async function declineOwnershipTransfer(
  supabase: SupabaseClient,
  params: {
    transferId: string;
    recipientUserId: string;
    inboxMessageId?: string;
    clubName: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { data: transferRow, error: fetchError } = await supabase
    .from("ownership_transfers")
    .select("*")
    .eq("id", params.transferId)
    .eq("to_user_id", params.recipientUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError || !transferRow) {
    return { ok: false, error: "This transfer request is no longer available." };
  }

  const transfer = mapOwnershipTransferRow(transferRow as Record<string, unknown>);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("ownership_transfers")
    .update({ status: "declined", responded_at: now })
    .eq("id", transfer.id);

  if (error) {
    return { ok: false, error: "Failed to decline ownership transfer." };
  }

  if (params.inboxMessageId) {
    await markInboxActionCompleted(supabase, params.inboxMessageId, params.recipientUserId);
  }

  await createInboxMessage(supabase, {
    recipientId: transfer.fromUserId,
    senderId: params.recipientUserId,
    type: "ownership_transfer",
    title: `Ownership transfer declined — ${params.clubName}`,
    message: `Your ownership transfer invitation for ${params.clubName} was declined.`,
    clubId: transfer.clubId,
    referenceId: transfer.id,
    referenceType: "ownership_transfer",
  });

  await createNotification(supabase, {
    userId: transfer.fromUserId,
    type: "club_update",
    message: `Your ownership transfer for ${params.clubName} was declined.`,
    clubId: transfer.clubId,
    referenceId: transfer.id,
  });

  return { ok: true };
}

function choiceToMemberUpdate(choice: FormerOwnerChoice): {
  role: MemberRole;
  accessLevel: AccessLevel;
  title: string | null;
  leave: boolean;
} {
  switch (choice) {
    case "stay_co_president":
      return {
        role: "owner",
        accessLevel: "president",
        title: "Co-President",
        leave: false,
      };
    case "executive":
      return {
        role: "executive",
        accessLevel: "executive",
        title: null,
        leave: false,
      };
    case "member":
      return { role: "member", accessLevel: "member", title: null, leave: false };
    case "leave":
    default:
      return { role: "member", accessLevel: "member", title: null, leave: true };
  }
}

export async function applyFormerOwnerChoice(
  supabase: SupabaseClient,
  params: {
    transferId: string;
    userId: string;
    choice: FormerOwnerChoice;
    inboxMessageId?: string;
    clubName: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { data: transferRow, error: fetchError } = await supabase
    .from("ownership_transfers")
    .select("*")
    .eq("id", params.transferId)
    .eq("from_user_id", params.userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (fetchError || !transferRow) {
    return { ok: false, error: "This follow-up is no longer available." };
  }

  const transfer = mapOwnershipTransferRow(transferRow as Record<string, unknown>);
  const update = choiceToMemberUpdate(params.choice);

  if (update.leave) {
    const { error: deleteError } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", transfer.clubId)
      .eq("user_id", params.userId);

    if (deleteError) {
      return { ok: false, error: "Failed to leave the club." };
    }
  } else {
    const { error: memberError } = await supabase
      .from("club_members")
      .update({
        role: update.role,
        access_level: update.accessLevel,
        title: update.title,
      })
      .eq("club_id", transfer.clubId)
      .eq("user_id", params.userId);

    if (memberError) {
      return { ok: false, error: "Failed to update your role." };
    }
  }

  if (params.inboxMessageId) {
    await markInboxActionCompleted(supabase, params.inboxMessageId, params.userId);
  }

  await createNotification(supabase, {
    userId: transfer.toUserId,
    type: "club_update",
    message: `The previous president updated their role for ${params.clubName}.`,
    clubId: transfer.clubId,
    referenceId: transfer.id,
  });

  return { ok: true };
}

export const FORMER_OWNER_CHOICE_OPTIONS: {
  value: FormerOwnerChoice;
  label: string;
}[] = [
  { value: "stay_co_president", label: "Stay as Co-President" },
  { value: "executive", label: "Step down to Executive" },
  { value: "member", label: "Step down to General Member" },
  { value: "leave", label: "Leave club" },
];
