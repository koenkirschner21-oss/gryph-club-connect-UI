import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import {
  buildClubSettingsConfirmPath,
  buildClubSettingsSectionPath,
  clubHasBannerValue,
  clubHasLogoValue,
  clubHasSocialLinks,
  getSetupFieldState,
  resolveClubSetupSettingsPath,
  setupChecklistActionLabel,
  setupChecklistItemLabel,
  type ClubSetupSettingsSection,
  type SetupFieldState,
} from "../../lib/clubProfileCompletion";
import { PublishClubValidationError } from "../../lib/clubPublishUtils";
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
  actionLabel?: string;
  templateType?: TemplateLaunchType;
  instruction?: string;
}

const SECTION_LABELS: Record<SectionKey, string> = {
  profile: "Profile Setup",
  launch: "Launch Content",
  live: "Go Live",
};

function settingsPathForField(
  clubId: string,
  section: ClubSetupSettingsSection,
  confirmField: string,
  state: SetupFieldState,
): string {
  if (state === "existing_unconfirmed") {
    return buildClubSettingsConfirmPath(clubId, section, confirmField);
  }
  return buildClubSettingsSectionPath(clubId, section);
}

function buildChecklistItems(
  club: Club,
  postsCount: number,
  eventsCount: number,
): ChecklistItem[] {
  const logoState = getSetupFieldState(
    clubHasLogoValue(club),
    club.logoConfirmed === true,
  );
  const bannerState = getSetupFieldState(
    clubHasBannerValue(club),
    club.bannerConfirmed === true,
  );
  const descriptionState = getSetupFieldState(
    Boolean(club.shortDescription?.trim()),
    club.descriptionConfirmed === true,
  );
  const contactEmailState = getSetupFieldState(
    Boolean(club.contactEmail?.trim()),
    club.contactEmailConfirmed === true,
  );
  const meetingScheduleState = getSetupFieldState(
    Boolean(club.meetingSchedule?.trim()),
    club.meetingScheduleConfirmed === true,
  );
  const socialLinksState = getSetupFieldState(
    clubHasSocialLinks(club.socialLinks),
    club.socialLinksConfirmed === true,
  );
  const membershipState = getSetupFieldState(
    Boolean(club.membershipType),
    club.membershipConfirmed === true,
  );

  return [
    {
      id: "name",
      label: "Club name confirmed",
      complete: Boolean(club.name?.trim()),
      section: "profile",
    },
    {
      id: "logo",
      label: setupChecklistItemLabel("club logo", logoState),
      complete: logoState === "confirmed",
      section: "profile",
      fixPath: settingsPathForField(club.id, "branding", "logo", logoState),
      actionLabel: setupChecklistActionLabel(logoState),
      instruction:
        logoState === "existing_unconfirmed"
          ? "Review your club logo and click Save in Settings to confirm it."
          : "Replace the default logo with your club's official logo.",
    },
    {
      id: "banner",
      label: setupChecklistItemLabel("club banner", bannerState),
      complete: bannerState === "confirmed",
      section: "profile",
      fixPath: settingsPathForField(club.id, "branding", "banner", bannerState),
      actionLabel: setupChecklistActionLabel(bannerState),
      instruction:
        bannerState === "existing_unconfirmed"
          ? "Review your club banner and click Save in Settings to confirm it."
          : "Replace the default banner with a real club banner image.",
    },
    {
      id: "short-description",
      label: setupChecklistItemLabel("short description", descriptionState),
      complete: descriptionState === "confirmed",
      section: "profile",
      fixPath: settingsPathForField(
        club.id,
        "profile",
        "short-description",
        descriptionState,
      ),
      actionLabel: setupChecklistActionLabel(descriptionState),
      instruction:
        descriptionState === "existing_unconfirmed"
          ? "Review the description from your club request and click Save to confirm."
          : "Add a short description that accurately represents your club.",
    },
    {
      id: "contact-email",
      label: setupChecklistItemLabel("contact email", contactEmailState),
      complete: contactEmailState === "confirmed",
      section: "profile",
      fixPath: settingsPathForField(
        club.id,
        "profile",
        "contact-email",
        contactEmailState,
      ),
      actionLabel: setupChecklistActionLabel(contactEmailState),
      instruction:
        contactEmailState === "existing_unconfirmed"
          ? "Review the contact email from your club request and click Save to confirm."
          : "Add a contact email so students can reach your club.",
    },
    {
      id: "meeting-schedule",
      label: setupChecklistItemLabel("meeting schedule", meetingScheduleState),
      complete: meetingScheduleState === "confirmed",
      section: "profile",
      fixPath: settingsPathForField(
        club.id,
        "profile",
        "meeting-schedule",
        meetingScheduleState,
      ),
      actionLabel: setupChecklistActionLabel(meetingScheduleState),
      instruction:
        meetingScheduleState === "existing_unconfirmed"
          ? "Review the meeting schedule from your club request and click Save to confirm."
          : "Let members know when and where your club meets.",
    },
    {
      id: "social-links",
      label: setupChecklistItemLabel("social links", socialLinksState),
      complete: socialLinksState === "confirmed",
      section: "profile",
      fixPath: settingsPathForField(
        club.id,
        "social",
        "social-links",
        socialLinksState,
      ),
      actionLabel: setupChecklistActionLabel(socialLinksState),
      instruction:
        socialLinksState === "existing_unconfirmed"
          ? "Review your social links and click Save to confirm."
          : "Link your Instagram, website, or other channels.",
    },
    {
      id: "membership-type",
      label: setupChecklistItemLabel("membership rules", membershipState),
      complete: membershipState === "confirmed",
      section: "profile",
      fixPath: settingsPathForField(
        club.id,
        "membership",
        "membership-type",
        membershipState,
      ),
      actionLabel: setupChecklistActionLabel(membershipState),
      instruction:
        membershipState === "existing_unconfirmed"
          ? "Review how students can join your club and click Save to confirm."
          : "Choose how students can join your club.",
    },
    {
      id: "announcement",
      label: "Create welcome announcement",
      complete: postsCount > 0,
      section: "launch",
      fixPath: `/app/clubs/${club.id}/announcements?openCreate=true`,
      actionLabel: "Add →",
      instruction:
        "Post a welcome message to introduce your club to new members.",
    },
    {
      id: "event",
      label: "Create first event",
      complete: eventsCount > 0,
      section: "launch",
      fixPath: `/app/clubs/${club.id}/events?openCreate=true`,
      actionLabel: "Add →",
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
  const canDeepLink = !item.complete && Boolean(item.fixPath);
  const actionLabel = item.actionLabel ?? "Fix this →";

  return (
    <div>
      <div style={checkRowStyle}>
        <div
          style={{
            minWidth: 0,
            flex: 1,
            cursor: canDeepLink ? "pointer" : undefined,
          }}
          role={canDeepLink ? "link" : undefined}
          tabIndex={canDeepLink ? 0 : undefined}
          onClick={canDeepLink ? () => navigate(item.fixPath!) : undefined}
          onKeyDown={
            canDeepLink
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(item.fixPath!);
                  }
                }
              : undefined
          }
        >
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
            {actionLabel}
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
    const handleRefresh = () => onRefetch();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleRefresh();
    };
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("club-setup-progress-changed", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("club-setup-progress-changed", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [onRefetch]);

  const items = useMemo(
    () => buildChecklistItems(club, postsCount, eventsCount),
    [club, postsCount, eventsCount],
  );

  const completedCount = items.filter((item) => item.complete).length;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const allComplete = completedCount === totalCount;

  const settingsPath = resolveClubSetupSettingsPath(
    `/app/clubs/${club.id}/settings`,
    club,
  );
  const publicProfilePath = `/clubs/${club.slug}`;

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish();
    } catch (error) {
      if (error instanceof PublishClubValidationError) {
        setPublishError(error.message);
      } else if (error instanceof Error && error.message.trim()) {
        setPublishError(error.message);
      } else {
        setPublishError("Could not publish your club. Please try again.");
      }
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
        <p
          style={{
            margin: "16px 0 0",
            fontSize: "13px",
            color: ACCENT_RED,
            whiteSpace: "pre-line",
          }}
        >
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
          style={{
            background: "transparent",
            color: "#cccccc",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-block",
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
