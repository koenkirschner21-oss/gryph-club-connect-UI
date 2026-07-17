/**
 * Stable deep-link builders for exact-record destinations.
 * Prefer these over section-only paths whenever a record ID is known.
 */

export function getClubTaskPath(clubId: string, taskId: string): string {
  return `/app/clubs/${clubId}/tasks?task=${encodeURIComponent(taskId)}`;
}

export function getClubAnnouncementPath(
  clubId: string,
  announcementId: string,
): string {
  return `/app/clubs/${clubId}/announcements?announcement=${encodeURIComponent(announcementId)}`;
}

/** Club Events section + exact event (detail/description). Never Manage Event. */
export function getClubEventPath(clubId: string, eventId: string): string {
  return `/app/clubs/${clubId}/events?event=${encodeURIComponent(eventId)}`;
}

export function getClubMembersPendingPath(clubId: string): string {
  return `/app/clubs/${clubId}/members?tab=pending`;
}

export function getClubRecruitingApplicationPath(
  clubId: string,
  options?: { listingId?: string; applicationId?: string },
): string {
  const params = new URLSearchParams();
  params.set("tab", "applications");
  if (options?.listingId) params.set("listing", options.listingId);
  if (options?.applicationId) params.set("application", options.applicationId);
  return `/app/clubs/${clubId}/recruiting?${params.toString()}`;
}

export function getClubRecruitingListingPath(
  clubId: string,
  listingId: string,
): string {
  return `/app/clubs/${clubId}/recruiting?listing=${encodeURIComponent(listingId)}`;
}

export function getDashboardInboxMessagePath(messageId: string): string {
  return `/app?tab=inbox&message=${encodeURIComponent(messageId)}`;
}

export function getDashboardInboxPath(): string {
  return `/app?tab=inbox`;
}

export function getDashboardEventsTabPath(): string {
  return `/app?tab=events`;
}

export function getClubRequestStatusPath(requestId: string): string {
  return `/club-request-status/${encodeURIComponent(requestId)}`;
}

export function getClaimStatusPath(claimId: string): string {
  return `/claim-status/${encodeURIComponent(claimId)}`;
}

export function getOwnershipTransferPath(transferId: string): string {
  return `/ownership-transfer/${encodeURIComponent(transferId)}`;
}

export function getAdminClubRequestPath(requestId: string): string {
  return `/app/admin?tab=requests&request=${encodeURIComponent(requestId)}`;
}

export function getAdminClaimPath(claimId: string): string {
  return `/app/admin?tab=claims&claim=${encodeURIComponent(claimId)}`;
}

function bracketTitle(message: string): string | null {
  const match = message.trim().match(/^\[([^\]]+)\]/);
  return match?.[1]?.trim() ?? null;
}

/**
 * Resolve Alerts/notification click destination from type + reference + optional link.
 */
export function resolveNotificationDeepLink(notification: {
  type: string;
  message?: string;
  link?: string | null;
  clubId?: string | null;
  referenceId?: string | null;
}): string | null {
  if (notification.link?.trim()) {
    return notification.link.trim();
  }

  const ref = notification.referenceId?.trim() || null;
  const clubId = notification.clubId?.trim() || null;
  const title = bracketTitle(notification.message ?? "");

  switch (notification.type) {
    case "new_club_request":
      return ref ? getAdminClubRequestPath(ref) : "/app/admin?tab=requests";
    case "report_submitted":
      return "/app/admin?tab=reports";
    case "new_claim_request":
      return ref ? getAdminClaimPath(ref) : "/app/admin?tab=claims";
    case "club_request_submitted":
    case "club_request_more_info":
      return ref ? getClubRequestStatusPath(ref) : getDashboardInboxPath();
    case "club_request_rejected":
      return ref ? getClubRequestStatusPath(ref) : "/explore";
    case "club_request_approved":
      return clubId
        ? `/app/clubs/${clubId}`
        : ref
          ? getClubRequestStatusPath(ref)
          : "/app";
    case "claim_submitted":
    case "claim_more_info":
      return ref ? getClaimStatusPath(ref) : getDashboardInboxPath();
    case "claim_rejected":
      return ref ? getClaimStatusPath(ref) : "/explore";
    case "claim_approved":
      return clubId ? `/app/clubs/${clubId}` : "/app";
    default:
      break;
  }

  // Bracket titles used for club_update / generic types
  if (title === "Event Registration Confirmed" || title === "Event Sign-up Approved") {
    if (clubId && ref) return getClubEventPath(clubId, ref);
    if (ref) return `/events/${ref}`;
  }
  if (title === "Event Sign-up Declined" && ref) {
    if (clubId) return getClubEventPath(clubId, ref);
    return `/events/${ref}`;
  }

  if (!clubId) {
    if (notification.type === "ownership_transfer" || title?.toLowerCase().includes("ownership")) {
      return ref ? getOwnershipTransferPath(ref) : getDashboardInboxPath();
    }
    return null;
  }

  const base = `/app/clubs/${clubId}`;

  switch (notification.type as string) {
    case "new_event":
    case "event":
    case "event_cancelled":
    case "event_updated":
    case "event_signup_pending":
      return ref ? getClubEventPath(clubId, ref) : `${base}/events`;
    case "meeting_invite":
    case "meeting_updated":
    case "meeting_cancelled":
      return ref ? `${base}/meetings/${ref}` : `${base}/meetings`;
    case "new_document":
      return `${base}/documents`;
    case "new_hiring_role":
      return ref
        ? getClubRecruitingListingPath(clubId, ref)
        : `${base}/recruiting`;
    case "announcement":
      return ref
        ? getClubAnnouncementPath(clubId, ref)
        : `${base}/announcements`;
    case "task_assigned":
    case "task":
      return ref ? getClubTaskPath(clubId, ref) : `${base}/tasks`;
    case "new_join_request":
      return getClubMembersPendingPath(clubId);
    case "join_approved":
    case "join_rejected":
    case "join_request_submitted":
    case "member_joined":
    case "role_updated":
    case "member_removed":
      return `${base}/members`;
    case "direct_message":
    case "mention":
      return ref ? `${base}/chat?conversation=${encodeURIComponent(ref)}` : `${base}/chat`;
    case "ownership_transfer":
      return ref ? getOwnershipTransferPath(ref) : getDashboardInboxPath();
    case "club_update":
      if (ref && (title?.includes("Event") || title?.includes("Sign-up") || title?.includes("Registration"))) {
        return getClubEventPath(clubId, ref);
      }
      if (ref && title?.toLowerCase().includes("ownership")) {
        return getOwnershipTransferPath(ref);
      }
      return base;
    default:
      return base;
  }
}
