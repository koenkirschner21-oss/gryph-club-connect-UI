import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import type { ClubEvent } from "../types";
import { normalizeVisibility } from "../lib/contentVisibility";

/** Map a Supabase `events` row to our ClubEvent type. */
function mapEventRow(row: Record<string, unknown>): ClubEvent {
  const creator = (row.creator ?? null) as Record<string, unknown> | null;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    date: (row.date as string) ?? "",
    time: (row.time as string) ?? "",
    location: (row.location as string) ?? "",
    createdBy: (row.created_by as string) ?? undefined,
    creatorName: (creator?.full_name as string) ?? undefined,
    creatorAvatar: (creator?.avatar_url as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
    visibility: normalizeVisibility(row.visibility as string | null, "public"),
    signupRequiresApproval: Boolean(row.signup_requires_approval),
  };
}

export interface UseClubEventsReturn {
  events: ClubEvent[];
  loading: boolean;
  error: string | null;
  createEvent: (
    fields: Pick<ClubEvent, "title" | "description" | "date" | "time" | "location"> & {
      visibility?: ClubEvent["visibility"];
      signupRequiresApproval?: boolean;
    },
  ) => Promise<boolean>;
  updateEvent: (
    eventId: string,
    fields: Partial<
      Pick<ClubEvent, "title" | "description" | "date" | "time" | "location" | "visibility" | "signupRequiresApproval">
    >,
  ) => Promise<boolean>;
  deleteEvent: (eventId: string) => Promise<boolean>;
  refresh: () => void;
}

/**
 * Hook that provides CRUD operations for events belonging to a specific club.
 * Fetches from the Supabase `events` table.
 */
export function useClubEvents(clubId: string | undefined): UseClubEventsReturn {
  const { user } = useAuthContext();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch events for this club
  useEffect(() => {
    if (!clubId) return;

    let cancelled = false;

    supabase
      .from("events")
      .select(`
        id,
        club_id,
        title,
        description,
        date,
        time,
        location,
        visibility,
        signup_requires_approval,
        created_at,
        created_by,
        creator:profiles!events_creator_profile_fkey (
          full_name,
          avatar_url
        )
      `)
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

  useEffect(() => {
    if (!clubId) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`events:club:${clubId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `club_id=eq.${clubId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [clubId, refresh]);

  const createEvent = useCallback(
    async (
      fields: Pick<ClubEvent, "title" | "description" | "date" | "time" | "location"> & {
        visibility?: ClubEvent["visibility"];
        signupRequiresApproval?: boolean;
      },
    ): Promise<boolean> => {
      if (!clubId || !user) return false;

      const { data, error: err } = await supabase
        .from("events")
        .insert({
          club_id: clubId,
          title: fields.title,
          description: fields.description,
          date: fields.date,
          time: fields.time,
          location: fields.location,
          visibility: fields.visibility ?? "public",
          signup_requires_approval: fields.signupRequiresApproval ?? false,
          created_by: user.id,
        })
        .select(`
          id,
          club_id,
          title,
          description,
          date,
          time,
          location,
          visibility,
          signup_requires_approval,
          created_at,
          created_by,
          creator:profiles!events_creator_profile_fkey (
            full_name,
            avatar_url
          )
        `)
        .single();

      if (err || !data) {
        console.error("Failed to create event:", err?.message);
        return false;
      }

      setEvents((prev) => [...prev, mapEventRow(data)]);

      return true;
    },
    [clubId, user],
  );

  const updateEvent = useCallback(
    async (
      eventId: string,
      fields: Partial<
        Pick<ClubEvent, "title" | "description" | "date" | "time" | "location" | "visibility" | "signupRequiresApproval">
      >,
    ): Promise<boolean> => {
      const row: Record<string, unknown> = {};
      if (fields.title !== undefined) row.title = fields.title;
      if (fields.description !== undefined) row.description = fields.description;
      if (fields.date !== undefined) row.date = fields.date;
      if (fields.time !== undefined) row.time = fields.time;
      if (fields.location !== undefined) row.location = fields.location;
      if (fields.visibility !== undefined) row.visibility = fields.visibility;
      if (fields.signupRequiresApproval !== undefined) {
        row.signup_requires_approval = fields.signupRequiresApproval;
      }

      const { data, error: err } = await supabase
        .from("events")
        .update(row)
        .eq("id", eventId)
        .select(`
          id,
          club_id,
          title,
          description,
          date,
          time,
          location,
          visibility,
          signup_requires_approval,
          created_at,
          created_by,
          creator:profiles!events_creator_profile_fkey (
            full_name,
            avatar_url
          )
        `)
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
