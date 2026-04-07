import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

export default function CreateClubPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [meetingSchedule, setMeetingSchedule] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [discord, setDiscord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleNameChange(value: string) {
    setName(value);
    setSlug(generateSlug(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Club name is required");
      return;
    }
    if (!category.trim()) {
      setError("Category is required");
      return;
    }

    setLoading(true);

    try {
      // For now, create a local club record. When Supabase tables are ready,
      // this will insert into the clubs + club_members tables and use the
      // returned database ID for navigation instead of the slug.
      const clubId = slug || generateSlug(name);
      // Navigate to the new club workspace
      navigate(`/app/clubs/${clubId}`);
    } catch {
      setError("Failed to create club. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold text-white">Create a Club</h1>
      <p className="mb-8 text-muted">
        Set up your club&apos;s public profile and private workspace.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Basic Info */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-white">
            Basic Information
          </legend>

          <FormInput
            id="name"
            label="Club Name"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Gryphon Robotics Club"
          />

          <div>
            <label
              htmlFor="slug"
              className="mb-1 block text-sm font-medium text-white"
            >
              URL Slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">/clubs/</span>
              <input
                id="slug"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                placeholder="gryphon-robotics-club"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="category"
              className="mb-1 block text-sm font-medium text-white"
            >
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-white"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Tell students what your club is about…"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </fieldset>

        {/* Meeting Info */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-white">
            Meeting Details
          </legend>

          <FormInput
            id="meetingSchedule"
            label="Meeting Schedule"
            value={meetingSchedule}
            onChange={(e) => setMeetingSchedule(e.target.value)}
            placeholder="e.g. Wednesdays 6:00 PM"
          />

          <FormInput
            id="meetingLocation"
            label="Meeting Location"
            value={meetingLocation}
            onChange={(e) => setMeetingLocation(e.target.value)}
            placeholder="e.g. Thornbrough Building, Room 1307"
          />
        </fieldset>

        {/* Contact & Links */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-white">
            Contact & Social Links
          </legend>

          <FormInput
            id="contactEmail"
            label="Contact Email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="club@uoguelph.ca"
          />

          <FormInput
            id="website"
            label="Website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
          />

          <FormInput
            id="instagram"
            label="Instagram URL"
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/yourclub"
          />

          <FormInput
            id="discord"
            label="Discord Invite"
            type="url"
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
            placeholder="https://discord.gg/yourserver"
          />
        </fieldset>

        <div className="flex gap-4 pt-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Creating…" : "Create Club"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
