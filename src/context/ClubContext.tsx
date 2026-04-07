import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "./useAuthContext";
import { ClubContext, type ClubContextValue } from "./clubContextValue";
import { mockClubs, categories as fallbackCategories } from "../data/clubs";
import type { Club } from "../types";

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id;

  // ---- Clubs data ----
  const [clubs, setClubs] = useState<Club[]>(mockClubs);
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
          // Fall back to mock data so the app remains usable
          setClubs(mockClubs);
          setClubsError(error.message);
        } else if (data && data.length > 0) {
          // Map DB rows → Club shape. Fields not in DB get safe defaults.
          const mapped: Club[] = data.map((row) => ({
            id: row.id,
            name: row.name ?? "",
            slug: row.slug ?? row.id,
            description: row.description ?? "",
            shortDescription: row.short_description ?? undefined,
            category: row.category ?? "",
            memberCount: row.member_count ?? 0,
            meetingSchedule: row.meeting_schedule ?? "",
            meetingLocation: row.meeting_location ?? undefined,
            location: row.location ?? "",
            imageUrl:
              row.image_url ??
              row.logo_url ??
              "/assets/placeholders/placeholder-rect.svg",
            bannerUrl: row.banner_url ?? undefined,
            tags: row.tags ?? [],
            contactEmail: row.contact_email ?? "",
            isPublic: row.is_public ?? true,
            joinCode: row.join_code ?? undefined,
            socialLinks: row.social_links ?? undefined,
            events: row.events ?? [],
            createdBy: row.created_by ?? undefined,
            createdAt: row.created_at ?? undefined,
          }));
          setClubs(mapped);
        } else {
          // Empty table – use mock data as seed display
          setClubs(mockClubs);
        }
        setClubsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Derive categories from current clubs list
  const categories = useMemo(() => {
    if (clubs === mockClubs) return fallbackCategories;
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

    supabase
      .from("user_clubs")
      .select("club_id, type")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load user clubs:", error.message);
          setFetchedForUser(userId);
          return;
        }
        const joined: string[] = [];
        const saved: string[] = [];
        for (const row of data ?? []) {
          if (row.type === "joined") joined.push(row.club_id);
          else if (row.type === "saved") saved.push(row.club_id);
        }
        setJoinedClubs(joined);
        setSavedClubs(saved);
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
      setJoinedClubs((prev) =>
        prev.includes(clubId) ? prev : [...prev, clubId],
      );
      supabase
        .from("user_clubs")
        .upsert(
          { user_id: user.id, club_id: clubId, type: "joined" },
          { onConflict: "user_id,club_id,type" },
        )
        .then(({ error }) => {
          if (error) {
            console.error("Failed to join club:", error.message);
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
        .from("user_clubs")
        .delete()
        .eq("user_id", user.id)
        .eq("club_id", clubId)
        .eq("type", "joined")
        .then(({ error }) => {
          if (error) {
            console.error("Failed to leave club:", error.message);
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
