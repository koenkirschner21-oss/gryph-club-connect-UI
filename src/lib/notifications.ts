import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUsers } from "./notifyUsers";
import { createInboxMessage } from "./inboxUtils";
import { accessLevelBadgeLabel } from "./memberRoleTitle";
import type { AccessLevel, NotificationType, Visibility } from "../types";
import { canViewContent } from "./contentVisibility";
import { isExecutiveAccessLevel } from "./clubPermissions";
import { fetchHiringNotificationRecipients } from "./hiringNotificationRecipients";

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
  const reviewerIds = await fetchHiringNotificationRecipients(
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
  const message = `Your request to join ${params.clubName} was not approved at this time.`;

  const ok = await createNotification(supabase, {
    userId: params.studentUserId,
    type: "join_rejected",
    message,
    clubId: params.clubId,
  });
  if (!ok) {
    console.error("Failed to send join rejection notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.studentUserId,
    type: "join_rejected",
    title: "Join Request Declined",
    message,
    clubId: params.clubId,
  });
  if (!inboxOk) {
    console.error("Failed to create join rejection inbox message.");
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
      actionData: { path: `/app/admin?tab=claims&claim=${params.claimRequestId}` },
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
  const claimStatusPath = `/claim-status/${params.claimRequestId}`;

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
      claimId: params.claimRequestId,
      clubSlug: params.clubSlug,
      path: claimStatusPath,
      actionLabel: "View Claim Status",
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

export async function notifyClubRequestSubmitted(
  supabase: SupabaseClient,
  params: {
    clubName: string;
    submitterName: string;
    submitterUserId: string;
    clubRequestId: string;
  },
): Promise<void> {
  const submitterMessage = `Your club request for ${params.clubName} has been submitted and is pending review. We'll notify you once it's reviewed.`;

  const submitterInboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "system_message",
    title: `Club request submitted — ${params.clubName}`,
    message: submitterMessage,
    actionRequired: false,
    actionType: "view_club_request_status",
    actionData: {
      requestId: params.clubRequestId,
      path: "/app",
    },
    referenceId: params.clubRequestId,
    referenceType: "club_request",
  });
  if (!submitterInboxOk) {
    console.error("Failed to create club request submission inbox message.");
  }

  const submitterBellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "club_request_submitted",
    message: submitterMessage,
    referenceId: params.clubRequestId,
  });
  if (!submitterBellOk) {
    console.error("Failed to create club request submission notification.");
  }

  const adminIds = await fetchPlatformAdminUserIds(supabase);
  if (adminIds.length === 0) return;

  const adminMessage = `${params.submitterName} submitted a new club request for ${params.clubName}.`;

  const adminBellOk = await createNotifications(
    supabase,
    adminIds.map((userId) => ({
      userId,
      type: "new_club_request",
      message: adminMessage,
      referenceId: params.clubRequestId,
    })),
  );
  if (!adminBellOk) {
    console.error("Failed to send admin club request notifications.");
  }

  for (const adminId of adminIds) {
    const inboxOk = await createInboxMessage(supabase, {
      recipientId: adminId,
      type: "admin_message",
      title: `New club request — ${params.clubName}`,
      message: adminMessage,
      actionRequired: true,
      actionType: "review_club_request",
      actionData: {
        path: `/app/admin?tab=requests&request=${params.clubRequestId}`,
        requestId: params.clubRequestId,
      },
      referenceId: params.clubRequestId,
      referenceType: "club_request",
    });
    if (!inboxOk) {
      console.error("Failed to create admin club request inbox message for:", adminId);
    }
  }
}

export async function notifyClubRequestApproved(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    submitterUserId: string;
    clubRequestId: string;
  },
): Promise<void> {
  const message = `Your club request for ${params.clubName} has been approved.`;

  const bellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "club_request_approved",
    message,
    clubId: params.clubId,
    referenceId: params.clubRequestId,
  });
  if (!bellOk) {
    console.error("Failed to send club request approval notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "club_request_approved",
    title: `Club request approved — ${params.clubName}`,
    message,
    actionRequired: false,
    actionType: "open_club_dashboard",
    actionData: {
      path: `/app/clubs/${params.clubId}`,
      actionLabel: "Open Club Dashboard",
    },
    clubId: params.clubId,
    referenceId: params.clubRequestId,
    referenceType: "club_request",
  });
  if (!inboxOk) {
    console.error("Failed to create club request approval inbox message.");
  }
}

export async function notifyClubRequestRejected(
  supabase: SupabaseClient,
  params: {
    clubName: string;
    submitterUserId: string;
    clubRequestId: string;
    reviewNote?: string | null;
  },
): Promise<void> {
  const trimmedNote = params.reviewNote?.trim();
  const message = trimmedNote
    ? `Your club request for ${params.clubName} was not approved: ${trimmedNote}`
    : `Your club request for ${params.clubName} was not approved at this time.`;

  const bellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "club_request_rejected",
    message,
    referenceId: params.clubRequestId,
  });
  if (!bellOk) {
    console.error("Failed to send club request rejection notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "club_request_rejected",
    title: `Club request declined — ${params.clubName}`,
    message,
    actionRequired: false,
    actionType: "view_explore",
    actionData: {
      path: "/explore",
      actionLabel: "Browse Clubs",
    },
    referenceId: params.clubRequestId,
    referenceType: "club_request",
  });
  if (!inboxOk) {
    console.error("Failed to create club request rejection inbox message.");
  }
}

export async function notifyClubRequestMoreInfo(
  supabase: SupabaseClient,
  params: {
    clubName: string;
    submitterUserId: string;
    clubRequestId: string;
    note: string;
  },
): Promise<void> {
  const trimmedNote = params.note.trim();
  const message = trimmedNote
    ? `More information is needed for your club request for ${params.clubName}: ${trimmedNote}`
    : `More information is needed for your club request for ${params.clubName}.`;

  const bellOk = await createNotification(supabase, {
    userId: params.submitterUserId,
    type: "club_request_more_info",
    message,
    referenceId: params.clubRequestId,
  });
  if (!bellOk) {
    console.error("Failed to send club request more-info notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.submitterUserId,
    type: "system_message",
    title: `More info needed — ${params.clubName}`,
    message,
    actionRequired: true,
    actionType: "view_club_request_status",
    actionData: {
      requestId: params.clubRequestId,
      path: "/app",
    },
    referenceId: params.clubRequestId,
    referenceType: "club_request",
  });
  if (!inboxOk) {
    console.error("Failed to create club request more-info inbox message.");
  }
}

function formatEventScheduleLabel(date: string, time: string): string {
  const parsed = new Date(date);
  const datePart = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const rawTime = time.trim();
  if (!rawTime || rawTime.toUpperCase() === "TBD") return datePart;
  const parsedTime = new Date(`1970-01-01T${rawTime}`);
  const timePart = Number.isNaN(parsedTime.getTime())
    ? rawTime
    : parsedTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  return `${datePart} · ${timePart}`;
}

export async function fetchEventRsvpRecipientUserIds(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("status", ["going", "maybe", "pending"]);

  if (error) {
    console.error("Failed to load event RSVP recipients:", error.message);
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

export async function notifyEventCancelled(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    recipientUserIds: string[];
  },
): Promise<void> {
  if (params.recipientUserIds.length === 0) return;

  const schedule = formatEventScheduleLabel(params.eventDate, params.eventTime);
  const bellMessage = `[Event Cancelled] ${params.eventTitle} on ${schedule} has been cancelled.`;
  const inboxMessage = `The event "${params.eventTitle}" scheduled for ${schedule} has been cancelled. Your sign-up is no longer active.`;

  const bellOk = await createNotifications(
    supabase,
    params.recipientUserIds.map((userId) => ({
      userId,
      type: "event_cancelled",
      message: bellMessage,
      clubId: params.clubId,
      referenceId: params.eventId,
    })),
  );
  if (!bellOk) {
    console.error("Failed to send event cancellation notifications.");
  }

  for (const userId of params.recipientUserIds) {
    const inboxOk = await createInboxMessage(supabase, {
      recipientId: userId,
      type: "event_cancelled",
      title: `Event cancelled — ${params.eventTitle}`,
      message: inboxMessage,
      clubId: params.clubId,
      referenceId: params.eventId,
      referenceType: "event",
    });
    if (!inboxOk) {
      console.error("Failed to create event cancellation inbox message for:", userId);
    }
  }
}

export async function notifyEventUpdated(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    location: string;
    recipientUserIds: string[];
    excludeUserId?: string;
    changedFields: Array<"date" | "time" | "location">;
  },
): Promise<void> {
  const recipients = params.recipientUserIds.filter(
    (id) => id && id !== params.excludeUserId,
  );
  if (recipients.length === 0 || params.changedFields.length === 0) return;

  const fieldLabels = params.changedFields.map((field) => {
    if (field === "date") return "date";
    if (field === "time") return "time";
    return "location";
  });
  const schedule = formatEventScheduleLabel(params.eventDate, params.eventTime);
  const locationLabel = params.location.trim() || "TBD";
  const message = `[Event Updated] ${params.eventTitle} has a new ${fieldLabels.join(" and ")}. Now scheduled for ${schedule} at ${locationLabel}.`;

  const ok = await createNotifications(
    supabase,
    recipients.map((userId) => ({
      userId,
      type: "event_updated",
      message,
      clubId: params.clubId,
      referenceId: params.eventId,
    })),
  );
  if (!ok) {
    console.error("Failed to send event update notifications.");
  }
}

function formatMeetingSchedule(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMeetingLocationLabel(
  location: string | null | undefined,
  meetingLink: string | null | undefined,
): string {
  const loc = location?.trim();
  const link = meetingLink?.trim();
  if (loc && link) return `${loc} (online link provided)`;
  if (link) return "Online";
  if (loc) return loc;
  return "TBD";
}

export async function notifyMeetingInvited(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    meetingId: string;
    meetingTitle: string;
    meetingDateIso: string;
    location: string | null;
    meetingLink: string | null;
    inviteeUserIds: string[];
    excludeUserId?: string;
  },
): Promise<void> {
  const recipients = params.inviteeUserIds.filter(
    (id) => id && id !== params.excludeUserId,
  );
  if (recipients.length === 0) return;

  const schedule = formatMeetingSchedule(params.meetingDateIso);
  const locationLabel = formatMeetingLocationLabel(
    params.location,
    params.meetingLink,
  );
  const message = `[Meeting Invite] You're invited to ${params.meetingTitle} on ${schedule}. Location: ${locationLabel}.`;

  const ok = await createNotifications(
    supabase,
    recipients.map((userId) => ({
      userId,
      type: "meeting_invite",
      message,
      clubId: params.clubId,
      referenceId: params.meetingId,
    })),
  );
  if (!ok) {
    console.error("Failed to send meeting invite notifications.");
  }
}

export async function notifyMeetingUpdated(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    meetingId: string;
    meetingTitle: string;
    meetingDateIso: string;
    location: string | null;
    meetingLink: string | null;
    inviteeUserIds: string[];
    excludeUserId?: string;
    changedFields: Array<"date" | "location" | "meeting_link">;
  },
): Promise<void> {
  const recipients = params.inviteeUserIds.filter(
    (id) => id && id !== params.excludeUserId,
  );
  if (recipients.length === 0 || params.changedFields.length === 0) return;

  const fieldLabels = params.changedFields.map((field) => {
    if (field === "date") return "date/time";
    if (field === "meeting_link") return "meeting link";
    return "location";
  });
  const schedule = formatMeetingSchedule(params.meetingDateIso);
  const locationLabel = formatMeetingLocationLabel(
    params.location,
    params.meetingLink,
  );
  const message = `[Meeting Updated] ${params.meetingTitle} has a new ${fieldLabels.join(" and ")}. Now scheduled for ${schedule} at ${locationLabel}.`;

  const ok = await createNotifications(
    supabase,
    recipients.map((userId) => ({
      userId,
      type: "meeting_updated",
      message,
      clubId: params.clubId,
      referenceId: params.meetingId,
    })),
  );
  if (!ok) {
    console.error("Failed to send meeting update notifications.");
  }
}

export async function notifyMeetingCancelled(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    meetingId: string;
    meetingTitle: string;
    meetingDateIso: string;
    inviteeUserIds: string[];
    excludeUserId?: string;
  },
): Promise<void> {
  const recipients = params.inviteeUserIds.filter(
    (id) => id && id !== params.excludeUserId,
  );
  if (recipients.length === 0) return;

  const schedule = formatMeetingSchedule(params.meetingDateIso);
  const bellMessage = `[Meeting Cancelled] ${params.meetingTitle} on ${schedule} has been cancelled.`;
  const inboxMessage = `The meeting "${params.meetingTitle}" scheduled for ${schedule} has been cancelled.`;

  const bellOk = await createNotifications(
    supabase,
    recipients.map((userId) => ({
      userId,
      type: "meeting_cancelled",
      message: bellMessage,
      clubId: params.clubId,
      referenceId: params.meetingId,
    })),
  );
  if (!bellOk) {
    console.error("Failed to send meeting cancellation notifications.");
  }

  for (const userId of recipients) {
    const inboxOk = await createInboxMessage(supabase, {
      recipientId: userId,
      type: "meeting_cancelled",
      title: `Meeting cancelled — ${params.meetingTitle}`,
      message: inboxMessage,
      clubId: params.clubId,
      referenceId: params.meetingId,
      referenceType: "club_meeting",
      actionData: {
        path: `/app/clubs/${params.clubId}/meetings`,
      },
    });
    if (!inboxOk) {
      console.error("Failed to create meeting cancellation inbox message for:", userId);
    }
  }
}

async function fetchClubMemberVisibilityContexts(
  supabase: SupabaseClient,
  clubId: string,
): Promise<
  Array<{
    userId: string;
    isMember: boolean;
    isPrivileged: boolean;
    accessLevel: AccessLevel | null;
    role: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("club_members")
    .select("user_id, role, access_level, status")
    .eq("club_id", clubId)
    .eq("status", "active");

  if (error) {
    console.error("Failed to load club members for document notifications:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const role = row.role as string;
      const accessLevel = row.access_level as AccessLevel | null;
      return {
        userId: row.user_id as string,
        isMember: true,
        isPrivileged: isExecutiveAccessLevel(accessLevel, role),
        accessLevel,
        role,
      };
    })
    .filter((entry) => Boolean(entry.userId));
}

export async function notifyNewDocumentUploaded(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    documentId: string;
    documentName: string;
    visibility: Visibility;
    visibilityRoles?: AccessLevel[];
    visibilityUserIds?: string[];
    uploadedByUserId: string;
  },
): Promise<void> {
  const members = await fetchClubMemberVisibilityContexts(supabase, params.clubId);
  const recipientIds = members
    .filter((member) =>
      canViewContent(params.visibility, {
        isMember: member.isMember,
        isPrivileged: member.isPrivileged,
        userId: member.userId,
        accessLevel: member.accessLevel,
        role: member.role,
      }, {
        visibilityRoles: params.visibilityRoles ?? [],
        visibilityUserIds: params.visibilityUserIds ?? [],
      }),
    )
    .map((member) => member.userId)
    .filter((userId) => userId !== params.uploadedByUserId);

  if (recipientIds.length === 0) return;

  const message = `[New Document] ${params.documentName} was uploaded to the club documents library.`;

  const ok = await createNotifications(
    supabase,
    recipientIds.map((userId) => ({
      userId,
      type: "new_document",
      message,
      clubId: params.clubId,
      referenceId: params.documentId,
    })),
  );
  if (!ok) {
    console.error("Failed to send new document notifications.");
  }
}

async function fetchActiveClubMemberUserIds(
  supabase: SupabaseClient,
  clubId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("status", "active");

  if (error) {
    console.error("Failed to load club members for hiring notifications:", error.message);
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

async function fetchClubFollowerUserIds(
  supabase: SupabaseClient,
  clubId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_clubs")
    .select("user_id")
    .eq("club_id", clubId);

  if (error) {
    console.error("Failed to load club followers for hiring notifications:", error.message);
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

export async function notifyNewHiringRolePosted(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    listingId: string;
    roleTitle: string;
    isPublic: boolean;
    excludeUserId?: string;
  },
): Promise<void> {
  const memberIds = await fetchActiveClubMemberUserIds(supabase, params.clubId);
  const followerIds = params.isPublic
    ? await fetchClubFollowerUserIds(supabase, params.clubId)
    : [];
  const recipientIds = Array.from(new Set([...memberIds, ...followerIds])).filter(
    (userId) => userId && userId !== params.excludeUserId,
  );

  if (recipientIds.length === 0) return;

  const message = `[New Role Posted] ${params.clubName} posted ${params.roleTitle}. View details on the hiring board.`;

  const ok = await createNotifications(
    supabase,
    recipientIds.map((userId) => ({
      userId,
      type: "new_hiring_role",
      message,
      clubId: params.clubId,
      referenceId: params.listingId,
    })),
  );
  if (!ok) {
    console.error("Failed to send new hiring role notifications.");
  }
}

export async function notifyMemberRemovedFromClub(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    removedUserId: string;
  },
): Promise<void> {
  const bellMessage = `[Membership Update] Your access to ${params.clubName} has ended. You no longer have workspace access for this club.`;
  const inboxMessage = `Your membership in ${params.clubName} has been updated. You no longer have access to this club's workspace. If you have questions, please contact the club's leadership directly.`;

  const bellOk = await createNotification(supabase, {
    userId: params.removedUserId,
    type: "member_removed",
    message: bellMessage,
    clubId: params.clubId,
  });
  if (!bellOk) {
    console.error("Failed to send member removal notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.removedUserId,
    type: "member_removed",
    title: `Membership update — ${params.clubName}`,
    message: inboxMessage,
    clubId: params.clubId,
    referenceType: "club_member",
  });
  if (!inboxOk) {
    console.error("Failed to create member removal inbox message.");
  }
}

function describeRoleChange(params: {
  previousAccessLevel: AccessLevel;
  nextAccessLevel: AccessLevel;
  previousTitle?: string | null;
  nextTitle?: string | null;
  clubName: string;
}): string {
  const previousLabel = accessLevelBadgeLabel(params.previousAccessLevel);
  const nextLabel = accessLevelBadgeLabel(params.nextAccessLevel);
  const previousTitle = params.previousTitle?.trim();
  const nextTitle = params.nextTitle?.trim();

  if (params.previousAccessLevel !== params.nextAccessLevel) {
    if (
      params.nextAccessLevel === "president" ||
      (params.previousAccessLevel === "member" &&
        (params.nextAccessLevel === "executive" ||
          params.nextAccessLevel === "managerial_executive"))
    ) {
      return `Your role in ${params.clubName} has been updated to ${nextLabel}${nextTitle ? ` (${nextTitle})` : ""}.`;
    }
    if (params.nextAccessLevel === "member") {
      return `Your role in ${params.clubName} has been updated to ${nextLabel}${nextTitle ? ` (${nextTitle})` : ""}.`;
    }
    return `Your access level in ${params.clubName} changed from ${previousLabel} to ${nextLabel}.`;
  }

  if (previousTitle !== nextTitle) {
    return nextTitle
      ? `Your role title in ${params.clubName} is now ${nextTitle}.`
      : `Your role title in ${params.clubName} has been updated.`;
  }

  return `Your role or permissions in ${params.clubName} have been updated.`;
}

export async function notifyRoleUpdated(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    memberUserId: string;
    memberRowId: string;
    previousAccessLevel: AccessLevel;
    nextAccessLevel: AccessLevel;
    previousTitle?: string | null;
    nextTitle?: string | null;
  },
): Promise<void> {
  const detail = describeRoleChange({
    previousAccessLevel: params.previousAccessLevel,
    nextAccessLevel: params.nextAccessLevel,
    previousTitle: params.previousTitle,
    nextTitle: params.nextTitle,
    clubName: params.clubName,
  });
  const bellMessage = `[Role Updated] ${detail}`;
  const inboxMessage = detail;

  const bellOk = await createNotification(supabase, {
    userId: params.memberUserId,
    type: "role_updated",
    message: bellMessage,
    clubId: params.clubId,
    referenceId: params.memberRowId,
  });
  if (!bellOk) {
    console.error("Failed to send role update notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.memberUserId,
    type: "role_updated",
    title: `Role updated — ${params.clubName}`,
    message: inboxMessage,
    clubId: params.clubId,
    referenceId: params.memberRowId,
    referenceType: "club_member",
    actionData: {
      path: `/app/clubs/${params.clubId}/members`,
    },
  });
  if (!inboxOk) {
    console.error("Failed to create role update inbox message.");
  }
}

export type ReportSubmissionKind = "club" | "post" | "bug";

export async function notifyReportSubmitted(
  supabase: SupabaseClient,
  params: {
    reportId: string;
    reportKind: ReportSubmissionKind;
    summary: string;
    adminPath: string;
  },
): Promise<void> {
  const adminIds = await fetchPlatformAdminUserIds(supabase);
  if (adminIds.length === 0) return;

  const bellMessage = `[Report Submitted] ${params.summary}`;
  const inboxMessage = `A new ${params.reportKind} report needs review. ${params.summary}`;

  const bellOk = await createNotifications(
    supabase,
    adminIds.map((userId) => ({
      userId,
      type: "report_submitted",
      message: bellMessage,
      referenceId: params.reportId,
    })),
  );
  if (!bellOk) {
    console.error("Failed to send report submission notifications.");
  }

  for (const adminId of adminIds) {
    const inboxOk = await createInboxMessage(supabase, {
      recipientId: adminId,
      type: "report_submitted",
      title: "New report submitted",
      message: inboxMessage,
      actionRequired: true,
      actionType: "review_report",
      actionData: {
        path: params.adminPath,
        reportId: params.reportId,
        reportKind: params.reportKind,
      },
      referenceId: params.reportId,
      referenceType: `${params.reportKind}_report`,
    });
    if (!inboxOk) {
      console.error("Failed to create report submission inbox message for:", adminId);
    }
  }
}

export async function notifyReportStatusUpdated(
  supabase: SupabaseClient,
  params: {
    reporterUserId: string;
    reportId: string;
    reportKind: ReportSubmissionKind;
    status: "resolved" | "dismissed" | "in_progress";
    subjectLabel: string;
  },
): Promise<void> {
  if (params.status === "in_progress") return;

  const statusLabel =
    params.status === "resolved" ? "reviewed and addressed" : "reviewed and closed";
  const bellMessage = `[Report Update] Your report about ${params.subjectLabel} has been ${statusLabel}.`;
  const inboxMessage =
    params.status === "resolved"
      ? `Thank you for your report about ${params.subjectLabel}. Our team has reviewed it and taken appropriate action.`
      : `Thank you for your report about ${params.subjectLabel}. Our team has reviewed it. No further action is required at this time.`;

  const bellOk = await createNotification(supabase, {
    userId: params.reporterUserId,
    type: "report_status_updated",
    message: bellMessage,
    referenceId: params.reportId,
  });
  if (!bellOk) {
    console.error("Failed to send report status notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.reporterUserId,
    type: "report_status_updated",
    title: "Report update",
    message: inboxMessage,
    referenceId: params.reportId,
    referenceType: `${params.reportKind}_report`,
  });
  if (!inboxOk) {
    console.error("Failed to create report status inbox message.");
  }
}

export async function notifyEventSignupPendingReview(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    clubName: string;
    eventId: string;
    eventTitle: string;
    registrantUserId: string;
    registrantName: string;
    rsvpId?: string;
  },
): Promise<void> {
  const organizerIds = await fetchClubExecutiveUserIds(supabase, params.clubId);
  const recipients = organizerIds.filter(
    (userId) => userId && userId !== params.registrantUserId,
  );
  if (recipients.length === 0) return;

  const bellMessage = `[Sign-up Needs Review] ${params.registrantName} requested to join ${params.eventTitle}. Review and approve their sign-up.`;
  const inboxMessage = `${params.registrantName} submitted a sign-up request for ${params.eventTitle} that requires your approval.`;

  const bellOk = await createNotifications(
    supabase,
    recipients.map((userId) => ({
      userId,
      type: "event_signup_pending",
      message: bellMessage,
      clubId: params.clubId,
      referenceId: params.rsvpId ?? params.eventId,
    })),
  );
  if (!bellOk) {
    console.error("Failed to send pending event sign-up notifications.");
  }

  for (const userId of recipients) {
    const inboxOk = await createInboxMessage(supabase, {
      recipientId: userId,
      type: "event_signup_pending",
      title: `Sign-up needs review — ${params.eventTitle}`,
      message: inboxMessage,
      actionRequired: true,
      actionType: "review_event_signup",
      actionData: {
        path: `/app/clubs/${params.clubId}/events`,
        eventId: params.eventId,
      },
      clubId: params.clubId,
      referenceId: params.rsvpId ?? params.eventId,
      referenceType: "event_rsvp",
    });
    if (!inboxOk) {
      console.error("Failed to create pending sign-up inbox message for:", userId);
    }
  }
}

export async function notifyEventSignupApproved(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    eventId: string;
    eventTitle: string;
    recipientUserId: string;
  },
): Promise<void> {
  const scheduleLabel = await (async () => {
    const { data } = await supabase
      .from("events")
      .select("date, time, location")
      .eq("id", params.eventId)
      .maybeSingle();
    if (!data) return params.eventTitle;
    const location = ((data.location as string) ?? "").trim() || "TBD";
    return `${params.eventTitle} on ${formatEventScheduleLabel(
      (data.date as string) ?? "",
      (data.time as string) ?? "",
    )}. Location: ${location}`;
  })();

  const message = `Your sign-up for ${scheduleLabel} was approved. You're registered to attend.`;

  const bellOk = await createNotification(supabase, {
    userId: params.recipientUserId,
    type: "club_update",
    message: `[Event Sign-up Approved] ${message}`,
    clubId: params.clubId,
    referenceId: params.eventId,
  });
  if (!bellOk) {
    console.error("Failed to send event sign-up approval notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.recipientUserId,
    type: "system_message",
    title: `Sign-up approved — ${params.eventTitle}`,
    message,
    actionRequired: false,
    actionType: "view_event",
    actionData: {
      path: `/events/${params.eventId}`,
      eventId: params.eventId,
    },
    clubId: params.clubId,
    referenceId: params.eventId,
    referenceType: "event_rsvp",
  });
  if (!inboxOk) {
    console.error("Failed to create event sign-up approval inbox message.");
  }
}

export async function notifyEventSignupRejected(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    eventId: string;
    eventTitle: string;
    recipientUserId: string;
  },
): Promise<void> {
  const message = `Your sign-up request for ${params.eventTitle} was not approved at this time.`;

  const bellOk = await createNotification(supabase, {
    userId: params.recipientUserId,
    type: "club_update",
    message: `[Event Sign-up Declined] ${message}`,
    clubId: params.clubId,
    referenceId: params.eventId,
  });
  if (!bellOk) {
    console.error("Failed to send event sign-up rejection notification.");
  }

  const inboxOk = await createInboxMessage(supabase, {
    recipientId: params.recipientUserId,
    type: "system_message",
    title: `Sign-up declined — ${params.eventTitle}`,
    message,
    actionRequired: false,
    actionType: "view_event",
    actionData: {
      path: `/events/${params.eventId}`,
      eventId: params.eventId,
    },
    clubId: params.clubId,
    referenceId: params.eventId,
    referenceType: "event_rsvp",
  });
  if (!inboxOk) {
    console.error("Failed to create event sign-up rejection inbox message.");
  }
}
