import type { SupabaseClient } from "@supabase/supabase-js";
import { createInboxMessage } from "./inboxUtils";
import { createNotification } from "./notifications";

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
  formerOwnerChoiceAt: string | null;
  formerOwnerChoice: FormerOwnerChoice | null;
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
    formerOwnerChoiceAt: (row.former_owner_choice_at as string | null) ?? null,
    formerOwnerChoice: (row.former_owner_choice as FormerOwnerChoice | null) ?? null,
  };
}

function isFormerOwnerChoiceAlreadyAppliedError(message: string | undefined): boolean {
  return Boolean(message?.includes("former_owner_choice_already_applied"));
}

function initiateTransferRpcErrorMessage(message: string | undefined): string {
  if (!message) return "Failed to send transfer request. Please try again.";
  if (message.includes("not_club_president")) {
    return "Only the club president can initiate an ownership transfer.";
  }
  if (message.includes("recipient_not_active_member")) {
    return "The selected member is not an active club member.";
  }
  if (message.includes("pending_transfer_exists")) {
    return "A pending ownership transfer already exists for this club.";
  }
  if (message.includes("cannot_transfer_to_self")) {
    return "You cannot transfer ownership to yourself.";
  }
  if (message.includes("invalid_new_role")) {
    return "Invalid role selected for the transfer.";
  }
  return "Failed to send transfer request. Please try again.";
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
): Promise<{ transfer: OwnershipTransferRow | null; error?: string }> {
  const { data, error } = await supabase.rpc("initiate_ownership_transfer", {
    p_club_id: params.clubId,
    p_to_user_id: params.toUserId,
    p_new_role: params.newRole,
    p_optional_message: params.optionalMessage?.trim() || null,
  });

  if (error || !data) {
    const message = initiateTransferRpcErrorMessage(error?.message);
    console.error("Failed to create ownership transfer:", error?.message ?? message);
    return { transfer: null, error: message };
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
      path: `/ownership-transfer/${transfer.id}`,
    },
    clubId: params.clubId,
    referenceId: transfer.id,
    referenceType: "ownership_transfer",
  });

  await createNotification(supabase, {
    userId: params.toUserId,
    type: "club_update",
    message: `[Ownership Transfer] You have been invited to become ${roleLabel} of ${params.clubName}.`,
    clubId: params.clubId,
    referenceId: transfer.id,
  });

  return { transfer };
}

export async function syncFormerOwnerChoiceInboxIfCompleted(
  supabase: SupabaseClient,
  params: {
    transferId: string;
    inboxMessageId: string;
    userId: string;
  },
): Promise<boolean> {
  const { data } = await supabase
    .from("ownership_transfers")
    .select("former_owner_choice_at")
    .eq("id", params.transferId)
    .eq("from_user_id", params.userId)
    .eq("status", "accepted")
    .maybeSingle();

  if (!data?.former_owner_choice_at) {
    return false;
  }

  await markInboxActionCompleted(supabase, params.inboxMessageId, params.userId);
  return true;
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
      path: `/ownership-transfer/${transfer.id}`,
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
  const { data: transferRow } = await supabase
    .from("ownership_transfers")
    .select("to_user_id, club_id")
    .eq("id", transferId)
    .eq("status", "pending")
    .maybeSingle();

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

  if (transferRow?.to_user_id) {
    await supabase
      .from("inbox_messages")
      .update({ action_completed: true, read: true })
      .eq("reference_id", transferId)
      .eq("recipient_id", transferRow.to_user_id as string)
      .eq("action_completed", false);
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

  const { error: rpcError } = await supabase.rpc("accept_ownership_transfer", {
    p_transfer_id: transfer.id,
  });

  if (rpcError) {
    console.error("Failed to accept ownership transfer:", rpcError.message);
    return { ok: false, error: "Failed to accept ownership transfer." };
  }

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
      path: `/ownership-transfer/${transfer.id}`,
    },
    clubId: transfer.clubId,
    referenceId: transfer.id,
    referenceType: "ownership_transfer",
  });

  await createNotification(supabase, {
    userId: transfer.fromUserId,
    type: "club_update",
    message: `[Ownership Transfer] Your ownership transfer for ${params.clubName} was accepted. Choose your next role.`,
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

  const { error: rpcError } = await supabase.rpc("decline_ownership_transfer", {
    p_transfer_id: transfer.id,
  });

  if (rpcError) {
    console.error("Failed to decline ownership transfer:", rpcError.message);
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

  if (transfer.formerOwnerChoiceAt) {
    if (params.inboxMessageId) {
      await markInboxActionCompleted(supabase, params.inboxMessageId, params.userId);
    }
    return { ok: true };
  }

  const { error: rpcError } = await supabase.rpc("apply_former_owner_role_choice", {
    p_transfer_id: transfer.id,
    p_choice: params.choice,
  });

  if (rpcError) {
    if (isFormerOwnerChoiceAlreadyAppliedError(rpcError.message)) {
      if (params.inboxMessageId) {
        await markInboxActionCompleted(supabase, params.inboxMessageId, params.userId);
      }
      return { ok: true };
    }
    console.error("Failed to apply former owner role choice:", rpcError.message);
    return { ok: false, error: "Failed to update your role." };
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
