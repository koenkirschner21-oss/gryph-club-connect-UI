import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ClubContext, type ClubContextValue } from "./clubContextValue";

export function ClubProvider({ children }: { children: ReactNode }) {
  const [joinedClubs, setJoinedClubs] = useState<string[]>([]);
  const [savedClubs, setSavedClubs] = useState<string[]>([]);

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
