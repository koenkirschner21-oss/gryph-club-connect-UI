import type { SupabaseClient } from "@supabase/supabase-js";

export type InboxMessageType =
  | "interview_invite"
  | "interview_confirmed"
  | "role_offer"
  | "club_invite"
  | "executive_invite"
  | "ownership_transfer"
  | "join_approved"
  | "join_rejected"
  | "club_claim_approved"
  | "club_claim_rejected"
  | "club_request_approved"
  | "club_request_rejected"
  | "application_update"
  | "offer_accepted"
  | "offer_declined"
  | "admin_message"
  | "candidate_selected_time"
  | "invite_accepted"
  | "invite_declined"
  | "role_updated"
  | "system_message";

export type InboxFilter =
  | "all"
  | "unread"
  | "action_required"
  | "applications"
  | "invites"
  | "club_updates"
  | "admin";

export interface InboxMessage {
  id: string;
  recipientId: string;
  senderId?: string;
  type: InboxMessageType;
  title: string;
  message: string;
  actionRequired: boolean;
  actionCompleted: boolean;
  actionType?: string;
  actionData: Record<string, unknown>;
  clubId?: string;
  clubName?: string;
  referenceId?: string;
  referenceType?: string;
  read: boolean;
  createdAt: string;
}

const APPLICATION_TYPES = new Set<InboxMessageType>([
  "interview_invite",
  "interview_confirmed",
  "role_offer",
  "application_update",
  "offer_accepted",
  "offer_declined",
  "candidate_selected_time",
]);

const INVITE_TYPES = new Set<InboxMessageType>([
  "club_invite",
  "executive_invite",
  "invite_accepted",
  "invite_declined",
]);

const CLUB_UPDATE_TYPES = new Set<InboxMessageType>([
  "join_approved",
  "join_rejected",
  "club_claim_approved",
  "club_claim_rejected",
  "club_request_approved",
  "club_request_rejected",
  "ownership_transfer",
  "role_updated",
]);

const ADMIN_TYPES = new Set<InboxMessageType>(["admin_message", "system_message"]);

export function mapInboxRow(row: Record<string, unknown>): InboxMessage {
  const clubRaw = row.clubs as { name?: string } | { name?: string }[] | null | undefined;
  const clubRecord = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;

  return {
    id: row.id as string,
    recipientId: row.recipient_id as string,
    senderId: (row.sender_id as string | null) ?? undefined,
    type: row.type as InboxMessageType,
    title: (row.title as string) ?? "",
    message: (row.message as string) ?? "",
    actionRequired: Boolean(row.action_required),
    actionCompleted: Boolean(row.action_completed),
    actionType: (row.action_type as string | null) ?? undefined,
    actionData: (row.action_data as Record<string, unknown>) ?? {},
    clubId: (row.club_id as string | null) ?? undefined,
    clubName: (clubRecord?.name as string | undefined) ?? undefined,
    referenceId: (row.reference_id as string | null) ?? undefined,
    referenceType: (row.reference_type as string | null) ?? undefined,
    read: Boolean(row.read),
    createdAt: (row.created_at as string) ?? "",
  };
}

export function filterInboxMessages(
  messages: InboxMessage[],
  filter: InboxFilter,
): InboxMessage[] {
  switch (filter) {
    case "unread":
      return messages.filter((message) => !message.read);
    case "action_required":
      return messages.filter(
        (message) => message.actionRequired && !message.actionCompleted,
      );
    case "applications":
      return messages.filter((message) => APPLICATION_TYPES.has(message.type));
    case "invites":
      return messages.filter((message) => INVITE_TYPES.has(message.type));
    case "club_updates":
      return messages.filter((message) => CLUB_UPDATE_TYPES.has(message.type));
    case "admin":
      return messages.filter((message) => ADMIN_TYPES.has(message.type));
    default:
      return messages;
  }
}

export function inboxEmptyMessage(): string {
  return "No messages here yet";
}

export function resolveInboxLink(message: InboxMessage): string {
  const actionPath =
    typeof message.actionData.path === "string"
      ? message.actionData.path.trim()
      : "";
  if (actionPath) return actionPath;

  if (message.actionType === "view_claim_status") {
    const claimId =
      (typeof message.actionData.claimId === "string" &&
        message.actionData.claimId.trim()) ||
      message.referenceId;
    if (claimId) return `/claim-status/${claimId}`;
  }

  if (message.actionType === "view_club_request_status") {
    return "/app";
  }

  if (message.actionType === "review_club_request") {
    const requestId =
      (typeof message.actionData.requestId === "string" &&
        message.actionData.requestId.trim()) ||
      message.referenceId;
    return requestId
      ? `/app/admin?tab=requests&request=${requestId}`
      : "/app/admin?tab=requests";
  }

  if (message.actionType === "review_claim_request") {
    return "/app/admin?tab=claims";
  }

  if (message.actionType === "claim_more_info") {
    const claimId =
      (typeof message.actionData.claimId === "string" &&
        message.actionData.claimId.trim()) ||
      message.referenceId;
    if (claimId) return `/claim-status/${claimId}`;
  }

  const clubBase = message.clubId ? `/app/clubs/${message.clubId}` : null;

  if (message.actionType === "review_hiring_application") {
    return clubBase ? `${clubBase}/recruiting` : "/app";
  }

  switch (message.type) {
    case "join_rejected":
      return "/explore";
    case "club_claim_rejected":
      return "/explore";
    case "club_request_rejected":
      return "/explore";
    case "club_claim_approved":
    case "club_request_approved":
      return clubBase ?? "/app";
    case "admin_message":
    case "system_message":
      return "/app/settings";
    case "interview_invite":
    case "interview_confirmed":
    case "role_offer":
    case "application_update":
    case "offer_accepted":
    case "offer_declined":
    case "candidate_selected_time":
      return clubBase ? `${clubBase}/recruiting` : "/app";
    case "club_invite":
    case "executive_invite":
    case "invite_accepted":
    case "invite_declined":
      return clubBase ?? "/app/join";
    default:
      return clubBase ?? "/app";
  }
}

export interface CreateInboxMessageInput {
  recipientId: string;
  senderId?: string | null;
  type: InboxMessageType | string;
  title: string;
  message: string;
  actionRequired?: boolean;
  actionType?: string | null;
  actionData?: Record<string, unknown>;
  clubId?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
}

export async function createInboxMessage(
  supabase: SupabaseClient,
  input: CreateInboxMessageInput,
): Promise<boolean> {
  const row = {
    recipient_id: input.recipientId,
    sender_id: input.senderId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    action_required: input.actionRequired ?? false,
    action_type: input.actionType ?? null,
    action_data: input.actionData ?? {},
    club_id: input.clubId ?? null,
    reference_id: input.referenceId ?? null,
    reference_type: input.referenceType ?? null,
    read: false,
  };

  const { error: rpcError } = await supabase.rpc("send_inbox_messages", {
    p_messages: [row],
  });

  if (!rpcError) {
    return true;
  }

  const { error } = await supabase.from("inbox_messages").insert(row);

  if (error) {
    console.error(
      "Failed to create inbox message:",
      error.message,
      rpcError.message ? `(RPC: ${rpcError.message})` : "",
    );
    return false;
  }

  return true;
}
