import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import type { Club } from "../../types";

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const GOLD = "#FFC429";
const ACCENT_RED = "#E51937";

type SectionKey = "profile" | "launch" | "live";
type TemplateLaunchType = "announcement" | "event";

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  section: SectionKey;
  fixPath?: string;
  templateType?: TemplateLaunchType;
  instruction?: string;
}

const SECTION_LABELS: Record<SectionKey, string> = {
  profile: "Profile Setup",
  launch: "Launch Content",
  live: "Go Live",
};

function settingsFixPath(
  clubId: string,
  section: "profile" | "branding" | "social" | "membership",
  highlight: "profile" | "branding" | "social" | "membership",
): string {
  return `/app/clubs/${clubId}/settings?section=${section}&highlight=${highlight}`;
}

function buildCompletionChecks(
  club: Club,
  postsCount: number,
  eventsCount: number,
) {
  return {
    clubName: Boolean(club.name?.trim()),
    shortDescription: Boolean(
      club.shortDescription?.trim() &&
        club.shortDescription.trim().length > 100 &&
        club.descriptionConfirmed === true,
    ),
    logo: Boolean(
      club.logoUrl?.trim() &&
        !club.logoUrl.includes("ui-avatars") &&
        !club.logoUrl.includes("placeholder") &&
        !club.logoUrl.includes("default") &&
        !club.logoUrl.includes("initials") &&
        club.logoConfirmed === true,
    ),
    banner: Boolean(
      club.bannerUrl?.trim() &&
        !club.bannerUrl.includes("placeholder") &&
        !club.bannerUrl.includes("default") &&
        club.bannerConfirmed === true,
    ),
    contactEmail: Boolean(club.contactEmail?.trim()),
    meetingSchedule: Boolean(club.meetingSchedule?.trim()),
    socialLinks: Boolean(
      club.socialLinks &&
        Object.values(club.socialLinks).some(
          (value) => value && String(value).trim() !== "",
        ),
    ),
    membershipType: club.membershipConfirmed === true,
    firstAnnouncement: postsCount > 0,
    firstEvent: eventsCount > 0,
  };
}

function buildChecklistItems(
  club: Club,
  postsCount: number,
  eventsCount: number,
): ChecklistItem[] {
  const checks = buildCompletionChecks(club, postsCount, eventsCount);

  return [
    {
      id: "name",
      label: "Club name confirmed",
      complete: checks.clubName,
      section: "profile",
    },
    {
      id: "logo",
      label: "Update club logo",
      complete: checks.logo,
      section: "profile",
      fixPath: settingsFixPath(club.id, "branding", "branding"),
      instruction:
        "Replace the default logo with your club's official logo.",
    },
    {
      id: "banner",
      label: "Update club banner",
      complete: checks.banner,
      section: "profile",
      fixPath: settingsFixPath(club.id, "branding", "branding"),
      instruction:
        "Replace the default banner with a real club banner image.",
    },
    {
      id: "short-description",
      label: "Review or update short description",
      complete: checks.shortDescription,
      section: "profile",
      fixPath: settingsFixPath(club.id, "profile", "profile"),
      instruction:
        "Review the imported description and update it to accurately represent your club. Click Save in Settings to confirm.",
    },
    {
      id: "contact-email",
      label: "Add contact email",
      complete: checks.contactEmail,
      section: "profile",
      fixPath: settingsFixPath(club.id, "profile", "profile"),
      instruction: "Add a contact email so students can reach your club.",
    },
    {
      id: "meeting-schedule",
      label: "Add meeting schedule",
      complete: checks.meetingSchedule,
      section: "profile",
      fixPath: settingsFixPath(club.id, "profile", "profile"),
      instruction: "Let members know when and where your club meets.",
    },
    {
      id: "social-links",
      label: "Add social links",
      complete: checks.socialLinks,
      section: "profile",
      fixPath: settingsFixPath(club.id, "social", "social"),
      instruction: "Link your Instagram, website, or other channels.",
    },
    {
      id: "membership-type",
      label: "Choose membership settings",
      complete: checks.membershipType,
      section: "profile",
      fixPath: settingsFixPath(club.id, "membership", "membership"),
      instruction:
        "Choose how students can join your club and click Save to confirm.",
    },
    {
      id: "announcement",
      label: "Create welcome announcement",
      complete: checks.firstAnnouncement,
      section: "launch",
      fixPath: `/app/clubs/${club.id}/announcements?openCreate=true`,
      templateType: "announcement",
      instruction:
        "Post a welcome message to introduce your club to new members.",
    },
    {
      id: "event",
      label: "Create first event",
      complete: checks.firstEvent,
      section: "launch",
      fixPath: `/app/clubs/${club.id}/events?openCreate=true`,
      templateType: "event",
      instruction: "Create your first event to start engaging your club community.",
    },
  ];
}

const checkRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "10px",
  fontSize: "14px",
  lineHeight: 1.4,
};

const fixButtonStyle: CSSProperties = {
  background: "transparent",
  border: `1px solid ${ACCENT_RED}`,
  borderRadius: "6px",
  padding: "6px 10px",
  color: ACCENT_RED,
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

function ChecklistRow({
  item,
  onUseTemplate,
}: {
  item: ChecklistItem;
  onUseTemplate: (type: TemplateLaunchType) => void;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div style={checkRowStyle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {item.complete ? (
              <Check size={16} color={GOLD} strokeWidth={2.5} aria-hidden />
            ) : (
              <span
                aria-hidden
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  border: "1px solid #444444",
                  flexShrink: 0,
                  boxSizing: "border-box",
                  marginTop: "2px",
                }}
              />
            )}
            <span
              style={{
                color: item.complete ? "#666666" : "#cccccc",
              }}
            >
              {item.label}
            </span>
          </div>
          {!item.complete && item.instruction ? (
            <p
              style={{
                margin: "6px 0 0 26px",
                fontSize: "12px",
                color: "#555555",
                lineHeight: 1.45,
              }}
            >
              {item.instruction}
            </p>
          ) : null}
        </div>
        {!item.complete && item.fixPath ? (
          <button
            type="button"
            onClick={() => navigate(item.fixPath!)}
            style={{ ...fixButtonStyle, marginTop: "2px" }}
          >
            Fix this →
          </button>
        ) : null}
      </div>
      {!item.complete && item.templateType ? (
        <div style={{ marginTop: "6px", marginLeft: "26px" }}>
          <button
            type="button"
            onClick={() => onUseTemplate(item.templateType!)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: ACCENT_RED,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Use Template →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export interface SetupChecklistProps {
  club: Club;
  postsCount: number;
  eventsCount: number;
  contentLoading?: boolean;
  onPublish: () => Promise<void>;
  onRefetch?: () => void;
  variant?: "inline" | "modal";
  onClose?: () => void;
}

export default function SetupChecklist({
  club,
  postsCount,
  eventsCount,
  contentLoading = false,
  onPublish,
  onRefetch,
  variant = "inline",
  onClose,
}: SetupChecklistProps) {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!onRefetch) return;
    const handleFocus = () => onRefetch();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [onRefetch]);

  const items = useMemo(
    () => buildChecklistItems(club, postsCount, eventsCount),
    [club, postsCount, eventsCount],
  );

  const completedCount = items.filter((item) => item.complete).length;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const allComplete = completedCount === totalCount;

  const settingsPath = `/app/clubs/${club.id}/settings`;
  const publicProfilePath = `/clubs/${club.slug}`;

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish();
    } catch {
      setPublishError("Could not publish your club. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  function handleUseTemplate(type: TemplateLaunchType) {
    if (type === "announcement") {
      navigate(`/app/clubs/${club.id}/announcements?openTemplate=true`);
      return;
    }
    navigate(`/app/clubs/${club.id}/events?openTemplate=true`);
  }

  const sections: SectionKey[] = ["profile", "launch", "live"];
  const isModal = variant === "modal";

  return (
    <div
      style={{
        background: isModal ? "transparent" : CARD_BG,
        border: isModal ? "none" : `1px solid ${CARD_BORDER}`,
        borderRadius: isModal ? 0 : "12px",
        padding: isModal ? 0 : "24px",
        marginBottom: isModal ? 0 : "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: isModal ? "16px" : "18px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {isModal ? "Finish Club Setup" : `Finish setting up ${club.name}`}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#777777" }}>
            {isModal
              ? "Complete the remaining setup steps to make your club profile ready for members."
              : contentLoading
                ? "Checking your progress…"
                : `${completedCount} of ${totalCount} complete · ${progressPercent}%`}
          </p>
          {isModal ? (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#555555" }}>
              {contentLoading
                ? "Checking your progress…"
                : `${completedCount} of ${totalCount} complete · ${progressPercent}%`}
            </p>
          ) : null}
        </div>
        {isModal && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup checklist"
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              padding: "4px",
              flexShrink: 0,
            }}
          >
            <X size={18} aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        style={{
          width: "100%",
          height: "6px",
          borderRadius: "999px",
          background: "#2a2a2a",
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: GOLD,
            borderRadius: "999px",
            transition: "width 0.2s ease",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {sections.map((section) => (
          <section key={section}>
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#888888",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {SECTION_LABELS[section]}
            </h3>
            {section === "live" ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: allComplete ? "#cccccc" : "#777777",
                  lineHeight: 1.5,
                }}
              >
                {allComplete
                  ? "Your profile is ready. Publish to make it live on Explore."
                  : "Complete the checklist above to unlock publishing."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {items
                  .filter((item) => item.section === section)
                  .map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      onUseTemplate={handleUseTemplate}
                    />
                  ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {publishError ? (
        <p style={{ margin: "16px 0 0", fontSize: "13px", color: ACCENT_RED }}>
          {publishError}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "24px",
          alignItems: "center",
        }}
      >
        <Link
          to={settingsPath}
          style={{
            background: "#2a2a2a",
            color: "#ffffff",
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Continue Setup
        </Link>
        <button
          type="button"
          onClick={() => navigate(publicProfilePath)}
          style={{
            background: "transparent",
            color: "#cccccc",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Preview Public Profile
        </button>
        {allComplete ? (
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishing}
            style={{
              background: ACCENT_RED,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: publishing ? "not-allowed" : "pointer",
              opacity: publishing ? 0.7 : 1,
              marginLeft: "auto",
            }}
          >
            {publishing ? "Publishing…" : "Publish Club Profile"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SetupChecklistModal({
  onClose,
  ...checklistProps
}: SetupChecklistProps & { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Finish Club Setup"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "560px",
          maxHeight: "85vh",
          overflowY: "auto",
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "12px",
          padding: "20px",
        }}
      >
        <SetupChecklist {...checklistProps} variant="modal" onClose={onClose} />
      </div>
    </div>
  );
}
