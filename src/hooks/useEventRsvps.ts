import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import type { EventRsvp, RsvpCounts, RsvpStatus } from "../types";

/** Map a Supabase `event_rsvps` row (optionally joined with profiles) to EventRsvp. */
function mapRsvpRow(row: Record<string, unknown>): EventRsvp {
  const profile = (row.attendee ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    userId: row.user_id as string,
    status: row.status as RsvpStatus,
    createdAt: (row.created_at as string) ?? undefined,
    fullName: (profile.full_name as string) ?? undefined,
    avatarUrl: (profile.avatar_url as string) ?? undefined,
    program: (profile.program as string) ?? undefined,
  };
}

function emptyCounts(): RsvpCounts {
  return { going: 0, maybe: 0, not_going: 0 };
}

export interface UseEventRsvpsReturn {
  /** Current user's RSVP status for each event, keyed by event id. */
  myRsvps: Record<string, RsvpStatus>;
  /** RSVP counts per event, keyed by event id. */
  counts: Record<string, RsvpCounts>;
  /** Full attendee list (only fetched when requested, e.g. for admin view). */
  attendees: Record<string, EventRsvp[]>;
  /** Upsert (create or update) the current user's RSVP for an event. */
  setRsvp: (eventId: string, status: RsvpStatus) => Promise<boolean>;
  /** Remove the current user's RSVP for an event. */
  removeRsvp: (eventId: string) => Promise<boolean>;
  /** Load full attendee list for a specific event (admin use). */
  loadAttendees: (eventId: string) => Promise<void>;
  loading: boolean;
}

/**
 * Hook that provides RSVP operations for a set of events belonging to a club.
 * Pass the array of event IDs to fetch RSVPs for.
 */
export function useEventRsvps(eventIds: string[]): UseEventRsvpsReturn {
  const { user } = useAuthContext();
  const [myRsvps, setMyRsvps] = useState<Record<string, RsvpStatus>>({});
  const myRsvpsRef = useRef(myRsvps);
  useEffect(() => {
    myRsvpsRef.current = myRsvps;
  }, [myRsvps]);
  const [counts, setCounts] = useState<Record<string, RsvpCounts>>({});
  const [attendees, setAttendees] = useState<Record<string, EventRsvp[]>>({});
  const [loading, setLoading] = useState(true);

  // Fetch counts + current user's RSVP for all supplied event IDs
  useEffect(() => {
    if (eventIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchRsvpData() {
      // Fetch all rsvps for these events (just id, event_id, user_id, status)
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("id, event_id, user_id, status")
        .in("event_id", eventIds);

      if (cancelled) return;
      if (error) {
        console.error("Failed to load RSVPs:", error.message);
        setLoading(false);
        return;
      }

      const rows = data ?? [];

      // Build counts
      const newCounts: Record<string, RsvpCounts> = {};
      for (const eid of eventIds) {
        newCounts[eid] = emptyCounts();
      }
      for (const r of rows) {
        const eid = r.event_id as string;
        const status = r.status as RsvpStatus;
        if (newCounts[eid]) {
          newCounts[eid][status] += 1;
        }
      }
      setCounts(newCounts);

      // Build current user's RSVPs
      if (user) {
        const mine: Record<string, RsvpStatus> = {};
        for (const r of rows) {
          if ((r.user_id as string) === user.id) {
            mine[r.event_id as string] = r.status as RsvpStatus;
          }
        }
        setMyRsvps(mine);
      }

      setLoading(false);
    }

    fetchRsvpData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIds.join(","), user?.id]);

  /** Upsert current user's RSVP. */
  const setRsvp = useCallback(
    async (eventId: string, status: RsvpStatus): Promise<boolean> => {
      if (!user) return false;

      const { error } = await supabase
        .from("event_rsvps")
        .upsert(
          { event_id: eventId, user_id: user.id, status },
          { onConflict: "event_id,user_id" },
        );

      if (error) {
        console.error("Failed to set RSVP:", error.message);
        return false;
      }

      // Optimistic update for user's RSVP
      setMyRsvps((prev) => ({ ...prev, [eventId]: status }));

      // Optimistic update for counts
      setCounts((prev) => {
        const old = prev[eventId] ?? emptyCounts();
        const prevStatus = myRsvpsRef.current[eventId];
        const updated = { ...old };
        if (prevStatus) updated[prevStatus] = Math.max(0, updated[prevStatus] - 1);
        updated[status] += 1;
        return { ...prev, [eventId]: updated };
      });

      return true;
    },
    [user],
  );

  /** Remove current user's RSVP. */
  const removeRsvp = useCallback(
    async (eventId: string): Promise<boolean> => {
      if (!user) return false;

      const { error } = await supabase
        .from("event_rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to remove RSVP:", error.message);
        return false;
      }

      const prevStatus = myRsvpsRef.current[eventId];
      setMyRsvps((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });

      if (prevStatus) {
        setCounts((prev) => {
          const old = prev[eventId] ?? emptyCounts();
          return {
            ...prev,
            [eventId]: { ...old, [prevStatus]: Math.max(0, old[prevStatus] - 1) },
          };
        });
      }

      return true;
    },
    [user],
  );

  /** Load full attendee list with profile info for a specific event. */
  const loadAttendees = useCallback(async (eventId: string): Promise<void> => {
    const { data, error } = await supabase
      .from("event_rsvps")
      .select(`
        id,
        event_id,
        user_id,
        status,
        created_at,
        attendee:profiles!event_rsvps_user_profile_fkey (
          full_name,
          avatar_url,
          program
        )
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load attendees:", error.message);
      return;
    }

    setAttendees((prev) => ({
      ...prev,
      [eventId]: (data ?? []).map(mapRsvpRow),
    }));
  }, []);

  return { myRsvps, counts, attendees, setRsvp, removeRsvp, loadAttendees, loading };
}
