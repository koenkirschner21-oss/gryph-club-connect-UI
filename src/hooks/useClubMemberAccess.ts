import { useCallback, useEffect, useMemo, useState } from "react";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import {
  cloneDefaultPermissions,
  hasClubPermission,
  hasPermissionKey,
  isPresidentAccess,
  resolvePermissionRole,
  type PermissionRole,
  PERMISSION_CAPABILITY_ALIASES,
} from "../lib/clubPermissions";
import { accessLevelFromMember } from "../lib/memberRoleTitle";
import type { AccessLevel, MemberRole } from "../types";

function normalizeMemberRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function normalizeStoredAccessLevel(
  value: string | null | undefined,
): AccessLevel | null {
  if (
    value === "president" ||
    value === "managerial_executive" ||
    value === "executive" ||
    value === "member"
  ) {
    return value;
  }
  return null;
}

export function useClubMemberAccess(clubId: string | undefined) {
  const { user } = useAuthContext();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<MemberRole>("member");
  const [storedAccessLevel, setStoredAccessLevel] = useState<AccessLevel | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [memberTitle, setMemberTitle] = useState<string | null>(null);
  const [hasMembership, setHasMembership] = useState(false);
  const [loadedContext, setLoadedContext] = useState<{
    clubId: string | undefined;
    userId: string | null;
  }>({ clubId: undefined, userId: null });

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
      const currentUserId = user?.id ?? null;

      setRole("member");
      setStoredAccessLevel(null);
      setJoinedAt(null);
      setMemberTitle(null);
      setHasMembership(false);

      if (!currentUserId || !clubId) {
        if (!cancelled) {
          setLoading(false);
          setLoadedContext({ clubId, userId: currentUserId });
          setHasMembership(false);
        }
        return;
      }

      setLoading(true);
      setLoadedContext({ clubId: undefined, userId: currentUserId });

      const previewRole = localStorage.getItem("previewRole");
      if (previewRole) {
        if (!cancelled) {
          const previewMemberRole = previewRole as MemberRole;
          setRole(previewMemberRole);
          setStoredAccessLevel(
            previewMemberRole === "owner"
              ? "president"
              : previewMemberRole === "executive"
                ? "executive"
                : "member",
          );
          setHasMembership(true);
          setLoadedContext({ clubId, userId: currentUserId });
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("club_members")
        .select("role, access_level, joined_at, title, status")
        .eq("club_id", clubId)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data || data.status !== "active") {
        setHasMembership(false);
        setLoadedContext({ clubId, userId: currentUserId });
        setLoading(false);
        return;
      }

      const memberRole = normalizeMemberRole(data.role as string);
      setRole(memberRole);
      setStoredAccessLevel(
        normalizeStoredAccessLevel(data.access_level as string | null),
      );
      setJoinedAt((data.joined_at as string | null) ?? null);
      setMemberTitle((data.title as string | null) ?? null);
      setHasMembership(true);
      setLoadedContext({ clubId, userId: currentUserId });
      setLoading(false);
    }

    void loadMembership();

    return () => {
      cancelled = true;
    };
  }, [clubId, user?.id]);

  const permissions = club?.customPermissions ?? cloneDefaultPermissions();
  const hasLoadedCurrentContext =
    loadedContext.clubId === clubId && loadedContext.userId === userId;
  const effectiveLoading = loading || !hasLoadedCurrentContext;
  const effectiveRole = hasLoadedCurrentContext ? role : "member";
  const effectiveStoredAccessLevel = hasLoadedCurrentContext
    ? storedAccessLevel
    : null;
  const effectiveHasMembership = hasLoadedCurrentContext ? hasMembership : false;
  const effectiveJoinedAt = hasLoadedCurrentContext ? joinedAt : null;
  const effectiveMemberTitle = hasLoadedCurrentContext ? memberTitle : null;
  const accessLevel = useMemo(
    () =>
      accessLevelFromMember({
        role: effectiveRole,
        accessLevel: effectiveStoredAccessLevel,
      }),
    [effectiveRole, effectiveStoredAccessLevel],
  );
  const permissionRole: PermissionRole = resolvePermissionRole(
    effectiveStoredAccessLevel,
    effectiveRole,
  );
  const isPresident = isPresidentAccess(effectiveStoredAccessLevel, effectiveRole);

  const can = useCallback(
    (capability: keyof typeof PERMISSION_CAPABILITY_ALIASES) =>
      hasClubPermission(
        permissions,
        effectiveStoredAccessLevel,
        effectiveRole,
        capability,
      ),
    [permissions, effectiveStoredAccessLevel, effectiveRole],
  );

  const canManageClubSettings = useMemo(
    () => isPresident || can("manage_club_settings"),
    [isPresident, can],
  );

  const canApproveMembers = useMemo(
    () =>
      hasPermissionKey(
        permissions,
        effectiveStoredAccessLevel,
        effectiveRole,
        "approve_members",
      ),
    [permissions, effectiveStoredAccessLevel, effectiveRole],
  );

  const canInviteMembers = useMemo(
    () =>
      hasPermissionKey(
        permissions,
        effectiveStoredAccessLevel,
        effectiveRole,
        "invite_members",
      ),
    [permissions, effectiveStoredAccessLevel, effectiveRole],
  );

  return {
    loading: effectiveLoading,
    role: effectiveRole,
    accessLevel,
    permissionRole,
    isPresident,
    permissions,
    can,
    canManageClubSettings,
    canApproveMembers,
    canInviteMembers,
    joinedAt: effectiveJoinedAt,
    memberTitle: effectiveMemberTitle,
    hasMembership: effectiveHasMembership,
    club,
  };
}
