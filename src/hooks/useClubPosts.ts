import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import type { Post } from "../types";

/** Map a Supabase `posts` row (joined with profiles) to our Post type. */
function mapPostRow(row: Record<string, unknown>): Post {
  const profile = (row.profiles ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    authorId: row.author_id as string,
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    authorName: (profile.full_name as string) ?? undefined,
  };
}

export interface UseClubPostsReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  createPost: (
    fields: Pick<Post, "title" | "content">,
  ) => Promise<boolean>;
  deletePost: (postId: string) => Promise<boolean>;
  refresh: () => void;
}

/**
 * Hook that provides CRUD operations for announcements/posts
 * belonging to a specific club.
 */
export function useClubPosts(clubId: string | undefined): UseClubPostsReturn {
  const { user } = useAuthContext();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch posts for this club (joined with author profile)
  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    supabase
      .from("posts")
      .select("*, profiles:author_id ( full_name )")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          console.error("Failed to load posts:", err.message);
          setError(err.message);
        } else {
          setPosts((data ?? []).map(mapPostRow));
          setError(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, refreshKey]);

  /** Create a new announcement post and notify club members. */
  const createPost = useCallback(
    async (fields: Pick<Post, "title" | "content">): Promise<boolean> => {
      if (!clubId || !user) return false;

      const { data, error: err } = await supabase
        .from("posts")
        .insert({
          club_id: clubId,
          author_id: user.id,
          title: fields.title,
          content: fields.content,
        })
        .select("*, profiles:author_id ( full_name )")
        .single();

      if (err || !data) {
        console.error("Failed to create post:", err?.message);
        return false;
      }

      setPosts((prev) => [mapPostRow(data), ...prev]);

      // Notify club members about the new announcement (fire-and-forget)
      Promise.resolve(
        supabase
          .from("club_members")
          .select("user_id")
          .eq("club_id", clubId)
          .eq("status", "active")
          .then(({ data: members }) => {
            if (!members || members.length === 0) return;
            const recipients = members.filter(
              (m) => m.user_id !== user.id,
            );
            if (recipients.length === 0) return;
            const rows = recipients.map((m) => ({
              user_id: m.user_id,
              type: "announcement",
              message: `New announcement: ${fields.title}`,
              club_id: clubId,
              reference_id: data.id as string,
            }));
            supabase
              .from("notifications")
              .insert(rows)
              .then(({ error: notifErr }) => {
                if (notifErr) {
                  console.error(
                    "Failed to send announcement notifications:",
                    notifErr.message,
                  );
                }
              });
          }),
      ).catch((err: unknown) => {
        console.error("Failed to send announcement notifications:", err);
      });

      return true;
    },
    [clubId, user],
  );

  /** Delete a post by id. */
  const deletePost = useCallback(
    async (postId: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

      if (err) {
        console.error("Failed to delete post:", err.message);
        return false;
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      return true;
    },
    [],
  );

  return { posts, loading, error, createPost, deletePost, refresh };
}
