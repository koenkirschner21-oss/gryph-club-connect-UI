import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUsers } from "./notifyUsers";
import { createInboxMessage } from "./inboxUtils";
import { accessLevelBadgeLabel } from "./memberRoleTitle";
import type { AccessLevel, NotificationType } from "../types";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  message: string;
  clubId?: string;
  referenceId?: string;
}

export async function createNotification(
  _supabase: SupabaseClient,
  input: CreateNotificationInput,
): Promise<boolean> {
  return createNotifications(_supabase, [input]);
}

export async function createNotifications(
  _supabase: SupabaseClient,
  inputs: CreateNotificationInput[],
): Promise<boolean> {
  if (inputs.length === 0) return true;

  const ok = await notifyUsers(
    inputs.map((input) => ({
      user_id: input.userId,
      type: input.type,
      message: input.message,
      club_id: input.clubId,
      reference_id: input.referenceId,
    })),
  );

  if (!ok) {
    console.error(
      "createNotifications failed for",
      inputs.length,
      "notification(s):",
      inputs.map((input) => ({ userId: input.userId, type: input.type })),
    );
  }

  return ok;
}

export function resolveStudentDisplayName(
  fullName?: string | null,
  email?: string | null,
): string {
  const trimmedName = fullName?.trim();
  if (trimmedName) return trimmedName;
  const trimmedEmail = email?.trim();
  if (trimmedEmail) return trimmedEmail.split("@")[0] || "A student";
  return "A student";
}

async function fetchClubMemberRowId(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.id as string | undefined) ?? undefined;
}

async function fetchClubOwnerUserIds(
  supabase: SupabaseClient,
  clubId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("role", "owner")
    .eq("status", "active");

  if (error) {
    console.error("Failed to load club owners for notifications:", error.message);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.user_id as string)
        .filter((id) => Boolean(id)),
    ),
  );
}

async function fetchClubExecutiveUserIds(
  supabase: SupabaseClient,
  clubId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .in("role", ["owner", "executive", "admin", "exec"])
    .eq("status", "active");

  if (error) {
    console.error("Failed to load club executives for notifications:", error.message);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.user_id as string)
        .filter((id) => Boolean(id)),
    ),
  );
}

export async function notifyJoinRequestSubmitted(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    studentUserId: string;
    studentName: string;
  },
): Promise<void> {
  const memberRowId = await fetchClubMemberRowId(
    supabase,
    params.clubId,
    params.studentUserId,
  );

  const notifications: CreateNotificationInput[] = [
    {
      userId: params.studentUserId,
      type: "join_request_submitted",
      message: `Your request to join ${params.clubName} has been sent for review.`,
      clubId: params.clubId,
      referenceId: memberRowId,
    },
  ];

  const executiveIds = await fetchClubExecutiveUserIds(supabase, params.clubId);
  for (const executiveId of executiveIds) {
    if (executiveId === params.studentUserId) continue;
    notifications.push({
      userId: executiveId,
      type: "new_join_request",
      message: `${params.studentName} requested to join ${params.clubName}.`,
      clubId: params.clubId,
      referenceId: memberRowId,
    });
  }

  const ok = await createNotifications(supabase, notifications);
  if (!ok) {
    console.error("Failed to send join request notifications.");
  }
}

export async function notifyJoinRequestApproved(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    studentUserId: string;
  },
): Promise<void> {
  const message = `You've been approved to join ${params.clubName}! Welcome aboard.`;

  const ok = await createNotification(supabase, {
    userId: params.studentUserId,
    type: "join_approved",
    message,
    clubId: params.clubId,
  });
  if (!ok) {
    console.error("Failed to send join approval notification.");
  }

  await createInboxMessage(supabase, {
    recipientId: params.studentUserId,
    type: "join_approved",
    title: "Join Request Approved",
    message,
    clubId: params.clubId,
  });
}

export async function notifyExecutiveInviteRequest(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    requesterUserId: string;
    requesterName: string;
    accessLevel: AccessLevel;
    roleTitle: string;
    message?: string;
  },
): Promise<void> {
  const accessLabel = accessLevelBadgeLabel(params.accessLevel);
  const rolePart = params.roleTitle.trim()
    ? `${accessLabel} (${params.roleTitle.trim()})`
    : accessLabel;
  const messageSuffix = params.message?.trim()
    ? ` Message: "${params.message.trim()}"`
    : "";

  const ownerIds = await fetchClubOwnerUserIds(supabase, params.clubId);
  if (ownerIds.length === 0) return;

  const notifications: CreateNotificationInput[] = ownerIds
    .filter((ownerId) => ownerId !== params.requesterUserId)
    .map((ownerId) => ({
      userId: ownerId,
      type: "club_update",
      message: `${params.requesterName} requested an executive invite to ${params.clubName} as ${rolePart}.${messageSuffix}`,
      clubId: params.clubId,
    }));

  const ok = await createNotifications(supabase, notifications);
  if (!ok) {
    console.error("Failed to send executive invite request notifications.");
  }
}

export async function notifyJoinRequestRejected(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    studentUserId: string;
  },
): Promise<void> {
  const ok = await createNotification(supabase, {
    userId: params.studentUserId,
    type: "join_rejected",
    message: `Your request to join ${params.clubName} was not approved at this time.`,
    clubId: params.clubId,
  });
  if (!ok) {
    console.error("Failed to send join rejection notification.");
  }
}

export async function notifyClaimRequestSubmitted(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    clubSlug?: string;
    submitterName: string;
    submitterUserId: string;
    claimRequestId?: string;
  },
): Promise<void> {
  const claimantInboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "system_message",
    title: `Claim request submitted — ${params.clubName}`,
    message: `Your claim request for ${params.clubName} has been submitted and is currently under review. We'll notify you once a decision has been made.`,
    actionRequired: false,
    actionType: "view_claim_status",
    actionData: {
      claimId: params.claimRequestId,
      clubSlug: params.clubSlug,
    },
    clubId: params.clubId,
    referenceId: params.claimRequestId,
    referenceType: "club_claim_request",
  });
  if (!claimantInboxOk) {
    console.error("Failed to create claimant claim submission inbox message.");
  }

  const claimantBellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "claim_submitted",
    message: `Your claim request for ${params.clubName} has been submitted and is under review.`,
    clubId: params.clubId,
    referenceId: params.claimRequestId,
  });
  if (!claimantBellOk) {
    console.error("Failed to create claimant claim submission notification.");
  }

  const { data: admins, error: adminsError } = await supabase
    .from("platform_admins")
    .select("user_id");

  if (adminsError) {
    console.error("Failed to load platform admins:", adminsError.message);
    return;
  }

  const adminIds = (admins ?? [])
    .map((row) => row.user_id as string)
    .filter(Boolean);

  if (adminIds.length === 0) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", adminIds);

  const uoguelphAdminIds = new Set(
    (profiles ?? [])
      .filter((profile) => {
        const email = (profile.email as string | null)?.trim().toLowerCase() ?? "";
        return email.endsWith("@uoguelph.ca");
      })
      .map((profile) => profile.id as string),
  );

  const recipientIds =
    uoguelphAdminIds.size > 0
      ? adminIds.filter((id) => uoguelphAdminIds.has(id))
      : adminIds;

  const adminBellOk = await createNotifications(
    supabase,
    recipientIds.map((userId) => ({
      userId,
      type: "new_claim_request",
      message: `New club claim submitted for ${params.clubName} by ${params.submitterName}.`,
      clubId: params.clubId,
      referenceId: params.claimRequestId,
    })),
  );
  if (!adminBellOk) {
    console.error("Failed to send admin claim request notifications.");
  }

  for (const adminId of recipientIds) {
    const inboxOk = await createInboxMessage(supabase, {
      recipientId: adminId,
      type: "admin_message",
      title: `New club claim — ${params.clubName}`,
      message: `${params.submitterName} has submitted a claim request for ${params.clubName}. Review it in the admin panel.`,
      actionRequired: true,
      actionType: "review_claim_request",
      actionData: { path: "/app/admin" },
      clubId: params.clubId,
      referenceId: params.claimRequestId,
      referenceType: "club_claim_request",
    });
    if (!inboxOk) {
      console.error("Failed to create admin claim request inbox message for:", adminId);
    }
  }
}
