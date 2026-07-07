import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Fetches the count of active (non-done) tasks assigned to the current user
 * across joined clubs for the dashboard.
 */
export function useDashboardTasks(
  joinedClubIds: string[],
  userId: string | undefined,
  membershipAccessKey: string,
) {
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const clubKey = joinedClubIds.join(",");

  useEffect(() => {
    if (joinedClubIds.length === 0 || !userId) {
      queueMicrotask(() => {
        setActiveCount(0);
        setLoading(false);
      });
      return;
    }

    setActiveCount(0);

    let cancelled = false;

    async function fetchTaskCount() {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("club_id", joinedClubIds)
        .eq("assigned_to", userId)
        .neq("status", "done")
        .neq("status", "cancelled");

      if (cancelled) return;

      if (error) {
        console.error("Failed to load task count:", error.message);
      } else {
        setActiveCount(count ?? 0);
      }
      setLoading(false);
    }

    void fetchTaskCount();

    return () => {
      cancelled = true;
    };
  }, [clubKey, membershipAccessKey, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { activeCount, loading };
}
