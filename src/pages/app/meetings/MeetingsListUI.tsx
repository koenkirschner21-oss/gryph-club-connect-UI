import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Calendar,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClubMembers } from "../../../hooks/useClubMembers";
import { useWindowWidth } from "../../../hooks/useWindowWidth";
import {
  inviteeCountLabel,
  parseAgendaItems,
  parseMeetingNotes,
} from "../../../lib/meetingMetadata";
import { MeetingTypeBadge, StatusBadge } from "./MeetingCard";
import { primaryButtonStyle } from "./meetingStyles";
import type { ClubMeeting, MeetingActionItem } from "./meetingTypes";
import {
  canJoinMeeting,
  formatLinkLocationStatus,
  meetingPrepStatus,
} from "./meetingDisplayHelpers";
import { formatMeetingDateTime } from "./meetingUtils";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

const statCardStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "10px",
  padding: "20px",
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
};

const panelCardStyle: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "10px",
  padding: "16px",
};

export function MeetingDateBadge({
  iso,
  muted = false,
  showWeekday = false,
}: {
  iso: string;
  muted?: boolean;
  showWeekday?: boolean;
}) {
  const parsed = new Date(iso);
  const monthLabel = Number.isNaN(parsed.getTime())
    ? "---"
    : parsed.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayLabel = Number.isNaN(parsed.getTime()) ? "?" : String(parsed.getDate());
  const weekdayLabel = Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleString("en-US", { weekday: "short" });

  return (
    <div
      style={{
        background: muted ? "#333333" : ACCENT_RED,
        borderRadius: "10px",
        width: "52px",
        height: "56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#ffffff",
          lineHeight: 1.1,
        }}
      >
        {monthLabel}
      </span>
      <span
        style={{
          display: "block",
          fontSize: "22px",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1,
        }}
      >
        {dayLabel}
      </span>
      {showWeekday && weekdayLabel ? (
        <span
          style={{
            display: "block",
            fontSize: "9px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.75)",
            marginTop: "1px",
          }}
        >
          {weekdayLabel}
        </span>
      ) : null}
    </div>
  );
}

function parseDueDate(dueDate: string | null): Date | null {
  if (!dueDate?.trim()) return null;
  const trimmed = dueDate.trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);
  return Number.isNaN(due.getTime()) ? null : due;
}

function isDueOverdue(dueDate: string | null): boolean {
  const due = parseDueDate(dueDate);
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function formatNextMeetingSubtext(nextMeeting: ClubMeeting | null): string {
  if (!nextMeeting) return "No upcoming meetings";
  return `Next: ${formatMeetingDateTime(nextMeeting.date)}`;
}

function meetingFormatLabel(meeting: ClubMeeting): string {
  const { metadata } = parseMeetingNotes(meeting.notes);
  if (metadata.format === "online") return "Online";
  if (metadata.format === "hybrid") return "Hybrid";
  return "In-Person";
}

function meetingFormatValue(meeting: ClubMeeting) {
  const { metadata } = parseMeetingNotes(meeting.notes);
  return metadata.format ?? "in_person";
}

function recurrenceLabel(meeting: ClubMeeting): string | null {
  if (!meeting.isRecurring || !meeting.recurrencePattern) return null;
  if (meeting.recurrencePattern === "weekly") return "Weekly";
  if (meeting.recurrencePattern === "biweekly") return "Biweekly";
  return "Monthly";
}

function outlinedButtonStyle(): CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${ACCENT_RED}`,
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 600,
    color: ACCENT_RED,
    cursor: "pointer",
  };
}

function MeetingRowMenu({
  onEdit,
  onCancel,
}: {
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Meeting options"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "#777777",
          cursor: "pointer",
          padding: "4px",
          display: "flex",
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            background: "#1a1a1a",
            border: "1px solid #333333",
            borderRadius: "8px",
            minWidth: "140px",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onEdit();
            }}
            style={menuItemStyle}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onCancel();
            }}
            style={{ ...menuItemStyle, color: ACCENT_RED }}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

const menuItemStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  color: "#cccccc",
  padding: "10px 14px",
  fontSize: "13px",
  cursor: "pointer",
};

export function MeetingsStatCards({
  upcomingCount,
  nextMeeting,
  openFollowUpCount,
  dueThisWeekCount,
  needsRecapCount,
  isMobile = false,
  activeCard = null,
  onUpcomingClick,
  onFollowUpsClick,
  onNeedsRecapClick,
}: {
  upcomingCount: number;
  nextMeeting: ClubMeeting | null;
  openFollowUpCount: number;
  dueThisWeekCount: number;
  needsRecapCount: number;
  isMobile?: boolean;
  activeCard?: "upcoming" | "follow_ups" | "needs_recap" | null;
  onUpcomingClick?: () => void;
  onFollowUpsClick?: () => void;
  onNeedsRecapClick?: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
        gap: "16px",
        marginBottom: "24px",
        width: "100%",
      }}
    >
      <StatCard
        icon={<Calendar size={20} color={ACCENT_RED} aria-hidden />}
        label="Upcoming Meetings"
        value={String(upcomingCount)}
        subtext={formatNextMeetingSubtext(nextMeeting)}
        onClick={onUpcomingClick}
        isActive={activeCard === "upcoming"}
      />
      <StatCard
        icon={<CheckSquare size={20} color={GOLD} aria-hidden />}
        label="Open Follow-Ups"
        value={String(openFollowUpCount)}
        subtext={`${dueThisWeekCount} due this week`}
        onClick={onFollowUpsClick}
        isActive={activeCard === "follow_ups"}
      />
      <StatCard
        icon={<FileText size={20} color="#777777" aria-hidden />}
        label="Needs Recap/Review"
        value={String(needsRecapCount)}
        subtext="Past meetings missing notes"
        onClick={onNeedsRecapClick}
        isActive={activeCard === "needs_recap"}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  onClick,
  isActive = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subtext: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const interactive = Boolean(onClick);
  const style: CSSProperties = {
    ...statCardStyle,
    width: "100%",
    textAlign: "left",
    fontFamily: "inherit",
    cursor: interactive ? "pointer" : "default",
    border: isActive
      ? `1px solid ${GOLD}`
      : hovered && interactive
        ? "1px solid #444444"
        : `1px solid ${CARD_BORDER}`,
    background: isActive ? "#1a1810" : hovered && interactive ? "#181818" : CARD_BG,
    boxShadow: isActive ? "0 0 0 1px rgba(255, 196, 41, 0.15)" : undefined,
    transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
  };

  const content = (
    <>
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          background: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#777777" }}>{label}</p>
        <p style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
          {value}
        </p>
        <p style={{ margin: 0, fontSize: "12px", color: "#555555" }}>{subtext}</p>
      </div>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
        aria-pressed={isActive}
      >
        {content}
      </button>
    );
  }

  return <div style={style}>{content}</div>;
}

function MeetingListCard({
  meeting,
  clubId,
  isPrivileged,
  featured = false,
  isPast = false,
  onEdit,
  onCancel,
}: {
  meeting: ClubMeeting;
  clubId: string;
  isPrivileged: boolean;
  featured?: boolean;
  isPast?: boolean;
  onEdit: (meeting: ClubMeeting) => void;
  onCancel: (meeting: ClubMeeting) => void;
}) {
  const navigate = useNavigate();
  const { members } = useClubMembers(clubId);
  const { metadata } = parseMeetingNotes(meeting.notes);
  const format = meetingFormatValue(meeting);
  const formatLabel = meetingFormatLabel(meeting);
  const agendaCount = parseAgendaItems(meeting.agenda).filter((item) => item.trim()).length;
  const inviteeLabel = inviteeCountLabel(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds,
  );
  const timeLabel = formatMeetingDateTime(meeting.date);
  const linkLocationStatus = formatLinkLocationStatus(meeting, format);
  const prepStatus = meetingPrepStatus(meeting);
  const showJoin = canJoinMeeting(meeting, format);
  const meetingDetailPath = `/app/clubs/${clubId}/meetings/${meeting.id}`;

  const metaParts: string[] = [inviteeLabel];
  if (agendaCount > 0) {
    metaParts.push(`${agendaCount} agenda item${agendaCount === 1 ? "" : "s"}`);
  }
  if (meeting.openActionItemCount > 0) {
    metaParts.push(
      `${meeting.openActionItemCount} open follow-up${meeting.openActionItemCount === 1 ? "" : "s"}`,
    );
  }
  metaParts.push(prepStatus);

  return (
    <div
      style={{
        background: isPast ? "#121212" : featured ? "#161616" : CARD_BG,
        border: `1px solid ${isPast ? "#252525" : CARD_BORDER}`,
        borderLeft: featured ? `3px solid ${GOLD}` : `1px solid ${isPast ? "#252525" : CARD_BORDER}`,
        borderRadius: "10px",
        padding: "16px 18px",
        marginBottom: featured ? "16px" : "10px",
        width: "100%",
      }}
    >
      {featured ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "11px",
            fontWeight: 700,
            color: "#777777",
            letterSpacing: "0.06em",
          }}
        >
          NEXT MEETING
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
        <MeetingDateBadge iso={meeting.date} muted={isPast} showWeekday={featured} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: featured ? "18px" : "15px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {meeting.title}
              </h3>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <MeetingTypeBadge type={meeting.meetingType} />
                <StatusBadge meeting={meeting} />
                {recurrenceLabel(meeting) ? (
                  <span
                    style={{
                      border: "1px solid #333333",
                      color: "#999999",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 600,
                    }}
                  >
                    {recurrenceLabel(meeting)}
                  </span>
                ) : null}
              </div>
            </div>
            {isPrivileged && meeting.status !== "cancelled" && !isPast ? (
              <MeetingRowMenu onEdit={() => onEdit(meeting)} onCancel={() => onCancel(meeting)} />
            ) : null}
          </div>

          <p style={{ margin: "0 0 4px", fontSize: "13px", color: isPast ? "#b8b8b8" : "#999999" }}>
            {timeLabel}
          </p>
          <p style={{ margin: "0 0 4px", fontSize: "12px", color: isPast ? "#9a9a9a" : "#777777" }}>
            {formatLabel} · {linkLocationStatus}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: isPast ? "#8a8a8a" : "#666666" }}>
            {metaParts.join(" · ")}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "14px",
          paddingTop: "14px",
          borderTop: `1px solid #222222`,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => navigate(meetingDetailPath)}
        >
          Open Agenda
        </button>
        {isPast ? (
          <>
            <button
              type="button"
              style={outlinedButtonStyle()}
              onClick={() => navigate(meetingDetailPath)}
            >
              View Recap/Notes
            </button>
            {isPrivileged ? (
              <button type="button" style={outlinedButtonStyle()} onClick={() => onEdit(meeting)}>
                Manage Meeting
              </button>
            ) : null}
          </>
        ) : (
          <>
            {isPrivileged ? (
              <button type="button" style={outlinedButtonStyle()} onClick={() => onEdit(meeting)}>
                Manage Meeting
              </button>
            ) : (
              <button
                type="button"
                style={outlinedButtonStyle()}
                onClick={() => navigate(meetingDetailPath)}
              >
                View Meeting
              </button>
            )}
            {showJoin && meeting.meetingLink ? (
              <a
                href={meeting.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...outlinedButtonStyle(),
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ExternalLink size={14} aria-hidden />
                Join Meeting
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function NextMeetingHero({
  meeting,
  clubId,
  isPrivileged,
  onEdit,
  onCancel,
}: {
  meeting: ClubMeeting;
  clubId: string;
  isPrivileged: boolean;
  isMobile?: boolean;
  onEdit: (meeting: ClubMeeting) => void;
  onCancel?: (meeting: ClubMeeting) => void;
}) {
  return (
    <MeetingListCard
      meeting={meeting}
      clubId={clubId}
      isPrivileged={isPrivileged}
      featured
      onEdit={onEdit}
      onCancel={onCancel ?? onEdit}
    />
  );
}

export function CompactMeetingRow({
  meeting,
  clubId,
  isPrivileged,
  isPast = false,
  onEdit,
  onCancel,
}: {
  meeting: ClubMeeting;
  clubId: string;
  isPrivileged: boolean;
  isPast?: boolean;
  onEdit: (meeting: ClubMeeting) => void;
  onCancel: (meeting: ClubMeeting) => void;
}) {
  return (
    <MeetingListCard
      meeting={meeting}
      clubId={clubId}
      isPrivileged={isPrivileged}
      isPast={isPast}
      onEdit={onEdit}
      onCancel={onCancel}
    />
  );
}

export function DueSoonPanel({
  items,
  onViewAll,
}: {
  items: MeetingActionItem[];
  onViewAll: () => void;
}) {
  return (
    <div style={{ ...panelCardStyle, marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
          gap: "12px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>Due Soon</h3>
        <button
          type="button"
          onClick={onViewAll}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: ACCENT_RED,
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          View All →
        </button>
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>
          No action items due soon.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {items.map((item) => {
            const overdue = isDueOverdue(item.dueDate);
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                    {item.title}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#555555" }}>
                    From: {item.meetingTitle ?? "Meeting"}
                  </p>
                </div>
                {item.dueDate ? (
                  <span
                    style={{
                      fontSize: "11px",
                      color: overdue ? ACCENT_RED : "#777777",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {item.dueDate}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NeedsRecapPanel({
  meetings,
  clubId,
  onViewAll,
}: {
  meetings: ClubMeeting[];
  clubId: string;
  onViewAll: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div style={{ ...panelCardStyle, marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
          gap: "12px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
          Needs Recap
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: ACCENT_RED,
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          View All →
        </button>
      </div>
      {meetings.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>
          All recent meetings have notes or decisions recorded.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {meetings.map((meeting) => (
            <button
              key={meeting.id}
              type="button"
              onClick={() => navigate(`/app/clubs/${clubId}/meetings/${meeting.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <MeetingDateBadge iso={meeting.date} muted />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#ffffff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {meeting.title}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: ACCENT_RED, fontWeight: 600 }}>
                  Add recap →
                </p>
              </div>
              <FileText size={16} color="#555555" aria-hidden style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UpcomingPrepPanel({
  meetings,
  clubId,
  onViewAll,
}: {
  meetings: ClubMeeting[];
  clubId: string;
  onViewAll: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div style={panelCardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
          gap: "12px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
          Upcoming Prep
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: ACCENT_RED,
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          View All →
        </button>
      </div>
      {meetings.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>
          Upcoming meetings are prepped.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {meetings.map((meeting) => (
            <button
              key={meeting.id}
              type="button"
              onClick={() => navigate(`/app/clubs/${clubId}/meetings/${meeting.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <MeetingDateBadge iso={meeting.date} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#ffffff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {meeting.title}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#777777" }}>
                  {meetingPrepStatus(meeting)}
                </p>
              </div>
              <ClipboardList size={16} color="#555555" aria-hidden style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** @deprecated Use DueSoonPanel */
export function ActionItemsDueSoonPanel(props: {
  items: MeetingActionItem[];
  onViewAll: () => void;
}) {
  return <DueSoonPanel {...props} />;
}

export function MeetingsUpcomingLayout({
  nextMeeting,
  listMeetings,
  clubId,
  isPrivileged,
  isMobile = false,
  actionItemsDueSoon,
  needsRecapMeetings,
  upcomingPrepMeetings,
  onEdit,
  onCancel,
  onViewAllActions,
  onViewAllRecap,
  onViewAllPrep,
}: {
  nextMeeting: ClubMeeting | null;
  listMeetings: ClubMeeting[];
  clubId: string;
  isPrivileged: boolean;
  isMobile?: boolean;
  actionItemsDueSoon: MeetingActionItem[];
  needsRecapMeetings: ClubMeeting[];
  upcomingPrepMeetings: ClubMeeting[];
  onEdit: (meeting: ClubMeeting) => void;
  onCancel: (meeting: ClubMeeting) => void;
  onViewAllActions: () => void;
  onViewAllRecap: () => void;
  onViewAllPrep: () => void;
}) {
  const windowWidth = useWindowWidth();
  const stackedLayout = isMobile || windowWidth <= 1024;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: stackedLayout ? "column" : "row",
        gap: "24px",
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      <div
        style={{
          flex: stackedLayout ? undefined : 2,
          minWidth: 0,
          width: stackedLayout ? "100%" : undefined,
        }}
      >
        {nextMeeting ? (
          <NextMeetingHero
            meeting={nextMeeting}
            clubId={clubId}
            isPrivileged={isPrivileged}
            onEdit={onEdit}
            onCancel={onCancel}
          />
        ) : null}
        {listMeetings.length === 0 && !nextMeeting ? (
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
            No upcoming meetings scheduled.
          </p>
        ) : listMeetings.length === 0 ? (
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
            No additional upcoming meetings.
          </p>
        ) : (
          listMeetings.map((meeting) => (
            <CompactMeetingRow
              key={meeting.id}
              meeting={meeting}
              clubId={clubId}
              isPrivileged={isPrivileged}
              onEdit={onEdit}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
      <div
        style={{
          flex: stackedLayout ? undefined : 1,
          minWidth: 0,
          maxWidth: stackedLayout ? "100%" : "360px",
          width: stackedLayout ? "100%" : undefined,
          flexShrink: 0,
          alignSelf: stackedLayout ? "stretch" : "flex-start",
          position: stackedLayout ? "static" : "sticky",
          top: stackedLayout ? undefined : "24px",
        }}
      >
        <DueSoonPanel items={actionItemsDueSoon} onViewAll={onViewAllActions} />
        <NeedsRecapPanel
          meetings={needsRecapMeetings}
          clubId={clubId}
          onViewAll={onViewAllRecap}
        />
        <UpcomingPrepPanel
          meetings={upcomingPrepMeetings}
          clubId={clubId}
          onViewAll={onViewAllPrep}
        />
      </div>
    </div>
  );
}
