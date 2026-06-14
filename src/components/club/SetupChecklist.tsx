import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
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
}

const SECTION_LABELS: Record<SectionKey, string> = {
  profile: "Profile Setup",
  launch: "Launch Content",
  live: "Go Live",
};

function buildCompletionChecks(
  club: Club,
  postsCount: number,
  eventsCount: number,
) {
  return {
    clubName: club.name?.trim() !== "",
    shortDescription:
      club.shortDescription?.trim() !== "" && club.shortDescription != null,
    logo: club.logoUrl?.trim() !== "" && club.logoUrl != null,
    banner: club.bannerUrl?.trim() !== "" && club.bannerUrl != null,
    contactEmail:
      club.contactEmail?.trim() !== "" && club.contactEmail != null,
    meetingSchedule:
      club.meetingSchedule?.trim() !== "" && club.meetingSchedule != null,
    socialLinks:
      club.socialLinks != null &&
      Object.values(club.socialLinks).some(
        (value) => value && String(value).trim() !== "",
      ),
    membershipType: true,
    firstAnnouncement: postsCount > 0,
    firstEvent: eventsCount > 0,
  };
}

function buildChecklistItems(
  club: Club,
  postsCount: number,
  eventsCount: number,
): ChecklistItem[] {
  const settingsBase = `/app/clubs/${club.id}/settings`;
  const checks = buildCompletionChecks(club, postsCount, eventsCount);

  return [
    {
      id: "name",
      label: "Club name added",
      complete: checks.clubName,
      section: "profile",
      fixPath: `${settingsBase}?section=profile`,
    },
    {
      id: "short-description",
      label: "Short description added",
      complete: checks.shortDescription,
      section: "profile",
      fixPath: `${settingsBase}?section=profile`,
    },
    {
      id: "logo",
      label: "Logo uploaded",
      complete: checks.logo,
      section: "profile",
      fixPath: `${settingsBase}?section=branding`,
    },
    {
      id: "banner",
      label: "Banner uploaded",
      complete: checks.banner,
      section: "profile",
      fixPath: `${settingsBase}?section=branding`,
    },
    {
      id: "contact-email",
      label: "Contact email added",
      complete: checks.contactEmail,
      section: "profile",
      fixPath: `${settingsBase}?section=profile`,
    },
    {
      id: "meeting-schedule",
      label: "Meeting schedule set",
      complete: checks.meetingSchedule,
      section: "profile",
      fixPath: `${settingsBase}?section=profile`,
    },
    {
      id: "social-links",
      label: "Social links added",
      complete: checks.socialLinks,
      section: "profile",
      fixPath: `${settingsBase}?section=social`,
    },
    {
      id: "membership-type",
      label: "Membership type configured",
      complete: checks.membershipType,
      section: "profile",
      fixPath: `${settingsBase}?section=membership`,
    },
    {
      id: "announcement",
      label: "Create welcome announcement",
      complete: checks.firstAnnouncement,
      section: "launch",
      fixPath: `/app/clubs/${club.id}/announcements?openCreate=true`,
      templateType: "announcement",
    },
    {
      id: "event",
      label: "Create first event",
      complete: checks.firstEvent,
      section: "launch",
      fixPath: `/app/clubs/${club.id}/events?openCreate=true`,
      templateType: "event",
    },
  ];
}

const checkRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  fontSize: "14px",
  lineHeight: 1.4,
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
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
              }}
            />
          )}
          <span
            style={{
              color: item.complete ? "#666666" : "#cccccc",
              textDecoration: item.complete ? "line-through" : "none",
            }}
          >
            {item.label}
          </span>
        </div>
        {!item.complete && item.fixPath ? (
          <button
            type="button"
            onClick={() => navigate(item.fixPath!)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: ACCENT_RED,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            → Fix this
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
}

export default function SetupChecklist({
  club,
  postsCount,
  eventsCount,
  contentLoading = false,
  onPublish,
  onRefetch,
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

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "12px",
        padding: "24px",
        marginBottom: "24px",
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
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            Finish setting up {club.name}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#777777" }}>
            {contentLoading
              ? "Checking your progress…"
              : `${completedCount} of ${totalCount} complete · ${progressPercent}%`}
          </p>
        </div>
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
