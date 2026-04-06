import { createContext } from "react";

export interface ClubContextValue {
  joinedClubs: string[];
  savedClubs: string[];
  loading: boolean;
  joinClub: (clubId: string) => void;
  leaveClub: (clubId: string) => void;
  toggleSaveClub: (clubId: string) => void;
  isJoined: (clubId: string) => boolean;
  isSaved: (clubId: string) => boolean;
}

export const ClubContext = createContext<ClubContextValue | undefined>(
  undefined,
);
