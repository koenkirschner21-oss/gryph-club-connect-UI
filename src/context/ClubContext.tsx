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

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();

  const userId = user?.id;

  const [joinedClubs, setJoinedClubs] = useState<string[]>([]);
  const [savedClubs, setSavedClubs] = useState<string[]>([]);
  const [fetchedForUser, setFetchedForUser] = useState<string | null>(null);

  // Derived: loading while we have a user but haven't fetched their data yet
  const loading = !!userId && fetchedForUser !== userId;

  // Fetch user clubs from Supabase when user changes
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
      // Optimistic update
      setJoinedClubs((prev) =>
        prev.includes(clubId) ? prev : [...prev, clubId],
      );
      // Persist to Supabase
      supabase
        .from("user_clubs")
        .upsert(
          { user_id: user.id, club_id: clubId, type: "joined" },
          { onConflict: "user_id,club_id,type" },
        )
        .then(({ error }) => {
          if (error) {
            console.error("Failed to join club:", error.message);
            // Rollback on error
            setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
          }
        });
    },
    [user],
  );

  const leaveClub = useCallback(
    (clubId: string) => {
      if (!user) return;
      // Optimistic update
      setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
      // Delete from Supabase
      supabase
        .from("user_clubs")
        .delete()
        .eq("user_id", user.id)
        .eq("club_id", clubId)
        .eq("type", "joined")
        .then(({ error }) => {
          if (error) {
            console.error("Failed to leave club:", error.message);
            // Rollback on error
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
          // Optimistic remove
          supabase
            .from("user_clubs")
            .delete()
            .eq("user_id", user.id)
            .eq("club_id", clubId)
            .eq("type", "saved")
            .then(({ error }) => {
              if (error) {
                console.error("Failed to unsave club:", error.message);
                // Rollback
                setSavedClubs((p) =>
                  p.includes(clubId) ? p : [...p, clubId],
                );
              }
            });
          return prev.filter((id) => id !== clubId);
        } else {
          // Optimistic add
          supabase
            .from("user_clubs")
            .upsert(
              { user_id: user.id, club_id: clubId, type: "saved" },
              { onConflict: "user_id,club_id,type" },
            )
            .then(({ error }) => {
              if (error) {
                console.error("Failed to save club:", error.message);
                // Rollback
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

  const value = useMemo<ClubContextValue>(
    () => ({
      joinedClubs,
      savedClubs,
      loading,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isSaved,
    }),
    [
      joinedClubs,
      savedClubs,
      loading,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isSaved,
    ],
  );

  return <ClubContext value={value}>{children}</ClubContext>;
}
