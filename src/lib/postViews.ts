import { supabase } from "./supabaseClient";
import type { MemberRole } from "../types";

export interface AnnouncementSeenEntry {
  userId: string;
  name: string;
  roleTitle?: string;
  role?: MemberRole;
  viewedAt: string;
}

/** Record that the current user has read an announcement (insert, then update on duplicate). */
export async function recordAnnouncementView(
  postId: string,
  userId: string,
): Promise<boolean> {
  const viewedAt = new Date().toISOString();
  const payload = { post_id: postId, user_id: userId, viewed_at: viewedAt };

  const { error: insertError } = await supabase.from("post_views").insert(payload);

  if (!insertError) return true;

  if (insertError.code !== "23505") {
    console.error(
      "Failed to record announcement view:",
      insertError.message,
      insertError.code,
    );
    return false;
  }

  const { error: updateError } = await supabase
    .from("post_views")
    .update({ viewed_at: viewedAt })
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (updateError) {
    console.error(
      "Failed to update announcement view:",
      updateError.message,
      updateError.code,
    );
    return false;
  }

  return true;
}

function normalizeMemberRole(role: string | null | undefined): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function memberRoleLabel(role?: MemberRole): string | undefined {
  if (role === "owner") return "President";
  if (role === "executive") return "Executive";
  if (role === "member") return "Member";
  return undefined;
}

async function fetchActiveMemberIdsForClub(clubId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("status", "active");

  if (error) {
    console.error("Failed to load active club members for views:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.user_id as string));
}

function countScopedViewsByPost(
  rows: Array<{ post_id: string; user_id: string }>,
  postIds: string[],
  activeMemberIds: Set<string>,
): Record<string, number> {
  const countMap: Record<string, number> = {};
  for (const postId of postIds) countMap[postId] = 0;
  for (const row of rows) {
    const postId = row.post_id as string;
    const userId = row.user_id as string;
    if (!activeMemberIds.has(userId)) continue;
    if (countMap[postId] === undefined) continue;
    countMap[postId] += 1;
  }
  return countMap;
}

/** View counts scoped to active members of a club (matches seen-list rows). */
export async function fetchPostViewCountsForClub(
  postIds: string[],
  clubId: string,
): Promise<Record<string, number>> {
  if (postIds.length === 0) return {};

  const [viewsRes, activeMemberIds] = await Promise.all([
    supabase.from("post_views").select("post_id, user_id").in("post_id", postIds),
    fetchActiveMemberIdsForClub(clubId),
  ]);

  if (viewsRes.error) {
    console.error("Failed to load announcement view counts:", viewsRes.error.message);
    return {};
  }

  return countScopedViewsByPost(
    (viewsRes.data ?? []) as Array<{ post_id: string; user_id: string }>,
    postIds,
    activeMemberIds,
  );
}

/** @deprecated Prefer fetchPostViewCountsForClub when a clubId is available. */
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
      return {
        userId,
        name: nameById.get(userId) ?? "Member",
        roleTitle: member?.roleTitle ?? memberRoleLabel(member?.role),
        role: member?.role,
        viewedAt: (row.viewed_at as string) ?? "",
      };
    });
}
