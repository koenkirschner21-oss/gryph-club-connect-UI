import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeClubSetupProgress,
  type ClubSetupProgress,
  type ClubSetupProgressCounts,
} from "../lib/clubProfileCompletion";
import { supabase } from "../lib/supabaseClient";
import type { Club } from "../types";

export type UseClubSetupProgressResult = {
  progress: ClubSetupProgress;
  counts: ClubSetupProgressCounts;
  loading: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
};

/**
 * Shared setup progress for dashboard + drawer. Keeps milestone math and
 * supplemental counts (posts/events/docs/invites) in one place.
 */
export function useClubSetupProgress(
  club: Club | null | undefined,
  options?: {
    postsCount?: number;
    eventsCount?: number;
    activeMemberCount?: number;
    /** When true, fetch documents + invite counts from Supabase. */
    fetchSupplemental?: boolean;
  },
): UseClubSetupProgressResult {
  const fetchSupplemental = options?.fetchSupplemental !== false;
  const [documentsCount, setDocumentsCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(fetchSupplemental && club?.id));
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!club?.id || !fetchSupplemental) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setRefreshError(null);

    const [documentsRes, executiveInvitesRes, clubInvitesRes] = await Promise.all([
      supabase
        .from("club_documents")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id),
      supabase
        .from("executive_invites")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)
        .eq("status", "pending"),
      supabase
        .from("club_invites")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)
        .eq("status", "pending"),
    ]);

    if (documentsRes.error || executiveInvitesRes.error || clubInvitesRes.error) {
      console.error(
        "Failed to refresh club setup counts:",
        documentsRes.error?.message ??
          executiveInvitesRes.error?.message ??
          clubInvitesRes.error?.message,
      );
      setRefreshError("Could not refresh setup progress. Try again.");
      setLoading(false);
      return;
    }

    setDocumentsCount(documentsRes.count ?? 0);
    setPendingInviteCount(
      (executiveInvitesRes.count ?? 0) + (clubInvitesRes.count ?? 0),
    );
    setLoading(false);
  }, [club?.id, fetchSupplemental]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    const handleRefresh = () => setRefreshKey((key) => key + 1);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleRefresh();
    };
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("club-setup-progress-changed", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("club-setup-progress-changed", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const counts = useMemo<ClubSetupProgressCounts>(
    () => ({
      postsCount: options?.postsCount ?? 0,
      eventsCount: options?.eventsCount ?? 0,
      documentsCount,
      activeMemberCount: options?.activeMemberCount ?? 1,
      pendingInviteCount,
    }),
    [
      options?.postsCount,
      options?.eventsCount,
      options?.activeMemberCount,
      documentsCount,
      pendingInviteCount,
    ],
  );

  const progress = useMemo(() => {
    if (!club) {
      return {
        milestones: [],
        requiredMilestones: [],
        recommendedMilestones: [],
        requiredCompletedCount: 0,
        requiredTotalCount: 0,
        recommendedCompletedCount: 0,
        recommendedTotalCount: 0,
        percent: 0,
        allRequiredComplete: false,
        canPreviewPublicProfile: false,
        nextRequiredMilestone: null,
        missingLabels: [],
        items: [],
        requiredItems: [],
        optionalItems: [],
        completedCount: 0,
        totalCount: 0,
        allComplete: false,
      } satisfies ClubSetupProgress;
    }
    return computeClubSetupProgress(club, counts);
  }, [club, counts]);

  return {
    progress,
    counts,
    loading,
    refreshError,
    refresh,
  };
}
