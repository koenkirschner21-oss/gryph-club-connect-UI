import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { ClubEvent } from "../types";

/** Map a Supabase `events` row to our ClubEvent type. */
function mapEventRow(row: Record<string, unknown>): ClubEvent {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    date: (row.date as string) ?? "",
    time: (row.time as string) ?? "",
    location: (row.location as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
  };
}

export interface UseClubEventsReturn {
  events: ClubEvent[];
  loading: boolean;
  error: string | null;
  createEvent: (
    fields: Pick<ClubEvent, "title" | "description" | "date" | "time" | "location">,
  ) => Promise<boolean>;
  updateEvent: (
    eventId: string,
    fields: Partial<Pick<ClubEvent, "title" | "description" | "date" | "time" | "location">>,
  ) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  refresh: () => void;
}

/**
 * Hook that provides CRUD operations for events belonging to a specific club.
 * Fetches from the Supabase `events` table.
 */
export function useClubEvents(clubId: string | undefined): UseClubEventsReturn {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch events for this club
  useEffect(() => {
    if (!clubId) return;

    let cancelled = false;

    supabase
      .from("events")
      .select("*")
      .eq("club_id", clubId)
      .order("date", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error("Failed to load events:", err.message);
          setError(err.message);
        } else {
          setEvents((data ?? []).map(mapEventRow));
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, refreshKey]);

  const createEvent = useCallback(
    async (
      fields: Pick<ClubEvent, "title" | "description" | "date" | "time" | "location">,
    ): Promise<boolean> => {
      if (!clubId) return false;

      const { data, error: err } = await supabase
        .from("events")
        .insert({
          club_id: clubId,
          title: fields.title,
          description: fields.description,
          date: fields.date,
          time: fields.time,
          location: fields.location,
        })
        .select()
        .single();

      if (err || !data) {
        console.error("Failed to create event:", err?.message);
        return false;
      }

      setEvents((prev) => [...prev, mapEventRow(data)]);

      // Notify club members about the new event (fire-and-forget)
      supabase
        .from("club_members")
        .select("user_id")
        .eq("club_id", clubId)
        .eq("status", "active")
        .then(({ data: members }) => {
          if (!members || members.length === 0) return;
          const rows = members.map((m) => ({
            user_id: m.user_id,
            type: "new_event",
            message: `New event: ${fields.title} on ${fields.date}`,
            club_id: clubId,
          }));
          supabase
            .from("notifications")
            .insert(rows)
            .then(({ error: notifErr }) => {
              if (notifErr) {
                console.error("Failed to send notifications:", notifErr.message);
              }
            });
        });

      return true;
    },
    [clubId],
  );

  const updateEvent = useCallback(
    async (
      eventId: string,
      fields: Partial<Pick<ClubEvent, "title" | "description" | "date" | "time" | "location">>,
    ): Promise<boolean> => {
      const row: Record<string, unknown> = {};
      if (fields.title !== undefined) row.title = fields.title;
      if (fields.description !== undefined) row.description = fields.description;
      if (fields.date !== undefined) row.date = fields.date;
      if (fields.time !== undefined) row.time = fields.time;
      if (fields.location !== undefined) row.location = fields.location;

      const { data, error: err } = await supabase
        .from("events")
        .update(row)
        .eq("id", eventId)
        .select()
        .single();

      if (err || !data) {
        console.error("Failed to update event:", err?.message);
        return false;
      }

      const updated = mapEventRow(data);
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
      return true;
    },
    [],
  );

  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    const { error: err } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (err) {
      console.error("Failed to delete event:", err.message);
      return false;
    }

    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    return true;
  }, []);

  return { events, loading, error, createEvent, updateEvent, deleteEvent, refresh };
}
