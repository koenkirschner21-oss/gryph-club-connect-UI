/** Dispatched when a club conversation is marked read (sidebar badge refresh). */
export const CLUB_CHAT_READ_EVENT = "gryph:club-chat-read";

export function notifyClubChatRead(clubId: string, conversationId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CLUB_CHAT_READ_EVENT, {
      detail: { clubId, conversationId },
    }),
  );
}
