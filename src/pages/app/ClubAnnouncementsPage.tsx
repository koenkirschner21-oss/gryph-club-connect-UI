import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Download } from "lucide-react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useClubPosts } from "../../hooks/useClubPosts";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { uploadImage } from "../../lib/uploadImage";
import { supabase } from "../../lib/supabaseClient";
import { notifyReportSubmitted } from "../../lib/notifications";
import Spinner from "../../components/ui/Spinner";
import VisibilitySelector from "../../components/club/VisibilitySelector";
import SelectedVisibilityPicker from "../../components/club/SelectedVisibilityPicker";
import TemplatePickerModal from "../../components/club/TemplatePickerModal";
import { filterByVisibility } from "../../lib/contentVisibility";
import {
  EMPTY_SELECTED_VISIBILITY,
  hasSelectedVisibilityTargets,
  selectedVisibilityPayload,
} from "../../lib/selectedVisibility";
import { removeRealtimeChannel, uniqueRealtimeTopic } from "../../lib/realtimeChannels";
import {
  fetchPostViewCountsForClub,
  recordAnnouncementView,
} from "../../lib/postViews";
import type { MemberRole, Post, Visibility } from "../../types";
import {
  AnnouncementCard,
  AnnouncementSortDropdown,
  EngagementTipsSidebar,
  SeenListModal,
  VisibilityFilterDropdown,
  type AnnouncementSort,
  type VisibilityFilter,
} from "./announcements/AnnouncementsListUI";

const PAGE_BG = "#0f0f0f";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";

const useTemplateButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  color: "#cccccc",
  borderRadius: "8px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const ANNOUNCEMENT_FILTER_PILLS = [
  { value: "all", label: "All" },
  { value: "pinned", label: "Pinned" },
  { value: "recent", label: "Recent" },
] as const;

type AnnouncementFilter = (typeof ANNOUNCEMENT_FILTER_PILLS)[number]["value"];

const announcementFilterPillStyle = (active: boolean): CSSProperties => ({
  background: active ? ACCENT_RED : "transparent",
  border: active ? "none" : "1px solid #333333",
  color: active ? "#ffffff" : "#777777",
  borderRadius: "20px",
  padding: "5px 16px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
});

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_FILE_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf";
const STORAGE_BUCKET = "announcement-attachments";

const REPORT_REASONS = ["Inappropriate", "Spam", "Harassment", "Unprofessional"] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

type ReactionName = "heart" | "thumbs_up" | "laugh" | "bookmark";
type PostReactionState = Record<ReactionName, number>;
type PostReactionFlags = Record<ReactionName, boolean>;

type AuthorMeta = {
  name?: string;
  avatarUrl?: string;
  role?: MemberRole;
  roleTitle?: string;
};

const pageStyle: CSSProperties = {
  backgroundColor: PAGE_BG,
  minHeight: "100%",
  padding: "24px",
};

const newPostButtonStyle: CSSProperties = {
  backgroundColor: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "9px 18px",
  fontWeight: 500,
  fontSize: "14px",
  cursor: "pointer",
};

const cancelButtonStyle: CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid #333333",
  color: "#888888",
  borderRadius: "6px",
  padding: "9px 18px",
  fontWeight: 500,
  fontSize: "14px",
  cursor: "pointer",
};

const formContainerStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "#888888",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "8px",
};

const baseFieldStyle: CSSProperties = {
  width: "100%",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const submitButtonStyle: CSSProperties = {
  background: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "10px 24px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};

const formCancelButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  color: "#888888",
  borderRadius: "6px",
  padding: "10px 24px",
  fontWeight: 500,
  fontSize: "14px",
  cursor: "pointer",
};

function normalizeRole(role: string | null | undefined): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function formatPostDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function ThemedField({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const fieldStyle: CSSProperties = {
    ...baseFieldStyle,
    borderColor: focused ? ACCENT_RED : "#2a2a2a",
    minHeight: multiline ? "120px" : undefined,
    resize: multiline ? "vertical" : undefined,
  };

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={5}
          style={fieldStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={fieldStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
    </div>
  );
}

function PostAttachment({
  url,
  type,
  title,
}: {
  url: string;
  type: string;
  title: string;
}) {
  if (type.startsWith("image/")) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          marginTop: "16px",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <img
          src={url}
          alt={`Attachment for ${title}`}
          style={{
            width: "100%",
            maxHeight: "360px",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  if (type === "application/pdf") {
    const fileName = decodeURIComponent(url.split("/").pop() ?? "Attachment.pdf");
    return (
      <div
        style={{
          background: "#111111",
          border: "1px solid #333333",
          borderRadius: "8px",
          padding: "12px 16px",
          margin: "0 16px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <span style={{ color: ACCENT_RED, fontSize: "15px", flexShrink: 0 }}>PDF</span>
          <span
            style={{
              color: "#cccccc",
              fontSize: "13px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {fileName}
          </span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: ACCENT_RED,
            textDecoration: "none",
            fontSize: "12px",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <Download size={14} />
          Download
        </a>
      </div>
    );
  }

  return null;
}

export default function ClubAnnouncementsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");
  const { posts, loading, createPost, updatePost, deletePost, refresh } = useClubPosts(clubId);
  const memberAccess = useClubMemberAccess(clubId);
  const { members } = useClubMembers(clubId);
  const canManageAnnouncements =
    memberAccess.isPresident || memberAccess.can("manage_announcements");
  const canViewEngagement = canManageAnnouncements;

  const [showForm, setShowForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [existingAttachmentType, setExistingAttachmentType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [authorMetaById, setAuthorMetaById] = useState<Record<string, AuthorMeta>>({});
  const [pinnedById, setPinnedById] = useState<Record<string, boolean>>({});
  const [menuOpenPostId, setMenuOpenPostId] = useState<string | null>(null);
  const [reactionCountsByPost, setReactionCountsByPost] = useState<Record<string, PostReactionState>>({});
  const [myReactionsByPost, setMyReactionsByPost] = useState<Record<string, PostReactionFlags>>({});
  const [viewCountByPost, setViewCountByPost] = useState<Record<string, number>>({});
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(null);
  const [announcementFilter, setAnnouncementFilter] =
    useState<AnnouncementFilter>("all");
  const [postVisibility, setPostVisibility] = useState<Visibility>("members_only");
  const [selectedVisibilityTargets, setSelectedVisibilityTargets] = useState(
    EMPTY_SELECTED_VISIBILITY,
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [sortBy, setSortBy] = useState<AnnouncementSort>("newest");
  const [seenListPostId, setSeenListPostId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadReactionMeta = useCallback(
    async (postIds: string[]) => {
      if (postIds.length === 0) return;

      const { data, error } = await supabase
        .from("post_reactions")
        .select("post_id, user_id, reaction")
        .in("post_id", postIds);

      if (error) {
        console.error("Failed to load announcement reactions:", error.message);
        return;
      }

      const countsMap: Record<string, PostReactionState> = {};
      const myMap: Record<string, PostReactionFlags> = {};
      for (const postId of postIds) {
        countsMap[postId] = { heart: 0, thumbs_up: 0, laugh: 0, bookmark: 0 };
        myMap[postId] = { heart: false, thumbs_up: false, laugh: false, bookmark: false };
      }
      for (const row of data ?? []) {
        const postId = row.post_id as string;
        const reaction = row.reaction as ReactionName;
        if (!countsMap[postId] || countsMap[postId][reaction] === undefined) continue;
        countsMap[postId][reaction] += 1;
        if (row.user_id === user?.id) {
          myMap[postId][reaction] = true;
        }
      }
      setReactionCountsByPost((prev) => ({ ...prev, ...countsMap }));
      setMyReactionsByPost((prev) => ({ ...prev, ...myMap }));
    },
    [user?.id],
  );

  useEffect(() => {
    if (!reportSuccessMessage) return;
    const timer = window.setTimeout(() => setReportSuccessMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [reportSuccessMessage]);

  useEffect(() => {
    if (!clubId || posts.length === 0) {
      setPinnedById({});
      setReactionCountsByPost({});
      setMyReactionsByPost({});
      setViewCountByPost({});
      return;
    }

    let cancelled = false;
    const postIds = posts.map((post) => post.id);
    const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));

    async function loadMeta() {
      const [pinnedRes, reactionsRes, profilesRes, rolesRes] = await Promise.all([
        supabase.from("posts").select("id, is_pinned").in("id", postIds),
        supabase.from("post_reactions").select("post_id, user_id, reaction").in("post_id", postIds),
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", authorIds),
        supabase
          .from("club_members")
          .select("user_id, role, title")
          .eq("club_id", clubId)
          .in("user_id", authorIds),
      ]);

      if (cancelled) return;

      if (!pinnedRes.error) {
        const map: Record<string, boolean> = {};
        for (const row of pinnedRes.data ?? []) {
          map[row.id as string] = Boolean((row as Record<string, unknown>).is_pinned);
        }
        setPinnedById(map);
      }

      if (!reactionsRes.error) {
        const countsMap: Record<string, PostReactionState> = {};
        const myMap: Record<string, PostReactionFlags> = {};
        for (const postId of postIds) {
          countsMap[postId] = { heart: 0, thumbs_up: 0, laugh: 0, bookmark: 0 };
          myMap[postId] = { heart: false, thumbs_up: false, laugh: false, bookmark: false };
        }
        for (const row of reactionsRes.data ?? []) {
          const postId = row.post_id as string;
          const reaction = row.reaction as ReactionName;
          if (!countsMap[postId] || countsMap[postId][reaction] === undefined) continue;
          countsMap[postId][reaction] += 1;
          if (row.user_id === user?.id) {
            myMap[postId][reaction] = true;
          }
        }
        setReactionCountsByPost(countsMap);
        setMyReactionsByPost(myMap);
      }

      if (clubId) {
        const countMap = await fetchPostViewCountsForClub(postIds, clubId);
        setViewCountByPost(countMap);
      }

      const profileById: Record<string, { name?: string; avatarUrl?: string }> = {};
      for (const row of profilesRes.data ?? []) {
        const rec = row as Record<string, unknown>;
        profileById[rec.id as string] = {
          name: rec.full_name as string | undefined,
          avatarUrl: rec.avatar_url as string | undefined,
        };
      }
      const roleById: Record<string, MemberRole> = {};
      const roleTitleById: Record<string, string> = {};
      for (const row of rolesRes.data ?? []) {
        const userId = row.user_id as string;
        roleById[userId] = normalizeRole(row.role as string);
        const title = (row.title as string | null)?.trim();
        if (title) roleTitleById[userId] = title;
      }
      const merged: Record<string, AuthorMeta> = {};
      for (const authorId of authorIds) {
        merged[authorId] = {
          name: profileById[authorId]?.name,
          avatarUrl: profileById[authorId]?.avatarUrl,
          role: roleById[authorId],
          roleTitle: roleTitleById[authorId],
        };
      }
      setAuthorMetaById(merged);
    }

    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [clubId, posts, user?.id]);

  useEffect(() => {
    if (!clubId || posts.length === 0) return;

    const postIds = posts.map((post) => post.id);
    const channel = supabase.channel(uniqueRealtimeTopic(`club-post-reactions:${clubId}`));

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "post_reactions" },
      () => {
        void reloadReactionMeta(postIds);
      },
    );

    channel.subscribe();

    return () => {
      removeRealtimeChannel(supabase, channel);
    };
  }, [clubId, posts, reloadReactionMeta]);

  const recordedViewsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    recordedViewsRef.current.clear();
  }, [user?.id]);

  const markPostAsSeen = useCallback(
    async (postId: string) => {
      if (!user?.id || !clubId) return;
      const recordKey = `${user.id}:${postId}`;
      if (recordedViewsRef.current.has(recordKey)) return;
      recordedViewsRef.current.add(recordKey);
      const ok = await recordAnnouncementView(postId, user.id);
      if (!ok) {
        recordedViewsRef.current.delete(recordKey);
        return;
      }
      const counts = await fetchPostViewCountsForClub([postId], clubId);
      setViewCountByPost((prev) => ({ ...prev, ...counts }));
    },
    [user?.id, clubId],
  );

  const isPrivileged = canManageAnnouncements;
  const isMemberRole =
    memberAccess.hasMembership && memberAccess.permissionRole === "member";
  const isMember = memberAccess.hasMembership;

  function openReportModal(postId: string) {
    setMenuOpenPostId(null);
    setReportPostId(postId);
    setReportReason(null);
    setReportDetails("");
  }

  function closeReportModal() {
    if (reportSubmitting) return;
    setReportPostId(null);
    setReportReason(null);
    setReportDetails("");
  }

  async function handleSubmitReport() {
    if (!user?.id || !reportPostId || !reportReason) return;
    setReportSubmitting(true);
    const { data: inserted, error } = await supabase
      .from("post_reports")
      .insert({
        post_id: reportPostId,
        reported_by: user.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      })
      .select("id")
      .single();
    setReportSubmitting(false);
    if (error || !inserted?.id) {
      setFeedback({ type: "error", text: "Could not submit report. Please try again." });
      return;
    }
    void notifyReportSubmitted(supabase, {
      reportId: inserted.id as string,
      reportKind: "post",
      summary: `Announcement/message report (${reportReason.replaceAll("_", " ")}).`,
      adminPath: "/app/admin?tab=reports",
    });
    closeReportModal();
    setReportSuccessMessage("Report submitted");
  }

  const displayPosts = useMemo(() => {
    let list = filterByVisibility(posts, {
      isMember,
      isPrivileged,
      userId: user?.id,
      accessLevel: memberAccess.accessLevel,
      role: memberAccess.role,
    });

    if (visibilityFilter !== "all") {
      list = list.filter((post) => (post.visibility ?? "members_only") === visibilityFilter);
    }

    if (announcementFilter === "pinned") {
      list = list.filter((post) => pinnedById[post.id] ?? false);
    }

    const comparePosts = (a: Post, b: Post) => {
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "most_liked") {
        const aLikes = reactionCountsByPost[a.id]?.heart ?? 0;
        const bLikes = reactionCountsByPost[b.id]?.heart ?? 0;
        if (bLikes !== aLikes) return bLikes - aLikes;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "most_seen") {
        const aSeen = viewCountByPost[a.id] ?? 0;
        const bSeen = viewCountByPost[b.id] ?? 0;
        if (bSeen !== aSeen) return bSeen - aSeen;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    const pinnedPosts = list
      .filter((post) => pinnedById[post.id] ?? false)
      .sort(comparePosts);
    const unpinnedPosts = list
      .filter((post) => !(pinnedById[post.id] ?? false))
      .sort(comparePosts);

    return [...pinnedPosts, ...unpinnedPosts];
  }, [
    posts,
    pinnedById,
    announcementFilter,
    visibilityFilter,
    sortBy,
    isMember,
    isPrivileged,
    user?.id,
    memberAccess.accessLevel,
    memberAccess.role,
    reactionCountsByPost,
    viewCountByPost,
  ]);

  useEffect(() => {
    if (!user?.id) return;
    for (const post of displayPosts) {
      const needsExpand = (post.content?.length ?? 0) > 300;
      if (!needsExpand) {
        void markPostAsSeen(post.id);
      }
    }
  }, [displayPosts, markPostAsSeen, user?.id]);

  function resetForm() {
    setTitle("");
    setContent("");
    setLinkUrl("");
    setPostVisibility("members_only");
    setSelectedVisibilityTargets(EMPTY_SELECTED_VISIBILITY);
    setSelectedFile(null);
    setExistingAttachmentUrl(null);
    setExistingAttachmentType(null);
    setEditingPostId(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreateForm() {
    setEditingPostId(null);
    setTitle("");
    setContent("");
    setLinkUrl("");
    setPostVisibility("members_only");
    setSelectedVisibilityTargets(EMPTY_SELECTED_VISIBILITY);
    setSelectedFile(null);
    setExistingAttachmentUrl(null);
    setExistingAttachmentType(null);
    setShowForm(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useEffect(() => {
    const shouldOpenCreate =
      searchParams.get("openCreate") === "true" ||
      searchParams.get("create") === "true";
    if (!shouldOpenCreate || !isPrivileged || loading || memberAccess.loading) {
      return;
    }
    const templateState = location.state as {
      contentTemplate?: { title?: string; content?: string };
    } | null;
    openCreateForm();
    if (templateState?.contentTemplate?.title) {
      setTitle(templateState.contentTemplate.title);
    }
    if (templateState?.contentTemplate?.content) {
      setContent(templateState.contentTemplate.content);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("openCreate");
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    isPrivileged,
    loading,
    memberAccess.loading,
    location.state,
  ]);

  useEffect(() => {
    if (
      searchParams.get("openTemplate") !== "true" ||
      !isPrivileged ||
      loading ||
      memberAccess.loading
    ) {
      return;
    }
    setShowTemplatePicker(true);
    const next = new URLSearchParams(searchParams);
    next.delete("openTemplate");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isPrivileged, loading, memberAccess.loading]);

  function openEditForm(post: Post) {
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setLinkUrl(post.linkUrl ?? "");
    setPostVisibility(post.visibility ?? "members_only");
    setSelectedVisibilityTargets(
      selectedVisibilityPayload(
        post.visibilityRoles ?? [],
        post.visibilityUserIds ?? [],
      ),
    );
    setSelectedFile(null);
    setExistingAttachmentUrl(post.attachmentUrl ?? null);
    setExistingAttachmentType(post.attachmentType ?? null);
    setShowForm(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFeedback({ type: "error", text: "File must be 20MB or smaller." });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const allowed = ACCEPTED_FILE_TYPES.split(",");
    if (!allowed.includes(file.type)) {
      setFeedback({
        type: "error",
        text: "Unsupported file type. Use JPEG, PNG, GIF, WebP, or PDF.",
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFeedback(null);
    setSelectedFile(file);
  }

  async function uploadAttachment(file: File, postId: string): Promise<{ url: string; type: string } | null> {
    if (!clubId) return null;
    const path = `${clubId}/${postId}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const url = await uploadImage(STORAGE_BUCKET, path, file);
    if (!url) return null;
    return { url, type: file.type };
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim() || !clubId) return;
    if (
      postVisibility === "selected" &&
      !hasSelectedVisibilityTargets(selectedVisibilityTargets)
    ) {
      setFeedback({
        type: "error",
        text: "Choose at least one role or member for selected visibility.",
      });
      return;
    }
    setSaving(true);
    setFeedback(null);

    let attachmentUrl = existingAttachmentUrl;
    let attachmentType = existingAttachmentType;
    if (selectedFile) {
      const uploadKey = editingPostId ?? crypto.randomUUID();
      const uploaded = await uploadAttachment(selectedFile, uploadKey);
      if (!uploaded) {
        setSaving(false);
        setFeedback({ type: "error", text: "Failed to upload attachment." });
        return;
      }
      attachmentUrl = uploaded.url;
      attachmentType = uploaded.type;
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      attachmentUrl,
      attachmentType,
      linkUrl: linkUrl.trim() || null,
      visibility: postVisibility,
      visibilityRoles:
        postVisibility === "selected"
          ? selectedVisibilityTargets.visibilityRoles
          : [],
      visibilityUserIds:
        postVisibility === "selected"
          ? selectedVisibilityTargets.visibilityUserIds
          : [],
    };

    const isEditing = Boolean(editingPostId);
    const ok = isEditing
      ? await updatePost(editingPostId as string, payload)
      : await createPost(payload);
    setSaving(false);

    if (ok) {
      resetForm();
      setFeedback({ type: "success", text: isEditing ? "Announcement updated." : "Announcement posted." });
    } else {
      setFeedback({ type: "error", text: isEditing ? "Failed to update announcement." : "Failed to post announcement." });
    }
  }

  async function handleTogglePin(postId: string) {
    const currentlyPinned = pinnedById[postId] ?? false;
    const { error } = await supabase
      .from("posts")
      .update({ is_pinned: !currentlyPinned })
      .eq("id", postId);
    if (error) {
      setFeedback({
        type: "error",
        text: currentlyPinned ? "Failed to unpin announcement." : "Failed to pin announcement.",
      });
      return;
    }
    setPinnedById((prev) => ({ ...prev, [postId]: !currentlyPinned }));
    refresh();
  }

  async function handleReactionToggle(postId: string, reaction: ReactionName) {
    if (!user?.id) return;
    const active = myReactionsByPost[postId]?.[reaction] ?? false;

    if (active) {
      const { error } = await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .eq("reaction", reaction);
      if (error) {
        console.error("Failed to remove reaction:", error.message);
      }
      await reloadReactionMeta([postId]);
      return;
    }

    const { error } = await supabase.from("post_reactions").insert({
      post_id: postId,
      user_id: user.id,
      reaction,
    });
    if (error) {
      console.error("Failed to add reaction:", error.message);
    }
    await reloadReactionMeta([postId]);
  }

  async function handleDelete(postId: string) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
    const ok = await deletePost(postId);
    if (ok) {
      refresh();
      if (editingPostId === postId) resetForm();
      setFeedback({ type: "success", text: "Announcement deleted." });
    } else {
      setFeedback({ type: "error", text: "Failed to delete announcement." });
    }
  }

  if (loading || memberAccess.loading) {
    return (
      <div
        style={{
          ...pageStyle,
          padding: isMobile ? "16px" : pageStyle.padding,
          display: "flex",
          minHeight: "40vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner label="Loading announcements…" />
      </div>
    );
  }

  const attachmentLabel = selectedFile
    ? selectedFile.name
    : existingAttachmentUrl
      ? "Current attachment kept (choose a file to replace)"
      : "No file selected";

  return (
    <div style={{ ...pageStyle, padding: isMobile ? "16px" : pageStyle.padding }}>
      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "28px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Announcements
          </h1>
          <p style={{ fontSize: "14px", color: MUTED, margin: "4px 0 0" }}>
            Stay up to date with club news, updates, and important posts.
          </p>
          <p style={{ fontSize: "12px", color: "#444444", margin: "4px 0 0" }}>
            {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isPrivileged ? (
          <button
            type="button"
            style={showForm && !editingPostId ? cancelButtonStyle : newPostButtonStyle}
            onClick={() => {
              if (showForm && !editingPostId) resetForm();
              else openCreateForm();
            }}
          >
            {showForm && !editingPostId ? "Cancel" : "+ New Post"}
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {ANNOUNCEMENT_FILTER_PILLS.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setAnnouncementFilter(pill.value)}
              style={announcementFilterPillStyle(announcementFilter === pill.value)}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <VisibilityFilterDropdown value={visibilityFilter} onChange={setVisibilityFilter} />
          <AnnouncementSortDropdown value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      {reportSuccessMessage ? (
        <p
          role="status"
          style={{
            fontSize: "13px",
            color: "#4ade80",
            margin: "0 0 16px",
          }}
        >
          {reportSuccessMessage}
        </p>
      ) : null}

      {feedback ? (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success" ? "bg-green-500/10 text-green-400" : "bg-primary/10 text-primary"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {showForm && isPrivileged ? (
        <div style={{ ...formContainerStyle, marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "#ffffff",
                margin: 0,
              }}
            >
              {editingPostId ? "Edit Announcement" : "Create Announcement"}
            </h3>
            {!editingPostId ? (
              <button
                type="button"
                onClick={() => setShowTemplatePicker(true)}
                style={useTemplateButtonStyle}
              >
                Use Template
              </button>
            ) : null}
          </div>
          <div className="space-y-4">
            <ThemedField
              id="postTitle"
              label="Title"
              value={title}
              onChange={setTitle}
              placeholder="e.g. Important Update"
              required
            />
            <ThemedField
              id="postContent"
              label="Content"
              value={content}
              onChange={setContent}
              placeholder="Write your announcement…"
              multiline
              required
            />
            <ThemedField
              id="postLinkUrl"
              label="Link (optional)"
              value={linkUrl}
              onChange={setLinkUrl}
              placeholder="https://..."
            />
            <VisibilitySelector
              value={postVisibility}
              onChange={setPostVisibility}
            />
            {postVisibility === "selected" ? (
              <SelectedVisibilityPicker
                members={members}
                targets={selectedVisibilityTargets}
                onChange={setSelectedVisibilityTargets}
                disabled={saving}
              />
            ) : null}
            <div>
              <label htmlFor="postAttachment" style={labelStyle}>
                Attach Image or File (optional)
              </label>
              <input
                ref={fileInputRef}
                id="postAttachment"
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ ...formCancelButtonStyle, padding: "8px 16px" }}
                >
                  Choose File
                </button>
                <span style={{ fontSize: "13px", color: "#888888" }}>{attachmentLabel}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "8px" }}>
              <button type="button" style={formCancelButtonStyle} onClick={resetForm} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...submitButtonStyle,
                  opacity:
                    !title.trim() ||
                    !content.trim() ||
                    saving ||
                    (postVisibility === "selected" &&
                      !hasSelectedVisibilityTargets(selectedVisibilityTargets))
                      ? 0.6
                      : 1,
                  cursor:
                    !title.trim() ||
                    !content.trim() ||
                    saving ||
                    (postVisibility === "selected" &&
                      !hasSelectedVisibilityTargets(selectedVisibilityTargets))
                      ? "not-allowed"
                      : "pointer",
                }}
                onClick={handleSubmit}
                disabled={
                  !title.trim() ||
                  !content.trim() ||
                  saving ||
                  (postVisibility === "selected" &&
                    !hasSelectedVisibilityTargets(selectedVisibilityTargets))
                }
              >
                {saving ? (editingPostId ? "Saving…" : "Posting…") : editingPostId ? "Save Changes" : "Post Announcement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {posts.length === 0 ? (
        <p style={{ textAlign: "center", color: MUTED, fontSize: "14px", padding: "48px 16px" }}>
          {isPrivileged
            ? "Create your first announcement →"
            : "No announcements yet. Be the first to post."}
        </p>
      ) : displayPosts.length === 0 ? (
        <p style={{ textAlign: "center", color: MUTED, fontSize: "14px", padding: "48px 16px" }}>
          No pinned announcements yet.
        </p>
      ) : (
        <div
          style={
            isPrivileged && !isMobile
              ? { display: "flex", alignItems: "flex-start" }
              : undefined
          }
        >
          <div
            style={{
              flex: isPrivileged && !isMobile ? 1 : undefined,
              minWidth: 0,
              width: isPrivileged && !isMobile ? undefined : "100%",
              marginRight: isPrivileged && !isMobile ? "24px" : 0,
            }}
          >
            {displayPosts.map((post) => renderPostCard(post))}
          </div>
          {isPrivileged && !isMobile ? <EngagementTipsSidebar /> : null}
        </div>
      )}

      {seenListPostId && canViewEngagement && clubId ? (
        <SeenListModal
          postId={seenListPostId}
          clubId={clubId}
          postTitle={posts.find((p) => p.id === seenListPostId)?.title ?? "Announcement"}
          onClose={() => setSeenListPostId(null)}
        />
      ) : null}

      {reportPostId ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
          onClick={closeReportModal}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              Report Post
            </h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              {REPORT_REASONS.map((reason) => {
                const selected = reportReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setReportReason(reason)}
                    style={{
                      background: selected ? "#1a0505" : "#111111",
                      border: `1px solid ${selected ? ACCENT_RED : "#2a2a2a"}`,
                      color: selected ? ACCENT_RED : "#cccccc",
                      borderRadius: "20px",
                      padding: "6px 14px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "#888888",
                marginBottom: "8px",
              }}
            >
              Additional details (optional)
            </label>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#ffffff",
                fontSize: "14px",
                marginBottom: "16px",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={() => void handleSubmitReport()}
              disabled={!reportReason || reportSubmitting}
              style={{
                width: "100%",
                background: ACCENT_RED,
                color: "#ffffff",
                borderRadius: "6px",
                padding: "10px 16px",
                fontSize: "14px",
                fontWeight: 600,
                border: "none",
                cursor: !reportReason || reportSubmitting ? "not-allowed" : "pointer",
                opacity: !reportReason || reportSubmitting ? 0.6 : 1,
              }}
            >
              {reportSubmitting ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        </div>
      ) : null}

      {showTemplatePicker ? (
        <TemplatePickerModal
          type="announcement"
          clubName={club?.name ?? "your club"}
          clubCategory={club?.category}
          onClose={() => setShowTemplatePicker(false)}
          onSelect={(template) => {
            setShowTemplatePicker(false);
            openCreateForm();
            if ("content" in template) {
              setTitle(template.title);
              setContent(template.content);
            }
          }}
        />
      ) : null}
    </div>
  );

  function renderPostCard(post: Post) {
    const isPinned = pinnedById[post.id] ?? false;
    const isHovered = hoveredPostId === post.id;
    const isExpanded = expanded[post.id] ?? false;
    const showReadMore = (post.content?.length ?? 0) > 300;
    const authorMeta = authorMetaById[post.authorId] ?? {};
    const authorName = authorMeta.name ?? post.authorName ?? "Unknown";
    const reactionCounts = reactionCountsByPost[post.id] ?? {
      heart: 0,
      thumbs_up: 0,
      laugh: 0,
      bookmark: 0,
    };
    const myReactions = myReactionsByPost[post.id] ?? {
      heart: false,
      thumbs_up: false,
      laugh: false,
      bookmark: false,
    };
    const showMenu = isPrivileged || (isMemberRole && post.authorId !== user?.id);

    return (
      <AnnouncementCard
        key={post.id}
        post={post}
        isPinned={isPinned}
        isHovered={isHovered}
        isExpanded={isExpanded}
        showReadMore={showReadMore}
        authorName={authorName}
        roleTitle={authorMeta.roleTitle}
        avatarUrl={authorMeta.avatarUrl}
        heartCount={reactionCounts.heart ?? 0}
        heartActive={myReactions.heart}
        bookmarkActive={myReactions.bookmark}
        seenCount={viewCountByPost[post.id] ?? 0}
        isPrivileged={isPrivileged}
        canViewEngagement={canViewEngagement}
        showMenu={showMenu}
        menuOpen={menuOpenPostId === post.id}
        isMemberRole={isMemberRole}
        canReport={post.authorId !== user?.id}
        onMouseEnter={() => setHoveredPostId(post.id)}
        onMouseLeave={() => setHoveredPostId(null)}
        onToggleMenu={() =>
          setMenuOpenPostId((prev) => (prev === post.id ? null : post.id))
        }
        onToggleExpand={() => {
          const willExpand = !isExpanded;
          setExpanded((prev) => ({ ...prev, [post.id]: willExpand }));
          if (willExpand) {
            void markPostAsSeen(post.id);
          }
        }}
        onHeartToggle={() => void handleReactionToggle(post.id, "heart")}
        onBookmarkToggle={() => void handleReactionToggle(post.id, "bookmark")}
        onViewSeenList={() => {
          setSeenListPostId(post.id);
          if (clubId) {
            void fetchPostViewCountsForClub([post.id], clubId).then((counts) => {
              setViewCountByPost((prev) => ({ ...prev, ...counts }));
            });
          }
        }}
        onPin={() => {
          setMenuOpenPostId(null);
          void handleTogglePin(post.id);
        }}
        onEdit={() => {
          setMenuOpenPostId(null);
          openEditForm(post);
        }}
        onDelete={() => {
          setMenuOpenPostId(null);
          void handleDelete(post.id);
        }}
        onReport={() => openReportModal(post.id)}
        formatDate={formatPostDate}
        attachment={
          post.attachmentUrl && post.attachmentType ? (
            <PostAttachment
              url={post.attachmentUrl}
              type={post.attachmentType}
              title={post.title}
            />
          ) : undefined
        }
      />
    );
  }
}
