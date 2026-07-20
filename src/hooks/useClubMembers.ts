import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { normalizeMembershipType } from "../lib/clubJoinUtils";
import type { ClubMember, MemberRole, MembershipType, AccessLevel } from "../types";
import { parseJoinAnswers } from "../lib/clubJoinUtils";
import { removeRealtimeChannel, uniqueRealtimeTopic } from "../lib/realtimeChannels";

/** Map a joined club_members + profiles row to our ClubMember type. */
function mapMemberRow(row: Record<string, unknown>): ClubMember {
  const profile = (row.member_profile ?? {}) as Record<string, unknown>;
  const rawAccessLevel = row.access_level as string | null | undefined;
  const accessLevel =
    rawAccessLevel === "president" ||
    rawAccessLevel === "managerial_executive" ||
    rawAccessLevel === "executive" ||
    rawAccessLevel === "member"
      ? rawAccessLevel
      : undefined;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    userId: row.user_id as string,
    role: (row.role as MemberRole) ?? "member",
    accessLevel,
    status: (row.status as ClubMember["status"]) ?? "active",
    joinedAt: (row.created_at as string) ?? new Date().toISOString(),
    fullName: (profile.full_name as string) ?? undefined,
    email: (profile.email as string) ?? undefined,
    avatarUrl: (profile.avatar_url as string) ?? undefined,
    program: (profile.program as string) ?? undefined,
    yearOfStudy: (profile.year_of_study as string) ?? undefined,
    roleTitle: (row.title as string | null)?.trim() || undefined,
    joinAnswers: parseJoinAnswers(row.join_answers),
    joinMessage: (row.join_message as string | null)?.trim() || undefined,
  };
}

export interface UseClubMembersReturn {
  members: ClubMember[];
  pendingMembers: ClubMember[];
  membershipType: MembershipType;
  loading: boolean;
  error: string | null;
  updateRole: (
    memberId: string,
    newRole: MemberRole,
    options?: { accessLevel?: AccessLevel; title?: string | null },
  ) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
  approveRequest: (
    memberId: string,
  ) => Promise<{ ok: true; outcome: string } | { ok: false; error: string }>;
  rejectRequest: (
    memberId: string,
    reason?: string,
  ) => Promise<{ ok: true; outcome: string } | { ok: false; error: string }>;
  refresh: () => void;
}

/**
 * Hook that fetches club members joined with their profile data,
 * and provides admin operations (update role, remove member).
 */
export function useClubMembers(
  clubId: string | undefined,
): UseClubMembersReturn {
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<ClubMember[]>([]);
  const [membershipType, setMembershipType] = useState<MembershipType>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    Promise.all([
      supabase
        .from("clubs")
        .select("membership_type")
        .eq("id", clubId)
        .maybeSingle(),
      supabase
        .from("club_members")
        .select(`
          id,
          club_id,
          user_id,
          role,
          status,
          created_at,
          title,
          access_level,
          join_answers,
          join_message,
          member_profile:profiles!club_members_user_profile_fkey (
            full_name,
            email,
            avatar_url,
            program,
            year_of_study
          )
        `)
        .eq("club_id", clubId)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabase
        .from("club_members")
        .select(`
          id,
          club_id,
          user_id,
          role,
          status,
          created_at,
          title,
          access_level,
          join_answers,
          join_message,
          member_profile:profiles!club_members_user_profile_fkey (
            full_name,
            email,
            avatar_url,
            program,
            year_of_study
          )
        `)
        .eq("club_id", clubId)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]).then(([clubRes, activeRes, pendingRes]) => {
      if (cancelled) return;
      if (clubRes.error) {
        console.error("Failed to load club membership type:", clubRes.error.message);
      } else {
        setMembershipType(
          normalizeMembershipType(clubRes.data?.membership_type),
        );
      }
      if (activeRes.error) {
        console.error("Failed to load members:", activeRes.error.message);
        setError(activeRes.error.message);
      } else {
        setMembers((activeRes.data ?? []).map(mapMemberRow));
        setError(null);
      }
      if (pendingRes.error) {
        console.error("Failed to load pending members:", pendingRes.error.message);
      } else {
        setPendingMembers((pendingRes.data ?? []).map(mapMemberRow));
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clubId, refreshKey]);

  useEffect(() => {
    if (!clubId) {
      removeRealtimeChannel(supabase, realtimeChannelRef.current);
      realtimeChannelRef.current = null;
      return;
    }

    removeRealtimeChannel(supabase, realtimeChannelRef.current);
    realtimeChannelRef.current = null;

    const channel = supabase.channel(uniqueRealtimeTopic(`club-members:${clubId}`));

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "club_members",
        filter: `club_id=eq.${clubId}`,
      },
      () => {
        refresh();
      },
    );

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Club members realtime channel error for club:", clubId);
        refresh();
      }
    });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
      removeRealtimeChannel(supabase, channel);
    };
  }, [clubId, refresh]);

  /** Change a member's role (e.g. member → exec, exec → member). */
  const updateRole = useCallback(
    async (
      memberId: string,
      newRole: MemberRole,
      options?: { accessLevel?: AccessLevel; title?: string | null },
    ): Promise<boolean> => {
      const payload: Record<string, unknown> = { role: newRole };
      if (options?.accessLevel !== undefined) {
        payload.access_level = options.accessLevel;
      }
      if (options?.title !== undefined) {
        payload.title = options.title;
      }

      const { error: err } = await supabase
        .from("club_members")
        .update(payload)
        .eq("id", memberId);

      if (err) {
        console.error("Failed to update role:", err.message);
        return false;
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                role: newRole,
                accessLevel: options?.accessLevel ?? m.accessLevel,
                roleTitle:
                  options?.title !== undefined
                    ? options.title || undefined
                    : m.roleTitle,
              }
            : m,
        ),
      );
      return true;
    },
    [],
  );

  /** Remove a member from the club. */
  const removeMember = useCallback(
    async (memberId: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("club_members")
        .delete()
        .eq("id", memberId);

      if (err) {
        console.error("Failed to remove member:", err.message);
        return false;
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      return true;
    },
    [],
  );

  /** Approve a pending join request → set status to 'active'. */
  const approveRequest = useCallback(
    async (
      memberId: string,
    ): Promise<{ ok: true; outcome: string } | { ok: false; error: string }> => {
      const { data, error: err } = await supabase.rpc("approve_club_join_request", {
        p_member_id: memberId,
      });

      if (err) {
        console.error("Failed to approve request:", err.message);
        return { ok: false, error: err.message };
      }

      const outcome =
        data && typeof data === "object" && "outcome" in data
          ? String((data as { outcome?: string }).outcome ?? "approved")
          : "approved";

      if (outcome === "already_active" || outcome === "approved") {
        let approved: ClubMember | undefined;
        setPendingMembers((prev) => {
          approved = prev.find((m) => m.id === memberId);
          return prev.filter((m) => m.id !== memberId);
        });
        if (approved) {
          const approvedMember = approved;
          setMembers((active) => {
            if (active.some((m) => m.id === memberId || m.userId === approvedMember.userId)) {
              return active.map((m) =>
                m.id === memberId || m.userId === approvedMember.userId
                  ? { ...m, status: "active" as const }
                  : m,
              );
            }
            return [...active, { ...approvedMember, status: "active" as const }];
          });
        } else {
          // Already active elsewhere — refresh pending list only
          setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
        }
        return { ok: true, outcome };
      }

      return { ok: false, error: "Unexpected approval result." };
    },
    [],
  );

  /** Reject a pending join request → delete the row. */
  const rejectRequest = useCallback(
    async (
      memberId: string,
      reason?: string,
    ): Promise<{ ok: true; outcome: string } | { ok: false; error: string }> => {
      const { data, error: err } = await supabase.rpc("reject_club_join_request", {
        p_member_id: memberId,
        p_reason: reason?.trim() || null,
      });

      if (err) {
        console.error("Failed to reject request:", err.message);
        return { ok: false, error: err.message };
      }

      const outcome =
        data && typeof data === "object" && "outcome" in data
          ? String((data as { outcome?: string }).outcome ?? "rejected")
          : "rejected";

      setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
      return { ok: true, outcome };
    },
    [],
  );

  return {
    members,
    pendingMembers,
    membershipType,
    loading,
    error,
    updateRole,
    removeMember,
    approveRequest,
    rejectRequest,
    refresh,
  };
}
