import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Fetches the count of active (non-done) tasks across all joined clubs for the dashboard.
 */
export function useDashboardTasks(joinedClubIds: string[]) {
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const clubKey = joinedClubIds.join(",");

  useEffect(() => {
    if (joinedClubIds.length === 0) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let cancelled = false;

    async function fetchTaskCount() {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("club_id", joinedClubIds)
        .neq("status", "done");

      if (cancelled) return;

      if (error) {
        console.error("Failed to load task count:", error.message);
      } else {
        setActiveCount(count ?? 0);
      }
      setLoading(false);
    }

    fetchTaskCount();

    return () => {
      cancelled = true;
    };
  }, [clubKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { activeCount, loading };
}
