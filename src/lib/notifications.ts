import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUsers } from "./notifyUsers";
import type { NotificationType } from "../types";

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

  return notifyUsers(
    inputs.map((input) => ({
      user_id: input.userId,
      type: input.type,
      message: input.message,
      club_id: input.clubId,
      reference_id: input.referenceId,
    })),
  );
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
  const ok = await createNotification(supabase, {
    userId: params.studentUserId,
    type: "join_approved",
    message: `You've been approved to join ${params.clubName}! Welcome aboard.`,
    clubId: params.clubId,
  });
  if (!ok) {
    console.error("Failed to send join approval notification.");
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
    submitterName: string;
  },
): Promise<void> {
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

  const ok = await createNotifications(
    supabase,
    recipientIds.map((userId) => ({
      userId,
      type: "new_claim_request",
      message: `${params.submitterName} submitted a claim request for ${params.clubName}.`,
      clubId: params.clubId,
    })),
  );

  if (!ok) {
    console.error("Failed to send claim request notifications.");
  }
}
