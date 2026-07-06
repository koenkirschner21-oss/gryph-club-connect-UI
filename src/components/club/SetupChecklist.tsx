import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import {
  computeClubSetupProgress,
  resolveClubSetupSettingsPath,
  type ClubSetupProgressCounts,
  type ClubSetupProgressItem,
} from "../../lib/clubProfileCompletion";
import { useClubContext } from "../../context/useClubContext";
import { PublishClubValidationError } from "../../lib/clubPublishUtils";
import type { Club } from "../../types";

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const GOLD = "#FFC429";
const ACCENT_RED = "#E51937";
const MUTED_GOLD = "#8a7428";

type SectionKey = "profile" | "launch" | "recommended" | "live";
type TemplateLaunchType = "announcement" | "event";

type ChecklistItem = ClubSetupProgressItem;

const SECTION_LABELS: Record<SectionKey, string> = {
  profile: "Required — Profile Setup",
  launch: "Required — Launch Content",
  recommended: "Optional — Recommended",
  live: "Go Live",
};

const SECTION_HINTS: Partial<Record<SectionKey, string>> = {
  recommended:
    "These steps help your club look polished but do not block publishing.",
};

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

const skipButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #444444",
  borderRadius: "6px",
  padding: "6px 10px",
  color: "#888888",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

function ChecklistRow({
  item,
  onUseTemplate,
  onSkip,
  skipping,
}: {
  item: ChecklistItem;
  onUseTemplate: (type: TemplateLaunchType) => void;
  onSkip?: (itemId: string) => void;
  skipping?: boolean;
}) {
  const navigate = useNavigate();
  const canDeepLink = !item.complete && Boolean(item.fixPath) && !item.skipped;
  const actionLabel = item.actionLabel ?? "Fix this →";
  const displayLabel = item.skipped ? `${item.label} (skipped for now)` : item.label;

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
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
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
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    color: item.complete ? "#666666" : "#cccccc",
                  }}
                >
                  {displayLabel}
                </span>
                {item.optional ? (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: MUTED_GOLD,
                      border: `1px solid ${MUTED_GOLD}`,
                      borderRadius: "999px",
                      padding: "2px 8px",
                    }}
                  >
                    Optional
                  </span>
                ) : null}
              </div>
            </div>
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginTop: "2px",
            flexShrink: 0,
          }}
        >
          {!item.complete && item.fixPath && !item.skipped ? (
            <button
              type="button"
              onClick={() => navigate(item.fixPath!)}
              style={fixButtonStyle}
            >
              {actionLabel}
            </button>
          ) : null}
          {!item.complete && item.canSkip && onSkip ? (
            <button
              type="button"
              onClick={() => onSkip(item.id)}
              disabled={skipping}
              style={{
                ...skipButtonStyle,
                opacity: skipping ? 0.6 : 1,
                cursor: skipping ? "not-allowed" : "pointer",
              }}
            >
              Skip for now
            </button>
          ) : null}
        </div>
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
  documentsCount?: number;
  activeMemberCount?: number;
  pendingInviteCount?: number;
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
  documentsCount = 0,
  activeMemberCount = 1,
  pendingInviteCount = 0,
  contentLoading = false,
  onPublish,
  onRefetch,
  variant = "inline",
  onClose,
}: SetupChecklistProps) {
  const navigate = useNavigate();
  const { updateClub } = useClubContext();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [skippingItemId, setSkippingItemId] = useState<string | null>(null);

  const progressCounts = useMemo<ClubSetupProgressCounts>(
    () => ({
      postsCount,
      eventsCount,
      documentsCount,
      activeMemberCount,
      pendingInviteCount,
    }),
    [postsCount, eventsCount, documentsCount, activeMemberCount, pendingInviteCount],
  );

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

  const setupProgress = useMemo(
    () => computeClubSetupProgress(club, progressCounts),
    [club, progressCounts],
  );
  const {
    items,
    completedCount,
    totalCount,
    percent: progressPercent,
    allComplete,
  } = setupProgress;

  const settingsPath = resolveClubSetupSettingsPath(
    `/app/clubs/${club.id}/settings`,
    club,
    progressCounts,
  );
  const publicProfilePath = `/clubs/${club.slug}`;

  async function handleSkipItem(itemId: string) {
    setSkippingItemId(itemId);
    const nextSkipped = Array.from(
      new Set([...(club.setupSkippedItems ?? []), itemId]),
    );
    const ok = await updateClub(club.id, { setupSkippedItems: nextSkipped });
    setSkippingItemId(null);
    if (ok) {
      window.dispatchEvent(
        new CustomEvent("club-setup-progress-changed", { detail: { clubId: club.id } }),
      );
    }
  }

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

  const sections: SectionKey[] = ["profile", "launch", "recommended", "live"];
  const isModal = variant === "modal";
  const progressLabel = contentLoading
    ? "Checking your progress…"
    : `${completedCount} of ${totalCount} required complete · ${progressPercent}%`;

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
              ? "Complete the required steps to publish your club on Explore."
              : progressLabel}
          </p>
          {isModal ? (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#555555" }}>
              {progressLabel}
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
            {SECTION_HINTS[section] ? (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "12px",
                  color: "#666666",
                  lineHeight: 1.45,
                }}
              >
                {SECTION_HINTS[section]}
              </p>
            ) : null}
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
                  ? "Your required setup is complete. Publish to make your club live on Explore."
                  : "Complete all required steps above to unlock publishing."}
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
                      onSkip={item.canSkip ? handleSkipItem : undefined}
                      skipping={skippingItemId === item.id}
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
