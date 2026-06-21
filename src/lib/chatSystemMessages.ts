/** Prefix for automated club chat system messages (see DB trigger `post_conversation_system_message`). */
export const CHAT_SYSTEM_MEMBER_JOINED_PREFIX = "[gryph-system:member_joined] ";

const MEMBER_JOINED_PATTERN = /^\[gryph-system:member_joined\]\s*(.+)$/;

export function formatMemberJoinedSystemMessage(fullName: string): string {
  const label = fullName.trim() || "A member";
  return `${CHAT_SYSTEM_MEMBER_JOINED_PREFIX}${label} just joined the club!`;
}

export function parseChatSystemMessage(
  content: string | null | undefined,
): { type: "member_joined"; text: string } | null {
  if (!content) return null;
  const match = content.match(MEMBER_JOINED_PATTERN);
  if (!match?.[1]) return null;
  return { type: "member_joined", text: match[1].trim() };
}

export function isChatSystemMessage(content: string | null | undefined): boolean {
  return parseChatSystemMessage(content) !== null;
}
