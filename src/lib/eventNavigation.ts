export function getWorkspaceEventDetailPath(clubId: string, eventId: string): string {
  return `/app/clubs/${clubId}/events?manageEvent=${encodeURIComponent(eventId)}`;
}

export function getClubEventDetailPath(clubId: string, eventId: string): string {
  return `/app/clubs/${clubId}/events?event=${encodeURIComponent(eventId)}`;
}

export function getPublicEventDetailPath(eventId: string): string {
  return `/events/${eventId}`;
}

export function getEventRsvpPath(eventId: string): string {
  return `/events/${eventId}/rsvp`;
}

/**
 * Dashboard / notification default: club Events section with exact event details.
 * Manage Event remains a separate permission-gated action.
 */
export function resolveEventDetailPath(
  eventId: string,
  clubId?: string,
  isClubMember?: boolean,
): string {
  if (clubId && isClubMember) {
    return getClubEventDetailPath(clubId, eventId);
  }
  return getPublicEventDetailPath(eventId);
}

/** Only for authorized event managers who explicitly open management. */
export function resolveEventManagePath(
  clubId: string,
  eventId: string,
  canManageEvents: boolean,
): string | null {
  if (!canManageEvents) return null;
  return getWorkspaceEventDetailPath(clubId, eventId);
}
