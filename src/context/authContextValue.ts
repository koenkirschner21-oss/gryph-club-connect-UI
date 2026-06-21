import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type UserProfileSnapshot = {
  fullName: string;
  avatarUrl: string | null;
};

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** null while profile onboarding flag is loading */
  onboardingCompleted: boolean | null;
  /** Loaded from profiles for nav avatar / display name; null before first fetch */
  userProfile: UserProfileSnapshot | null;
  refreshUserProfile: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Path to use after auth when onboarding is incomplete */
  postAuthRedirectPath: string;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
