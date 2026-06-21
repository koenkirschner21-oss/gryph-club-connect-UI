import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { ClubEvent } from "../types";

export interface DashboardEvent extends ClubEvent {
  clubName: string;
  clubAbbreviation: string;
  clubBrandColor: string;
}

function mapEventRow(row: Record<string, unknown>): DashboardEvent {
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
}

/**
 * Fetches upcoming events from joined clubs plus any upcoming events the user RSVP'd to.
 */
export function useDashboardEvents(
  joinedClubIds: string[],
  userId: string | undefined,
) {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const clubKey = joinedClubIds.join(",");

  useEffect(() => {
    if (!userId && joinedClubIds.length === 0) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let cancelled = false;

    async function fetchEvents() {
      const today = new Date().toISOString().slice(0, 10);
      const byId = new Map<string, DashboardEvent>();

      if (joinedClubIds.length > 0) {
        const { data, error } = await supabase
          .from("events")
          .select(
            "id, club_id, title, description, date, time, location, created_at, clubs:club_id ( name, abbreviation, brand_color )",
          )
          .in("club_id", joinedClubIds)
          .gte("date", today)
          .order("date", { ascending: true })
          .limit(20);

        if (cancelled) return;

        if (error) {
          console.error("Failed to load dashboard events:", error.message);
        } else {
          for (const row of data ?? []) {
            const mapped = mapEventRow(row as Record<string, unknown>);
            byId.set(mapped.id, mapped);
          }
        }
      }

      if (userId) {
        const { data: rsvpRows, error: rsvpError } = await supabase
          .from("event_rsvps")
          .select("event_id")
          .eq("user_id", userId)
          .in("status", ["going", "maybe"]);

        if (cancelled) return;

        if (rsvpError) {
          console.error("Failed to load RSVP events:", rsvpError.message);
        } else {
          const rsvpEventIds = Array.from(
            new Set(
              (rsvpRows ?? [])
                .map((row) => row.event_id as string)
                .filter((id) => id && !byId.has(id)),
            ),
          );

          if (rsvpEventIds.length > 0) {
            const { data: rsvpEvents, error: eventsError } = await supabase
              .from("events")
              .select(
                "id, club_id, title, description, date, time, location, created_at, clubs:club_id ( name, abbreviation, brand_color )",
              )
              .in("id", rsvpEventIds)
              .gte("date", today)
              .order("date", { ascending: true });

            if (!cancelled && !eventsError) {
              for (const row of rsvpEvents ?? []) {
                const mapped = mapEventRow(row as Record<string, unknown>);
                byId.set(mapped.id, mapped);
              }
            } else if (eventsError) {
              console.error("Failed to load RSVP event details:", eventsError.message);
            }
          }
        }
      }

      if (cancelled) return;

      const merged = Array.from(byId.values()).sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });

      setEvents(merged.slice(0, 30));
      setLoading(false);
    }

    void fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [clubKey, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, loading };
}
