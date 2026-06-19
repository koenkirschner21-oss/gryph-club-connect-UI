import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Calendar,
  CheckSquare,
  FileText,
  Link2,
  MapPin,
  MoreHorizontal,
  Users,
  Video,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useClubMembers } from "../../../hooks/useClubMembers";
import { useWindowWidth } from "../../../hooks/useWindowWidth";
import { formatRelativeTime } from "../../../lib/formatRelativeTime";
import {
  inviteeCountLabel,
  parseAgendaItems,
  parseMeetingNotes,
} from "../../../lib/meetingMetadata";
import { MeetingTypeBadge } from "./MeetingCard";
import { primaryButtonStyle } from "./meetingStyles";
import type { ClubMeeting, MeetingActionItem } from "./meetingTypes";
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

function DateBadge({
  iso,
  compact = false,
}: {
  iso: string;
  compact?: boolean;
}) {
  const parsed = new Date(iso);
  const month = Number.isNaN(parsed.getTime())
    ? "---"
    : parsed.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = Number.isNaN(parsed.getTime()) ? "?" : String(parsed.getDate());
  const weekday = Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleString("en-US", { weekday: "short" });

  return (
    <div
      style={{
        background: "rgba(229,25,55,0.12)",
        border: `1px solid ${ACCENT_RED}`,
        borderRadius: compact ? "6px" : "8px",
        padding: compact ? "6px 8px" : "8px 10px",
        textAlign: "center",
        minWidth: compact ? "44px" : "52px",
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: compact ? "9px" : "10px", fontWeight: 700, color: ACCENT_RED }}>
        {month}
      </div>
      <div
        style={{
          fontSize: compact ? "16px" : "20px",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.1,
        }}
      >
        {day}
      </div>
      {!compact && weekday ? (
        <div style={{ fontSize: "10px", color: "#777777", marginTop: "2px" }}>{weekday}</div>
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

function meetingHasNotes(meeting: ClubMeeting): boolean {
  const { meetingNotes } = parseMeetingNotes(meeting.notes);
  return Boolean(meetingNotes.trim());
}

function meetingFormatLabel(meeting: ClubMeeting): string {
  const { metadata } = parseMeetingNotes(meeting.notes);
  if (metadata.format === "online") return "Online";
  if (metadata.format === "hybrid") return "Hybrid";
  return "In-Person";
}

function meetingLocationLine(meeting: ClubMeeting): string | null {
  const { metadata } = parseMeetingNotes(meeting.notes);
  if (metadata.format === "online") return meeting.meetingLink?.trim() || "Online meeting";
  if (metadata.format === "hybrid") {
    return meeting.meetingLink?.trim() || meeting.location?.trim() || "Hybrid meeting";
  }
  return meeting.location?.trim() || null;
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
  openActionItemCount,
  dueThisWeekCount,
  isMobile = false,
}: {
  upcomingCount: number;
  nextMeeting: ClubMeeting | null;
  openActionItemCount: number;
  dueThisWeekCount: number;
  isMobile?: boolean;
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
      />
      <StatCard
        icon={<CheckSquare size={20} color={GOLD} aria-hidden />}
        label="Open Action Items"
        value={String(openActionItemCount)}
        subtext={`${dueThisWeekCount} due this week`}
      />
      <StatCard
        icon={<Users size={20} color="#555555" aria-hidden />}
        label="Avg Attendance"
        value="—"
        subtext="Coming soon"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div style={statCardStyle}>
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
    </div>
  );
}

export function NextMeetingHero({
  meeting,
  clubId,
  isPrivileged,
  isMobile = false,
  onEdit,
}: {
  meeting: ClubMeeting;
  clubId: string;
  isPrivileged: boolean;
  isMobile?: boolean;
  onEdit: (meeting: ClubMeeting) => void;
}) {
  const navigate = useNavigate();
  const { members } = useClubMembers(clubId);
  const windowWidth = useWindowWidth();
  const stackedLayout = isMobile || windowWidth <= 1024;
  const { metadata } = parseMeetingNotes(meeting.notes);
  const agendaItems = parseAgendaItems(meeting.agenda);
  const formatLabel = meetingFormatLabel(meeting);
  const locationLine = meetingLocationLine(meeting);
  const inviteeLabel = inviteeCountLabel(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds,
  );
  const timeLabel = formatMeetingDateTime(meeting.date);

  return (
    <div
      style={{
        background: "#161616",
        border: `1px solid ${CARD_BORDER}`,
        borderLeft: `3px solid ${GOLD}`,
        borderRadius: "10px",
        padding: "20px",
        marginBottom: "24px",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: stackedLayout ? "column" : "row",
          gap: "24px",
          width: "100%",
        }}
      >
        <div style={{ flex: stackedLayout ? undefined : 1.5, minWidth: 0 }}>
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
          <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
            <DateBadge iso={meeting.date} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                {meeting.title}
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                <MeetingTypeBadge type={meeting.meetingType} />
                {recurrenceLabel(meeting) ? (
                  <span
                    style={{
                      border: "1px solid #333333",
                      color: "#999999",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {recurrenceLabel(meeting)}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#999999" }}>
                {timeLabel} · {formatLabel} · {inviteeLabel}
              </p>
              {locationLine ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#777777",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {metadata.format === "online" || metadata.format === "hybrid" ? (
                    <Video size={14} aria-hidden />
                  ) : (
                    <MapPin size={14} aria-hidden />
                  )}
                  {locationLine}
                  {meeting.meetingLink?.trim() ? <Link2 size={12} aria-hidden /> : null}
                </p>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "16px" }}>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => navigate(`/app/clubs/${clubId}/meetings/${meeting.id}`)}
            >
              Open Agenda
            </button>
            {isPrivileged ? (
              <button
                type="button"
                style={outlinedButtonStyle()}
                onClick={() => onEdit(meeting)}
              >
                Manage Meeting
              </button>
            ) : (
              <button
                type="button"
                style={outlinedButtonStyle()}
                onClick={() => navigate(`/app/clubs/${clubId}/meetings/${meeting.id}`)}
              >
                Manage Meeting
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: stackedLayout ? undefined : 1, minWidth: 0 }}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#777777",
              letterSpacing: "0.06em",
            }}
          >
            AGENDA PREVIEW
          </p>
          {agendaItems.length > 0 ? (
            <>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  color: "#cccccc",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                {agendaItems.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {agendaItems.length > 3 ? (
                <Link
                  to={`/app/clubs/${clubId}/meetings/${meeting.id}`}
                  style={{
                    display: "inline-block",
                    marginTop: "10px",
                    fontSize: "13px",
                    color: ACCENT_RED,
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  View full agenda →
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>No agenda set yet</p>
              {isPrivileged ? (
                <button
                  type="button"
                  onClick={() => onEdit(meeting)}
                  style={{
                    marginTop: "10px",
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: ACCENT_RED,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Add agenda items →
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
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
  const { members } = useClubMembers(clubId);
  const { metadata } = parseMeetingNotes(meeting.notes);
  const inviteeLabel = inviteeCountLabel(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds,
  );
  const formatLabel = meetingFormatLabel(meeting);
  const locationLine = meetingLocationLine(meeting);
  const parsedDate = new Date(meeting.date);
  const timeOnly = Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  const hasNotes = meetingHasNotes(meeting);

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        padding: "14px 16px",
        marginBottom: "8px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}
    >
      <DateBadge iso={meeting.date} compact />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              minWidth: 0,
            }}
          >
            {meeting.title}
          </p>
          {isPast ? (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#777777",
                border: "1px solid #333333",
                borderRadius: "4px",
                padding: "2px 8px",
              }}
            >
              Event Ended
            </span>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            marginTop: "6px",
          }}
        >
          <MeetingTypeBadge type={meeting.meetingType} />
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
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#777777" }}>
          {[timeOnly, formatLabel, locationLine].filter(Boolean).join(" · ")}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#555555" }}>{inviteeLabel}</p>
        {isPast ? (
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: hasNotes ? "#777777" : "#555555" }}>
            {hasNotes ? "Notes available" : "No notes"}
          </p>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <Link
          to={`/app/clubs/${clubId}/meetings/${meeting.id}`}
          style={{
            fontSize: "13px",
            color: ACCENT_RED,
            textDecoration: "none",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          Open Meeting
        </Link>
        {isPrivileged && meeting.status !== "cancelled" && !isPast ? (
          <MeetingRowMenu onEdit={() => onEdit(meeting)} onCancel={() => onCancel(meeting)} />
        ) : null}
      </div>
    </div>
  );
}

export function ActionItemsDueSoonPanel({
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
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
          Action Items Due Soon
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
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>No action items due soon</p>
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

export function RecentMeetingNotesPanel({
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
          Recent Meeting Notes
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
        <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>No meeting notes yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
              <DateBadge iso={meeting.date} compact />
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
                <p style={{ margin: 0, fontSize: "11px", color: "#555555" }}>
                  Notes added {formatRelativeTime(meeting.createdAt)}
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

export function MeetingsUpcomingLayout({
  nextMeeting,
  listMeetings,
  clubId,
  isPrivileged,
  isMobile = false,
  actionItemsDueSoon,
  recentNotesMeetings,
  onEdit,
  onCancel,
  onViewAllActions,
  onViewAllNotes,
}: {
  nextMeeting: ClubMeeting | null;
  listMeetings: ClubMeeting[];
  clubId: string;
  isPrivileged: boolean;
  isMobile?: boolean;
  actionItemsDueSoon: MeetingActionItem[];
  recentNotesMeetings: ClubMeeting[];
  onEdit: (meeting: ClubMeeting) => void;
  onCancel: (meeting: ClubMeeting) => void;
  onViewAllActions: () => void;
  onViewAllNotes: () => void;
}) {
  const windowWidth = useWindowWidth();
  const stackedLayout = isMobile || windowWidth <= 1024;

  return (
    <>
      {nextMeeting ? (
        <NextMeetingHero
          meeting={nextMeeting}
          clubId={clubId}
          isPrivileged={isPrivileged}
          isMobile={isMobile}
          onEdit={onEdit}
        />
      ) : null}
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
          }}
        >
          <ActionItemsDueSoonPanel items={actionItemsDueSoon} onViewAll={onViewAllActions} />
          <RecentMeetingNotesPanel
            meetings={recentNotesMeetings}
            clubId={clubId}
            onViewAll={onViewAllNotes}
          />
        </div>
      </div>
    </>
  );
}
