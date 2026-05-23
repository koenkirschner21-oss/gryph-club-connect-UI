import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubPosts } from "../../hooks/useClubPosts";
import { uploadImage } from "../../lib/uploadImage";
import { supabase } from "../../lib/supabaseClient";
import Spinner from "../../components/ui/Spinner";
import type { MemberRole, Post } from "../../types";

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#242424";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_FILE_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf";
const STORAGE_BUCKET = "announcement-attachments";

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

const postCardStyle: CSSProperties = {
  backgroundColor: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderLeft: `3px solid ${ACCENT_RED}`,
  borderRadius: "8px",
  padding: "20px",
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

const editButtonStyle: CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid #333333",
  color: "#888888",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  cursor: "pointer",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const deleteButtonStyle: CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid #3a1a1a",
  color: ACCENT_RED,
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  cursor: "pointer",
  flexShrink: 0,
};

const pdfLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "#1a1a1a",
  border: "1px solid #333333",
  borderRadius: "6px",
  padding: "8px 14px",
  color: ACCENT_RED,
  fontSize: "13px",
  textDecoration: "none",
  marginTop: "12px",
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

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DownloadIcon() {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
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
          display: "block",
          width: "100%",
          maxHeight: "300px",
          objectFit: "contain",
          borderRadius: "8px",
          marginTop: "12px",
          backgroundColor: "#111111",
        }}
      />
    );
  }

  if (type === "application/pdf") {
    const fileName = url.split("/").pop() ?? "Download PDF";
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        style={pdfLinkStyle}
      >
        <DownloadIcon />
        {decodeURIComponent(fileName)}
      </a>
    );
  }

  return null;
}

export default function ClubAnnouncementsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { posts, loading, createPost, updatePost, deletePost } =
    useClubPosts(clubId);

  const [userRole, setUserRole] = useState<MemberRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<
    string | null
  >(null);
  const [existingAttachmentType, setExistingAttachmentType] = useState<
    string | null
  >(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
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
        setUserRole(data?.role ? normalizeRole(data.role) : "member");
        setRoleLoading(false);
      }
    }

    fetchRole();
    return () => {
      cancelled = true;
    };
  }, [clubId, user?.id]);

  const isPrivileged = isPrivilegedRole(userRole);

  function resetForm() {
    setTitle("");
    setContent("");
    setSelectedFile(null);
    setExistingAttachmentUrl(null);
    setExistingAttachmentType(null);
    setEditingPostId(null);
    setShowForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openCreateForm() {
    setEditingPostId(null);
    setTitle("");
    setContent("");
    setSelectedFile(null);
    setExistingAttachmentUrl(null);
    setExistingAttachmentType(null);
    setShowForm(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openEditForm(post: Post) {
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setSelectedFile(null);
    setExistingAttachmentUrl(post.attachmentUrl ?? null);
    setExistingAttachmentType(post.attachmentType ?? null);
    setShowForm(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFeedback({ type: "error", text: "File must be 20MB or smaller." });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const allowed = ACCEPTED_FILE_TYPES.split(",");
    if (!allowed.includes(file.type)) {
      setFeedback({
        type: "error",
        text: "Unsupported file type. Use JPEG, PNG, GIF, WebP, or PDF.",
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setFeedback(null);
    setSelectedFile(file);
  }

  async function uploadAttachment(
    file: File,
    postId: string,
  ): Promise<{ url: string; type: string } | null> {
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
      ? await updatePost(editingPostId!, payload)
      : await createPost(payload);

    setSaving(false);

    if (ok) {
      resetForm();
      setFeedback({
        type: "success",
        text: isEditing
          ? "Announcement updated."
          : "Announcement posted.",
      });
    } else {
      setFeedback({
        type: "error",
        text: isEditing
          ? "Failed to update announcement."
          : "Failed to post announcement.",
      });
    }
  }

  async function handleDelete(postId: string) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) {
      return;
    }
    setFeedback(null);
    const ok = await deletePost(postId);
    if (ok) {
      if (editingPostId === postId) {
        resetForm();
      }
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
    <div style={pageStyle}>
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
          <h1
            style={{
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Announcements
          </h1>
          <p style={{ fontSize: "13px", color: MUTED, margin: "4px 0 0" }}>
            {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isPrivileged && (
          <button
            type="button"
            style={showForm && !editingPostId ? cancelButtonStyle : newPostButtonStyle}
            onClick={() => {
              if (showForm && !editingPostId) {
                resetForm();
              } else {
                openCreateForm();
              }
            }}
          >
            {showForm && !editingPostId ? "Cancel" : "+ New Post"}
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {showForm && isPrivileged && (
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
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...formCancelButtonStyle,
                    padding: "8px 16px",
                  }}
                >
                  Choose File
                </button>
                <span style={{ fontSize: "13px", color: "#888888" }}>
                  {attachmentLabel}
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                paddingTop: "8px",
              }}
            >
              <button
                type="button"
                style={formCancelButtonStyle}
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...submitButtonStyle,
                  opacity: !title.trim() || !content.trim() || saving ? 0.6 : 1,
                  cursor:
                    !title.trim() || !content.trim() || saving
                      ? "not-allowed"
                      : "pointer",
                }}
                onClick={handleSubmit}
                disabled={!title.trim() || !content.trim() || saving}
              >
                {saving
                  ? editingPostId
                    ? "Saving…"
                    : "Posting…"
                  : editingPostId
                    ? "Save Changes"
                    : "Post Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <p
          style={{
            textAlign: "center",
            color: MUTED,
            fontSize: "14px",
            padding: "48px 16px",
          }}
        >
          No announcements yet.{" "}
          {isPrivileged ? (
            <span style={{ color: ACCENT_RED }}>
              Create your first announcement
            </span>
          ) : (
            "Check back soon!"
          )}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {posts.map((post) => (
            <article key={post.id} style={postCardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3
                    style={{
                      fontWeight: 600,
                      fontSize: "16px",
                      color: "#ffffff",
                      margin: 0,
                    }}
                  >
                    {post.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "12px",
                      color: MUTED,
                      marginTop: "4px",
                      marginBottom: 0,
                    }}
                  >
                    <span style={{ color: "#888888", fontWeight: 500 }}>
                      {post.authorName ?? "Unknown"}
                    </span>
                    {" · "}
                    {new Date(post.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#cccccc",
                      lineHeight: 1.6,
                      marginTop: "12px",
                      marginBottom: 0,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {post.content}
                  </p>
                  {post.attachmentUrl && post.attachmentType ? (
                    <PostAttachment
                      url={post.attachmentUrl}
                      type={post.attachmentType}
                      title={post.title}
                    />
                  ) : null}
                </div>
                {isPrivileged && (
                  <div
                    style={{
                      display: "flex",
                      flexShrink: 0,
                      gap: "8px",
                    }}
                  >
                    <button
                      type="button"
                      style={editButtonStyle}
                      onClick={() => openEditForm(post)}
                    >
                      <PencilIcon />
                      Edit
                    </button>
                    <button
                      type="button"
                      style={deleteButtonStyle}
                      onClick={() => handleDelete(post.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
