import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { Club } from "../../types";

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const GOLD = "#FFC429";
const ACCENT_RED = "#E51937";

type SectionKey = "profile" | "launch" | "live";

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  section: SectionKey;
}

const SECTION_LABELS: Record<SectionKey, string> = {
  profile: "Profile Setup",
  launch: "Launch Content",
  live: "Go Live",
};

function hasSocialLinks(links: Club["socialLinks"]): boolean {
  if (!links) return false;
  return Boolean(
    links.website?.trim() || links.instagram?.trim() || links.discord?.trim(),
  );
}

function buildChecklistItems(
  club: Club,
  hasAnnouncement: boolean,
  hasEvent: boolean,
): ChecklistItem[] {
  return [
    {
      id: "name",
      label: "Club name added",
      complete: Boolean(club.name?.trim()),
      section: "profile",
    },
    {
      id: "short-description",
      label: "Short description added",
      complete: Boolean(club.shortDescription?.trim()),
      section: "profile",
    },
    {
      id: "logo",
      label: "Logo uploaded",
      complete: Boolean(club.logoUrl?.trim()),
      section: "profile",
    },
    {
      id: "banner",
      label: "Banner uploaded",
      complete: Boolean(club.bannerUrl?.trim()),
      section: "profile",
    },
    {
      id: "contact-email",
      label: "Contact email added",
      complete: Boolean(club.contactEmail?.trim()),
      section: "profile",
    },
    {
      id: "meeting-schedule",
      label: "Meeting schedule set",
      complete: Boolean(club.meetingSchedule?.trim()),
      section: "profile",
    },
    {
      id: "social-links",
      label: "Social links added",
      complete: hasSocialLinks(club.socialLinks),
      section: "profile",
    },
    {
      id: "membership-type",
      label: "Membership type configured",
      complete: true,
      section: "profile",
    },
    {
      id: "announcement",
      label: "First announcement created",
      complete: hasAnnouncement,
      section: "launch",
    },
    {
      id: "event",
      label: "First event created",
      complete: hasEvent,
      section: "launch",
    },
  ];
}

const checkRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "14px",
  lineHeight: 1.4,
};

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <div style={checkRowStyle}>
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
  );
}

export interface SetupChecklistProps {
  club: Club;
  hasAnnouncement: boolean;
  hasEvent: boolean;
  contentLoading?: boolean;
  onPublish: () => Promise<void>;
}

export default function SetupChecklist({
  club,
  hasAnnouncement,
  hasEvent,
  contentLoading = false,
  onPublish,
}: SetupChecklistProps) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const items = useMemo(
    () => buildChecklistItems(club, hasAnnouncement, hasEvent),
    [club, hasAnnouncement, hasEvent],
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
              : `${completedCount} of ${totalCount} complete`}
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
                    <ChecklistRow key={item.id} item={item} />
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
        <Link
          to={publicProfilePath}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: "transparent",
            color: "#cccccc",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Preview Public Profile
        </Link>
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
