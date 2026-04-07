import { createContext } from "react";
import type { Club } from "../types";

export interface ClubContextValue {
  /** All available clubs (fetched from Supabase or fallback data). */
  clubs: Club[];
  /** True while clubs list or user-club state is loading. */
  loading: boolean;
  /** Non-null when fetching clubs failed. */
  error: string | null;
  /** Category strings derived from current clubs (includes "All"). */
  categories: string[];
  /** Look up a single club by ID. */
  getClubById: (clubId: string) => Club | undefined;
  /** Look up a single club by slug. */
  getClubBySlug: (slug: string) => Club | undefined;
  joinedClubs: string[];
  savedClubs: string[];
  joinClub: (clubId: string) => void;
  leaveClub: (clubId: string) => void;
  toggleSaveClub: (clubId: string) => void;
  isJoined: (clubId: string) => boolean;
  isSaved: (clubId: string) => boolean;
}

export const ClubContext = createContext<ClubContextValue | undefined>(
  undefined,
);
