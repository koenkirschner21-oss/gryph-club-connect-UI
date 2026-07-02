export function parseNotificationDisplay(
  type: string,
  message: string,
): { title: string; body: string } {
  const trimmed = message.trim();
  const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (bracketMatch) {
    return {
      title: bracketMatch[1].trim(),
      body: bracketMatch[2].trim() || trimmed,
    };
  }

  if (type === "direct_message") {
    return { title: "New Message", body: trimmed };
  }
  if (type === "task_assigned" || type === "task") {
    return { title: "Task", body: trimmed };
  }
  if (type === "announcement") {
    return { title: "Announcement", body: trimmed };
  }
  if (type === "new_event" || type === "event") {
    return { title: "Event", body: trimmed };
  }
  if (type === "join_approved" || type === "member_joined") {
    return { title: "Membership Approved", body: trimmed };
  }
  if (type === "join_request_submitted") {
    return { title: "Join Request Sent", body: trimmed };
  }
  if (type === "new_join_request") {
    return { title: "New Join Request", body: trimmed };
  }
  if (type === "join_rejected") {
    return { title: "Join Request Update", body: trimmed };
  }
  if (type === "new_claim_request") {
    return { title: "Club Claim Request", body: trimmed };
  }
  if (type === "claim_submitted") {
    return { title: "Claim Submitted", body: trimmed };
  }
  if (type === "claim_approved") {
    return { title: "Claim Approved", body: trimmed };
  }
  if (type === "claim_rejected") {
    return { title: "Claim Declined", body: trimmed };
  }
  if (type === "claim_more_info") {
    return { title: "More Info Needed", body: trimmed };
  }
  if (type === "new_club_request") {
    return { title: "New Club Request", body: trimmed };
  }
  if (type === "club_request_submitted") {
    return { title: "Club Request Submitted", body: trimmed };
  }
  if (type === "club_request_approved") {
    return { title: "Club Request Approved", body: trimmed };
  }
  if (type === "club_request_rejected") {
    return { title: "Club Request Declined", body: trimmed };
  }
  if (type === "club_request_more_info") {
    return { title: "More Info Needed", body: trimmed };
  }
  if (type === "event_cancelled") {
    return { title: "Event Cancelled", body: trimmed };
  }

  return { title: "Update", body: trimmed };
}
