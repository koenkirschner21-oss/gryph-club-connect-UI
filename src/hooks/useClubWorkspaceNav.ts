import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthContext } from "../context/useAuthContext";
import { ensureMyClubChats } from "../lib/clubChatProvisioning";
import { supabase } from "../lib/supabaseClient";
import {
  buildWorkspaceNavContext,
  documentVisibleToMember,
  shouldShowAnalyticsNav,
  shouldShowWorkspaceNavLink,
  userHasMeetingInvite,
  type WorkspaceNavFlags,
  type WorkspaceNavKey,
} from "../lib/workspaceNavVisibility";
import { useClubMemberAccess } from "./useClubMemberAccess";
import { useClubMembers } from "./useClubMembers";

const EMPTY_FLAGS: WorkspaceNavFlags = {
  hasChat: false,
  hasAssignedTasks: false,
  hasMeetingInvite: false,
  hasMemberDocuments: false,
  hasActiveHiring: false,
  isHiringReviewer: false,
};

export function useClubWorkspaceNav(clubId: string | undefined) {
  const { user } = useAuthContext();
  const access = useClubMemberAccess(clubId);
  const { members, pendingMembers } = useClubMembers(clubId);

  const [flags, setFlags] = useState<WorkspaceNavFlags>(EMPTY_FLAGS);
  const [flagsLoading, setFlagsLoading] = useState(true);

  const loadFlags = useCallback(async () => {
    if (!clubId || !user?.id) {
      setFlags(EMPTY_FLAGS);
      setFlagsLoading(false);
      return;
    }

    setFlagsLoading(true);

    try {
      if (access.hasMembership) {
        await ensureMyClubChats(supabase, clubId);
      }

      const [
        membershipsRes,
        assignedTasksRes,
        meetingsRes,
        documentsRes,
        openListingsRes,
      ] = await Promise.all([
        supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", user.id),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("assigned_to", user.id)
          .neq("status", "done"),
        supabase.from("club_meetings").select("notes").eq("club_id", clubId),
        supabase.from("club_documents").select("visibility").eq("club_id", clubId),
        supabase
          .from("hiring_listings")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("is_open", true),
      ]);

      let hasChat = false;
      const membershipIds = (membershipsRes.data ?? []).map(
        (row) => row.conversation_id as string,
      );
      if (membershipIds.length > 0) {
        const { count } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .in("id", membershipIds);
        hasChat = (count ?? 0) > 0;
      }

      const activeMembers = members.filter((member) => member.status === "active");
      const hasMeetingInvite = (meetingsRes.data ?? []).some((row) =>
        userHasMeetingInvite(user.id, activeMembers, (row.notes as string | null) ?? null),
      );

      const hasMemberDocuments = (documentsRes.data ?? []).some((row) =>
        documentVisibleToMember(row.visibility as string | null),
      );

      setFlags({
        hasChat,
        hasAssignedTasks: (assignedTasksRes.count ?? 0) > 0,
        hasMeetingInvite,
        hasMemberDocuments,
        hasActiveHiring: (openListingsRes.count ?? 0) > 0,
        isHiringReviewer: false,
      });
    } catch (error) {
      console.error("Failed to load workspace nav flags:", error);
      setFlags(EMPTY_FLAGS);
    } finally {
      setFlagsLoading(false);
    }
  }, [clubId, members, user?.id, access.hasMembership]);

  useEffect(() => {
    if (access.loading) return;
    void loadFlags();
  }, [access.loading, loadFlags]);

  const navContext = useMemo(
    () =>
      buildWorkspaceNavContext(
        access.accessLevel,
        access.role,
        access.permissions,
        flags,
        access.hasMembership,
      ),
    [access.accessLevel, access.hasMembership, access.permissions, access.role, flags],
  );

  const isLinkVisible = useCallback(
    (key: WorkspaceNavKey) => shouldShowWorkspaceNavLink(key, navContext),
    [navContext],
  );

  const showAnalytics = shouldShowAnalyticsNav(navContext);

  const pendingJoinRequestCount = access.canApproveMembers
    ? pendingMembers.length
    : 0;

  return {
    ...access,
    flags,
    flagsLoading,
    navContext,
    isLinkVisible,
    showAnalytics,
    pendingJoinRequestCount,
    settingsLabel: access.canManageClubSettings ? "Club Settings" : "My Membership",
    refreshFlags: loadFlags,
  };
}
