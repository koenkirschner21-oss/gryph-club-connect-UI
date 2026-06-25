import type { SupabaseClient } from "@supabase/supabase-js";

export const PRESIDENT_MEMBER_TITLE = "President";

/** Upsert active President membership — same shape as claim approval. */
export async function ensurePresidentMembership(
  supabase: SupabaseClient,
  clubId: string,
  userId: string,
  title = PRESIDENT_MEMBER_TITLE,
): Promise<string | null> {
  const { error } = await supabase.from("club_members").upsert(
    {
      club_id: clubId,
      user_id: userId,
      role: "owner",
      access_level: "president",
      status: "active",
      title,
    },
    { onConflict: "club_id,user_id" },
  );

  if (error) return error.message;
  return null;
}
