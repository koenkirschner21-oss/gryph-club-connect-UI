import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";

export interface UseUserInterestsReturn {
  interests: string[];
  loading: boolean;
  hasCompletedOnboarding: boolean;
  saveInterests: (categories: string[]) => Promise<boolean>;
}

/**
 * Hook that manages the current user's interest categories.
 * Used for onboarding and club recommendations.
 */
export function useUserInterests(): UseUserInterestsReturn {
  const { user } = useAuthContext();
  const userId = user?.id;

  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .from("user_interests")
      .select("category")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load user interests:", error.message);
        } else {
          const cats = (data ?? []).map((r) => r.category as string);
          setInterests(cats);
          setHasCompletedOnboarding(cats.length > 0);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveInterests = useCallback(
    async (categories: string[]): Promise<boolean> => {
      if (!userId) return false;

      // Delete existing interests and insert new ones
      const { error: delErr } = await supabase
        .from("user_interests")
        .delete()
        .eq("user_id", userId);

      if (delErr) {
        console.error("Failed to clear interests:", delErr.message);
        return false;
      }

      if (categories.length > 0) {
        const rows = categories.map((cat) => ({
          user_id: userId,
          category: cat,
        }));

        const { error: insErr } = await supabase
          .from("user_interests")
          .insert(rows);

        if (insErr) {
          console.error("Failed to save interests:", insErr.message);
          return false;
        }
      }

      setInterests(categories);
      setHasCompletedOnboarding(categories.length > 0);
      return true;
    },
    [userId],
  );

  return { interests, loading, hasCompletedOnboarding, saveInterests };
}
