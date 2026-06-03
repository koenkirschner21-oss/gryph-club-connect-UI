import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bookmark, Download, Heart } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubPosts } from "../../hooks/useClubPosts";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { uploadImage } from "../../lib/uploadImage";
import { supabase } from "../../lib/supabaseClient";
import Spinner from "../../components/ui/Spinner";
import type { MemberRole, Post } from "../../types";

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#242424";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";
const PIN_GOLD = "#FFC429";
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

function isPrivilegedRole(role: MemberRole | null): boolean {
  return role === "owner" || role === "executive";
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "just now";
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) {
    const mins = Math.floor(diff / minute);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diff / day);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function roleBadgeStyle(role: MemberRole | undefined): CSSProperties {
  if (role === "owner") {
    return {
      fontSize: "11px",
      fontWeight: 600,
      color: PIN_GOLD,
      border: `1px solid ${PIN_GOLD}`,
      background: "#1a1500",
      borderRadius: "999px",
      padding: "2px 8px",
      textTransform: "uppercase",
    };
  }
  if (role === "executive") {
    return {
      fontSize: "11px",
      fontWeight: 600,
      color: ACCENT_RED,
      border: `1px solid ${ACCENT_RED}`,
      background: "#1a0a0a",
      borderRadius: "999px",
      padding: "2px 8px",
      textTransform: "uppercase",
    };
  }
  return {
    fontSize: "11px",
    fontWeight: 600,
    color: "#888888",
    border: "1px solid #333333",
    background: "#151515",
    borderRadius: "999px",
    padding: "2px 8px",
    textTransform: "uppercase",
  };
}

function roleLabel(role: MemberRole | undefined): string {
  if (role === "owner") return "President";
  if (role === "executive") return "Executive";
  return "Member";
}

const reactionButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  borderRadius: "20px",
  cursor: "pointer",
};

function menuItemButtonStyle(destructive = false): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: destructive ? ACCENT_RED : "#cccccc",
    padding: "9px 12px",
    fontSize: "13px",
    cursor: "pointer",
  };
}

function DotsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
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
      <img
        src={url}
        alt={`Attachment for ${title}`}
        style={{
          width: "100%",
          maxHeight: "400px",
          objectFit: "cover",
          display: "block",
        }}
      />
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
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const { posts, loading, createPost, updatePost, deletePost, refresh } = useClubPosts(clubId);

  const [userRole, setUserRole] = useState<MemberRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!reportSuccessMessage) return;
    const timer = window.setTimeout(() => setReportSuccessMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [reportSuccessMessage]);

  useEffect(() => {
    let cancelled = false;
    async function fetchRole() {
      const previewRole = localStorage.getItem("previewRole");
      if (previewRole) {
        setUserRole(previewRole as MemberRole);
        setRoleLoading(false);
        return;
      }

      if (!clubId || !user?.id) {
        if (!cancelled) {
          setUserRole(null);
          setRoleLoading(false);
        }
        return;
      }
      setRoleLoading(true);
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (!cancelled) {
        setUserRole(data?.role ? normalizeRole(data.role as string) : "member");
        setRoleLoading(false);
      }
    }
    void fetchRole();
    return () => {
      cancelled = true;
    };
  }, [clubId, user?.id]);

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
      const [pinnedRes, reactionsRes, viewsRes, profilesRes, rolesRes] = await Promise.all([
        supabase.from("posts").select("id, is_pinned").in("id", postIds),
        supabase.from("post_reactions").select("post_id, user_id, reaction").in("post_id", postIds),
        supabase.from("post_views").select("post_id, user_id").in("post_id", postIds),
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", authorIds),
        supabase
          .from("club_members")
          .select("user_id, role")
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

      if (!viewsRes.error) {
        const countMap: Record<string, number> = {};
        for (const postId of postIds) countMap[postId] = 0;
        for (const row of viewsRes.data ?? []) {
          const postId = row.post_id as string;
          countMap[postId] = (countMap[postId] ?? 0) + 1;
        }
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
      for (const row of rolesRes.data ?? []) {
        roleById[row.user_id as string] = normalizeRole(row.role as string);
      }
      const merged: Record<string, AuthorMeta> = {};
      for (const authorId of authorIds) {
        merged[authorId] = {
          name: profileById[authorId]?.name,
          avatarUrl: profileById[authorId]?.avatarUrl,
          role: roleById[authorId],
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
    if (!clubId || !user?.id || posts.length === 0) return;
    const rows = posts.map((post) => ({ post_id: post.id, user_id: user.id }));
    void supabase
      .from("post_views")
      .upsert(rows, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  }, [clubId, posts, user?.id]);

  const isPrivileged = isPrivilegedRole(userRole);
  const isMemberRole = userRole === "member";

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
    const { error } = await supabase.from("post_reports").insert({
      post_id: reportPostId,
      reported_by: user.id,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    setReportSubmitting(false);
    if (error) {
      setFeedback({ type: "error", text: "Could not submit report. Please try again." });
      return;
    }
    closeReportModal();
    setReportSuccessMessage("Report submitted");
  }

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      const aPinned = pinnedById[a.id] ?? false;
      const bPinned = pinnedById[b.id] ?? false;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [posts, pinnedById]);
  const pinnedPosts = sortedPosts.filter((post) => pinnedById[post.id] ?? false);
  const regularPosts = sortedPosts.filter((post) => !(pinnedById[post.id] ?? false));

  function resetForm() {
    setTitle("");
    setContent("");
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
    setSelectedFile(null);
    setExistingAttachmentUrl(null);
    setExistingAttachmentType(null);
    setShowForm(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useEffect(() => {
    if (searchParams.get("create") !== "true" || !isPrivileged || loading || roleLoading) {
      return;
    }
    openCreateForm();
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isPrivileged, loading, roleLoading]);

  function openEditForm(post: Post) {
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
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

    setMyReactionsByPost((prev) => ({
      ...prev,
      [postId]: {
        heart: prev[postId]?.heart ?? false,
        thumbs_up: prev[postId]?.thumbs_up ?? false,
        laugh: prev[postId]?.laugh ?? false,
        bookmark: prev[postId]?.bookmark ?? false,
        [reaction]: !active,
      },
    }));
    setReactionCountsByPost((prev) => ({
      ...prev,
      [postId]: {
        heart: prev[postId]?.heart ?? 0,
        thumbs_up: prev[postId]?.thumbs_up ?? 0,
        laugh: prev[postId]?.laugh ?? 0,
        bookmark: prev[postId]?.bookmark ?? 0,
        [reaction]: Math.max((prev[postId]?.[reaction] ?? 0) + (active ? -1 : 1), 0),
      },
    }));

    if (active) {
      const { error } = await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .eq("reaction", reaction);
      if (error) console.error("Failed to remove reaction:", error.message);
      else refresh();
      return;
    }

    const { error } = await supabase.from("post_reactions").insert({
      post_id: postId,
      user_id: user.id,
      reaction,
    });
    if (error) console.error("Failed to add reaction:", error.message);
    else refresh();
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

  if (loading || roleLoading) {
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
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ fontWeight: 700, fontSize: "22px", color: "#ffffff", margin: 0 }}>
            Announcements
          </h1>
          <p style={{ fontSize: "13px", color: MUTED, margin: "4px 0 0" }}>
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
          <h3
            style={{
              fontWeight: 600,
              fontSize: "16px",
              color: "#ffffff",
              margin: "0 0 20px",
            }}
          >
            {editingPostId ? "Edit Announcement" : "Create Announcement"}
          </h3>
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
                  opacity: !title.trim() || !content.trim() || saving ? 0.6 : 1,
                  cursor: !title.trim() || !content.trim() || saving ? "not-allowed" : "pointer",
                }}
                onClick={handleSubmit}
                disabled={!title.trim() || !content.trim() || saving}
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
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
          }}
        >
          {pinnedPosts.length > 0 ? (
            <div style={{ marginBottom: "4px" }}>
              <p
                style={{
                  color: PIN_GOLD,
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: "0 0 10px",
                }}
              >
                📌 Pinned
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {pinnedPosts.map((post) => renderPostCard(post, true))}
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {regularPosts.map((post) => renderPostCard(post, false))}
          </div>
        </div>
      )}

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
    </div>
  );

  function renderPostCard(post: Post, pinnedSection: boolean) {
    const isPinned = pinnedById[post.id] ?? false;
    const authorMeta = authorMetaById[post.authorId] ?? {};
    const displayName = authorMeta.name ?? post.authorName ?? "Unknown";
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
    const heartActive = myReactions.heart;
    const bookmarkActive = myReactions.bookmark;
    const heartCount = reactionCounts.heart ?? 0;

    return (
      <article
        key={post.id}
        style={{
          background: CARD_BG,
          border: pinnedSection ? "1px solid #3a2500" : `1px solid ${CARD_BORDER}`,
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: "16px",
          transition: "all 0.15s ease",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            padding: "14px 16px 10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            {authorMeta.avatarUrl ? (
              <img
                src={authorMeta.avatarUrl}
                alt=""
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#2a2a2a",
                  color: "#888888",
                  fontWeight: 600,
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials(displayName)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                  {displayName}
                </p>
                <span style={roleBadgeStyle(authorMeta.role)}>{roleLabel(authorMeta.role)}</span>
              </div>
              <p style={{ fontSize: "12px", color: "#555555", margin: "3px 0 0" }}>
                {relativeTime(post.createdAt)}
              </p>
            </div>
          </div>
          {isPrivileged || (isMemberRole && post.authorId !== user?.id) ? (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                aria-label="Post options"
                onClick={() => setMenuOpenPostId((prev) => (prev === post.id ? null : post.id))}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#777777",
                  padding: "4px",
                  cursor: "pointer",
                }}
              >
                <DotsIcon />
              </button>
              {menuOpenPostId === post.id ? (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "24px",
                    background: "#151515",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    minWidth: "140px",
                    zIndex: 5,
                    overflow: "hidden",
                  }}
                >
                  {isPrivileged ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpenPostId(null);
                          void handleTogglePin(post.id);
                        }}
                        style={menuItemButtonStyle()}
                      >
                        {isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpenPostId(null);
                          openEditForm(post);
                        }}
                        style={menuItemButtonStyle()}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpenPostId(null);
                          void handleDelete(post.id);
                        }}
                        style={menuItemButtonStyle(true)}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                  {isMemberRole && post.authorId !== user?.id ? (
                    <button
                      type="button"
                      onClick={() => openReportModal(post.id)}
                      style={menuItemButtonStyle()}
                    >
                      Report Post
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ padding: "0 16px 16px" }}>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", margin: "0 0 8px" }}>
            {post.title}
          </p>
          <p
            style={{
              fontSize: "15px",
              color: "#cccccc",
              lineHeight: 1.7,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {post.content}
          </p>
        </div>
        {post.attachmentUrl && post.attachmentType ? (
          <PostAttachment url={post.attachmentUrl} type={post.attachmentType} title={post.title} />
        ) : null}

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1e1e1e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              aria-label={heartActive ? "Unlike announcement" : "Like announcement"}
              onClick={() => void handleReactionToggle(post.id, "heart")}
              style={reactionButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1f1f1f";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Heart
                size={16}
                color={heartActive ? ACCENT_RED : MUTED}
                fill={heartActive ? ACCENT_RED : "none"}
                aria-hidden
              />
              <span
                style={{
                  fontSize: "13px",
                  color: heartActive ? ACCENT_RED : MUTED,
                }}
              >
                {heartCount}
              </span>
            </button>
            <button
              type="button"
              aria-label={bookmarkActive ? "Remove bookmark" : "Bookmark announcement"}
              onClick={() => void handleReactionToggle(post.id, "bookmark")}
              style={reactionButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1f1f1f";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Bookmark
                size={16}
                color={bookmarkActive ? PIN_GOLD : MUTED}
                fill={bookmarkActive ? PIN_GOLD : "none"}
                aria-hidden
              />
            </button>
          </div>
          {isPrivileged ? (
            <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
              Seen by {viewCountByPost[post.id] ?? 0} members
            </p>
          ) : null}
        </div>
      </article>
    );
  }
}
