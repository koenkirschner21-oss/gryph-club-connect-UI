import { useEffect, useState } from "react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import FormInput from "../../components/ui/FormInput";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

interface ProfileData {
  full_name: string;
  email: string;
  university: string;
  program: string;
  avatar_url: string;
}

const EMPTY_PROFILE: ProfileData = {
  full_name: "",
  email: "",
  university: "",
  program: "",
  avatar_url: "",
};

export default function ProfilePage() {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch existing profile on mount
  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, university, program, avatar_url")
        .eq("id", user!.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = row not found — that's OK for new users
        setMessage({ type: "error", text: "Failed to load profile." });
      }

      if (data) {
        setProfile({
          full_name: data.full_name ?? "",
          email: data.email ?? user!.email ?? "",
          university: data.university ?? "",
          program: data.program ?? "",
          avatar_url: data.avatar_url ?? "",
        });
      } else {
        // Pre-fill email from auth
        setProfile((prev) => ({
          ...prev,
          email: user!.email ?? "",
        }));
      }
      setLoading(false);
    }

    fetchProfile();
  }, [user]);

  function handleChange(field: keyof ProfileData, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: profile.full_name.trim(),
        email: profile.email.trim(),
        university: profile.university.trim(),
        program: profile.program.trim(),
        avatar_url: profile.avatar_url.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      setMessage({ type: "error", text: "Failed to save profile. Please try again." });
    } else {
      setMessage({ type: "success", text: "Profile updated successfully." });
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading profile…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Your Profile</h1>
      <p className="mt-1 text-sm text-muted">
        Update your personal information.
      </p>

      <form onSubmit={handleSave} noValidate className="mt-8 space-y-6">
        {/* Avatar preview */}
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-alt">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile picture"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <svg
                className="h-8 w-8 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <FormInput
              label="Profile Picture URL"
              id="avatar_url"
              type="url"
              placeholder="https://example.com/your-photo.jpg"
              value={profile.avatar_url}
              onChange={(e) => handleChange("avatar_url", e.target.value)}
            />
          </div>
        </div>

        <FormInput
          label="Full Name"
          id="full_name"
          type="text"
          placeholder="Jane Doe"
          autoComplete="name"
          value={profile.full_name}
          onChange={(e) => handleChange("full_name", e.target.value)}
        />

        <FormInput
          label="Email"
          id="email"
          type="email"
          placeholder="you@uoguelph.ca"
          autoComplete="email"
          value={profile.email}
          onChange={(e) => handleChange("email", e.target.value)}
        />

        <FormInput
          label="University"
          id="university"
          type="text"
          placeholder="University of Guelph"
          value={profile.university}
          onChange={(e) => handleChange("university", e.target.value)}
        />

        <FormInput
          label="Program"
          id="program"
          type="text"
          placeholder="e.g. Computer Science, B.Sc."
          value={profile.program}
          onChange={(e) => handleChange("program", e.target.value)}
        />

        {/* Status message */}
        {message && (
          <p
            role="alert"
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "bg-green-500/10 text-green-400"
                : "bg-primary/10 text-primary-light"
            }`}
          >
            {message.text}
          </p>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
