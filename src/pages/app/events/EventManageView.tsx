import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { MoreHorizontal } from "lucide-react";
import EventPlanningTasksSection from "../../../components/club/EventPlanningTasksSection";
import PublicDetailBackButton from "../../../components/public/PublicDetailBackButton";
import {
  EventDetailBadges,
  EventDetailClubHeader,
  EventDetailDescription,
  EventDetailMeta,
  EventDetailMyRsvp,
  EventDetailPageShell,
  EventDetailPrimaryAction,
  EventDetailPublicLink,
  EventDetailRsvpSummary,
  EventDetailTitle,
  EventDetailTwoColumn,
} from "../../../components/events/EventDetailLayout";
import type { UseClubTasksReturn } from "../../../hooks/useClubTasks";
import { supabase } from "../../../lib/supabaseClient";
import { formatMemberDisplayRole } from "../../../lib/memberRoleTitle";
import { eventCategoryLabel } from "../../../lib/eventCategories";
import type { RsvpAccessResult } from "../../../lib/eventRsvpUtils";
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

const menuButtonStyle = {
  width: "100%",
  textAlign: "left" as const,
  background: "transparent",
  border: "none",
  color: "#cccccc",
  padding: "9px 12px",
  fontSize: "12px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryActionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  background: "transparent",
  color: "#cccccc",
  border: "1px solid #333333",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  width: "100%",
};

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

function cleanEventLocation(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  return raw;
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

type AttendeeFilterTab = "all" | "pending" | "going" | "maybe" | "not_going" | "no_response";

const ATTENDEE_FILTER_TABS: { id: AttendeeFilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
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
  canReview,
  reviewBusy,
  onApprove,
  onReject,
  hasSignupResponse,
  onViewSignupResponses,
}: {
  item: AttendeeListItem;
  canReview: boolean;
  reviewBusy: boolean;
  onApprove?: (rsvpId: string) => void;
  onReject?: (rsvpId: string) => void;
  hasSignupResponse?: boolean;
  onViewSignupResponses?: () => void;
}) {
  const statusColors: Record<RsvpStatus, { bg: string; color: string; border: string }> = {
    going: { bg: "#1a1200", color: "#FFC429", border: "1px solid #FFC429" },
    maybe: { bg: "#1a1a1a", color: "#aaaaaa", border: "1px solid #555555" },
    not_going: { bg: "#1a0505", color: "#E51937", border: "1px solid #E51937" },
    pending: { bg: "#1a1005", color: "#FFC429", border: "1px solid #666666" },
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
          : item.attendee.status === "pending"
            ? "Pending Approval"
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
              color: "#8a8a8a",
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </p>
        ) : null}
        {hasSignupResponse && onViewSignupResponses ? (
          <button
            type="button"
            onClick={onViewSignupResponses}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              margin: "2px 0 0",
              color: "#E51937",
              fontSize: "11px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            View Signup Responses
          </button>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
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
        {canReview &&
        item.kind === "rsvp" &&
        item.attendee.status === "pending" &&
        onApprove &&
        onReject ? (
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              disabled={reviewBusy}
              onClick={() => onApprove(item.attendee.id)}
              style={{
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: 600,
                cursor: reviewBusy ? "wait" : "pointer",
              }}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={reviewBusy}
              onClick={() => onReject(item.attendee.id)}
              style={{
                background: "transparent",
                color: "#cccccc",
                border: "1px solid #333333",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: 600,
                cursor: reviewBusy ? "wait" : "pointer",
              }}
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>
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
  clubName,
  clubLogoUrl,
  clubAbbreviation,
  clubSlug,
  myRsvpStatus,
  rsvpAccess,
  publicEventPath,
  onRsvp,
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
  onApproveSignup,
  onRejectSignup,
  reviewBusyRsvpId,
  copiedEventId,
  onCopyRsvpLink,
  onDelete,
  signupQuestions,
  onOpenResponses,
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
  clubName: string;
  clubLogoUrl?: string;
  clubAbbreviation?: string;
  clubSlug?: string;
  myRsvpStatus?: RsvpStatus;
  rsvpAccess: RsvpAccessResult;
  publicEventPath?: string;
  onRsvp?: (eventId: string, status: RsvpStatus) => void;
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
  onApproveSignup?: (rsvpId: string) => Promise<void>;
  onRejectSignup?: (rsvpId: string) => Promise<void>;
  reviewBusyRsvpId?: string | null;
  copiedEventId?: string | null;
  onCopyRsvpLink?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  signupQuestions?: Array<{ id: string; question: string }>;
  onOpenResponses?: (event: ClubEvent) => void;
}) {
  const rsvpPanelRef = useRef<HTMLElement>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesReady, setNotesReady] = useState(false);
  const [attendeeFilter, setAttendeeFilter] = useState<AttendeeFilterTab>("all");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [respondedUserIds, setRespondedUserIds] = useState<Set<string>>(new Set());

  const isPast = useMemo(() => {
    const parsed = new Date(`${event.date?.trim() ?? ""}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getTime() < Date.now();
  }, [event.date]);

  const questions = signupQuestions ?? [];
  const hasSignupQuestions = questions.length > 0;

  const locationLabel = cleanEventLocation(event.location);
  const categoryLabel = eventCategoryLabel(category);
  const attendeeStatusCounts = useMemo(() => {
    const derived = { going: 0, maybe: 0, not_going: 0, pending: 0 };
    if (attendeeList?.length) {
      for (const attendee of attendeeList) {
        if (attendee.status === "pending") derived.pending += 1;
        else if (attendee.status in derived) derived[attendee.status] += 1;
      }
      return derived;
    }
    return {
      going: counts.going,
      maybe: counts.maybe,
      not_going: counts.not_going,
      pending: 0,
    };
  }, [attendeeList, counts.going, counts.maybe, counts.not_going]);
  const totalRsvps =
    attendeeStatusCounts.going +
    attendeeStatusCounts.maybe +
    attendeeStatusCounts.not_going +
    attendeeStatusCounts.pending;
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

  useEffect(() => {
    if (!isPrivileged || !hasSignupQuestions) {
      setRespondedUserIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("event_form_responses")
        .select("user_id")
        .eq("event_id", event.id);
      if (cancelled) return;
      if (error) {
        console.error("Failed to load signup response count:", error.message);
        return;
      }
      setRespondedUserIds(new Set((data ?? []).map((row) => row.user_id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id, isPrivileged, hasSignupQuestions]);

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
      pending: 2,
      not_going: 3,
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
      case "pending":
        return rsvpRows.filter(
          (row): row is Extract<AttendeeListItem, { kind: "rsvp" }> =>
            row.kind === "rsvp" && row.attendee.status === "pending",
        );
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
  const recurrenceDetail =
    recurringMeta?.frequency && RECURRENCE_LABELS[recurringMeta.frequency]
      ? `${RECURRENCE_LABELS[recurringMeta.frequency]}${recurrenceEndLabel ? ` until ${recurrenceEndLabel}` : ""}`
      : recurrenceEndLabel
        ? `until ${recurrenceEndLabel}`
        : undefined;

  const showPublicLink =
    publicEventPath &&
    (event.visibility === "public" || !event.visibility);

  const totalSignupResponses = respondedUserIds.size;
  const awaitingSignupResponseCount = Math.max(
    totalRsvps - totalSignupResponses,
    0,
  );
  const signupQuestionsSummary = questions
    .slice(0, 3)
    .map((q) => q.question)
    .join(" · ");

  const primaryAction = (() => {
    if (isPrivileged) return null;
    if (rsvpAccess.showRsvpButton && onRsvp) {
      if (myRsvpStatus === "going") {
        return (
          <EventDetailPrimaryAction
            label="Going"
            variant="going"
            showCheck
            onClick={() => onRsvp(event.id, "going")}
          />
        );
      }
      if (myRsvpStatus === "maybe") {
        return (
          <EventDetailPrimaryAction
            label="Maybe"
            variant="secondary"
            onClick={() => onRsvp(event.id, "maybe")}
          />
        );
      }
      if (myRsvpStatus === "not_going") {
        return (
          <EventDetailPrimaryAction
            label="Not Going"
            variant="secondary"
            onClick={() => onRsvp(event.id, "not_going")}
          />
        );
      }
      return (
        <EventDetailPrimaryAction
          label="RSVP"
          onClick={() => onRsvp(event.id, "going")}
        />
      );
    }
    return null;
  })();

  const linkedWorkSection = (
    <section style={sectionCardStyle}>
      <h2 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
        Linked Work
      </h2>
      <p style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>
        {planningTasks.length} planning task{planningTasks.length === 1 ? "" : "s"}
        {" · "}
        {openPlanningCount} open
      </p>
    </section>
  );

  const rsvpResponsesPanel =
    isPrivileged && hasSignupQuestions ? (
      <section ref={rsvpPanelRef} style={sectionCardStyle}>
        <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
          RSVP Responses
        </h2>
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#999999" }}>
          {totalSignupResponses} response{totalSignupResponses === 1 ? "" : "s"} ·{" "}
          {awaitingSignupResponseCount} awaiting response
        </p>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "13px",
            color: "#cccccc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {questions.length} question{questions.length === 1 ? "" : "s"}
          {signupQuestionsSummary ? `: ${signupQuestionsSummary}` : ""}
        </p>
        <button
          type="button"
          onClick={() => onOpenResponses?.(event)}
          style={{ ...secondaryActionButtonStyle, width: "auto" }}
        >
          Review RSVP Responses
        </button>
      </section>
    ) : null;

  const attendeeSidebarPanel = isPrivileged ? (
    <section style={sectionCardStyle}>
      <h2
        style={{
          margin: "0 0 4px",
          fontSize: "15px",
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        Attendees
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#999999" }}>
        {totalRsvps} responded · {noResponseCount} no response
        {attendeeStatusCounts.pending > 0
          ? ` · ${attendeeStatusCounts.pending} pending approval`
          : ""}
      </p>

      {attendeeStatusCounts.pending > 0 ? (
        <RsvpStatusBar
          label="Pending Approval"
          count={attendeeStatusCounts.pending}
          total={Math.max(totalRsvps, 1)}
          color="#FFC429"
        />
      ) : null}
      <RsvpStatusBar
        label="Going"
        count={attendeeStatusCounts.going}
        total={Math.max(totalRsvps, 1)}
        color="#E51937"
      />
      <RsvpStatusBar
        label="Maybe"
        count={attendeeStatusCounts.maybe}
        total={Math.max(totalRsvps, 1)}
        color="#FFC429"
      />
      <RsvpStatusBar
        label="Not Going"
        count={attendeeStatusCounts.not_going}
        total={Math.max(totalRsvps, 1)}
        color="#777777"
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          margin: "16px 0 10px",
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
                color: active ? "#ffffff" : "#999999",
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

      <div style={{ maxHeight: "420px", overflowY: "auto" }}>
        {attendeeRows.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#888888" }}>
            No attendees in this view.
          </p>
        ) : (
          attendeeRows.map((row) => {
            const userId = row.kind === "rsvp" ? row.attendee.userId : row.member.userId;
            return (
              <AttendeeRow
                key={
                  row.kind === "rsvp"
                    ? row.attendee.id
                    : `no-response-${row.member.userId}`
                }
                item={row}
                canReview={isPrivileged}
                reviewBusy={reviewBusyRsvpId === (row.kind === "rsvp" ? row.attendee.id : "")}
                onApprove={onApproveSignup}
                onReject={onRejectSignup}
                hasSignupResponse={hasSignupQuestions && respondedUserIds.has(userId)}
                onViewSignupResponses={() => onOpenResponses?.(event)}
              />
            );
          })
        )}
      </div>
    </section>
  ) : null;

  const eventActionsCard = isPrivileged ? (
    <section style={sectionCardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#999999", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Event Actions
        </h2>
        {onDelete ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              aria-label="More event actions"
              onClick={() => setActionsMenuOpen((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                color: "#888888",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "2px",
              }}
            >
              <MoreHorizontal size={16} />
            </button>
            {actionsMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "4px",
                  background: "#151515",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "8px",
                  minWidth: "150px",
                  zIndex: 20,
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    onDelete(event.id);
                  }}
                  style={{ ...menuButtonStyle, color: "#E51937" }}
                >
                  Delete Event
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <EventDetailPrimaryAction label="Edit Event" onClick={() => onEdit(event)} />
        <button
          type="button"
          onClick={() => onCopyRsvpLink?.(event.id)}
          style={secondaryActionButtonStyle}
        >
          {copiedEventId === event.id ? "Copied!" : "Copy RSVP Link"}
        </button>
        {showPublicLink ? (
          <EventDetailPublicLink href={publicEventPath!} />
        ) : null}
      </div>
    </section>
  ) : null;

  return (
    <EventDetailPageShell maxWidth="1100px">
      <PublicDetailBackButton
        label="Back to Events"
        onBack={onBack}
        style={{ marginBottom: "20px" }}
      />

      <EventDetailClubHeader
        clubName={clubName}
        logoUrl={clubLogoUrl}
        abbreviation={clubAbbreviation}
        clubSlug={clubSlug}
      />

      <EventDetailBadges
        visibility={(event.visibility ?? "public") as Visibility}
        categoryLabel={categoryLabel}
        isRecurring={isRecurring}
        recurrenceDetail={recurrenceDetail}
      />

      <EventDetailTitle title={event.title} size="medium" />

      <EventDetailMeta date={event.date} time={event.time} location={event.location} />

      <EventDetailTwoColumn
        isMobile={isMobile}
        main={
          <>
            <EventDetailDescription description={event.description ?? ""} />
            {locationLabel && isUrl(locationLabel) ? (
              <p style={{ margin: "0 0 16px", fontSize: "13px" }}>
                <a
                  href={locationLabel}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#E51937", textDecoration: "none" }}
                >
                  Open location link
                </a>
              </p>
            ) : null}

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

            {isPrivileged || (notesDraft.trim() && isPast) ? (
            <section style={{ ...sectionCardStyle, marginBottom: "16px" }}>
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
                  {isPast ? "Notes Recap" : "Planning Notes"}
                </h2>
                {isPrivileged ? (
                  <span
                    style={{
                      fontSize: "11px",
                      color: notesSaved ? "#4ade80" : "#999999",
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
                  placeholder={
                    isPast
                      ? "Post-event notes, recap, follow-ups…"
                      : "Planning notes for this event…"
                  }
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
                  {notesDraft.trim()}
                </p>
              )}
            </section>
            ) : null}

            {isPrivileged ? <div style={{ marginBottom: "16px" }}>{linkedWorkSection}</div> : null}

            {rsvpResponsesPanel}
          </>
        }
        sidebar={
          <>
            {eventActionsCard}
            <EventDetailMyRsvp status={myRsvpStatus} />
            <EventDetailRsvpSummary counts={counts} />
            {!isPrivileged ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  width: "100%",
                }}
              >
                {primaryAction}
                {rsvpAccess.blockedMessage ? (
                  <p style={{ margin: 0, fontSize: "13px", color: "#999999" }}>
                    {rsvpAccess.blockedMessage}
                  </p>
                ) : null}
                {showPublicLink ? (
                  <div style={{ width: "100%" }}>
                    <EventDetailPublicLink href={publicEventPath!} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {attendeeSidebarPanel}
          </>
        }
      />
    </EventDetailPageShell>
  );
}
