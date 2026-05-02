import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import { uploadImage } from "../../lib/uploadImage";
import FormInput from "../../components/ui/FormInput";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import { showToast } from "../../components/ui/Toast";

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        showToast("Failed to load profile.", "error");
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
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    setUploading(true);

    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}.${ext}`;
    const url = await uploadImage("profile-pictures", path, file);

    if (url) {
      // Append a cache-busting param so the browser shows the fresh image
      const freshUrl = `${url}?t=${Date.now()}`;
      setProfile((prev) => ({ ...prev, avatar_url: freshUrl }));
      showToast("Photo uploaded. Save changes to keep it.", "success");
    } else {
      showToast("Avatar upload failed.", "error");
    }
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

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
      showToast("Failed to save profile. Please try again.", "error");
    } else {
      showToast("Profile saved.", "success");
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
    <div className="page-root mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-[26px] font-semibold tracking-[-0.5px] text-[var(--text-1)]">Profile settings</h1>
      <p className="mt-1 text-sm text-[var(--text-2)]">Manage your personal information</p>

      <form onSubmit={handleSave} noValidate className="mt-8 grid gap-6 rounded-[var(--r-xl)] border border-[var(--border)] bg-[var(--bg-2)] p-6 md:grid-cols-[280px_1fr]">
        <aside className="space-y-4 border-b border-[var(--border)] pb-6 md:border-b-0 md:border-r md:pb-0 md:pr-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-3)]"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-medium text-[var(--text-1)]">
                {(profile.full_name || profile.email || "GC").slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.55)] text-xs text-[var(--text-1)] opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? "Uploading..." : "Change photo"}
            </span>
          </button>
          <div>
            <p className="text-base font-medium text-[var(--text-1)]">{profile.full_name || "Set your name"}</p>
            <p className="mt-1 text-sm text-[var(--text-2)]">{profile.email}</p>
            <p className="mt-1 text-sm text-[var(--text-2)]">{profile.program || "No program set"}</p>
          </div>
        </aside>

        <section className="space-y-4">
          <FormInput
            label="Full Name"
            id="full_name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            value={profile.full_name}
            onChange={(e) => handleChange("full_name", e.target.value)}
          />
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--text-1)]">
              Email
            </label>
            <div className="flex items-center gap-2">
              <input
                id="email"
                type="email"
                value={profile.email}
                readOnly
                className="h-[38px] w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-3)] px-3 text-sm text-[var(--text-2)] opacity-60"
              />
              <span className="rounded-[var(--r-full)] border border-[var(--green)] bg-[var(--green-dim)] px-2 py-1 text-xs text-[var(--green)]">
                verified
              </span>
            </div>
          </div>
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

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="h-9 bg-[var(--red)] hover:bg-[var(--red-hover)]">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
