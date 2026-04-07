import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityType = "post" | "event";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  clubId: string;
  clubName: string;
  title: string;
  preview: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches a merged activity feed of recent announcements and events
 * from the clubs the user has joined, sorted newest-first.
 */
export function useActivityFeed(joinedClubIds: string[]) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (joinedClubIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchFeed() {
      // Fetch posts and events in parallel, each limited to 20 recent rows
      const [postsRes, eventsRes] = await Promise.all([
        supabase
          .from("posts")
          .select("id, club_id, title, content, created_at, clubs:club_id ( name )")
          .in("club_id", joinedClubIds)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("events")
          .select("id, club_id, title, description, created_at, clubs:club_id ( name )")
          .in("club_id", joinedClubIds)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      const feed: ActivityItem[] = [];

      // Map posts
      if (postsRes.data) {
        for (const row of postsRes.data) {
          const club = (row.clubs ?? {}) as Record<string, unknown>;
          feed.push({
            id: row.id as string,
            type: "post",
            clubId: row.club_id as string,
            clubName: (club.name as string) ?? "Unknown Club",
            title: (row.title as string) ?? "",
            preview: truncate((row.content as string) ?? "", 100),
            createdAt: (row.created_at as string) ?? "",
          });
        }
      }

      // Map events
      if (eventsRes.data) {
        for (const row of eventsRes.data) {
          const club = (row.clubs ?? {}) as Record<string, unknown>;
          feed.push({
            id: row.id as string,
            type: "event",
            clubId: row.club_id as string,
            clubName: (club.name as string) ?? "Unknown Club",
            title: (row.title as string) ?? "",
            preview: truncate((row.description as string) ?? "", 100),
            createdAt: (row.created_at as string) ?? "",
          });
        }
      }

      // Sort newest first and keep top 20
      feed.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setItems(feed.slice(0, 20));
      setLoading(false);
    }

    fetchFeed();

    return () => {
      cancelled = true;
    };
  }, [joinedClubIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}
