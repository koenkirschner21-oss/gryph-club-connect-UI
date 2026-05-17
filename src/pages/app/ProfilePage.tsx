import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import { uploadImage } from "../../lib/uploadImage";
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

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#242424";
const MUTED = "#555555";
const ACCENT_RED = "#E51937";

const pageStyle: CSSProperties = {
  backgroundColor: PAGE_BG,
  minHeight: "100%",
  padding: "40px 24px",
  maxWidth: "72rem",
  margin: "0 auto",
};

const cardStyle: CSSProperties = {
  backgroundColor: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "12px",
  padding: "32px",
  marginTop: "32px",
  display: "grid",
  gap: "24px",
};

const labelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "#888888",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "6px",
  display: "block",
};

const inputStyle: CSSProperties = {
  backgroundColor: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const saveButtonStyle: CSSProperties = {
  backgroundColor: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "10px 24px",
  fontWeight: 500,
  fontSize: "14px",
  cursor: "pointer",
};

const cancelButtonStyle: CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid #333333",
  color: "#888888",
  borderRadius: "6px",
  padding: "10px 24px",
  fontWeight: 500,
  fontSize: "14px",
  cursor: "pointer",
};

const verifiedBadgeStyle: CSSProperties = {
  backgroundColor: "#0d2b0d",
  color: "#4ade80",
  border: "1px solid #1a4a1a",
  borderRadius: "20px",
  padding: "3px 10px",
  fontSize: "11px",
  flexShrink: 0,
  textTransform: "lowercase",
};

function setInputFocus(el: HTMLInputElement, focused: boolean) {
  el.style.borderColor = focused ? ACCENT_RED : "#2a2a2a";
}

function ProfileField({
  label,
  id,
  ...inputProps
}: {
  label: string;
  id: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        style={inputStyle}
        onFocus={(e) => setInputFocus(e.currentTarget, true)}
        onBlur={(e) => setInputFocus(e.currentTarget, false)}
        {...inputProps}
      />
    </div>
  );
}

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
      <div
        style={{
          ...pageStyle,
          display: "flex",
          minHeight: "60vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner label="Loading profile…" />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <h1
        style={{
          fontWeight: 700,
          fontSize: "22px",
          color: "#ffffff",
          margin: 0,
        }}
      >
        Profile settings
      </h1>
      <p style={{ fontSize: "13px", color: MUTED, margin: "4px 0 0" }}>
        Manage your personal information
      </p>

      <form
        onSubmit={handleSave}
        noValidate
        style={cardStyle}
        className="grid gap-6 md:grid-cols-[280px_1fr]"
      >
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            borderBottom: "1px solid #2a2a2a",
            paddingBottom: "24px",
          }}
          className="md:border-b-0 md:border-r md:border-[#2a2a2a] md:pb-0 md:pr-6"
        >
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
            className="group relative overflow-hidden"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              border: "3px solid #E51937",
              backgroundColor: "#111111",
              padding: 0,
              cursor: "pointer",
              outline: "1px dashed #333333",
              outlineOffset: "-4px",
            }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "50%",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 500,
                  color: "#ffffff",
                }}
              >
                {(profile.full_name || profile.email || "GC")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <span
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.55)",
                fontSize: "11px",
                color: "#ffffff",
              }}
            >
              {uploading ? "Uploading..." : "Change photo"}
            </span>
          </button>
          <div>
            <p
              style={{
                fontWeight: 700,
                fontSize: "18px",
                color: "#ffffff",
                marginTop: "12px",
                marginBottom: 0,
              }}
            >
              {profile.full_name || "Set your name"}
            </p>
            <p
              style={{
                fontSize: "13px",
                color: MUTED,
                marginTop: "4px",
                marginBottom: 0,
              }}
            >
              {profile.email}
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "#747676",
                marginTop: "4px",
                marginBottom: 0,
              }}
            >
              {profile.program || "No program set"}
            </p>
          </div>
        </aside>

        <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <ProfileField
            label="Full Name"
            id="full_name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            value={profile.full_name}
            onChange={(e) => handleChange("full_name", e.target.value)}
          />
          <div>
            <label htmlFor="email" style={labelStyle}>
              Email
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="email"
                type="email"
                value={profile.email}
                readOnly
                style={{
                  ...inputStyle,
                  opacity: 0.7,
                  cursor: "default",
                }}
              />
              <span style={verifiedBadgeStyle}>verified</span>
            </div>
          </div>
          <ProfileField
            label="University"
            id="university"
            type="text"
            placeholder="University of Guelph"
            value={profile.university}
            onChange={(e) => handleChange("university", e.target.value)}
          />
          <ProfileField
            label="Program"
            id="program"
            type="text"
            placeholder="e.g. Computer Science, B.Sc."
            value={profile.program}
            onChange={(e) => handleChange("program", e.target.value)}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              paddingTop: "8px",
            }}
          >
            <button type="button" style={cancelButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={saveButtonStyle}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
