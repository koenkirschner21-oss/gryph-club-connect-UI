import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUsers } from "./notifyUsers";

/** Presidents, manage_hiring permission holders, and listing reviewer_ids. */
export async function fetchHiringNotificationRecipients(
  supabase: SupabaseClient,
  clubId: string,
  listingId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("hiring_listing_manager_user_ids", {
    p_club_id: clubId,
    p_listing_id: listingId,
  });

  if (error) {
    console.error("Failed to load hiring notification recipients:", error.message);
    return [];
  }

  if (!Array.isArray(data)) return [];

  return Array.from(
    new Set(
      data.filter((id): id is string => typeof id === "string" && Boolean(id)),
    ),
  );
}

export async function notifyHiringManagerBells(
  supabase: SupabaseClient,
  params: {
    clubId: string;
    listingId: string;
    referenceId: string;
    message: string;
    excludeUserIds?: Iterable<string>;
  },
): Promise<void> {
  const exclude = new Set(params.excludeUserIds ?? []);
  const recipientIds = (
    await fetchHiringNotificationRecipients(supabase, params.clubId, params.listingId)
  ).filter((id) => !exclude.has(id));

  if (recipientIds.length === 0) return;

  const ok = await notifyUsers(
    recipientIds.map((userId) => ({
      user_id: userId,
      type: "club_update",
      message: params.message,
      club_id: params.clubId,
      reference_id: params.referenceId,
    })),
  );

  if (!ok) {
    console.error(
      "Failed to send hiring manager bell notifications for listing:",
      params.listingId,
    );
  }
}
