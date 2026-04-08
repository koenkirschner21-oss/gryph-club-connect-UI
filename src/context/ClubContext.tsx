import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { normalizeTags } from "../lib/normalizeTags";
import { useAuthContext } from "./useAuthContext";
import { ClubContext, type ClubContextValue } from "./clubContextValue";
import type { Club, MemberRole } from "../types";

/** Map a Supabase clubs row to our Club type. */
function mapRow(row: Record<string, unknown>): Club {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    slug: (row.slug as string) ?? (row.id as string),
    description: (row.description as string) ?? "",
    shortDescription: (row.short_description as string) ?? undefined,
    longDescription: (row.long_description as string) ?? undefined,
    category: (row.category as string) ?? "",
    memberCount: (row.member_count as number) ?? 0,
    meetingSchedule: (row.meeting_schedule as string) ?? "",
    meetingLocation: (row.meeting_location as string) ?? undefined,
    location: (row.location as string) ?? "",
    imageUrl:
      (row.image_url as string) ??
      (row.logo_url as string) ??
      "/assets/placeholders/placeholder-rect.svg",
    logoUrl: (row.logo_url as string) ?? undefined,
    bannerUrl: (row.banner_url as string) ?? undefined,
    brandColor: (row.brand_color as string) ?? undefined,
    tags: normalizeTags(row.tags as string | string[] | null | undefined),
    contactEmail: (row.contact_email as string) ?? "",
    isPublic: (row.is_public as boolean) ?? true,
    isFeatured: (row.is_featured as boolean) ?? false,
    isVerified: (row.is_verified as boolean) ?? false,
    abbreviation: (row.abbreviation as string) ?? undefined,
    joinCode: (row.join_code as string) ?? undefined,
    socialLinks: (row.social_links as Club["socialLinks"]) ?? undefined,
    events: (row.events as Club["events"]) ?? [],
    requiresApproval: (row.requires_approval as boolean) ?? false,
    createdBy: (row.created_by as string) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
  };
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id;

  // ---- Clubs data ----
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsError, setClubsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve(
      supabase
        .from("clubs")
        .select("*")
        .order("name"),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load clubs:", error.message);
          setClubsError(error.message);
        } else if (data && data.length > 0) {
          setClubs(data.map(mapRow));
        }
        // If data is empty, clubs stays as [] — no mock fallback
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Failed to load clubs:", err);
        setClubsError(String(err));
      })
      .finally(() => {
        if (!cancelled) setClubsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Derive categories from current clubs list
  const categories = useMemo(() => {
    const cats = new Set(clubs.map((c) => c.category).filter(Boolean));
    return ["All", ...Array.from(cats).sort()];
  }, [clubs]);

  const getClubById = useCallback(
    (clubId: string): Club | undefined => clubs.find((c) => c.id === clubId),
    [clubs],
  );

  const getClubBySlug = useCallback(
    (slug: string): Club | undefined => clubs.find((c) => c.slug === slug),
    [clubs],
  );

  // ---- User club state (join/save) ----
  const [joinedClubs, setJoinedClubs] = useState<string[]>([]);
  const [pendingClubs, setPendingClubs] = useState<string[]>([]);
  const [savedClubs, setSavedClubs] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, MemberRole>>({});
  const [fetchedForUser, setFetchedForUser] = useState<string | null>(null);

  const userClubsLoading = !!userId && fetchedForUser !== userId;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    // Fetch memberships (with role + status) from club_members and saved clubs from user_clubs in parallel
    Promise.all([
      supabase
        .from("club_members")
        .select("club_id, role, status")
        .eq("user_id", userId),
      supabase
        .from("user_clubs")
        .select("club_id")
        .eq("user_id", userId)
        .eq("type", "saved"),
    ]).then(([membersRes, savedRes]) => {
      if (cancelled) return;
      if (membersRes.error) {
        console.error("Failed to load club memberships:", membersRes.error.message);
      }
      if (savedRes.error) {
        console.error("Failed to load saved clubs:", savedRes.error.message);
      }
      const activeIds: string[] = [];
      const pendingIds: string[] = [];
      const roles: Record<string, MemberRole> = {};
      for (const row of membersRes.data ?? []) {
        if (row.status === "active") {
          activeIds.push(row.club_id);
          roles[row.club_id] = row.role as MemberRole;
        } else if (row.status === "pending") {
          pendingIds.push(row.club_id);
        }
      }
      setJoinedClubs(activeIds);
      setPendingClubs(pendingIds);
      setUserRoles(roles);
      setSavedClubs(
        (savedRes.data ?? []).map((row) => row.club_id),
      );
      setFetchedForUser(userId);
    }).catch((err: unknown) => {
      if (cancelled) return;
      console.error("Failed to load user clubs:", err);
      setFetchedForUser(userId);
    });

    return () => {
      cancelled = true;
      setJoinedClubs([]);
      setPendingClubs([]);
      setSavedClubs([]);
      setUserRoles({});
      setFetchedForUser(null);
    };
  }, [userId]);

  const joinClub = useCallback(
    (clubId: string) => {
      if (!user) return;
      const club = clubs.find((c) => c.id === clubId);
      const needsApproval = club?.requiresApproval ?? false;
      const status = needsApproval ? "pending" : "active";

      // Optimistic update
      if (needsApproval) {
        setPendingClubs((prev) =>
          prev.includes(clubId) ? prev : [...prev, clubId],
        );
      } else {
        setJoinedClubs((prev) =>
          prev.includes(clubId) ? prev : [...prev, clubId],
        );
      }

      supabase
        .from("club_members")
        .upsert(
          {
            club_id: clubId,
            user_id: user.id,
            role: "member",
            status,
          },
          { onConflict: "club_id,user_id" },
        )
        .then(({ error }) => {
          if (error) {
            console.error("Failed to join club:", error.message);
            // Rollback optimistic update
            if (needsApproval) {
              setPendingClubs((prev) => prev.filter((id) => id !== clubId));
            } else {
              setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
            }
          }
        });
    },
    [user, clubs],
  );

  const leaveClub = useCallback(
    (clubId: string) => {
      if (!user) return;
      const wasPending = pendingClubs.includes(clubId);
      setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
      setPendingClubs((prev) => prev.filter((id) => id !== clubId));
      supabase
        .from("club_members")
        .delete()
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to leave club:", error.message);
            // Rollback optimistic update to correct state
            if (wasPending) {
              setPendingClubs((prev) =>
                prev.includes(clubId) ? prev : [...prev, clubId],
              );
            } else {
              setJoinedClubs((prev) =>
                prev.includes(clubId) ? prev : [...prev, clubId],
              );
            }
          }
        });
    },
    [user, pendingClubs],
  );

  const toggleSaveClub = useCallback(
    (clubId: string) => {
      if (!user) return;

      setSavedClubs((prev) => {
        const alreadySaved = prev.includes(clubId);
        if (alreadySaved) {
          supabase
            .from("user_clubs")
            .delete()
            .eq("user_id", user.id)
            .eq("club_id", clubId)
            .eq("type", "saved")
            .then(({ error }) => {
              if (error) {
                console.error("Failed to unsave club:", error.message);
                setSavedClubs((p) =>
                  p.includes(clubId) ? p : [...p, clubId],
                );
              }
            });
          return prev.filter((id) => id !== clubId);
        } else {
          supabase
            .from("user_clubs")
            .upsert(
              { user_id: user.id, club_id: clubId, type: "saved" },
              { onConflict: "user_id,club_id,type" },
            )
            .then(({ error }) => {
              if (error) {
                console.error("Failed to save club:", error.message);
                setSavedClubs((p) => p.filter((id) => id !== clubId));
              }
            });
          return [...prev, clubId];
        }
      });
    },
    [user],
  );

  const isJoined = useCallback(
    (clubId: string) => joinedClubs.includes(clubId),
    [joinedClubs],
  );

  const isPending = useCallback(
    (clubId: string) => pendingClubs.includes(clubId),
    [pendingClubs],
  );

  const isSaved = useCallback(
    (clubId: string) => savedClubs.includes(clubId),
    [savedClubs],
  );

  const getUserRole = useCallback(
    (clubId: string): MemberRole | null => userRoles[clubId] ?? null,
    [userRoles],
  );

  /** Create a club in Supabase and add the current user as admin. */
  const createClub = useCallback(
    async (fields: Partial<Club>): Promise<string | null> => {
      if (!user) return null;

      // Build the DB row from camelCase fields
      const row: Record<string, unknown> = {
        name: fields.name,
        slug: fields.slug,
        description: fields.description,
        category: fields.category,
        contact_email: fields.contactEmail,
        meeting_schedule: fields.meetingSchedule,
        meeting_location: fields.meetingLocation,
        social_links: fields.socialLinks,
        created_by: user.id,
        is_public: true,
      };

      const { data, error } = await supabase
        .from("clubs")
        .insert(row)
        .select()
        .single();

      if (error || !data) {
        console.error("Failed to create club:", error?.message);
        return null;
      }

      // Add creator as admin in club_members
      const { error: memberErr } = await supabase.from("club_members").insert({
        club_id: data.id,
        user_id: user.id,
        role: "admin",
        status: "active",
      });

      if (memberErr) {
        console.error("Failed to add admin membership:", memberErr.message);
        // Rollback club creation if membership failed — the club is unusable without an admin
        await supabase.from("clubs").delete().eq("id", data.id);
        return null;
      }

      // Update local state
      const newClub = mapRow(data);
      setClubs((prev) => [...prev, newClub]);
      setJoinedClubs((prev) => [...prev, newClub.id]);
      setUserRoles((prev) => ({ ...prev, [newClub.id]: "admin" }));

      return newClub.id;
    },
    [user],
  );

  /** Update an existing club in Supabase and refresh local state. */
  const updateClub = useCallback(
    async (clubId: string, fields: Partial<Club>): Promise<boolean> => {
      // Build the DB update payload from camelCase fields
      const row: Record<string, unknown> = {};
      if (fields.name !== undefined) row.name = fields.name;
      if (fields.shortDescription !== undefined)
        row.short_description = fields.shortDescription;
      if (fields.longDescription !== undefined)
        row.long_description = fields.longDescription;
      if (fields.category !== undefined) row.category = fields.category;
      if (fields.abbreviation !== undefined)
        row.abbreviation = fields.abbreviation;
      if (fields.brandColor !== undefined) row.brand_color = fields.brandColor;
      if (fields.logoUrl !== undefined) row.logo_url = fields.logoUrl;
      if (fields.bannerUrl !== undefined) row.banner_url = fields.bannerUrl;
      if (fields.requiresApproval !== undefined)
        row.requires_approval = fields.requiresApproval;

      const { data, error } = await supabase
        .from("clubs")
        .update(row)
        .eq("id", clubId)
        .select()
        .single();

      if (error || !data) {
        console.error("Failed to update club:", error?.message);
        return false;
      }

      // Update local state
      const updated = mapRow(data);
      setClubs((prev) => prev.map((c) => (c.id === clubId ? updated : c)));
      return true;
    },
    [],
  );

  const loading = clubsLoading || userClubsLoading;

  const value = useMemo<ClubContextValue>(
    () => ({
      clubs,
      loading,
      error: clubsError,
      categories,
      getClubById,
      getClubBySlug,
      joinedClubs,
      pendingClubs,
      savedClubs,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isPending,
      isSaved,
      createClub,
      getUserRole,
      userRoles,
      updateClub,
    }),
    [
      clubs,
      loading,
      clubsError,
      categories,
      getClubById,
      getClubBySlug,
      joinedClubs,
      pendingClubs,
      savedClubs,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isPending,
      isSaved,
      createClub,
      getUserRole,
      userRoles,
      updateClub,
    ],
  );

  return <ClubContext value={value}>{children}</ClubContext>;
}
