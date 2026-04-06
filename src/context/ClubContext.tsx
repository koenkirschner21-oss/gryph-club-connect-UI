import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ClubContext, type ClubContextValue } from "./clubContextValue";

function loadFromStorage(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
    }
  } catch {
    /* corrupted data – fall back to empty */
  }
  return [];
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const [joinedClubs, setJoinedClubs] = useState<string[]>(() =>
    loadFromStorage("joinedClubs"),
  );
  const [savedClubs, setSavedClubs] = useState<string[]>(() =>
    loadFromStorage("savedClubs"),
  );

  useEffect(() => {
    localStorage.setItem("joinedClubs", JSON.stringify(joinedClubs));
  }, [joinedClubs]);

  useEffect(() => {
    localStorage.setItem("savedClubs", JSON.stringify(savedClubs));
  }, [savedClubs]);

  const joinClub = useCallback((clubId: string) => {
    setJoinedClubs((prev) =>
      prev.includes(clubId) ? prev : [...prev, clubId],
    );
  }, []);

  const leaveClub = useCallback((clubId: string) => {
    setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
  }, []);

  const toggleSaveClub = useCallback((clubId: string) => {
    setSavedClubs((prev) =>
      prev.includes(clubId)
        ? prev.filter((id) => id !== clubId)
        : [...prev, clubId],
    );
  }, []);

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
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isSaved,
    }),
    [joinedClubs, savedClubs, joinClub, leaveClub, toggleSaveClub, isJoined, isSaved],
  );

  return <ClubContext value={value}>{children}</ClubContext>;
}
