import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { supabase } from "../../lib/supabaseClient";
import {
  accessLevelBadgeLabel,
  formatMemberDisplayRole,
  roleFromAccessLevel,
} from "../../lib/memberRoleTitle";
import { useIsMobile } from "../../hooks/useWindowWidth";
import type { AccessLevel, Club } from "../../types";
import Spinner from "../ui/Spinner";

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

const cardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #242424",
  borderRadius: "10px",
  padding: "20px",
  marginBottom: "16px",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "16px",
};

const modalPanelStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333333",
  borderRadius: "10px",
  padding: "24px",
  width: "100%",
  maxWidth: "420px",
};

function mergeNotificationPreferences(
  raw: Record<string, unknown> | null | undefined,
): NotificationPreferences {
  const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!raw) return merged;
  for (const toggle of NOTIFICATION_TOGGLES) {
    if (typeof raw[toggle.key] === "boolean") {
      merged[toggle.key] = raw[toggle.key] as boolean;
    }
  }
  return merged;
}

interface MyMembershipPanelProps {
  club: Club;
  accessLevel: AccessLevel;
  memberTitle: string | null;
  joinedAt: string | null;
}

export default function MyMembershipPanel({
  club,
  accessLevel,
  memberTitle,
  joinedAt,
}: MyMembershipPanelProps) {
  const { user } = useAuthContext();
  const { leaveClub } = useClubContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [profileLoading, setProfileLoading] = useState(true);
  const [program, setProgram] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("program, year_of_study, notification_preferences")
        .eq("id", user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error("Failed to load profile for membership page:", profileError.message);
      } else if (data) {
        setProgram((data.program as string | null)?.trim() ?? "");
        setYearOfStudy((data.year_of_study as string | null)?.trim() ?? "");
        setNotificationPrefs(
          mergeNotificationPreferences(
            data.notification_preferences as Record<string, unknown> | null,
          ),
        );
      }

      setProfileLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const joinedLabel = joinedAt
    ? new Date(joinedAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const roleLabel = formatMemberDisplayRole(roleFromAccessLevel(accessLevel), memberTitle);

  const handleSaveNotifications = useCallback(async () => {
    if (!user?.id) return;
    setSavingNotifications(true);
    setNotificationSuccess(false);
    setError(null);

    const { error: saveError } = await supabase
      .from("profiles")
      .update({ notification_preferences: notificationPrefs })
      .eq("id", user.id);

    setSavingNotifications(false);

    if (saveError) {
      console.error("Failed to save notification preferences:", saveError.message);
      setError("Failed to save notification preferences.");
      return;
    }

    setNotificationSuccess(true);
    window.setTimeout(() => setNotificationSuccess(false), 2500);
  }, [notificationPrefs, user?.id]);

  async function handleConfirmLeave() {
    if (!club.id) return;
    setLeaving(true);
    leaveClub(club.id);
    setShowLeaveModal(false);
    navigate("/app");
  }

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading membership…" />
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "16px" : "24px", maxWidth: "720px" }}>
      <h1
        style={{
          fontWeight: 800,
          fontSize: "28px",
          color: "#ffffff",
          margin: "0 0 4px",
        }}
      >
        My Membership
      </h1>
      <p style={{ fontSize: "14px", color: "#555555", margin: "0 0 24px" }}>
        Your role and preferences in {club.name}.
      </p>

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            border: "1px solid #3a1a1a",
            background: "#1a0505",
            color: "#E51937",
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
          Membership overview
        </h2>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <img
            src={club.logoUrl ?? club.imageUrl}
            alt=""
            style={{
              width: 52,
              height: 52,
              borderRadius: "10px",
              objectFit: "cover",
              background: "#1a1a1a",
            }}
          />
          <div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#ffffff" }}>
              {club.name}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#777777" }}>
              {club.category}
            </p>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
          Your role
        </h2>
        <dl style={{ margin: 0, display: "grid", gap: "12px" }}>
          <div>
            <dt style={{ fontSize: "12px", color: "#666666", marginBottom: "4px" }}>Role</dt>
            <dd style={{ margin: 0, fontSize: "14px", color: "#ffffff" }}>{roleLabel}</dd>
          </div>
          <div>
            <dt style={{ fontSize: "12px", color: "#666666", marginBottom: "4px" }}>
              Access level
            </dt>
            <dd style={{ margin: 0, fontSize: "14px", color: "#ffffff" }}>
              {accessLevelBadgeLabel(accessLevel)}
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: "12px", color: "#666666", marginBottom: "4px" }}>Joined</dt>
            <dd style={{ margin: 0, fontSize: "14px", color: "#ffffff" }}>{joinedLabel}</dd>
          </div>
          {program || yearOfStudy ? (
            <div>
              <dt style={{ fontSize: "12px", color: "#666666", marginBottom: "4px" }}>
                Program / year
              </dt>
              <dd style={{ margin: 0, fontSize: "14px", color: "#ffffff" }}>
                {[program, yearOfStudy].filter(Boolean).join(" · ") || "—"}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
          Notification preferences
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555555" }}>
          These apply across all clubs on your account.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {NOTIFICATION_TOGGLES.map((toggle) => (
            <label
              key={toggle.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "#cccccc",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={notificationPrefs[toggle.key]}
                onChange={(event) =>
                  setNotificationPrefs((prev) => ({
                    ...prev,
                    [toggle.key]: event.target.checked,
                  }))
                }
              />
              {toggle.label}
            </label>
          ))}
        </div>
        <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            disabled={savingNotifications}
            onClick={() => void handleSaveNotifications()}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: savingNotifications ? "not-allowed" : "pointer",
              opacity: savingNotifications ? 0.7 : 1,
            }}
          >
            {savingNotifications ? "Saving…" : "Save preferences"}
          </button>
          {notificationSuccess ? (
            <span style={{ fontSize: "13px", color: "#FFC429" }}>Saved</span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          ...cardStyle,
          background: "#1a0a0a",
          border: "1px solid #3a1a1a",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
          Danger zone
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555555" }}>
          Leave this club and lose access to its workspace.
        </p>
        <button
          type="button"
          onClick={() => setShowLeaveModal(true)}
          style={{
            background: "transparent",
            border: "1px solid #E51937",
            color: "#E51937",
            borderRadius: "6px",
            padding: "9px 18px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Leave club
        </button>
      </div>

      {showLeaveModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => !leaving && setShowLeaveModal(false)}
        >
          <div style={modalPanelStyle} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600, color: "#ffffff" }}>
              Leave club?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#555555" }}>
              You will lose access to {club.name}&apos;s workspace.
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
                {leaving ? "Leaving…" : "Leave club"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
