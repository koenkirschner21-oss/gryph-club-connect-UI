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

  return { title: "Update", body: trimmed };
}
