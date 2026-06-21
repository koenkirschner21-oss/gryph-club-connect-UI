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

  const inboxTitle = `Join request submitted — ${params.clubName}`;
  const inboxMessage = `Your request to join ${params.clubName} has been submitted and is waiting for approval.`;

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.studentUserId,
    type: "join_request_submitted",
    title: inboxTitle,
    message: inboxMessage,
    clubId: params.clubId,
    referenceId: memberRowId,
    referenceType: "club_member",
  });

  if (!inboxOk) {
    console.error("Failed to create join request submission inbox message.");
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

async function fetchClubPresidentUserIds(
  supabase: SupabaseClient,
  clubId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("status", "active")
    .or("role.eq.owner,access_level.eq.president");

  if (error) {
    console.error("Failed to load club presidents for notifications:", error.message);
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

async function fetchHiringListingReviewerUserIds(
  supabase: SupabaseClient,
  clubId: string,
  listingId: string,
): Promise<string[]> {
  const { data: listing, error: listingError } = await supabase
    .from("hiring_listings")
    .select("reviewer_ids")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) {
    console.error(
      "Failed to load hiring listing reviewers for notifications:",
      listingError.message,
    );
    return fetchClubPresidentUserIds(supabase, clubId);
  }

  const designated = Array.isArray(listing?.reviewer_ids)
    ? (listing.reviewer_ids as string[]).filter(Boolean)
    : [];

  const presidentIds = await fetchClubPresidentUserIds(supabase, clubId);
  return Array.from(new Set([...presidentIds, ...designated]));
}

export async function notifyHiringApplicationSubmitted(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    listingId: string;
    applicationId: string;
    roleTitle: string;
    applicantUserId: string;
    applicantName: string;
  },
): Promise<void> {
  const applicantMessage = `Your application for ${params.roleTitle} at ${params.clubName} has been submitted. The club team will review it.`;
  const reviewPath = `/app/clubs/${params.clubId}/recruiting?listing=${params.listingId}&application=${params.applicationId}`;

  const applicantBellOk = await createNotification(supabase, {
    userId: params.applicantUserId,
    type: "club_update",
    message: applicantMessage,
    clubId: params.clubId,
    referenceId: params.applicationId,
  });
  if (!applicantBellOk) {
    console.error("Failed to send applicant hiring submission notification.");
  }

  const applicantInboxOk = await createInboxMessage(supabase, {
    recipientId: params.applicantUserId,
    type: "application_update",
    title: `Application submitted — ${params.roleTitle}`,
    message: applicantMessage,
    clubId: params.clubId,
    referenceId: params.applicationId,
    referenceType: "hiring_application",
  });
  if (!applicantInboxOk) {
    console.error("Failed to create applicant hiring submission inbox message.");
  }

  const reviewerMessage = `${params.applicantName} applied for ${params.roleTitle}.`;
  const reviewerIds = await fetchHiringListingReviewerUserIds(
    supabase,
    params.clubId,
    params.listingId,
  );

  for (const reviewerId of reviewerIds) {
    if (reviewerId === params.applicantUserId) continue;

    const reviewerBellOk = await createNotification(supabase, {
      userId: reviewerId,
      type: "club_update",
      message: reviewerMessage,
      clubId: params.clubId,
      referenceId: params.applicationId,
    });
    if (!reviewerBellOk) {
      console.error("Failed to send hiring reviewer notification for:", reviewerId);
    }

    const reviewerInboxOk = await createInboxMessage(supabase, {
      recipientId: reviewerId,
      type: "admin_message",
      title: `New application — ${params.roleTitle}`,
      message: reviewerMessage,
      actionRequired: true,
      actionType: "review_hiring_application",
      actionData: {
        path: reviewPath,
        listingId: params.listingId,
        applicationId: params.applicationId,
      },
      clubId: params.clubId,
      referenceId: params.applicationId,
      referenceType: "hiring_application",
    });
    if (!reviewerInboxOk) {
      console.error("Failed to create hiring reviewer inbox message for:", reviewerId);
    }
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

async function fetchPlatformAdminUserIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase.from("platform_admins").select("user_id");

  if (error) {
    console.error("Failed to load platform admins:", error.message);
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
  const claimantMessage = `Your claim for ${params.clubName} has been submitted and is under review.`;

  const claimantInboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "system_message",
    title: `Claim submitted — ${params.clubName}`,
    message: claimantMessage,
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
    message: claimantMessage,
    clubId: params.clubId,
    referenceId: params.claimRequestId,
  });
  if (!claimantBellOk) {
    console.error("Failed to create claimant claim submission notification.");
  }

  const adminIds = await fetchPlatformAdminUserIds(supabase);
  if (adminIds.length === 0) return;

  const adminMessage = `${params.submitterName} submitted a claim for ${params.clubName}.`;

  const adminBellOk = await createNotifications(
    supabase,
    adminIds.map((userId) => ({
      userId,
      type: "new_claim_request",
      message: adminMessage,
      clubId: params.clubId,
      referenceId: params.claimRequestId,
    })),
  );
  if (!adminBellOk) {
    console.error("Failed to send admin claim request notifications.");
  }

  for (const adminId of adminIds) {
    const inboxOk = await createInboxMessage(supabase, {
      recipientId: adminId,
      type: "admin_message",
      title: `New club claim — ${params.clubName}`,
      message: adminMessage,
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

export async function notifyClaimRequestApproved(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    submitterUserId: string;
    claimRequestId: string;
  },
): Promise<void> {
  const message = `Your claim for ${params.clubName} has been approved.`;

  const bellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "claim_approved",
    message,
    clubId: params.clubId,
    referenceId: params.claimRequestId,
  });
  if (!bellOk) {
    console.error("Failed to send claim approval notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "club_claim_approved",
    title: `Club claim approved — ${params.clubName}`,
    message,
    actionRequired: false,
    actionType: "open_club_dashboard",
    actionData: {
      path: `/app/clubs/${params.clubId}`,
      actionLabel: "Open Club Dashboard",
    },
    clubId: params.clubId,
    referenceId: params.claimRequestId,
    referenceType: "club_claim_request",
  });
  if (!inboxOk) {
    console.error("Failed to create claim approval inbox message.");
  }
}

export async function notifyClaimRequestRejected(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    clubSlug?: string;
    submitterUserId: string;
    claimRequestId: string;
  },
): Promise<void> {
  const message = `Your claim for ${params.clubName} was not approved at this time.`;
  const profilePath = params.clubSlug
    ? `/clubs/${params.clubSlug}`
    : "/explore";

  const bellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "claim_rejected",
    message,
    clubId: params.clubId,
    referenceId: params.claimRequestId,
  });
  if (!bellOk) {
    console.error("Failed to send claim rejection notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "club_claim_rejected",
    title: `Club claim declined — ${params.clubName}`,
    message,
    actionRequired: false,
    actionType: "view_club_profile",
    actionData: {
      path: profilePath,
      actionLabel: "View Club Profile",
    },
    clubId: params.clubId,
    referenceId: params.claimRequestId,
    referenceType: "club_claim_request",
  });
  if (!inboxOk) {
    console.error("Failed to create claim rejection inbox message.");
  }
}

export async function notifyClaimRequestMoreInfo(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    clubSlug?: string;
    submitterUserId: string;
    claimRequestId: string;
    note: string;
  },
): Promise<void> {
  const trimmedNote = params.note.trim();
  const message = trimmedNote
    ? `More information is needed for your claim for ${params.clubName}: ${trimmedNote}`
    : `More information is needed for your claim for ${params.clubName}.`;

  const bellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "claim_more_info",
    message,
    clubId: params.clubId,
    referenceId: params.claimRequestId,
  });
  if (!bellOk) {
    console.error("Failed to send claim more-info notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "system_message",
    title: `More info needed — ${params.clubName}`,
    message,
    actionRequired: true,
    actionType: "claim_more_info",
    actionData: {
      claimId: params.claimRequestId,
      clubSlug: params.clubSlug,
      path: params.claimRequestId
        ? `/claim-status/${params.claimRequestId}`
        : undefined,
    },
    clubId: params.clubId,
    referenceId: params.claimRequestId,
    referenceType: "club_claim_request",
  });
  if (!inboxOk) {
    console.error("Failed to create claim more-info inbox message.");
  }
}
