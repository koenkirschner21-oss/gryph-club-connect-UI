import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import { DASHBOARD_MY_TASKS_EXCLUDED_STATUSES } from "../lib/dashboardMyTasksScope";

/**
 * Fetches the count of open tasks assigned to the current user across joined
 * clubs for the dashboard (shared "My Tasks" scope).
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
        .neq("status", DASHBOARD_MY_TASKS_EXCLUDED_STATUSES[0])
        .neq("status", DASHBOARD_MY_TASKS_EXCLUDED_STATUSES[1]);

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
