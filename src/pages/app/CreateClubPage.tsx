import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

export default function CreateClubPage() {
  const { user } = useAuthContext();
  const { createClub } = useClubContext();
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
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const categories = [
    "Academic",
    "Arts",
    "Athletics",
    "Cultural",
    "Engineering",
    "Environmental",
    "Health",
    "Media",
    "Political",
    "Recreation",
    "Social",
    "Technology",
    "Volunteer",
  ];

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
      const socialLinks: Record<string, string> = {};
      if (website.trim()) socialLinks.website = website.trim();
      if (instagram.trim()) socialLinks.instagram = instagram.trim();
      if (discord.trim()) socialLinks.discord = discord.trim();

      const clubId = await createClub({
        name: name.trim(),
        slug: slug || generateSlug(name),
        description: description.trim(),
        category: category.trim(),
        contactEmail: contactEmail.trim(),
        meetingSchedule: meetingSchedule.trim(),
        meetingLocation: meetingLocation.trim(),
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
      });

      if (clubId) {
        navigate(`/app/clubs/${clubId}`);
      } else {
        setError("Failed to create club. Please try again.");
      }
    } catch {
      setError("Failed to create club. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-root mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-2 text-[26px] font-semibold tracking-[-0.5px] text-[var(--text-1)]">Create a club</h1>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-2)] px-4 py-3 text-sm text-[#f87171]"
        >
          {error}
        </div>
      )}

      <div className="mb-8 flex items-center">
        {[1, 2, 3].map((dot, i) => (
          <div key={dot} className="flex flex-1 items-center">
            <div className={`step-dot ${step === dot ? "active" : step > dot ? "complete" : ""}`}>{dot}</div>
            {i < 2 && <div className={`step-line ${step > dot ? "complete" : ""}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 overflow-hidden rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-2)] p-6" noValidate>
        <div className="transition-all duration-200" style={{ transform: "translateX(0)", opacity: 1 }}>
          {step === 1 && (
            <fieldset className="space-y-4">
              <legend className="mb-4 text-[18px] font-medium text-[var(--text-1)]">Basics</legend>
              <FormInput id="name" label="Club Name" required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Gryphon Robotics Club" />
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-1)]">Category <span className="ml-1 text-[var(--red)]">*</span></label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      className={`rounded-[var(--r-md)] border px-3 py-2 text-sm transition ${category === item ? "border-[var(--red)] bg-[var(--red-dim)] text-[var(--text-1)]" : "border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-2)] hover:bg-[var(--bg-4)]"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="description" className="mb-1 block text-sm font-medium text-[var(--text-1)]">Description</label>
                <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Tell students what your club is about..." className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-3)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--red)] focus:outline-none" />
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="space-y-4">
              <legend className="mb-4 text-[18px] font-medium text-[var(--text-1)]">Details</legend>
              <FormInput id="meetingSchedule" label="Meeting Schedule" value={meetingSchedule} onChange={(e) => setMeetingSchedule(e.target.value)} placeholder="e.g. Wednesdays 6:00 PM" />
              <FormInput id="meetingLocation" label="Meeting Location" value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} placeholder="e.g. Thornbrough Building, Room 1307" />
              <FormInput id="contactEmail" label="Contact Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="club@uoguelph.ca" />
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="space-y-4">
              <legend className="mb-4 text-[18px] font-medium text-[var(--text-1)]">Social</legend>
              <FormInput id="website" label="Website URL" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
              <FormInput id="instagram" label="Instagram URL" type="url" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/yourclub" />
              <FormInput id="discord" label="Discord Invite" type="url" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/yourserver" />
            </fieldset>
          )}
        </div>

        <div className="flex justify-between gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => (step === 1 ? navigate(-1) : setStep((s) => (s - 1) as 1 | 2 | 3))}>
            Back
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
              Next →
            </Button>
          ) : (
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Club"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
