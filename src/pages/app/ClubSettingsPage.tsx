import { useState, useEffect, type FormEvent, type CSSProperties } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { uploadImage } from "../../lib/uploadImage";
import { supabase } from "../../lib/supabaseClient";
import { useClubMembers } from "../../hooks/useClubMembers";
import type { MemberRole } from "../../types";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Card from "../../components/ui/Card";
import ImageUpload from "../../components/ui/ImageUpload";

function normalizeMemberRole(role: string): MemberRole {
  if (role === "executive" || role === "exec") return "executive";
  if (role === "owner") return "owner";
  return "member";
}

function formatSettingsRoleLabel(role: MemberRole | string): string {
  if (role === "owner") return "President";
  if (role === "executive" || role === "exec") return "Executive";
  return "Member";
}

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
};

const modalPanelStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "400px",
  width: "100%",
};

export default function ClubSettingsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { getClubById, updateClub, leaveClub } = useClubContext();
  const { members } = useClubMembers(clubId);

  const club = getClubById(clubId ?? "");

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [roleLoading, setRoleLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState(false);

  const [name, setName] = useState(club?.name ?? "");
  const [shortDescription, setShortDescription] = useState(
    club?.shortDescription ?? "",
  );
  const [longDescription, setLongDescription] = useState(
    club?.longDescription ?? "",
  );
  const [category, setCategory] = useState(club?.category ?? "");
  const [abbreviation, setAbbreviation] = useState(
    club?.abbreviation ?? "",
  );
  const [brandColor, setBrandColor] = useState(club?.brandColor ?? "#C20430");
  const [requiresApproval, setRequiresApproval] = useState(
    club?.requiresApproval ?? false,
  );

  const [logoUrl, setLogoUrl] = useState(club?.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(club?.bannerUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const [transferTargetId, setTransferTargetId] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const socialInputStyle: CSSProperties = {
    background: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "10px 14px",
    color: "#ffffff",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  };

  const socialLabelStyle: CSSProperties = {
    fontSize: "12px",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "6px",
  };

  const isOwner = userRole === "owner";

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      if (!user?.id || !clubId) {
        if (!cancelled) setRoleLoading(false);
        return;
      }

      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();

      if (cancelled) return;

      if (data?.role) {
        setUserRole(normalizeMemberRole(data.role as string));
        setHasMembership(true);
      } else {
        setHasMembership(false);
      }
      setRoleLoading(false);
    }

    void fetchRole();
    return () => {
      cancelled = true;
    };
  }, [clubId, user?.id]);

  useEffect(() => {
    if (!clubId || !isOwner) return;

    let cancelled = false;

    supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setInstagramUrl((data.instagram_url as string) ?? "");
        setLinkedinUrl((data.linkedin_url as string) ?? "");
        setTwitterUrl((data.twitter_url as string) ?? "");
        setWebsiteUrl((data.website_url as string) ?? "");
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, isOwner]);

  async function handleLogoUpload(file: File) {
    if (!clubId) return;
    setUploadingLogo(true);
    setError(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${clubId}.${ext}`;
    const url = await uploadImage("club-logos", path, file);
    if (url) {
      setLogoUrl(`${url}?t=${Date.now()}`);
    } else {
      setError("Logo upload failed.");
    }
    setUploadingLogo(false);
  }

  async function handleBannerUpload(file: File) {
    if (!clubId) return;
    setUploadingBanner(true);
    setError(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${clubId}.${ext}`;
    const url = await uploadImage("club-banners", path, file);
    if (url) {
      setBannerUrl(`${url}?t=${Date.now()}`);
    } else {
      setError("Banner upload failed.");
    }
    setUploadingBanner(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError("Club name is required");
      return;
    }

    setSaving(true);

    const ok = await updateClub(
      clubId!,
      isOwner
        ? {
            name: name.trim(),
            shortDescription: shortDescription.trim() || undefined,
            longDescription: longDescription.trim() || undefined,
            category: category.trim(),
            abbreviation: abbreviation.trim() || undefined,
            brandColor: brandColor.trim() || undefined,
            logoUrl: logoUrl.trim() || undefined,
            bannerUrl: bannerUrl.trim() || undefined,
            requiresApproval,
          }
        : {
            name: name.trim(),
            shortDescription: shortDescription.trim() || undefined,
            longDescription: longDescription.trim() || undefined,
            category: category.trim(),
          },
    );

    if (ok && isOwner) {
      const { error: socialError } = await supabase
        .from("clubs")
        .update({
          instagram_url: instagramUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        })
        .eq("id", clubId);

      if (socialError) {
        setSaving(false);
        setError("Failed to save social links. Please try again.");
        return;
      }
    }

    setSaving(false);

    if (ok) {
      setSuccess(true);
    } else {
      setError("Failed to save changes. Please try again.");
    }
  }

  async function handleRegenerateCode() {
    if (!clubId) return;
    setRegeneratingCode(true);
    setError(null);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const randomValues = crypto.getRandomValues(new Uint8Array(6));
    const newCode = Array.from(randomValues, (v) => chars[v % chars.length]).join("");
    const ok = await updateClub(clubId, { joinCode: newCode });
    setRegeneratingCode(false);
    if (ok) {
      setSuccess(true);
    } else {
      setError("Failed to regenerate join code.");
    }
  }

  function handleCopyCode() {
    const currentCode = getClubById(clubId ?? "")?.joinCode;
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setError("Failed to copy to clipboard.");
      },
    );
  }

  async function handleConfirmTransfer() {
    if (!clubId || !user?.id || !transferTargetId) return;
    setTransferring(true);
    setError(null);

    const { error: ownerError } = await supabase
      .from("club_members")
      .update({ role: "owner" })
      .eq("club_id", clubId)
      .eq("user_id", transferTargetId);

    if (ownerError) {
      setError("Failed to transfer ownership. Please try again.");
      setTransferring(false);
      setShowTransferModal(false);
      return;
    }

    const { error: execError } = await supabase
      .from("club_members")
      .update({ role: "executive" })
      .eq("club_id", clubId)
      .eq("user_id", user.id);

    setTransferring(false);
    setShowTransferModal(false);

    if (execError) {
      setError("Ownership transferred but your role could not be updated.");
      return;
    }

    setUserRole("executive");
    setTransferTargetId("");
    setSuccess(true);
  }

  async function handleConfirmDelete() {
    if (!clubId || !club) return;
    if (deleteConfirmName.trim() !== club.name.trim()) return;

    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("clubs")
      .delete()
      .eq("id", clubId);

    setDeleting(false);
    setShowDeleteModal(false);

    if (deleteError) {
      setError("Failed to delete club. Please try again.");
      return;
    }

    navigate("/app", { replace: true });
  }

  async function handleConfirmLeave() {
    if (!clubId) return;
    setLeaving(true);
    leaveClub(clubId);
    setLeaving(false);
    setShowLeaveModal(false);
    navigate("/app", { replace: true });
  }

  if (!club) {
    return <Navigate to="/app" replace />;
  }

  if (roleLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">Loading settings…</p>
      </div>
    );
  }

  if (!hasMembership) {
    return <Navigate to="/app" replace />;
  }

  const transferCandidates = members.filter(
    (m) => m.userId !== user?.id && m.status === "active",
  );

  if (userRole === "member") {
    return (
      <div className="p-6">
        <h1 className="mb-1 text-xl font-bold text-white">Personal Settings</h1>
        <p className="mb-6 text-sm text-muted">
          Manage your membership in this club.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            {error}
          </div>
        )}

        <div
          style={{
            background: "#1a0a0a",
            border: "1px solid #3a1a1a",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <h2
            style={{
              fontWeight: 600,
              fontSize: "15px",
              color: "#ffffff",
              margin: "0 0 8px",
            }}
          >
            Leave Club
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "#555555",
              margin: "0 0 16px",
            }}
          >
            You will lose access to this club workspace
          </p>
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            style={{
              background: "transparent",
              border: "1px solid #E51937",
              color: "#E51937",
              borderRadius: "6px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Leave Club
          </button>
        </div>

        {showLeaveModal ? (
          <div
            role="dialog"
            aria-modal="true"
            style={modalOverlayStyle}
            onClick={() => !leaving && setShowLeaveModal(false)}
          >
            <div style={modalPanelStyle} onClick={(e) => e.stopPropagation()}>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#ffffff",
                  margin: "0 0 12px",
                }}
              >
                Leave club?
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#555555",
                  margin: "0 0 20px",
                }}
              >
                You will lose access to this club workspace.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => setShowLeaveModal(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid #333",
                    color: "#aaa",
                    borderRadius: "6px",
                    padding: "10px 20px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => void handleConfirmLeave()}
                  style={{
                    background: "transparent",
                    border: "1px solid #E51937",
                    color: "#E51937",
                    borderRadius: "6px",
                    padding: "10px 20px",
                    cursor: "pointer",
                  }}
                >
                  {leaving ? "Leaving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-white">Club Settings</h1>
      <p className="mb-6 text-sm text-muted">
        Manage your club&apos;s profile and details.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-6 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400"
        >
          Changes saved successfully.
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormInput
            id="club-name"
            label="Club Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gryphon Robotics Club"
          />

          <div>
            <label
              htmlFor="short-description"
              className="mb-1.5 block text-sm font-medium text-white"
            >
              Short Description
            </label>
            <input
              id="short-description"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="A brief tagline for your club"
              maxLength={200}
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="long-description"
              className="mb-1.5 block text-sm font-medium text-white"
            >
              Long Description
            </label>
            <textarea
              id="long-description"
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              rows={5}
              placeholder="A detailed description of your club, its mission, and activities…"
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="manage-category"
              className="mb-1.5 block text-sm font-medium text-white"
            >
              Category
            </label>
            <select
              id="manage-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
            >
              <option value="">Select a category</option>
              <option value="Academic">Academic</option>
              <option value="Arts">Arts</option>
              <option value="Athletics">Athletics</option>
              <option value="Cultural">Cultural</option>
              <option value="Engineering">Engineering</option>
              <option value="Environmental">Environmental</option>
              <option value="Health">Health</option>
              <option value="Media">Media</option>
              <option value="Political">Political</option>
              <option value="Recreation">Recreation</option>
              <option value="Social">Social</option>
              <option value="Technology">Technology</option>
              <option value="Volunteer">Volunteer</option>
            </select>
          </div>

          {isOwner ? (
            <>
              <FormInput
                id="abbreviation"
                label="Abbreviation"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
                placeholder="e.g. GRC"
                maxLength={10}
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-white">
                  Club Logo
                </label>
                <ImageUpload
                  currentUrl={logoUrl}
                  onFileSelected={handleLogoUpload}
                  uploading={uploadingLogo}
                  label="Upload Logo"
                  shape="circle"
                />
                <div className="mt-2">
                  <FormInput
                    id="logo-url"
                    label="Or paste logo URL"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-white">
                  Club Banner
                </label>
                <ImageUpload
                  currentUrl={bannerUrl}
                  onFileSelected={handleBannerUpload}
                  uploading={uploadingBanner}
                  label="Upload Banner"
                  shape="rect"
                />
                <div className="mt-2">
                  <FormInput
                    id="banner-url"
                    label="Or paste banner URL"
                    type="url"
                    placeholder="https://example.com/banner.jpg"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="brand-color"
                  className="mb-1.5 block text-sm font-medium text-white"
                >
                  Brand Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand-color"
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-card"
                  />
                  <span className="text-sm text-muted">{brandColor}</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div>
                  <label
                    htmlFor="requires-approval"
                    className="text-sm font-medium text-white"
                  >
                    Require Join Approval
                  </label>
                  <p className="text-xs text-muted">
                    When enabled, new members must be approved by an admin or exec
                  </p>
                </div>
                <button
                  id="requires-approval"
                  type="button"
                  role="switch"
                  aria-checked={requiresApproval}
                  onClick={() => setRequiresApproval((v) => !v)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/25 ${
                    requiresApproval ? "bg-primary" : "bg-surface-alt"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      requiresApproval ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </>
          ) : null}

          {isOwner ? (
            <div>
              <h2
                style={{
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "#ffffff",
                  marginBottom: "16px",
                }}
              >
                Social Links
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={socialLabelStyle} htmlFor="instagram-url">
                    Instagram URL
                  </label>
                  <input
                    id="instagram-url"
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/yourclub"
                    style={socialInputStyle}
                  />
                </div>
                <div>
                  <label style={socialLabelStyle} htmlFor="linkedin-url">
                    LinkedIn URL
                  </label>
                  <input
                    id="linkedin-url"
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/company/yourclub"
                    style={socialInputStyle}
                  />
                </div>
                <div>
                  <label style={socialLabelStyle} htmlFor="twitter-url">
                    Twitter/X URL
                  </label>
                  <input
                    id="twitter-url"
                    type="url"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://twitter.com/yourclub"
                    style={socialInputStyle}
                  />
                </div>
                <div>
                  <label style={socialLabelStyle} htmlFor="website-url">
                    Website URL
                  </label>
                  <input
                    id="website-url"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourclub.com"
                    style={socialInputStyle}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex gap-4 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>

      {isOwner ? (
        <>
          <Card className="mt-6 p-6">
            <h2 className="mb-1 text-lg font-bold text-white">Join Code</h2>
            <p className="mb-4 text-sm text-muted">
              Share this code to let people join your club.
            </p>

            {(() => {
              const currentCode = getClubById(clubId ?? "")?.joinCode;
              return currentCode ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="rounded-lg bg-surface-alt px-4 py-2 font-mono text-lg font-bold tracking-widest text-white">
                    {currentCode}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-white"
                    >
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={regeneratingCode}
                      onClick={handleRegenerateCode}
                    >
                      {regeneratingCode ? "Regenerating…" : "Regenerate"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">No join code generated yet.</p>
                  <Button
                    size="sm"
                    disabled={regeneratingCode}
                    onClick={handleRegenerateCode}
                  >
                    {regeneratingCode ? "Generating…" : "Generate Code"}
                  </Button>
                </div>
              );
            })()}
          </Card>

          <section className="mt-6">
            <h2
              style={{
                fontWeight: 600,
                fontSize: "15px",
                color: "#ffffff",
                margin: "0 0 8px",
              }}
            >
              Transfer Ownership
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 16px",
              }}
            >
              Transfer your president role to another member. You will become an
              Executive after transfer.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={transferTargetId}
                onChange={(e) => setTransferTargetId(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="">Select a member…</option>
                {transferCandidates.map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.fullName || m.email || "Unknown"} —{" "}
                    {formatSettingsRoleLabel(m.role)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!transferTargetId}
                onClick={() => setShowTransferModal(true)}
                style={{
                  background: "transparent",
                  border: "1px solid #FFC429",
                  color: "#FFC429",
                  borderRadius: "6px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: transferTargetId ? "pointer" : "not-allowed",
                  opacity: transferTargetId ? 1 : 0.5,
                }}
              >
                Transfer
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h2
              style={{
                fontWeight: 600,
                fontSize: "15px",
                color: "#E51937",
                margin: "0 0 12px",
              }}
            >
              Danger Zone
            </h2>
            <div
              style={{
                background: "#1a0a0a",
                border: "1px solid #3a1a1a",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "#ffffff",
                  margin: "0 0 8px",
                }}
              >
                Delete Club
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#555555",
                  margin: "0 0 16px",
                }}
              >
                Permanently delete this club and all its data. This cannot be
                undone.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmName("");
                  setShowDeleteModal(true);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #E51937",
                  color: "#E51937",
                  borderRadius: "6px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Delete Club
              </button>
            </div>
          </section>
        </>
      ) : null}

      {showTransferModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => !transferring && setShowTransferModal(false)}
        >
          <div style={modalPanelStyle} onClick={(e) => e.stopPropagation()}>
            <h3
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              Are you sure?
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 20px",
              }}
            >
              You will lose president access.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={transferring}
                onClick={() => setShowTransferModal(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  color: "#aaa",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transferring}
                onClick={() => void handleConfirmTransfer()}
                style={{
                  background: "transparent",
                  border: "1px solid #FFC429",
                  color: "#FFC429",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor: "pointer",
                }}
              >
                {transferring ? "Transferring…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            style={{ ...modalPanelStyle, maxWidth: "440px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              Delete club permanently?
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 16px",
              }}
            >
              Type <strong style={{ color: "#fff" }}>{club.name}</strong> to
              confirm. This cannot be undone.
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={club.name}
              className="mb-5 w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  color: "#aaa",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleting || deleteConfirmName.trim() !== club.name.trim()
                }
                onClick={() => void handleConfirmDelete()}
                style={{
                  background: "transparent",
                  border: "1px solid #E51937",
                  color: "#E51937",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor:
                    deleteConfirmName.trim() === club.name.trim()
                      ? "pointer"
                      : "not-allowed",
                  opacity:
                    deleteConfirmName.trim() === club.name.trim() ? 1 : 0.5,
                }}
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
