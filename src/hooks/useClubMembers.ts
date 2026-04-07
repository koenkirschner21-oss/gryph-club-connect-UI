import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { ClubMember, MemberRole } from "../types";

/** Map a joined club_members + profiles row to our ClubMember type. */
function mapMemberRow(row: Record<string, unknown>): ClubMember {
  const profile = (row.profiles ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    userId: row.user_id as string,
    role: (row.role as MemberRole) ?? "member",
    status: (row.status as ClubMember["status"]) ?? "active",
    joinedAt: (row.created_at as string) ?? new Date().toISOString(),
    fullName: (profile.full_name as string) ?? undefined,
    email: (profile.email as string) ?? undefined,
    avatarUrl: (profile.avatar_url as string) ?? undefined,
    program: (profile.program as string) ?? undefined,
  };
}

export interface UseClubMembersReturn {
  members: ClubMember[];
  loading: boolean;
  error: string | null;
  updateRole: (memberId: string, newRole: MemberRole) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    supabase
      .from("club_members")
      .select("*, profiles ( full_name, email, avatar_url, program )")
      .eq("club_id", clubId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error("Failed to load members:", err.message);
          setError(err.message);
        } else {
          setMembers((data ?? []).map(mapMemberRow));
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, refreshKey]);

  /** Change a member's role (e.g. member → exec, exec → member). */
  const updateRole = useCallback(
    async (memberId: string, newRole: MemberRole): Promise<boolean> => {
      const { error: err } = await supabase
        .from("club_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (err) {
        console.error("Failed to update role:", err.message);
        return false;
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
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

  return { members, loading, error, updateRole, removeMember, refresh };
}
