import { useState } from "react";
import { useParams } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubPosts } from "../../hooks/useClubPosts";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";

export default function ClubAnnouncementsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getUserRole } = useClubContext();
  const { posts, loading, createPost, deletePost } = useClubPosts(clubId);

  const role = getUserRole(clubId ?? "");
  const isAdminOrExec = role === "admin" || role === "exec";

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
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading announcements…" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Announcements</h1>
          <p className="text-sm text-muted">
            {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdminOrExec && (
          <Button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
          >
            {showForm ? "Cancel" : "+ New Post"}
          </Button>
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
      {showForm && isAdminOrExec && (
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
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            No announcements yet.{" "}
            {isAdminOrExec
              ? "Create one to keep your members informed!"
              : "Check back soon!"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white">{post.title}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {post.authorName ?? "Unknown"} ·{" "}
                    {new Date(post.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                    {post.content}
                  </p>
                </div>
                {isAdminOrExec && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(post.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
