import { useState, type FormEvent } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Card from "../../components/ui/Card";

export default function ManageClubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getClubById, getUserRole, updateClub } = useClubContext();

  const club = getClubById(clubId ?? "");
  const role = getUserRole(clubId ?? "");

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

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only admin or exec can access this page
  if (!club || (role !== "admin" && role !== "exec")) {
    return <Navigate to="/app" replace />;
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

    const ok = await updateClub(clubId!, {
      name: name.trim(),
      shortDescription: shortDescription.trim() || undefined,
      longDescription: longDescription.trim() || undefined,
      category: category.trim(),
      abbreviation: abbreviation.trim() || undefined,
      brandColor: brandColor.trim() || undefined,
    });

    setSaving(false);

    if (ok) {
      setSuccess(true);
    } else {
      setError("Failed to save changes. Please try again.");
    }
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

          <FormInput
            id="abbreviation"
            label="Abbreviation"
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            placeholder="e.g. GRC"
            maxLength={10}
          />

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

          <div className="flex gap-4 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
