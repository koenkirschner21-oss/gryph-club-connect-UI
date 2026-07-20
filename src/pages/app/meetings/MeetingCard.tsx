import { useEffect, useRef, useState } from "react";
import { Link2, MapPin, MoreHorizontal, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { useClubMembers } from "../../../hooks/useClubMembers";
import {
  inviteeCountLabel,
  meetingStatusLabel,
  parseAgendaItems,
  parseMeetingNotes,
  type MeetingType,
} from "../../../lib/meetingMetadata";
import {
  CARD_BG,
  CARD_BORDER,
  primaryButtonStyle,
} from "./meetingStyles";
import type { ClubMeeting } from "./meetingTypes";
import { MEETING_TYPE_COLORS } from "./meetingTypes";
import { formatMeetingDateTime, meetingTypeLabel } from "./meetingUtils";

export function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const colors = MEETING_TYPE_COLORS[type];
  return (
    <span
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        borderRadius: "4px",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {meetingTypeLabel(type)}
    </span>
  );
}

export function StatusBadge({ meeting }: { meeting: ClubMeeting }) {
  const label = meetingStatusLabel(meeting.status, meeting.date);
  const colors =
    label === "Cancelled"
      ? { bg: "#1a1a1a", border: "#333333", color: "#777777" }
      : label === "Completed"
        ? { bg: "rgba(34,197,94,0.1)", border: "#22c55e", color: "#4ade80" }
        : { bg: "#1a1a1a", border: "#555555", color: "#999999" };

  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: colors.color,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "4px",
        padding: "2px 8px",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function MeetingCardMenu({
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
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Meeting options"
        onClick={() => setOpen((value) => !value)}
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
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          <button type="button" onClick={() => { setOpen(false); onEdit(); }} style={menuItemStyle}>
            Edit
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onCancel(); }}
            style={{ ...menuItemStyle, color: "#E51937" }}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

const menuItemStyle = {
  display: "block",
  width: "100%",
  textAlign: "left" as const,
  background: "transparent",
  border: "none",
  color: "#cccccc",
  padding: "10px 14px",
  fontSize: "13px",
  cursor: "pointer",
};

export function MeetingCard({
  meeting,
  clubId,
  isPrivileged,
  onEdit,
  onCancel,
}: {
  meeting: ClubMeeting;
  clubId: string;
  isPrivileged: boolean;
  onEdit: (meeting: ClubMeeting) => void;
  onCancel: (meeting: ClubMeeting) => void;
}) {
  const { members } = useClubMembers(clubId);
  const { metadata } = parseMeetingNotes(meeting.notes);
  const agendaCount = parseAgendaItems(meeting.agenda).length;
  const formatLabel =
    metadata.format === "online"
      ? "Online"
      : metadata.format === "hybrid"
        ? "Hybrid"
        : meeting.location?.trim() || "In-Person";

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <MeetingTypeBadge type={meeting.meetingType} />
          <StatusBadge meeting={meeting} />
        </div>
        {isPrivileged && meeting.status !== "cancelled" ? (
          <MeetingCardMenu onEdit={() => onEdit(meeting)} onCancel={() => onCancel(meeting)} />
        ) : null}
      </div>

      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
          {meeting.title}
        </h3>
        <p style={{ margin: 0, fontSize: "13px", color: "#999999" }}>
          {formatMeetingDateTime(meeting.date)}
        </p>
      </div>

      <p style={{ margin: 0, fontSize: "13px", color: "#777777", display: "flex", alignItems: "center", gap: "6px" }}>
        {metadata.format === "online" || metadata.format === "hybrid" ? (
          <>
            <Video size={14} aria-hidden />
            {formatLabel}
            <Link2 size={12} aria-hidden style={{ color: "#555555" }} />
          </>
        ) : (
          <>
            <MapPin size={14} aria-hidden />
            {meeting.location?.trim() || "In-Person"}
          </>
        )}
      </p>

      <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
        {inviteeCountLabel(metadata.inviteeGroup, members, metadata.customInviteeIds)}
      </p>

      {agendaCount > 0 ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
          {agendaCount} agenda item{agendaCount === 1 ? "" : "s"}
        </p>
      ) : null}

      {meeting.actionItemCount > 0 ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
          {meeting.actionItemCount} action item{meeting.actionItemCount === 1 ? "" : "s"}
        </p>
      ) : null}

      <Link
        to={`/app/clubs/${clubId}/meetings/${meeting.id}`}
        style={{
          ...primaryButtonStyle,
          textDecoration: "none",
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        View Meeting
      </Link>
    </div>
  );
}
