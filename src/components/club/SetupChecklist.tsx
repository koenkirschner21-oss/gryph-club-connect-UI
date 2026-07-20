import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import {
  type ClubSetupMilestone,
  type ClubSetupProgress,
} from "../../lib/clubProfileCompletion";
import { PublishClubValidationError } from "../../lib/clubPublishUtils";
import { useIsMobile } from "../../hooks/useWindowWidth";
import type { Club } from "../../types";

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const GOLD = "#FFC429";
const ACCENT_RED = "#E51937";

const primaryButtonStyle: CSSProperties = {
  background: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 18px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const secondaryButtonStyle: CSSProperties = {
  background: "transparent",
  color: "#cccccc",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "8px",
  padding: "10px 18px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "6px",
        borderRadius: "999px",
        background: "#2a2a2a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          background: GOLD,
          borderRadius: "999px",
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

function MilestoneCard({
  milestone,
  expanded,
  onToggle,
}: {
  milestone: ClubSetupMilestone;
  expanded: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: "#121212",
        border: `1px solid ${milestone.complete ? "#2a2a2a" : "#333333"}`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            border: milestone.complete ? `1px solid ${GOLD}` : "1px solid #444444",
            background: milestone.complete ? "rgba(255, 196, 41, 0.12)" : "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "1px",
          }}
          aria-hidden
        >
          {milestone.complete ? <Check size={13} color={GOLD} strokeWidth={2.5} /> : null}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 600,
              color: milestone.complete ? "#888888" : "#ffffff",
            }}
          >
            {milestone.title}
          </span>
          {milestone.description ? (
            <span
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "12px",
                color: "#777777",
                lineHeight: 1.45,
              }}
            >
              {milestone.description}
            </span>
          ) : null}
        </span>
        {expanded ? (
          <ChevronDown size={16} color="#777777" style={{ flexShrink: 0, marginTop: "3px" }} />
        ) : (
          <ChevronRight size={16} color="#777777" style={{ flexShrink: 0, marginTop: "3px" }} />
        )}
      </button>

      {expanded ? (
        <div style={{ padding: "0 16px 16px 50px" }}>
          {milestone.fields.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                margin: "0 0 12px",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {milestone.fields.map((field) => (
                <li
                  key={field.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    fontSize: "13px",
                    color: field.complete ? "#666666" : "#cccccc",
                  }}
                >
                  <span>
                    {field.complete ? "✓ " : "○ "}
                    {field.label}
                  </span>
                  {!field.complete && field.fixPath ? (
                    <button
                      type="button"
                      onClick={() => navigate(field.fixPath!)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${ACCENT_RED}`,
                        borderRadius: "6px",
                        padding: "4px 10px",
                        color: ACCENT_RED,
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {field.actionLabel ?? milestone.actionLabel}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {!milestone.complete ? (
            <button
              type="button"
              onClick={() => navigate(milestone.fixPath)}
              style={{
                ...primaryButtonStyle,
                padding: "8px 14px",
                fontSize: "12px",
              }}
            >
              {milestone.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MilestoneGroup({
  title,
  hint,
  milestones,
  expandedIds,
  onToggle,
}: {
  title: string;
  hint?: string;
  milestones: ClubSetupMilestone[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <section style={{ marginBottom: "22px" }}>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: "12px",
          fontWeight: 700,
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h3>
      {hint ? (
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#666666", lineHeight: 1.45 }}>
          {hint}
        </p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {milestones.map((milestone) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            expanded={expandedIds.has(milestone.id)}
            onToggle={() => onToggle(milestone.id)}
          />
        ))}
      </div>
    </section>
  );
}

function SetupBody({
  club,
  progress,
  contentLoading,
  refreshError,
  publishing,
  publishError,
  publishSuccess,
  onPrimaryAction,
  onClose,
  compact,
  showActions = true,
  hideHeader = false,
}: {
  club: Club;
  progress: ClubSetupProgress;
  contentLoading?: boolean;
  refreshError?: string | null;
  publishing: boolean;
  publishError: string | null;
  publishSuccess: boolean;
  onPrimaryAction: () => void;
  onClose?: () => void;
  compact?: boolean;
  showActions?: boolean;
  hideHeader?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const firstIncomplete = progress.nextRequiredMilestone?.id;
    return new Set(firstIncomplete ? [firstIncomplete] : []);
  });

  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set<string>();
      for (const milestone of progress.milestones) {
        if (!milestone.complete && prev.has(milestone.id)) {
          next.add(milestone.id);
        }
      }
      const firstIncomplete = progress.nextRequiredMilestone?.id;
      if (firstIncomplete && next.size === 0) {
        next.add(firstIncomplete);
      }
      return next;
    });
  }, [progress]);

  function toggleMilestone(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const progressLabel = contentLoading
    ? "Checking your progress…"
    : `${progress.requiredCompletedCount} of ${progress.requiredTotalCount} required complete · ${progress.percent}%`;

  const recommendedLabel =
    progress.recommendedTotalCount > 0
      ? `${progress.recommendedCompletedCount} of ${progress.recommendedTotalCount} recommended`
      : null;

  if (publishSuccess) {
    return (
      <div style={{ padding: compact ? 0 : "8px 0" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#ffffff", fontWeight: 700 }}>
          {club.name} is live
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#aaaaaa", lineHeight: 1.5 }}>
          Your club profile is published on Explore.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <Link to={`/clubs/${club.slug}`} style={primaryButtonStyle}>
            View Public Profile
          </Link>
          <Link to={`/app/clubs/${club.id}`} style={secondaryButtonStyle}>
            Open Club Workspace
          </Link>
          {onClose ? (
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Close
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      {!hideHeader ? (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: compact ? "18px" : "16px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {compact ? `Finish setting up ${club.name}` : club.name}
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#888888" }}>
                {progressLabel}
                {recommendedLabel ? ` · ${recommendedLabel}` : ""}
              </p>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close setup"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#777777",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
          <ProgressBar percent={progress.percent} />
        </div>
      ) : null}

      {refreshError ? (
        <p style={{ margin: "0 0 12px", fontSize: "13px", color: ACCENT_RED }} role="alert">
          {refreshError}
        </p>
      ) : null}

      <MilestoneGroup
        title="Required to publish"
        milestones={progress.requiredMilestones}
        expandedIds={expandedIds}
        onToggle={toggleMilestone}
      />
      <MilestoneGroup
        title="Recommended for launch"
        hint="These help your club look ready but do not block publishing."
        milestones={progress.recommendedMilestones}
        expandedIds={expandedIds}
        onToggle={toggleMilestone}
      />

      {publishError ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "13px",
            color: ACCENT_RED,
            whiteSpace: "pre-line",
          }}
          role="alert"
        >
          {publishError}
        </p>
      ) : null}

      {showActions ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={publishing}
            style={{
              ...primaryButtonStyle,
              opacity: publishing ? 0.7 : 1,
              cursor: publishing ? "not-allowed" : "pointer",
            }}
          >
            {publishing
              ? "Publishing…"
              : progress.allRequiredComplete
                ? "Publish Club"
                : "Complete Next Step"}
          </button>

          {progress.canPreviewPublicProfile ? (
            <Link to={`/clubs/${club.slug}`} style={secondaryButtonStyle}>
              Preview Public Profile
            </Link>
          ) : (
            <span
              title="Complete the required profile fields to preview."
              style={{
                ...secondaryButtonStyle,
                opacity: 0.45,
                cursor: "not-allowed",
                pointerEvents: "none",
              }}
            >
              Preview Public Profile
            </span>
          )}
          {!progress.canPreviewPublicProfile ? (
            <span style={{ fontSize: "12px", color: "#666666" }}>
              Complete the required profile fields to preview.
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export interface SetupChecklistProps {
  club: Club;
  progress: ClubSetupProgress;
  contentLoading?: boolean;
  refreshError?: string | null;
  onPublish: () => Promise<void>;
  onRefetch?: () => void;
  variant?: "inline" | "drawer";
  onClose?: () => void;
}

export default function SetupChecklist({
  club,
  progress,
  contentLoading = false,
  refreshError = null,
  onPublish,
  onRefetch,
  variant = "inline",
  onClose,
}: SetupChecklistProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

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

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish();
      setPublishSuccess(true);
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

  function handlePrimaryAction() {
    if (progress.allRequiredComplete) {
      void handlePublish();
      return;
    }
    const next = progress.nextRequiredMilestone;
    if (next?.fixPath) {
      navigate(next.fixPath);
    }
  }

  const body = (
    <SetupBody
      club={club}
      progress={progress}
      contentLoading={contentLoading}
      refreshError={refreshError}
      publishing={publishing}
      publishError={publishError}
      publishSuccess={publishSuccess}
      onPrimaryAction={handlePrimaryAction}
      onClose={onClose}
      compact={variant === "inline"}
      showActions={variant === "inline"}
      hideHeader={variant === "drawer"}
    />
  );

  if (variant === "inline") {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          margin: "0 auto 24px",
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "12px",
          padding: isMobile ? "20px 16px" : "24px",
        }}
      >
        {body}
      </div>
    );
  }

  return body;
}

export function SetupChecklistDrawer({
  onClose,
  club,
  progress,
  contentLoading = false,
  refreshError = null,
  onPublish,
  onRefetch,
}: SetupChecklistProps & { onClose: () => void }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!onRefetch) return;
    const handleRefresh = () => onRefetch();
    window.addEventListener("club-setup-progress-changed", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    return () => {
      window.removeEventListener("club-setup-progress-changed", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [onRefetch]);

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish();
      setPublishSuccess(true);
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

  function handlePrimaryAction() {
    if (progress.allRequiredComplete) {
      void handlePublish();
      return;
    }
    const next = progress.nextRequiredMilestone;
    if (next?.fixPath) navigate(next.fixPath);
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Finish Club Setup"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : "480px",
          height: "100%",
          background: CARD_BG,
          borderLeft: isMobile ? "none" : `1px solid ${CARD_BORDER}`,
          display: "flex",
          flexDirection: "column",
          boxShadow: isMobile ? "none" : "-12px 0 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            borderBottom: `1px solid ${CARD_BORDER}`,
            padding: isMobile ? "16px" : "18px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#777777",
                }}
              >
                Club setup
              </p>
              <h2
                style={{
                  margin: "4px 0 0",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {club.name}
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#888888" }}>
                {contentLoading
                  ? "Checking your progress…"
                  : `${progress.requiredCompletedCount} of ${progress.requiredTotalCount} required · ${progress.percent}%`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close setup"
              style={{
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={18} />
            </button>
          </div>
          <ProgressBar percent={progress.percent} />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "16px 16px 24px" : "20px 20px 28px",
          }}
        >
          <SetupBody
            club={club}
            progress={progress}
            contentLoading={contentLoading}
            refreshError={refreshError}
            publishing={publishing}
            publishError={publishError}
            publishSuccess={publishSuccess}
            onPrimaryAction={handlePrimaryAction}
            onClose={onClose}
            showActions={false}
            hideHeader
          />
        </div>

        {!publishSuccess ? (
          <div
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${CARD_BORDER}`,
              background: "#121212",
              padding: "14px 20px",
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={publishing}
              style={{
                ...primaryButtonStyle,
                flex: 1,
                opacity: publishing ? 0.7 : 1,
              }}
            >
              {publishing
                ? "Publishing…"
                : progress.allRequiredComplete
                  ? "Publish Club"
                  : "Complete Next Step"}
            </button>
            {progress.canPreviewPublicProfile ? (
              <Link to={`/clubs/${club.slug}`} style={secondaryButtonStyle}>
                Preview
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Compact post-publish / maintenance prompt for the dashboard. */
export function SetupCompleteBanner({
  clubName,
  publicProfilePath,
  children,
}: {
  clubName: string;
  publicProfilePath: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto 24px",
        background: "rgba(255, 196, 41, 0.08)",
        border: "1px solid rgba(255, 196, 41, 0.25)",
        borderRadius: "12px",
        padding: "16px 18px",
      }}
    >
      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: GOLD }}>
        {clubName} is published
      </p>
      <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#cccccc" }}>
        Your public profile is live. Keep details current as your club evolves.
      </p>
      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <Link to={publicProfilePath} style={secondaryButtonStyle}>
          View Public Profile
        </Link>
        {children}
      </div>
    </div>
  );
}

/** @deprecated Prefer SetupChecklistDrawer */
export const SetupChecklistModal = SetupChecklistDrawer;
