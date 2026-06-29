import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Calendar, Clock, ExternalLink, MapPin } from "lucide-react";
import EventPlanningTasksSection from "../../../components/club/EventPlanningTasksSection";
import VisibilityBadge from "../../../components/club/VisibilityBadge";
import type { UseClubTasksReturn } from "../../../hooks/useClubTasks";
import { supabase } from "../../../lib/supabaseClient";
import { formatMemberDisplayRole } from "../../../lib/memberRoleTitle";
import { eventCategoryLabel } from "../../../lib/eventCategories";
import {
  CARD_BORDER,
  inputStyle,
  sectionCardStyle,
} from "../meetings/meetingStyles";
import type {
  ClubEvent,
  ClubMember,
  EventRsvp,
  RsvpStatus,
  Task,
  Visibility,
} from "../../../types";

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";

export interface EventRecurringMeta {
  isRecurring: boolean;
  frequency: RecurrenceFrequency | null;
  recurrenceEndDate: string | null;
  parentEventId: string | null;
}

const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
};

function useDebouncedSave(
  value: string,
  onSave: (value: string) => Promise<void>,
  delay = 900,
) {
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void onSave(value).then(() => setSaved(true));
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, onSave, delay]);

  return saved;
}

function formatEventTime(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  const parsed = new Date(`1970-01-01T${raw}`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function cleanEventLocation(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  return raw;
}

function formatEventDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function RsvpStatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          marginBottom: "6px",
        }}
      >
        <span style={{ color: "#aaaaaa" }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{count}</span>
      </div>
      <div
        style={{
          height: "6px",
          background: "#1a1a1a",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "999px",
            transition: "width 0.2s ease",
          }}
        />
      </div>
    </div>
  );
}

type AttendeeFilterTab = "all" | "going" | "maybe" | "not_going" | "no_response";

const ATTENDEE_FILTER_TABS: { id: AttendeeFilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "going", label: "Going" },
  { id: "maybe", label: "Maybe" },
  { id: "not_going", label: "Not Going" },
  { id: "no_response", label: "No Response" },
];

type AttendeeListItem =
  | { kind: "rsvp"; attendee: EventRsvp; member?: ClubMember }
  | { kind: "no_response"; member: ClubMember };

function AttendeeRow({
  item,
}: {
  item: AttendeeListItem;
}) {
  const statusColors: Record<RsvpStatus, { bg: string; color: string; border: string }> = {
    going: { bg: "#1a1200", color: "#FFC429", border: "1px solid #FFC429" },
    maybe: { bg: "#1a1a1a", color: "#aaaaaa", border: "1px solid #555555" },
    not_going: { bg: "#1a0505", color: "#E51937", border: "1px solid #E51937" },
  };

  const name =
    item.kind === "rsvp"
      ? item.attendee.fullName ?? item.member?.fullName ?? "Unknown"
      : item.member.fullName ?? "Member";
  const avatarUrl =
    item.kind === "rsvp" ? item.attendee.avatarUrl ?? item.member?.avatarUrl : item.member.avatarUrl;
  const subtitle =
    item.kind === "rsvp"
      ? formatMemberDisplayRole(item.member?.role ?? "member", item.member?.roleTitle)
      : formatMemberDisplayRole(item.member.role, item.member.roleTitle);
  const statusLabel =
    item.kind === "no_response"
      ? "No Response"
      : item.attendee.status === "going"
        ? "Going"
        : item.attendee.status === "maybe"
          ? "Maybe"
          : "Not Going";
  const statusStyle =
    item.kind === "no_response"
      ? { bg: "#141414", color: "#777777", border: "1px solid #333333" }
      : statusColors[item.attendee.status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 0",
        borderTop: `1px solid ${CARD_BORDER}`,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#1a0505",
            color: "#E51937",
            fontSize: "13px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {name[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </p>
        {subtitle ? (
          <p
            style={{
              fontSize: "11px",
              color: "#555555",
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <span
        style={{
          flexShrink: 0,
          borderRadius: "20px",
          padding: "3px 10px",
          fontSize: "10px",
          fontWeight: 600,
          background: statusStyle.bg,
          color: statusStyle.color,
          border: statusStyle.border,
        }}
      >
        {statusLabel}
      </span>
    </div>
  );
}

export function EventManageView({
  event,
  category,
  recurringMeta,
  isRecurring,
  isPrivileged,
  isMobile,
  counts,
  attendeeList,
  planningTasks,
  members,
  createTask,
  updateTask,
  deleteTask,
  onFeedback,
  onEdit,
  onBack,
  focusRsvpPanel,
  onRsvpPanelFocused,
  initialPlanningQuickAdd,
  onPlanningQuickAddOpened,
  loadAttendees,
}: {
  event: ClubEvent;
  category: string;
  recurringMeta?: EventRecurringMeta;
  isRecurring: boolean;
  isPrivileged: boolean;
  isMobile: boolean;
  counts: { going: number; maybe: number; not_going: number };
  attendeeList?: EventRsvp[];
  planningTasks: Task[];
  members: ClubMember[];
  createTask: UseClubTasksReturn["createTask"];
  updateTask: UseClubTasksReturn["updateTask"];
  deleteTask: UseClubTasksReturn["deleteTask"];
  onFeedback: (message: { type: "success" | "error"; text: string }) => void;
  onEdit: (event: ClubEvent) => void;
  onBack: () => void;
  focusRsvpPanel?: boolean;
  onRsvpPanelFocused?: () => void;
  initialPlanningQuickAdd?: boolean;
  onPlanningQuickAddOpened?: () => void;
  loadAttendees: (eventId: string) => Promise<void>;
}) {
  const rsvpPanelRef = useRef<HTMLElement>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesReady, setNotesReady] = useState(false);
  const [attendeeFilter, setAttendeeFilter] = useState<AttendeeFilterTab>("all");

  const timeLabel = formatEventTime(event.time);
  const locationLabel = cleanEventLocation(event.location);
  const categoryLabel = eventCategoryLabel(category);
  const totalRsvps = counts.going + counts.maybe + counts.not_going;
  const openPlanningCount = planningTasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  ).length;

  useEffect(() => {
    void loadAttendees(event.id);
  }, [event.id, loadAttendees]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("notes")
        .eq("id", event.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("Failed to load event notes:", error.message);
        setNotesReady(true);
        return;
      }
      setNotesDraft((data?.notes as string) ?? "");
      setNotesReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  useEffect(() => {
    if (!focusRsvpPanel || !rsvpPanelRef.current) return;
    rsvpPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    onRsvpPanelFocused?.();
  }, [focusRsvpPanel, onRsvpPanelFocused]);

  const saveNotes = useCallback(
    async (value: string) => {
      if (!isPrivileged) return;
      const { error } = await supabase
        .from("events")
        .update({ notes: value })
        .eq("id", event.id);
      if (error) {
        console.error("Failed to save event notes:", error.message);
      }
    },
    [isPrivileged, event.id],
  );

  const notesSaved = useDebouncedSave(notesReady ? notesDraft : "", saveNotes);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ClubMember>();
    for (const member of members) {
      map.set(member.userId, member);
    }
    return map;
  }, [members]);

  const noResponseCount = useMemo(() => {
    const responded = new Set((attendeeList ?? []).map((row) => row.userId));
    return members.filter((member) => !responded.has(member.userId)).length;
  }, [attendeeList, members]);

  const attendeeRows = useMemo((): AttendeeListItem[] => {
    const rsvpRows: AttendeeListItem[] = (attendeeList ?? []).map((attendee) => ({
      kind: "rsvp" as const,
      attendee,
      member: memberByUserId.get(attendee.userId),
    }));
    const respondedIds = new Set((attendeeList ?? []).map((row) => row.userId));
    const noResponseRows: AttendeeListItem[] = members
      .filter((member) => !respondedIds.has(member.userId))
      .map((member) => ({ kind: "no_response" as const, member }));

    const statusOrder: Record<RsvpStatus, number> = {
      going: 0,
      maybe: 1,
      not_going: 2,
    };

    const allRows = [...rsvpRows, ...noResponseRows].sort((left, right) => {
      const leftOrder =
        left.kind === "rsvp" ? statusOrder[left.attendee.status] : 3;
      const rightOrder =
        right.kind === "rsvp" ? statusOrder[right.attendee.status] : 3;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      const leftName =
        left.kind === "rsvp"
          ? left.attendee.fullName ?? ""
          : left.member.fullName ?? "";
      const rightName =
        right.kind === "rsvp"
          ? right.attendee.fullName ?? ""
          : right.member.fullName ?? "";
      return leftName.localeCompare(rightName);
    });

    switch (attendeeFilter) {
      case "going":
        return rsvpRows.filter(
          (row): row is Extract<AttendeeListItem, { kind: "rsvp" }> =>
            row.kind === "rsvp" && row.attendee.status === "going",
        );
      case "maybe":
        return rsvpRows.filter(
          (row): row is Extract<AttendeeListItem, { kind: "rsvp" }> =>
            row.kind === "rsvp" && row.attendee.status === "maybe",
        );
      case "not_going":
        return rsvpRows.filter(
          (row): row is Extract<AttendeeListItem, { kind: "rsvp" }> =>
            row.kind === "rsvp" && row.attendee.status === "not_going",
        );
      case "no_response":
        return noResponseRows;
      default:
        return allRows;
    }
  }, [attendeeFilter, attendeeList, memberByUserId, members]);

  const recurrenceEndLabel = recurringMeta?.recurrenceEndDate
    ? new Date(recurringMeta.recurrenceEndDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div style={{ width: "100%", maxWidth: "none" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "transparent",
          border: "none",
          color: "#777777",
          cursor: "pointer",
          fontSize: "13px",
          marginBottom: "20px",
          padding: 0,
        }}
      >
        <ArrowLeft size={16} aria-hidden />
        Back to Events
      </button>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ flex: 1, minWidth: "240px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "8px",
            }}
          >
            {categoryLabel ? (
              <span
                style={{
                  background: "#1a1a1a",
                  border: `1px solid ${CARD_BORDER}`,
                  color: "#777777",
                  borderRadius: "20px",
                  padding: "3px 10px",
                  fontSize: "11px",
                  fontWeight: 500,
                }}
              >
                {categoryLabel}
              </span>
            ) : null}
            <VisibilityBadge visibility={(event.visibility ?? "public") as Visibility} />
            {isRecurring ? (
              <span style={{ fontSize: "11px", color: "#777777" }}>Recurring</span>
            ) : null}
          </div>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: isMobile ? "22px" : "26px",
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            {event.title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#999999",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Calendar size={14} color="#555555" aria-hidden />
              {formatEventDate(event.date)}
            </span>
            {timeLabel ? (
              <>
                <span style={{ color: "#444444" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={14} color="#555555" aria-hidden />
                  {timeLabel}
                </span>
              </>
            ) : null}
            {locationLabel ? (
              <>
                <span style={{ color: "#444444" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={14} color="#555555" aria-hidden />
                  {locationLabel}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {isPrivileged ? (
          <button
            type="button"
            onClick={() => onEdit(event)}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Edit Event
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(320px, 380px)",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div>
          <section style={{ ...sectionCardStyle, marginBottom: "16px" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "15px",
                fontWeight: 600,
                color: "#ffffff",
              }}
            >
              Description
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: event.description?.trim() ? "#cccccc" : "#555555",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {event.description?.trim() || "No description provided."}
            </p>
            {isRecurring && recurringMeta ? (
              <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#555555" }}>
                Recurring
                {recurringMeta.frequency
                  ? `: ${RECURRENCE_LABELS[recurringMeta.frequency]}`
                  : ""}
                {recurrenceEndLabel ? ` · until ${recurrenceEndLabel}` : ""}
              </p>
            ) : null}
            {locationLabel && isUrl(locationLabel) ? (
              <p style={{ margin: "8px 0 0", fontSize: "12px" }}>
                <a
                  href={locationLabel}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#E51937",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  Open location link
                  <ExternalLink size={13} aria-hidden />
                </a>
              </p>
            ) : null}
          </section>

          {isPrivileged ? (
            <div style={{ marginBottom: "16px" }}>
              <EventPlanningTasksSection
                clubId={event.clubId ?? ""}
                eventId={event.id}
                eventTitle={event.title}
                planningTasks={planningTasks}
                members={members}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                onFeedback={onFeedback}
                initialQuickAddOpen={initialPlanningQuickAdd}
                onQuickAddOpened={onPlanningQuickAddOpened}
              />
            </div>
          ) : null}

          <section style={sectionCardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                Notes / Recap
              </h2>
              {isPrivileged ? (
                <span
                  style={{
                    fontSize: "11px",
                    color: notesSaved ? "#4ade80" : "#777777",
                  }}
                >
                  {notesSaved ? "Saved" : "Saving…"}
                </span>
              ) : null}
            </div>
            {isPrivileged ? (
              <textarea
                style={{ ...inputStyle, minHeight: "140px", resize: "vertical" }}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Post-event notes, recap, follow-ups…"
              />
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#cccccc",
                  whiteSpace: "pre-wrap",
                }}
              >
                {notesDraft.trim() || "No notes yet."}
              </p>
            )}
          </section>
        </div>

        <section
          ref={rsvpPanelRef}
          style={{
            ...sectionCardStyle,
            position: isMobile ? "static" : "sticky",
            top: isMobile ? undefined : "16px",
          }}
        >
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "16px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            Attendees
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#555555" }}>
            {totalRsvps} responded · {noResponseCount} no response
            {openPlanningCount > 0 ? ` · ${openPlanningCount} open planning tasks` : ""}
          </p>

          <RsvpStatusBar
            label="Going"
            count={counts.going}
            total={Math.max(totalRsvps, 1)}
            color="#E51937"
          />
          <RsvpStatusBar
            label="Maybe"
            count={counts.maybe}
            total={Math.max(totalRsvps, 1)}
            color="#FFC429"
          />
          <RsvpStatusBar
            label="Not Going"
            count={counts.not_going}
            total={Math.max(totalRsvps, 1)}
            color="#777777"
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              margin: "18px 0 12px",
            }}
          >
            {ATTENDEE_FILTER_TABS.map((tab) => {
              const active = attendeeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAttendeeFilter(tab.id)}
                  style={{
                    background: active ? "#E51937" : "transparent",
                    color: active ? "#ffffff" : "#777777",
                    border: active ? "1px solid #E51937" : "1px solid #333333",
                    borderRadius: "20px",
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {attendeeRows.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13px", color: "#555555" }}>
              No attendees in this view.
            </p>
          ) : (
            attendeeRows.map((row) => (
              <AttendeeRow
                key={
                  row.kind === "rsvp"
                    ? row.attendee.id
                    : `no-response-${row.member.userId}`
                }
                item={row}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}
