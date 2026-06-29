import { supabase } from "./supabaseClient";
import { formatNameWithRoleTitle } from "./memberRoleTitle";
import type { MemberRole } from "../types";

export interface AnnouncementSeenEntry {
  userId: string;
  name: string;
  roleTitle?: string;
  role?: MemberRole;
  viewedAt: string;
}

/** Record that the current user has read an announcement (upserts viewed_at). */
export async function recordAnnouncementView(
  postId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase.from("post_views").upsert(
    {
      post_id: postId,
      user_id: userId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "post_id,user_id" },
  );

  if (error) {
    console.error("Failed to record announcement view:", error.message);
    return false;
  }

  return true;
}

export async function fetchPostViewCounts(
  postIds: string[],
): Promise<Record<string, number>> {
  if (postIds.length === 0) return {};

  const { data, error } = await supabase
    .from("post_views")
    .select("post_id")
    .in("post_id", postIds);

  if (error) {
    console.error("Failed to load announcement view counts:", error.message);
    return {};
  }

  const countMap: Record<string, number> = {};
  for (const postId of postIds) countMap[postId] = 0;
  for (const row of data ?? []) {
    const postId = row.post_id as string;
    countMap[postId] = (countMap[postId] ?? 0) + 1;
  }
  return countMap;
}

function normalizeMemberRole(role: string | null | undefined): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

/** Seen list for one announcement — active club members who recorded a view. */
export async function fetchAnnouncementSeenList(
  postId: string,
  clubId: string,
): Promise<AnnouncementSeenEntry[]> {
  const { data: views, error: viewsError } = await supabase
    .from("post_views")
    .select("user_id, viewed_at")
    .eq("post_id", postId)
    .order("viewed_at", { ascending: false });

  if (viewsError) {
    console.error("Failed to load announcement seen list:", viewsError.message);
    return [];
  }

  if (!views?.length) return [];

  const userIds = Array.from(new Set(views.map((row) => row.user_id as string)));

  const [profilesRes, membersRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", userIds),
    supabase
      .from("club_members")
      .select("user_id, role, title")
      .eq("club_id", clubId)
      .eq("status", "active")
      .in("user_id", userIds),
  ]);

  if (profilesRes.error) {
    console.error("Failed to load seen list profiles:", profilesRes.error.message);
  }
  if (membersRes.error) {
    console.error("Failed to load seen list members:", membersRes.error.message);
  }

  const nameById = new Map(
    (profilesRes.data ?? []).map((row) => [
      row.id as string,
      ((row.full_name as string | null) ?? "Member").trim(),
    ]),
  );

  const memberById = new Map(
    (membersRes.data ?? []).map((row) => [
      row.user_id as string,
      {
        role: normalizeMemberRole(row.role as string),
        roleTitle: (row.title as string | null)?.trim() || undefined,
      },
    ]),
  );

  return views
    .filter((row) => memberById.has(row.user_id as string))
    .map((row) => {
      const userId = row.user_id as string;
      const member = memberById.get(userId);
      const plainName = nameById.get(userId) ?? "Member";
      return {
        userId,
        name: formatNameWithRoleTitle(plainName, member?.roleTitle),
        roleTitle: member?.roleTitle,
        role: member?.role,
        viewedAt: (row.viewed_at as string) ?? "",
      };
    });
}
