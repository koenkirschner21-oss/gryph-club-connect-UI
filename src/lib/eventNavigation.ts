export function getWorkspaceEventDetailPath(clubId: string, eventId: string): string {
  return `/app/clubs/${clubId}/events?manageEvent=${encodeURIComponent(eventId)}`;
}

export function getPublicEventDetailPath(eventId: string): string {
  return `/events/${eventId}`;
}

export function getEventRsvpPath(eventId: string): string {
  return `/events/${eventId}/rsvp`;
}

/** Members open the club workspace event view; others use the public detail page. */
export function resolveEventDetailPath(
  eventId: string,
  clubId: string,
  isClubMember: boolean,
): string {
  if (isClubMember) {
    return getWorkspaceEventDetailPath(clubId, eventId);
  }
  return getPublicEventDetailPath(eventId);
}
