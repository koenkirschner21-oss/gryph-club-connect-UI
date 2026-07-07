import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessLevel } from "../types";

/** Mirrors public.is_club_chat_executive() — role OR access_level executive tier. */
export function isClubChatExecutive(
  role: string | null | undefined,
  accessLevel: AccessLevel | string | null | undefined,
): boolean {
  if (
    accessLevel === "president" ||
    accessLevel === "managerial_executive" ||
    accessLevel === "executive"
  ) {
    return true;
  }
  return (
    role === "owner" ||
    role === "executive" ||
    role === "admin" ||
    role === "exec"
  );
}

/** Ensure default group chats exist and the current user is a member. */
export async function ensureMyClubChats(
  supabase: SupabaseClient,
  clubId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc("ensure_my_club_chats", {
    p_club_id: clubId,
  });

  if (error) {
    console.error("Failed to ensure club chats:", error.message);
    return false;
  }

  return true;
}

/** Provision chats for a member after join approval (exec/president or self). */
export async function provisionClubChatsForUser(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
  postJoinMessage = false,
): Promise<boolean> {
  const { error } = await supabase.rpc("provision_club_member_chats_for_user", {
    p_club_id: clubId,
    p_user_id: userId,
    p_post_join_message: postJoinMessage,
  });

  if (error) {
    console.error("Failed to provision member chats:", error.message);
    return false;
  }

  return true;
}
