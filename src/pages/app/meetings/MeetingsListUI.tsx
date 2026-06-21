import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Calendar,
  CheckSquare,
  FileText,
  Lightbulb,
  Link2,
  MapPin,
  MoreHorizontal,
  Users,
  Video,
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
}: {
  iso: string;
  muted?: boolean;
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
        padding: "8px 12px",
        textAlign: "center",
        minWidth: "52px",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "11px",
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
      {weekdayLabel ? (
        <span
          style={{
            display: "block",
            fontSize: "10px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.75)",
            marginTop: "2px",
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
  completedCount,
  isMobile = false,
}: {
  upcomingCount: number;
  nextMeeting: ClubMeeting | null;
  openActionItemCount: number;
  dueThisWeekCount: number;
  completedCount: number;
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
        icon={<Users size={20} color="#777777" aria-hidden />}
        label="Completed Meetings"
        value={String(completedCount)}
        subtext="Past meetings on record"
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
  const windowWidth = useWindowWidth();
  const stackedLayout = windowWidth <= 768;
  const { metadata, meetingNotes } = parseMeetingNotes(meeting.notes);
  const agendaItems = parseAgendaItems(meeting.agenda);
  const formatLabel = meetingFormatLabel(meeting);
  const locationLine = meetingLocationLine(meeting);
  const inviteeLabel = inviteeCountLabel(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds,
  );
  const timeLabel = formatMeetingDateTime(meeting.date);
  const decisionsText = metadata.decisions?.trim() ?? "";
  const hasNotes = Boolean(meetingNotes.trim());
  const hasDecisions = Boolean(decisionsText);
  const agendaPreview = agendaItems.find((item) => item.trim()) ?? "";

  const contextCounts: string[] = [];
  if (agendaItems.length > 0) {
    contextCounts.push(
      `${agendaItems.length} agenda item${agendaItems.length === 1 ? "" : "s"}`,
    );
  }
  if (meeting.actionItemCount > 0) {
    contextCounts.push(
      `${meeting.actionItemCount} action item${meeting.actionItemCount === 1 ? "" : "s"}`,
    );
  }
  if (hasNotes) contextCounts.push("Notes recorded");
  if (hasDecisions) contextCounts.push("Decisions recorded");

  return (
    <div
      style={{
        background: featured ? "#161616" : CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderLeft: featured ? `3px solid ${GOLD}` : `1px solid ${CARD_BORDER}`,
        borderRadius: "10px",
        padding: "16px 18px",
        marginBottom: featured ? "16px" : "10px",
        width: "100%",
        opacity: isPast ? 0.75 : 1,
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

      <div
        style={{
          display: "flex",
          flexDirection: stackedLayout ? "column" : "row",
          gap: stackedLayout ? "14px" : "20px",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "14px",
            flex: stackedLayout ? undefined : 1.4,
            minWidth: 0,
            width: stackedLayout ? "100%" : undefined,
          }}
        >
          <MeetingDateBadge iso={meeting.date} muted={isPast} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: featured ? "18px" : "15px",
                  fontWeight: 700,
                  color: "#ffffff",
                  minWidth: 0,
                }}
              >
                {meeting.title}
              </h3>
              <StatusBadge meeting={meeting} />
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "8px",
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
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#999999" }}>{timeLabel}</p>
            <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#777777" }}>
              {formatLabel} · {inviteeLabel}
            </p>
            {locationLine ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#777777",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {metadata.format === "online" || metadata.format === "hybrid" ? (
                  <Video size={13} aria-hidden />
                ) : (
                  <MapPin size={13} aria-hidden />
                )}
                {locationLine}
                {meeting.meetingLink?.trim() ? <Link2 size={11} aria-hidden /> : null}
              </p>
            ) : null}
          </div>
        </div>

        <div
          style={{
            flex: stackedLayout ? undefined : 1,
            minWidth: 0,
            width: stackedLayout ? "100%" : undefined,
            paddingLeft: stackedLayout ? 0 : "8px",
            borderLeft: stackedLayout ? "none" : `1px solid #222222`,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "10px",
              fontWeight: 700,
              color: "#555555",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Context
          </p>
          {agendaPreview ? (
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "13px",
                color: "#cccccc",
                lineHeight: 1.45,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {agendaPreview}
            </p>
          ) : (
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#555555" }}>
              No agenda set yet
            </p>
          )}
          {contextCounts.length > 0 ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
              {contextCounts.join(" · ")}
            </p>
          ) : null}
        </div>

        {isPrivileged && meeting.status !== "cancelled" && !isPast ? (
          <MeetingRowMenu onEdit={() => onEdit(meeting)} onCancel={() => onCancel(meeting)} />
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: `1px solid #222222`,
        }}
      >
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => navigate(`/app/clubs/${clubId}/meetings/${meeting.id}`)}
        >
          Open Agenda
        </button>
        {isPrivileged ? (
          <button type="button" style={outlinedButtonStyle()} onClick={() => onEdit(meeting)}>
            Manage Meeting
          </button>
        ) : (
          <button
            type="button"
            style={outlinedButtonStyle()}
            onClick={() => navigate(`/app/clubs/${clubId}/meetings/${meeting.id}`)}
          >
            View Meeting
          </button>
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
        <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>
          No recent meeting notes yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {meetings.map((meeting) => {
            const { meetingNotes } = parseMeetingNotes(meeting.notes);
            const preview = meetingNotes.trim().slice(0, 100);
            const truncated = meetingNotes.trim().length > 100;

            return (
            <button
              key={meeting.id}
              type="button"
              onClick={() => navigate(`/app/clubs/${clubId}/meetings/${meeting.id}`)}
              style={{
                display: "flex",
                alignItems: "flex-start",
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
                {preview ? (
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: "12px",
                      color: "#777777",
                      lineHeight: 1.45,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {preview}
                    {truncated ? "…" : ""}
                  </p>
                ) : null}
                <p style={{ margin: 0, fontSize: "11px", color: ACCENT_RED, fontWeight: 600 }}>
                  Open meeting →
                </p>
              </div>
              <FileText size={16} color="#555555" aria-hidden style={{ flexShrink: 0 }} />
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MeetingTipsCard() {
  const tips = [
    "Add agenda items before the meeting.",
    "Record decisions during the meeting.",
    "Convert action items into tasks after the meeting.",
  ];

  return (
    <div style={{ ...panelCardStyle, marginTop: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <Lightbulb size={16} color={GOLD} aria-hidden />
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
          Meeting Tips
        </h3>
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {tips.map((tip) => (
          <li key={tip} style={{ fontSize: "12px", color: "#777777", lineHeight: 1.45 }}>
            {tip}
          </li>
        ))}
      </ul>
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
        <ActionItemsDueSoonPanel items={actionItemsDueSoon} onViewAll={onViewAllActions} />
        <RecentMeetingNotesPanel
          meetings={recentNotesMeetings}
          clubId={clubId}
          onViewAll={onViewAllNotes}
        />
        <MeetingTipsCard />
      </div>
    </div>
  );
}
