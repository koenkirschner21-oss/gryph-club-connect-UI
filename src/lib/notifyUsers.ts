import { supabase } from "./supabaseClient";
import type { NotificationType } from "../types";

export interface NotificationRequest {
  user_id: string;
  type: NotificationType;
  message: string;
  club_id?: string;
  reference_id?: string;
}

export async function notifyUsers(
  notifications: NotificationRequest[],
): Promise<boolean> {
  if (notifications.length === 0) return true;

  const { error } = await supabase.functions.invoke("send-notification", {
    body: { notifications },
  });

  if (error) {
    console.error("Failed to send notifications via function:", error.message);
    return false;
  }

  return true;
}
