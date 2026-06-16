import { supabase } from "./supabaseClient";
import type { NotificationType } from "../types";

export interface NotificationRequest {
  user_id: string;
  type: NotificationType;
  message: string;
  club_id?: string;
  reference_id?: string;
}

function mapNotificationPayload(notifications: NotificationRequest[]) {
  return notifications.map((notification) => ({
    user_id: notification.user_id,
    type: notification.type,
    message: notification.message,
    club_id: notification.club_id ?? null,
    reference_id: notification.reference_id ?? null,
  }));
}

export async function notifyUsers(
  notifications: NotificationRequest[],
): Promise<boolean> {
  if (notifications.length === 0) return true;

  const payload = mapNotificationPayload(notifications);

  const { error: rpcError } = await supabase.rpc("send_app_notifications", {
    p_notifications: payload,
  });

  if (!rpcError) {
    return true;
  }

  console.error(
    "Failed to insert notifications via send_app_notifications RPC:",
    rpcError.message,
    rpcError.details ?? "",
    rpcError.hint ?? "",
  );

  const { error: fnError, data: fnData } = await supabase.functions.invoke(
    "send-notification",
    {
      body: { notifications },
    },
  );

  if (fnError) {
    console.error(
      "Failed to send notifications via edge function:",
      fnError.message,
      fnData ?? "",
    );
    return false;
  }

  return true;
}
