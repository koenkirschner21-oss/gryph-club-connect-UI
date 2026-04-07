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
import type { Club } from "../types";

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id;

  // ---- Clubs data ----
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsError, setClubsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("clubs")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load clubs:", error.message);
          setClubsError(error.message);
        } else if (data && data.length > 0) {
          // Map DB rows → Club shape. Fields not in DB get safe defaults.
          const mapped: Club[] = data.map((row) => ({
            id: row.id,
            name: row.name ?? "",
            slug: row.slug ?? row.id,
            description: row.description ?? "",
            shortDescription: row.short_description ?? undefined,
            longDescription: row.long_description ?? undefined,
            category: row.category ?? "",
            memberCount: row.member_count ?? 0,
            meetingSchedule: row.meeting_schedule ?? "",
            meetingLocation: row.meeting_location ?? undefined,
            location: row.location ?? "",
            imageUrl:
              row.image_url ??
              row.logo_url ??
              "/assets/placeholders/placeholder-rect.svg",
            logoUrl: row.logo_url ?? undefined,
            bannerUrl: row.banner_url ?? undefined,
            brandColor: row.brand_color ?? undefined,
            tags: normalizeTags(row.tags),
            contactEmail: row.contact_email ?? "",
            isPublic: row.is_public ?? true,
            isFeatured: row.is_featured ?? false,
            isVerified: row.is_verified ?? false,
            abbreviation: row.abbreviation ?? undefined,
            joinCode: row.join_code ?? undefined,
            socialLinks: row.social_links ?? undefined,
            events: row.events ?? [],
            createdBy: row.created_by ?? undefined,
            createdAt: row.created_at ?? undefined,
          }));
          setClubs(mapped);
        }
        // If data is empty, clubs stays as [] — no mock fallback
        setClubsLoading(false);
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
  const [savedClubs, setSavedClubs] = useState<string[]>([]);
  const [fetchedForUser, setFetchedForUser] = useState<string | null>(null);

  const userClubsLoading = !!userId && fetchedForUser !== userId;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    // Fetch memberships from club_members and saved clubs from user_clubs in parallel
    Promise.all([
      supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", userId)
        .eq("status", "active"),
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
      setJoinedClubs(
        (membersRes.data ?? []).map((row) => row.club_id),
      );
      setSavedClubs(
        (savedRes.data ?? []).map((row) => row.club_id),
      );
      setFetchedForUser(userId);
    });

    return () => {
      cancelled = true;
      setJoinedClubs([]);
      setSavedClubs([]);
      setFetchedForUser(null);
    };
  }, [userId]);

  const joinClub = useCallback(
    (clubId: string) => {
      if (!user) return;
      // Prevent duplicate — optimistic update
      setJoinedClubs((prev) =>
        prev.includes(clubId) ? prev : [...prev, clubId],
      );
      supabase
        .from("club_members")
        .upsert(
          {
            club_id: clubId,
            user_id: user.id,
            role: "member",
            status: "active",
          },
          { onConflict: "club_id,user_id" },
        )
        .then(({ error }) => {
          if (error) {
            console.error("Failed to join club:", error.message);
            // Rollback optimistic update
            setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
          }
        });
    },
    [user],
  );

  const leaveClub = useCallback(
    (clubId: string) => {
      if (!user) return;
      setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
      supabase
        .from("club_members")
        .delete()
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to leave club:", error.message);
            // Rollback optimistic update
            setJoinedClubs((prev) =>
              prev.includes(clubId) ? prev : [...prev, clubId],
            );
          }
        });
    },
    [user],
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

  const isSaved = useCallback(
    (clubId: string) => savedClubs.includes(clubId),
    [savedClubs],
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
      savedClubs,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isSaved,
    }),
    [
      clubs,
      loading,
      clubsError,
      categories,
      getClubById,
      getClubBySlug,
      joinedClubs,
      savedClubs,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isSaved,
    ],
  );

  return <ClubContext value={value}>{children}</ClubContext>;
}
