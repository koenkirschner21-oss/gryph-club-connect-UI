import { useCallback, useEffect, useMemo, useState } from "react";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import {
  cloneDefaultPermissions,
  hasClubPermission,
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

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<MemberRole>("member");
  const [storedAccessLevel, setStoredAccessLevel] = useState<AccessLevel | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [memberTitle, setMemberTitle] = useState<string | null>(null);
  const [hasMembership, setHasMembership] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
      if (!user?.id || !clubId) {
        if (!cancelled) {
          setLoading(false);
          setHasMembership(false);
        }
        return;
      }

      setLoading(true);

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
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("club_members")
        .select("role, access_level, joined_at, title, status")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data || data.status !== "active") {
        setHasMembership(false);
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
      setLoading(false);
    }

    void loadMembership();

    return () => {
      cancelled = true;
    };
  }, [clubId, user?.id]);

  const permissions = club?.customPermissions ?? cloneDefaultPermissions();
  const accessLevel = useMemo(
    () => accessLevelFromMember({ role, accessLevel: storedAccessLevel }),
    [role, storedAccessLevel],
  );
  const permissionRole: PermissionRole = resolvePermissionRole(
    storedAccessLevel,
    role,
  );
  const isPresident = isPresidentAccess(storedAccessLevel, role);

  const can = useCallback(
    (capability: keyof typeof PERMISSION_CAPABILITY_ALIASES) =>
      hasClubPermission(permissions, storedAccessLevel, role, capability),
    [permissions, storedAccessLevel, role],
  );

  const canManageClubSettings = useMemo(
    () => isPresident || can("manage_club_settings"),
    [isPresident, can],
  );

  return {
    loading,
    role,
    accessLevel,
    permissionRole,
    isPresident,
    permissions,
    can,
    canManageClubSettings,
    joinedAt,
    memberTitle,
    hasMembership,
    club,
  };
}
