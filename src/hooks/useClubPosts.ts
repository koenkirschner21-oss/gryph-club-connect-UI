import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";
import { notifyUsers, type NotificationRequest } from "../lib/notifyUsers";
import type { Post, Visibility } from "../types";
import { normalizeVisibility } from "../lib/contentVisibility";

const POST_SELECT = `
  id,
  club_id,
  author_id,
  title,
  content,
  created_at,
  updated_at,
  attachment_url,
  attachment_type,
  link_url,
  visibility,
  author:profiles!posts_author_profile_fkey (
    full_name
  )
`;

/** Map a Supabase \`posts\` row (joined with profiles) to our Post type. */
function mapPostRow(row: Record<string, unknown>): Post {
  const profile = (row.author ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    authorId: row.author_id as string,
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string | null) ?? null,
    authorName: (profile.full_name as string) ?? undefined,
    attachmentUrl: (row.attachment_url as string | null) ?? null,
    attachmentType: (row.attachment_type as string | null) ?? null,
    linkUrl: (row.link_url as string | null) ?? null,
    visibility: normalizeVisibility(row.visibility as string | null, "members_only"),
  };
}

export type PostWriteFields = Pick<Post, "title" | "content"> & {
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  linkUrl?: string | null;
  visibility?: Visibility;
};

export interface UseClubPostsReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  createPost: (fields: PostWriteFields) => Promise<boolean>;
  updatePost: (postId: string, fields: PostWriteFields) => Promise<boolean>;
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

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;

    supabase
      .from("posts")
      .select(POST_SELECT)
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

  const createPost = useCallback(
    async (fields: PostWriteFields): Promise<boolean> => {
      if (!clubId || !user) return false;

      const { data, error: err } = await supabase
        .from("posts")
        .insert({
          club_id: clubId,
          author_id: user.id,
          title: fields.title,
          content: fields.content,
          attachment_url: fields.attachmentUrl ?? null,
          attachment_type: fields.attachmentType ?? null,
          link_url: fields.linkUrl?.trim() || null,
          visibility: fields.visibility ?? "members_only",
        })
        .select(POST_SELECT)
        .single();

      if (err || !data) {
        console.error("Failed to create post:", err?.message);
        return false;
      }

      setPosts((prev) => [mapPostRow(data), ...prev]);

      Promise.resolve(
        supabase
          .from("club_members")
          .select("user_id")
          .eq("club_id", clubId)
          .eq("status", "active")
          .then(({ data: members }) => {
            if (!members || members.length === 0) return;
            const recipients = members.filter((m) => m.user_id !== user.id);
            if (recipients.length === 0) return;
            const rows: NotificationRequest[] = recipients.map((m) => ({
              user_id: m.user_id,
              type: "announcement",
              message: `New announcement: ${fields.title}`,
              club_id: clubId,
              reference_id: data.id as string,
            }));
            notifyUsers(rows).then((ok) => {
              if (!ok) {
                console.error("Failed to send announcement notifications.");
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

  const updatePost = useCallback(
    async (postId: string, fields: PostWriteFields): Promise<boolean> => {
      const { data, error: err } = await supabase
        .from("posts")
        .update({
          title: fields.title,
          content: fields.content,
          attachment_url: fields.attachmentUrl ?? null,
          attachment_type: fields.attachmentType ?? null,
          updated_at: new Date().toISOString(),
          visibility: fields.visibility ?? "members_only",
        })
        .eq("id", postId)
        .select(POST_SELECT);

      if (err || !data?.length) {
        console.error("Failed to update post:", err?.message ?? "no rows updated");
        return false;
      }

      if (data?.[0]) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? mapPostRow(data[0]) : p)),
        );
      } else {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  title: fields.title,
                  content: fields.content,
                  attachmentUrl: fields.attachmentUrl ?? null,
                  attachmentType: fields.attachmentType ?? null,
                  linkUrl: fields.linkUrl?.trim() || null,
                  updatedAt: new Date().toISOString(),
                }
              : p,
          ),
        );
      }
      return true;
    },
    [],
  );

  const deletePost = useCallback(async (postId: string): Promise<boolean> => {
    const { error: err } = await supabase.from("posts").delete().eq("id", postId);

    if (err) {
      console.error("Failed to delete post:", err.message);
      return false;
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    return true;
  }, []);

  return { posts, loading, error, createPost, updatePost, deletePost, refresh };
}
