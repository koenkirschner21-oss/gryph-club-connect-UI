import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";

export interface ClubChannel {
  id: string;
  clubId: string;
  name: string;
  description?: string;
  isAnnouncementOnly: boolean;
}

interface UseClubChannelsReturn {
  channels: ClubChannel[];
  loading: boolean;
  error: string | null;
  createChannel: (
    name: string,
    description?: string,
    isAnnouncementOnly?: boolean,
  ) => Promise<boolean>;
}

function mapChannelRow(row: Record<string, unknown>): ClubChannel {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    name: (row.name as string) ?? "",
    description: (row.description as string) ?? undefined,
    isAnnouncementOnly: (row.is_announcement_only as boolean) ?? false,
  };
}

export function useClubChannels(clubId: string | undefined): UseClubChannelsReturn {
  const { user } = useAuthContext();
  const [channels, setChannels] = useState<ClubChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    setLoading(true);

    supabase
      .from("channels")
      .select("id, club_id, name, description, is_announcement_only")
      .eq("club_id", clubId)
      .order("name", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error("Failed to load channels:", err.message);
          setError(err.message);
        } else {
          setChannels((data ?? []).map(mapChannelRow));
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const createChannel = useCallback(
    async (
      name: string,
      description = "",
      isAnnouncementOnly = false,
    ): Promise<boolean> => {
      if (!clubId || !user) return false;

      const { data, error: err } = await supabase
        .from("channels")
        .insert({
          club_id: clubId,
          name,
          description,
          is_announcement_only: isAnnouncementOnly,
          created_by: user.id,
        })
        .select("id, club_id, name, description, is_announcement_only")
        .single();

      if (err || !data) {
        console.error("Failed to create channel:", err?.message);
        return false;
      }

      setChannels((prev) => [...prev, mapChannelRow(data)].sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    },
    [clubId, user],
  );

  return { channels, loading, error, createChannel };
}
