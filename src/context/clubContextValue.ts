import { createContext } from "react";
import type { Club, MemberRole } from "../types";

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
  pendingClubs: string[];
  savedClubs: string[];
  joinClub: (clubId: string) => Promise<boolean>;
  leaveClub: (clubId: string) => void;
  toggleSaveClub: (clubId: string) => void;
  isJoined: (clubId: string) => boolean;
  isPending: (clubId: string) => boolean;
  isSaved: (clubId: string) => boolean;
  /** Create a new club and add the current user as admin. Returns the new club ID or null on error. */
  createClub: (fields: Partial<Club>) => Promise<string | null>;
  /** Get the current user's role in a club (admin/exec/member) or null if not a member. */
  getUserRole: (clubId: string) => MemberRole | null;
  /** Map of club_id → MemberRole for the current user. */
  userRoles: Record<string, MemberRole>;
  /** Update a club's details in Supabase and local state. */
  updateClub: (clubId: string, fields: Partial<Club>) => Promise<boolean>;
}

export const ClubContext = createContext<ClubContextValue | undefined>(
  undefined,
);
