import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";
import { useNavigate } from "react-router-dom";
import { X, Camera } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import { uploadImage } from "../../lib/uploadImage";
import Spinner from "../../components/ui/Spinner";
import ImageCropModal from "../../components/ui/ImageCropModal";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Graduate"] as const;

const NOTIFICATION_TOGGLES = [
  { key: "announcements", label: "New announcements in my clubs" },
  { key: "events", label: "New events in my clubs" },
  { key: "task_assignments", label: "Task assignments" },
  { key: "task_deadline_reminders", label: "Task deadline reminders" },
  { key: "chat_messages", label: "New chat messages" },
  { key: "chat_mentions", label: "@ mentions in chat" },
] as const;

type NotificationKey = (typeof NOTIFICATION_TOGGLES)[number]["key"];

type NotificationPreferences = Record<NotificationKey, boolean>;

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  announcements: true,
  events: true,
  task_assignments: true,
  task_deadline_reminders: true,
  chat_messages: true,
  chat_mentions: true,
};

const pageStyle: CSSProperties = {
  maxWidth: "700px",
  margin: "0 auto",
  padding: "40px 24px",
  background: "#0f0f0f",
  minHeight: "100%",
};

const cardStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "10px",
  padding: "24px",
  marginBottom: "16px",
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#ffffff",
  marginBottom: "20px",
  borderBottom: "1px solid #222222",
  paddingBottom: "10px",
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "#888888",
  marginBottom: "6px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#ffffff",
  fontSize: "14px",
  outline: "none",
};

function mergeNotificationPreferences(
  raw: Record<string, unknown> | null | undefined,
): NotificationPreferences {
  const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!raw || typeof raw !== "object") return merged;
  for (const { key } of NOTIFICATION_TOGGLES) {
    if (typeof raw[key] === "boolean") {
      merged[key] = raw[key];
    }
  }
  return merged;
}

function deriveInitials(fullName: string, email: string): string {
  const fromName = fullName.trim().split(/\s+/).filter(Boolean);
  if (fromName.length >= 2) {
    return `${fromName[0][0]}${fromName[1][0]}`.toUpperCase();
  }
  if (fromName.length === 1 && fromName[0].length > 0) {
    return fromName[0].slice(0, 2).toUpperCase();
  }
  return (email || "GC").slice(0, 2).toUpperCase();
}

function SettingsField({
  label,
  id,
  hint,
  ...inputProps
}: {
  label: string;
  id: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
      </label>
      <input id={id} style={inputStyle} {...inputProps} />
      {hint ? (
        <p style={{ fontSize: "11px", color: "#555555", margin: "6px 0 0" }}>{hint}</p>
      ) : null}
    </div>
  );
}

function NotificationToggle({
  label,
  checked,
  onChange,
  isLast = false,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        borderBottom: isLast ? "none" : "1px solid #1e1e1e",
        padding: "12px 0",
      }}
    >
      <span style={{ fontSize: "13px", color: "#cccccc" }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: "36px",
          height: "20px",
          borderRadius: "10px",
          border: "none",
          background: checked ? "#E51937" : "#333333",
          position: "relative",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 0.2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "18px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#ffffff",
            transition: "left 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}

export default function PersonalSettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [program, setProgram] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [profileSuccess, setProfileSuccess] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      const activeUser = authUser ?? user;
      if (!activeUser) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "full_name, email, program, year_of_study, avatar_url, notification_preferences",
        )
        .eq("id", activeUser.id)
        .single();

      if (cancelled) return;

      if (error && error.code !== "PGRST116") {
        console.error("Failed to load profile:", error.message);
        setErrorMessage("Failed to load your settings.");
      }

      if (data) {
        setFullName((data.full_name as string) ?? "");
        setEmail((data.email as string) ?? activeUser.email ?? "");
        setProgram((data.program as string) ?? "");
        setYearOfStudy((data.year_of_study as string) ?? "");
        setAvatarUrl((data.avatar_url as string) ?? "");
        setNotificationPrefs(
          mergeNotificationPreferences(
            data.notification_preferences as Record<string, unknown> | null,
          ),
        );
      } else {
        setEmail(activeUser.email ?? "");
      }

      setLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!profileSuccess) return;
    const timeout = window.setTimeout(() => setProfileSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [profileSuccess]);

  useEffect(() => {
    if (!notificationSuccess) return;
    const timeout = window.setTimeout(() => setNotificationSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [notificationSuccess]);

  async function handleAvatarChange(file: File) {
    if (!user) return;
    setUploadingAvatar(true);
    setErrorMessage(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${user.id}.${ext}`;
    const url = await uploadImage("profile-pictures", path, file);

    if (!url) {
      setErrorMessage("Failed to upload photo.");
      setUploadingAvatar(false);
      return;
    }

    const freshUrl = `${url}?t=${Date.now()}`;
    setAvatarUrl(freshUrl);

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: freshUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to save avatar:", error.message);
      setErrorMessage("Photo uploaded but failed to save to profile.");
    }

    setUploadingAvatar(false);
  }

  async function handleSaveProfile() {
    if (!user) return;
    setSavingProfile(true);
    setErrorMessage(null);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName.trim(),
        email: email.trim() || user.email,
        program: program.trim() || null,
        year_of_study: yearOfStudy || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    setSavingProfile(false);

    if (error) {
      console.error("Failed to save profile:", error.message);
      setErrorMessage("Failed to save profile.");
      return;
    }

    setProfileSuccess(true);
  }

  async function handleSaveNotifications() {
    if (!user) return;
    setSavingNotifications(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        notification_preferences: notificationPrefs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSavingNotifications(false);

    if (error) {
      console.error("Failed to save notification preferences:", error.message);
      setErrorMessage("Failed to save notification preferences.");
      return;
    }

    setNotificationSuccess(true);
  }

  async function handleSavePassword() {
    setPasswordMessage(null);

    if (!newPassword) {
      setPasswordMessage({ type: "error", text: "Enter a new password." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 8 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordMessage({ type: "error", text: error.message });
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage({ type: "success", text: "Password updated." });
  }

  async function handleDeleteAccount() {
    if (!user || deleteConfirmText !== "DELETE") return;

    setDeletingAccount(true);
    setErrorMessage(null);

    await supabase.from("user_interests").delete().eq("user_id", user.id);
    await supabase.from("club_members").delete().eq("user_id", user.id);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: null,
        program: null,
        year_of_study: null,
        avatar_url: null,
        bio: null,
        notification_preferences: {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to clear profile:", profileError.message);
      setDeletingAccount(false);
      setErrorMessage("Could not fully delete account data. Please try again.");
      return;
    }

    setShowDeleteModal(false);
    setDeleteConfirmText("");

    try {
      await signOut();
    } catch {
      await supabase.auth.signOut();
    }

    navigate("/");
    setDeletingAccount(false);
  }

  if (loading) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50vh",
        }}
      >
        <Spinner label="Loading settings…" />
      </div>
    );
  }

  const initials = deriveInitials(fullName, email);

  return (
    <div style={pageStyle}>
      <header style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
            margin: 0,
          }}
        >
          Personal Settings
        </h1>
        <p style={{ fontSize: "13px", color: "#555555", margin: "6px 0 0" }}>
          Manage your account and preferences
        </p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          style={{
            fontSize: "13px",
            color: "#E51937",
            margin: "0 0 16px",
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Profile */}
      <section style={cardStyle} aria-labelledby="profile-section-heading">
        <h2 id="profile-section-heading" style={sectionHeadingStyle}>
          Profile
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) setAvatarCropFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            aria-label="Change profile photo"
            style={{
              position: "relative",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              border: "none",
              padding: 0,
              cursor: "pointer",
              overflow: "hidden",
              background: "#111111",
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                {initials}
              </span>
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: avatarHovered ? 1 : 0,
                transition: "opacity 0.15s ease",
                pointerEvents: "none",
              }}
            >
              <Camera size={20} color="#ffffff" aria-hidden />
            </div>
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "transparent",
                border: "none",
                color: "#E51937",
                fontSize: "12px",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {uploadingAvatar ? "Uploading…" : "Change Photo"}
            </button>
          </div>
        </div>

        <SettingsField
          label="Full Name"
          id="settings-full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="settings-email" style={fieldLabelStyle}>
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            value={email}
            readOnly
            style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
          />
          <p style={{ fontSize: "11px", color: "#555555", margin: "6px 0 0" }}>
            Email cannot be changed
          </p>
        </div>

        <SettingsField
          label="Program / Major"
          id="settings-program"
          type="text"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
        />

        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="settings-year" style={fieldLabelStyle}>
            Year of Study
          </label>
          <select
            id="settings-year"
            value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="">Select year</option>
            {YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={savingProfile}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 24px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: savingProfile ? "not-allowed" : "pointer",
              opacity: savingProfile ? 0.7 : 1,
            }}
          >
            {savingProfile ? "Saving…" : "Save"}
          </button>
          {profileSuccess ? (
            <span style={{ fontSize: "13px", color: "#4ade80" }}>Profile updated</span>
          ) : null}
        </div>
      </section>

      {/* Notifications */}
      <section style={cardStyle} aria-labelledby="notifications-section-heading">
        <h2 id="notifications-section-heading" style={sectionHeadingStyle}>
          Notifications
        </h2>

        <div>
          {NOTIFICATION_TOGGLES.map(({ key, label }, index) => (
            <NotificationToggle
              key={key}
              label={label}
              checked={notificationPrefs[key]}
              isLast={index === NOTIFICATION_TOGGLES.length - 1}
              onChange={(next) =>
                setNotificationPrefs((prev) => ({ ...prev, [key]: next }))
              }
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => void handleSaveNotifications()}
            disabled={savingNotifications}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 24px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: savingNotifications ? "not-allowed" : "pointer",
              opacity: savingNotifications ? 0.7 : 1,
            }}
          >
            {savingNotifications ? "Saving…" : "Save Preferences"}
          </button>
          {notificationSuccess ? (
            <span style={{ fontSize: "13px", color: "#4ade80" }}>
              Preferences saved
            </span>
          ) : null}
        </div>
      </section>

      {/* Account */}
      <section style={cardStyle} aria-labelledby="account-section-heading">
        <h2 id="account-section-heading" style={sectionHeadingStyle}>
          Account
        </h2>

        <SettingsField
          label="New Password"
          id="settings-new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <SettingsField
          label="Confirm Password"
          id="settings-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />

        {passwordMessage ? (
          <p
            style={{
              fontSize: "13px",
              color: passwordMessage.type === "success" ? "#4ade80" : "#E51937",
              margin: "0 0 16px",
            }}
          >
            {passwordMessage.text}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSavePassword()}
          disabled={savingPassword}
          style={{
            background: "transparent",
            border: "1px solid #E51937",
            color: "#E51937",
            borderRadius: "6px",
            padding: "10px 24px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: savingPassword ? "not-allowed" : "pointer",
            opacity: savingPassword ? 0.7 : 1,
            marginBottom: "28px",
          }}
        >
          {savingPassword ? "Saving…" : "Save Password"}
        </button>

        <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: "20px" }}>
          <p style={{ fontSize: "13px", color: "#888888", margin: "0 0 12px" }}>
            Permanently remove your profile data and sign out. Your login may
            still exist until removed by an administrator.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText("");
              setShowDeleteModal(true);
            }}
            style={{
              background: "transparent",
              border: "1px solid #E51937",
              color: "#E51937",
              borderRadius: "6px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Delete Account
          </button>
        </div>
      </section>

      {showDeleteModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
          onClick={() => {
            if (!deletingAccount) setShowDeleteModal(false);
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              disabled={deletingAccount}
              onClick={() => setShowDeleteModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
              }}
            >
              <X size={18} aria-hidden />
            </button>
            <h3
              id="delete-account-title"
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              Delete account?
            </h3>
            <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 16px" }}>
              This clears your profile, leaves all clubs, and signs you out. Type{" "}
              <strong style={{ color: "#ffffff" }}>DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deletingAccount}
              style={{ ...inputStyle, marginBottom: "16px" }}
            />
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount || deleteConfirmText !== "DELETE"}
              style={{
                width: "100%",
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "10px 24px",
                fontWeight: 600,
                fontSize: "14px",
                cursor:
                  deletingAccount || deleteConfirmText !== "DELETE"
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  deletingAccount || deleteConfirmText !== "DELETE" ? 0.5 : 1,
              }}
            >
              {deletingAccount ? "Deleting…" : "Confirm Delete"}
            </button>
          </div>
        </div>
      ) : null}

      {avatarCropFile ? (
        <ImageCropModal
          imageFile={avatarCropFile}
          aspectRatio={1}
          circular
          onComplete={(blob) => {
            const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
            setAvatarCropFile(null);
            void handleAvatarChange(file);
          }}
          onCancel={() => {
            setAvatarCropFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      ) : null}
    </div>
  );
}
