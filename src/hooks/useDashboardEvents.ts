import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { ClubEvent } from "../types";

export interface DashboardEvent extends ClubEvent {
  clubName: string;
  clubAbbreviation: string;
  clubBrandColor: string;
}

/**
 * Fetches upcoming events from ALL joined clubs for the dashboard.
 * Returns events sorted by date ascending (soonest first).
 */
export function useDashboardEvents(joinedClubIds: string[]) {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const clubKey = joinedClubIds.join(",");

  useEffect(() => {
    if (joinedClubIds.length === 0) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let cancelled = false;

    async function fetchEvents() {
      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, club_id, title, description, date, time, location, created_at, clubs:club_id ( name, abbreviation, brand_color )"
        )
        .in("club_id", joinedClubIds)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(20);

      if (cancelled) return;

      if (error) {
        console.error("Failed to load dashboard events:", error.message);
        setLoading(false);
        return;
      }

      const mapped: DashboardEvent[] = (data ?? []).map((row) => {
        const clubRaw = row.clubs as unknown;
        const club = (
          Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
        ) as Record<string, unknown>;

        return {
          id: row.id as string,
          clubId: row.club_id as string,
          title: (row.title as string) ?? "",
          description: (row.description as string) ?? "",
          date: (row.date as string) ?? "",
          time: (row.time as string) ?? "",
          location: (row.location as string) ?? "",
          createdAt: (row.created_at as string) ?? "",
          clubName: (club.name as string) ?? "Unknown Club",
          clubAbbreviation: (club.abbreviation as string) ?? "",
          clubBrandColor: (club.brand_color as string) ?? "#C20430",
        };
      });

      setEvents(mapped);
      setLoading(false);
    }

    fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [clubKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, loading };
}
