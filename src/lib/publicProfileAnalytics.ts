import { supabase } from "./supabaseClient";

export type PublicProfileEventType =
  | "page_view"
  | "join_click"
  | "join_request"
  | "event_click"
  | "hiring_click"
  | "save_click";

export interface PublicProfileEventRow {
  id: string;
  club_id: string;
  event_type: PublicProfileEventType;
  target_id: string | null;
  created_at: string;
}

export async function recordPublicProfileEvent(
  clubId: string,
  eventType: PublicProfileEventType,
  targetId?: string | null,
): Promise<void> {
  const payload: {
    club_id: string;
    event_type: PublicProfileEventType;
    target_id?: string;
  } = {
    club_id: clubId,
    event_type: eventType,
  };
  if (targetId) payload.target_id = targetId;

  const { error } = await supabase.from("club_public_profile_events").insert(payload);
  if (error) {
    console.error("Failed to record public profile event:", error.message);
  }
}

export async function fetchPublicProfileEvents(
  clubId: string,
): Promise<PublicProfileEventRow[]> {
  const { data, error } = await supabase
    .from("club_public_profile_events")
    .select("id, club_id, event_type, target_id, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load public profile analytics:", error.message);
    return [];
  }

  return (data ?? []) as PublicProfileEventRow[];
}

export async function fetchClubSavedCount(clubId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_clubs")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("type", "saved");

  if (error) {
    console.error("Failed to load saved club count:", error.message);
    return 0;
  }

  return count ?? 0;
}

export function countEventsByType(
  events: PublicProfileEventRow[],
  eventType: PublicProfileEventType,
): number {
  return events.filter((event) => event.event_type === eventType).length;
}

export function buildProfileViewsOverTime(events: PublicProfileEventRow[]) {
  const pageViews = events.filter((event) => event.event_type === "page_view");
  const now = new Date();
  const points: { label: string; views: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const views = pageViews.filter((event) => {
      const createdAt = new Date(event.created_at);
      return createdAt >= monthDate && createdAt <= monthEnd;
    }).length;
    points.push({
      label: monthDate.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      views,
    });
  }

  return points;
}

export function buildPublicProfileSectionInsight(params: {
  totalEvents: number;
  pageViews: number;
  joinClicks: number;
  savedCount: number;
}): { text: string; sentiment: "warning" | "positive" | "neutral" } {
  const { totalEvents, pageViews, joinClicks, savedCount } = params;

  if (totalEvents === 0) {
    return {
      sentiment: "neutral",
      text: "Public profile tracking just started. Share your club page to collect views and click data.",
    };
  }
  if (pageViews < 5) {
    return {
      sentiment: "warning",
      text: `Only ${pageViews} profile view${pageViews === 1 ? "" : "s"} recorded so far — still early days. Promote your public link during tabling and social posts.`,
    };
  }
  return {
    sentiment: joinClicks > 0 || savedCount > 0 ? "positive" : "neutral",
    text: `${pageViews} profile views with ${joinClicks} join action${joinClicks === 1 ? "" : "s"} and ${savedCount} saved club${savedCount === 1 ? "" : "s"}.`,
  };
}

export function isLowPublicProfileData(totalTrackedEvents: number): boolean {
  return totalTrackedEvents < 5;
}
