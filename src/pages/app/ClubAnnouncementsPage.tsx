import { useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubPosts } from "../../hooks/useClubPosts";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";
import { isPrivilegedClubRole } from "../../lib/clubRoles";

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#242424";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";

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

export default function ClubAnnouncementsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getUserRole } = useClubContext();
  const { posts, loading, createPost, deletePost } = useClubPosts(clubId);

  const role = getUserRole(clubId ?? "");
  const isPrivileged = isPrivilegedClubRole(role);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function resetForm() {
    setTitle("");
    setContent("");
    setShowForm(false);
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setFeedback(null);
    const ok = await createPost({
      title: title.trim(),
      content: content.trim(),
    });
    setSaving(false);
    if (ok) {
      resetForm();
      setFeedback({ type: "success", text: "Announcement posted." });
    } else {
      setFeedback({ type: "error", text: "Failed to post announcement." });
    }
  }

  async function handleDelete(postId: string) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
    setFeedback(null);
    const ok = await deletePost(postId);
    if (ok) {
      setFeedback({ type: "success", text: "Announcement deleted." });
    } else {
      setFeedback({ type: "error", text: "Failed to delete announcement." });
    }
  }

  if (loading) {
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
            style={showForm ? cancelButtonStyle : newPostButtonStyle}
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
          >
            {showForm ? "Cancel" : "+ New Post"}
          </button>
        )}
      </div>

      {/* Feedback message */}
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

      {/* Create form — admin/exec only */}
      {showForm && isPrivileged && (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 font-semibold text-white">
            Create Announcement
          </h3>
          <div className="space-y-3">
            <FormInput
              id="postTitle"
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Important Update"
              required
            />
            <div>
              <label
                htmlFor="postContent"
                className="mb-1 block text-sm font-medium text-white"
              >
                Content
              </label>
              <textarea
                id="postContent"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Write your announcement…"
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || !content.trim() || saving}
              >
                {saving ? "Posting…" : "Post Announcement"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Posts list */}
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
            <span style={{ color: ACCENT_RED }}>Create your first announcement</span>
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
                </div>
                {isPrivileged && (
                  <button
                    type="button"
                    style={deleteButtonStyle}
                    onClick={() => handleDelete(post.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
