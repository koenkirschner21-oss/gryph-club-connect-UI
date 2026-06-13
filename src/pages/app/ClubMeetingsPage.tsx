import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Link2,
  MapPin,
  MoreHorizontal,
  Plus,
  Video,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { isPrivilegedClubRole } from "../../lib/clubRoles";
import { formatNameWithRoleTitle } from "../../lib/memberRoleTitle";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole } from "../../types";
import Spinner from "../../components/ui/Spinner";

type MeetingType =
  | "general"
  | "executive"
  | "committee"
  | "event_planning"
  | "hiring"
  | "other";

type MeetingStatus = "upcoming" | "completed" | "cancelled";
type RecurrencePattern = "weekly" | "biweekly" | "monthly";
type ActionItemStatus = "pending" | "completed";

interface ClubMeeting {
  id: string;
  clubId: string;
  title: string;
  meetingType: MeetingType;
  date: string;
  location: string | null;
  meetingLink: string | null;
  agenda: string | null;
  notes: string | null;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | null;
  status: MeetingStatus;
  createdBy: string | null;
  createdAt: string;
  actionItemCount: number;
}

interface MeetingActionItem {
  id: string;
  meetingId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  linkedTaskId: string | null;
  createdAt: string;
}

interface MeetingFormState {
  title: string;
  meetingType: MeetingType;
  date: string;
  time: string;
  location: string;
  meetingLink: string;
  agenda: string;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | "";
}

const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "executive", label: "Executive" },
  { value: "committee", label: "Committee" },
  { value: "event_planning", label: "Event Planning" },
  { value: "hiring", label: "Hiring" },
  { value: "other", label: "Other" },
];

const MEETING_TYPE_COLORS: Record<
  MeetingType,
  { bg: string; border: string; color: string }
> = {
  general: { bg: "rgba(59,130,246,0.12)", border: "#3b82f6", color: "#60a5fa" },
  executive: { bg: "rgba(229,25,55,0.12)", border: "#E51937", color: "#E51937" },
  committee: { bg: "rgba(255,196,41,0.12)", border: "#FFC429", color: "#FFC429" },
  event_planning: {
    bg: "rgba(168,85,247,0.12)",
    border: "#a855f7",
    color: "#c084fc",
  },
  hiring: { bg: "rgba(34,197,94,0.12)", border: "#22c55e", color: "#4ade80" },
  other: { bg: "rgba(119,119,119,0.12)", border: "#555555", color: "#999999" },
};

const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#ffffff",
  fontSize: "13px",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "#888888",
  marginBottom: "6px",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
};

const modalPanelStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "520px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
};

const primaryButtonStyle: CSSProperties = {
  background: "#E51937",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const outlineButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  color: "#cccccc",
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
};

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function mapMeetingRow(
  row: Record<string, unknown>,
  actionItemCount = 0,
): ClubMeeting {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    meetingType: (row.meeting_type as MeetingType) ?? "general",
    date: row.date as string,
    location: (row.location as string | null) ?? null,
    meetingLink: (row.meeting_link as string | null) ?? null,
    agenda: (row.agenda as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    isRecurring: Boolean(row.is_recurring),
    recurrencePattern: (row.recurrence_pattern as RecurrencePattern | null) ?? null,
    status: (row.status as MeetingStatus) ?? "upcoming",
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
    actionItemCount,
  };
}

function mapActionItemRow(row: Record<string, unknown>): MeetingActionItem {
  const profileRaw = row.assignee;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
  return {
    id: row.id as string,
    meetingId: row.meeting_id as string,
    title: (row.title as string) ?? "",
    assigneeId: (row.assignee_id as string | null) ?? null,
    assigneeName: ((profile as { full_name?: string } | null)?.full_name ?? null),
    dueDate: (row.due_date as string | null) ?? null,
    status: (row.status as ActionItemStatus) ?? "pending",
    linkedTaskId: (row.linked_task_id as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
  };
}

function meetingTypeLabel(type: MeetingType): string {
  return MEETING_TYPES.find((t) => t.value === type)?.label ?? "General";
}

function formatMeetingDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function splitDateTime(iso: string): { date: string; time: string } {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "", time: "18:00" };
  }
  const date = parsed.toISOString().slice(0, 10);
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return { date, time: `${hours}:${minutes}` };
}

function combineDateTime(date: string, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setHours(hours || 0, minutes || 0, 0, 0);
  return parsed.toISOString();
}

function meetingLinkButtonLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("teams.microsoft.com") || lower.includes("teams.live.com")) {
    return "Open in Teams";
  }
  if (lower.includes("zoom.us")) return "Open in Zoom";
  if (lower.includes("meet.google.com")) return "Open in Google Meet";
  return "Open Meeting Link";
}

function isMeetingPast(meeting: ClubMeeting): boolean {
  if (meeting.status === "completed" || meeting.status === "cancelled") return true;
  return new Date(meeting.date).getTime() < Date.now();
}

function emptyForm(): MeetingFormState {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    title: "",
    meetingType: "general",
    date: tomorrow.toISOString().slice(0, 10),
    time: "18:00",
    location: "",
    meetingLink: "",
    agenda: "",
    isRecurring: false,
    recurrencePattern: "",
  };
}

function MeetingTypeBadge({ type }: { type: MeetingType }) {
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
        onClick={() => setOpen((v) => !v)}
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
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              color: "#cccccc",
              padding: "10px 14px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCancel();
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              color: "#E51937",
              padding: "10px 14px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MeetingCard({
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
  const locationOrLink = meeting.meetingLink?.trim()
    ? null
    : meeting.location?.trim() || null;

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
        <MeetingTypeBadge type={meeting.meetingType} />
        {isPrivileged && meeting.status !== "cancelled" ? (
          <MeetingCardMenu
            onEdit={() => onEdit(meeting)}
            onCancel={() => onCancel(meeting)}
          />
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

      {meeting.meetingLink?.trim() ? (
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
          <Video size={14} aria-hidden />
          Online
          <Link2 size={12} aria-hidden style={{ color: "#555555" }} />
        </p>
      ) : locationOrLink ? (
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
          <MapPin size={14} aria-hidden />
          {locationOrLink}
        </p>
      ) : null}

      {meeting.status === "cancelled" ? (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#777777",
            background: "#1a1a1a",
            border: "1px solid #333333",
            borderRadius: "4px",
            padding: "2px 8px",
            alignSelf: "flex-start",
          }}
        >
          Cancelled
        </span>
      ) : null}

      {meeting.actionItemCount > 0 ? (
        <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
          {meeting.actionItemCount} action item{meeting.actionItemCount === 1 ? "" : "s"}
        </p>
      ) : null}

      <Link
        to={`/app/clubs/${clubId}/meetings/${meeting.id}`}
        style={{
          ...outlineButtonStyle,
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

function MeetingFormModal({
  open,
  initial,
  editingId,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: MeetingFormState;
  editingId: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: MeetingFormState) => void;
}) {
  const [form, setForm] = useState<MeetingFormState>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div style={modalOverlayStyle} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-form-title"
        style={modalPanelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 id="meeting-form-title" style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>
            {editingId ? "Edit Meeting" : "New Meeting"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#777777", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle} htmlFor="meeting-title">Title</label>
            <input
              id="meeting-title"
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Weekly exec meeting"
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="meeting-type">Meeting Type</label>
            <select
              id="meeting-type"
              style={inputStyle}
              value={form.meetingType}
              onChange={(e) =>
                setForm((f) => ({ ...f, meetingType: e.target.value as MeetingType }))
              }
            >
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle} htmlFor="meeting-date">Date</label>
              <input
                id="meeting-date"
                type="date"
                style={inputStyle}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="meeting-time">Time</label>
              <input
                id="meeting-time"
                type="time"
                style={inputStyle}
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="meeting-location">Location</label>
            <input
              id="meeting-location"
              style={inputStyle}
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Example: University Centre Room 103"
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="meeting-link">Meeting Link</label>
            <input
              id="meeting-link"
              style={inputStyle}
              value={form.meetingLink}
              onChange={(e) => setForm((f) => ({ ...f, meetingLink: e.target.value }))}
              placeholder="Paste Teams, Zoom, Google Meet, or other link"
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="meeting-agenda">Agenda</label>
            <textarea
              id="meeting-agenda"
              style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
              value={form.agenda}
              onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              placeholder="Topics to cover in this meeting…"
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "#cccccc",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  isRecurring: e.target.checked,
                  recurrencePattern: e.target.checked ? f.recurrencePattern || "weekly" : "",
                }))
              }
            />
            Is Recurring
          </label>

          {form.isRecurring ? (
            <div>
              <label style={labelStyle} htmlFor="recurrence-pattern">Recurrence Pattern</label>
              <select
                id="recurrence-pattern"
                style={inputStyle}
                value={form.recurrencePattern}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    recurrencePattern: e.target.value as RecurrencePattern,
                  }))
                }
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          ) : null}

          <button
            type="button"
            disabled={saving || !form.title.trim() || !form.date || !form.time}
            onClick={() => onSave(form)}
            style={{
              ...primaryButtonStyle,
              width: "100%",
              marginTop: "8px",
              opacity: saving || !form.title.trim() ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MeetingDetailView({
  clubId,
  meetingId,
  isPrivileged,
  userId,
}: {
  clubId: string;
  meetingId: string;
  isPrivileged: boolean;
  userId: string | undefined;
}) {
  const navigate = useNavigate();
  const { members } = useClubMembers(clubId);
  const [meeting, setMeeting] = useState<ClubMeeting | null>(null);
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendaDraft, setAgendaDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingField, setSavingField] = useState<"agenda" | "notes" | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<MeetingFormState>(emptyForm());
  const [savingMeeting, setSavingMeeting] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  );

  const loadMeeting = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("club_meetings")
      .select("*")
      .eq("id", meetingId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (error || !data) {
      setMeeting(null);
      setLoading(false);
      return;
    }

    const { count } = await supabase
      .from("meeting_action_items")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", meetingId);

    const mapped = mapMeetingRow(data as Record<string, unknown>, count ?? 0);
    setMeeting(mapped);
    setAgendaDraft(mapped.agenda ?? "");
    setNotesDraft(mapped.notes ?? "");
    setLoading(false);
  }, [clubId, meetingId]);

  const loadActionItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("meeting_action_items")
      .select(
        `
        id,
        meeting_id,
        title,
        assignee_id,
        due_date,
        status,
        linked_task_id,
        created_at,
        assignee:profiles!meeting_action_items_assignee_profile_fkey ( full_name )
      `,
      )
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load action items:", error.message);
      const { data: fallback } = await supabase
        .from("meeting_action_items")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      setActionItems((fallback ?? []).map((row) => mapActionItemRow(row as Record<string, unknown>)));
      return;
    }

    setActionItems((data ?? []).map((row) => mapActionItemRow(row as Record<string, unknown>)));
  }, [meetingId]);

  useEffect(() => {
    void loadMeeting();
    void loadActionItems();
  }, [loadMeeting, loadActionItems]);

  const saveAgenda = async () => {
    if (!isPrivileged || !meeting) return;
    setSavingField("agenda");
    const { error } = await supabase
      .from("club_meetings")
      .update({ agenda: agendaDraft.trim() || null })
      .eq("id", meeting.id);
    setSavingField(null);
    if (!error) {
      setMeeting((m) => (m ? { ...m, agenda: agendaDraft.trim() || null } : m));
    }
  };

  const saveNotes = async () => {
    if (!isPrivileged || !meeting) return;
    setSavingField("notes");
    const { error } = await supabase
      .from("club_meetings")
      .update({ notes: notesDraft.trim() || null })
      .eq("id", meeting.id);
    setSavingField(null);
    if (!error) {
      setMeeting((m) => (m ? { ...m, notes: notesDraft.trim() || null } : m));
    }
  };

  const toggleActionItem = async (item: MeetingActionItem) => {
    if (!isPrivileged) return;
    const nextStatus: ActionItemStatus = item.status === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("meeting_action_items")
      .update({ status: nextStatus })
      .eq("id", item.id);
    if (!error) void loadActionItems();
  };

  const addActionItem = async () => {
    if (!isPrivileged || !newItemTitle.trim()) return;
    setAddingItem(true);
    const { error } = await supabase.from("meeting_action_items").insert({
      meeting_id: meetingId,
      title: newItemTitle.trim(),
      assignee_id: newItemAssignee || null,
      due_date: newItemDueDate || null,
    });
    setAddingItem(false);
    if (!error) {
      setNewItemTitle("");
      setNewItemAssignee("");
      setNewItemDueDate("");
      void loadActionItems();
      void loadMeeting();
    }
  };

  const convertToTask = async (item: MeetingActionItem) => {
    if (!isPrivileged || !userId || item.linkedTaskId) return;
    setConvertingId(item.id);
    const { data: taskRow, error: taskError } = await supabase
      .from("tasks")
      .insert({
        club_id: clubId,
        title: item.title,
        description: meeting ? `From meeting: ${meeting.title}` : "",
        status: "todo",
        priority: "medium",
        assigned_to: item.assigneeId,
        due_date: item.dueDate,
        created_by: userId,
      })
      .select("id")
      .single();

    if (taskError || !taskRow) {
      setConvertingId(null);
      return;
    }

    await supabase
      .from("meeting_action_items")
      .update({ linked_task_id: taskRow.id as string })
      .eq("id", item.id);

    setConvertingId(null);
    void loadActionItems();
  };

  const openEditModal = () => {
    if (!meeting) return;
    const { date, time } = splitDateTime(meeting.date);
    setEditForm({
      title: meeting.title,
      meetingType: meeting.meetingType,
      date,
      time,
      location: meeting.location ?? "",
      meetingLink: meeting.meetingLink ?? "",
      agenda: meeting.agenda ?? "",
      isRecurring: meeting.isRecurring,
      recurrencePattern: meeting.recurrencePattern ?? "weekly",
    });
    setEditModalOpen(true);
  };

  const saveMeetingEdit = async (form: MeetingFormState) => {
    if (!meeting) return;
    setSavingMeeting(true);
    const { error } = await supabase
      .from("club_meetings")
      .update({
        title: form.title.trim(),
        meeting_type: form.meetingType,
        date: combineDateTime(form.date, form.time),
        location: form.location.trim() || null,
        meeting_link: form.meetingLink.trim() || null,
        agenda: form.agenda.trim() || null,
        is_recurring: form.isRecurring,
        recurrence_pattern: form.isRecurring ? form.recurrencePattern || null : null,
      })
      .eq("id", meeting.id);
    setSavingMeeting(false);
    if (!error) {
      setEditModalOpen(false);
      void loadMeeting();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading meeting…" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ padding: "24px" }}>
        <p style={{ color: "#777777" }}>Meeting not found.</p>
        <Link to={`/app/clubs/${clubId}/meetings`} style={{ color: "#E51937" }}>
          Back to meetings
        </Link>
      </div>
    );
  }

  return (
    <div style={detailPagePaddingStyle}>
      <button
        type="button"
        onClick={() => navigate(`/app/clubs/${clubId}/meetings`)}
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
        Back to Meetings
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <MeetingTypeBadge type={meeting.meetingType} />
            {meeting.isRecurring && meeting.recurrencePattern ? (
              <span style={{ fontSize: "11px", color: "#777777" }}>
                Repeats {meeting.recurrencePattern}
              </span>
            ) : null}
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
            {meeting.title}
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#999999" }}>
            {formatMeetingDateTime(meeting.date)}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {meeting.meetingLink?.trim() ? (
            <a
              href={meeting.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...primaryButtonStyle,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ExternalLink size={14} aria-hidden />
              {meetingLinkButtonLabel(meeting.meetingLink)}
            </a>
          ) : null}
          {isPrivileged ? (
            <button type="button" style={outlineButtonStyle} onClick={openEditModal}>
              Edit Meeting
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {meeting.location?.trim() && !meeting.meetingLink?.trim() ? (
          <section
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: "10px",
              padding: "16px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#777777", display: "flex", alignItems: "center", gap: "8px" }}>
              <MapPin size={16} aria-hidden />
              {meeting.location}
            </p>
          </section>
        ) : null}

        <section
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>Agenda</h2>
            {isPrivileged ? (
              <button
                type="button"
                style={outlineButtonStyle}
                disabled={savingField === "agenda"}
                onClick={() => void saveAgenda()}
              >
                {savingField === "agenda" ? "Saving…" : "Save"}
              </button>
            ) : null}
          </div>
          {isPrivileged ? (
            <textarea
              style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
              value={agendaDraft}
              onChange={(e) => setAgendaDraft(e.target.value)}
              placeholder="Meeting agenda…"
            />
          ) : (
            <p style={{ margin: 0, fontSize: "14px", color: "#cccccc", whiteSpace: "pre-wrap" }}>
              {meeting.agenda?.trim() || "No agenda yet."}
            </p>
          )}
        </section>

        <section
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>Notes</h2>
            {isPrivileged ? (
              <button
                type="button"
                style={outlineButtonStyle}
                disabled={savingField === "notes"}
                onClick={() => void saveNotes()}
              >
                {savingField === "notes" ? "Saving…" : "Save"}
              </button>
            ) : null}
          </div>
          {isPrivileged ? (
            <textarea
              style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Notes from the meeting…"
            />
          ) : (
            <p style={{ margin: 0, fontSize: "14px", color: "#cccccc", whiteSpace: "pre-wrap" }}>
              {meeting.notes?.trim() || "No notes yet."}
            </p>
          )}
        </section>

        <section
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "10px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>Action Items</h2>
          </div>

          {actionItems.length === 0 ? (
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#777777" }}>No action items yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 0",
                    borderTop: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  {isPrivileged ? (
                    <input
                      type="checkbox"
                      checked={item.status === "completed"}
                      onChange={() => void toggleActionItem(item)}
                      aria-label={`Mark ${item.title} complete`}
                    />
                  ) : (
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: item.status === "completed" ? "#22c55e" : "#555555",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: "160px" }}>
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: item.status === "completed" ? "#777777" : "#ffffff",
                        textDecoration: item.status === "completed" ? "line-through" : "none",
                      }}
                    >
                      {item.title}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
                      {item.assigneeName ?? "Unassigned"}
                      {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                    </p>
                  </div>
                  {isPrivileged && !item.linkedTaskId ? (
                    <button
                      type="button"
                      style={outlineButtonStyle}
                      disabled={convertingId === item.id}
                      onClick={() => void convertToTask(item)}
                    >
                      {convertingId === item.id ? "Converting…" : "Convert to Task"}
                    </button>
                  ) : item.linkedTaskId ? (
                    <Link
                      to={`/app/clubs/${clubId}/tasks`}
                      style={{ ...outlineButtonStyle, textDecoration: "none" }}
                    >
                      View Task
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {isPrivileged ? (
            <div
              style={{
                borderTop: `1px solid ${CARD_BORDER}`,
                paddingTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#ffffff" }}>
                Add Action Item
              </p>
              <input
                style={inputStyle}
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Action item title"
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <select
                  style={inputStyle}
                  value={newItemAssignee}
                  onChange={(e) => setNewItemAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {activeMembers.map((member) => (
                    <option key={member.id} value={member.userId}>
                      {formatNameWithRoleTitle(member.fullName ?? "Member", member.roleTitle)}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  style={inputStyle}
                  value={newItemDueDate}
                  onChange={(e) => setNewItemDueDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                style={{ ...primaryButtonStyle, alignSelf: "flex-start" }}
                disabled={addingItem || !newItemTitle.trim()}
                onClick={() => void addActionItem()}
              >
                {addingItem ? "Adding…" : "Add Action Item"}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <MeetingFormModal
        open={editModalOpen}
        initial={editForm}
        editingId={meeting.id}
        saving={savingMeeting}
        onClose={() => setEditModalOpen(false)}
        onSave={(form) => void saveMeetingEdit(form)}
      />
    </div>
  );
}

const detailPagePaddingStyle: CSSProperties = { padding: "24px 20px" };

export default function ClubMeetingsPage() {
  const { clubId, meetingId } = useParams<{ clubId: string; meetingId?: string }>();
  const { user } = useAuthContext();
  const isMobile = useIsMobile();
  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [meetings, setMeetings] = useState<ClubMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<ClubMeeting | null>(null);
  const [formInitial, setFormInitial] = useState<MeetingFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const isPrivileged = isPrivilegedClubRole(userRole);

  useEffect(() => {
    const previewRole = localStorage.getItem("previewRole");
    if (previewRole) {
      setUserRole(previewRole as MemberRole);
      return;
    }
    const fetchRole = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.role) setUserRole(normalizeUserRole(data.role));
    };
    void fetchRole();
  }, [clubId, user?.id]);

  const loadMeetings = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("club_meetings")
      .select("*")
      .eq("club_id", clubId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Failed to load meetings:", error.message);
      setMeetings([]);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    const meetingIds = rows.map((row) => row.id as string);
    const counts: Record<string, number> = {};

    if (meetingIds.length > 0) {
      const { data: items } = await supabase
        .from("meeting_action_items")
        .select("meeting_id")
        .in("meeting_id", meetingIds);

      for (const item of items ?? []) {
        const id = item.meeting_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }

    setMeetings(
      rows.map((row) =>
        mapMeetingRow(row as Record<string, unknown>, counts[row.id as string] ?? 0),
      ),
    );
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (!meetingId) void loadMeetings();
  }, [loadMeetings, meetingId]);

  const upcomingMeetings = useMemo(
    () => meetings.filter((m) => !isMeetingPast(m)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [meetings],
  );

  const pastMeetings = useMemo(
    () => meetings.filter((m) => isMeetingPast(m)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [meetings],
  );

  const openCreateModal = () => {
    setEditingMeeting(null);
    setFormInitial(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (meeting: ClubMeeting) => {
    const { date, time } = splitDateTime(meeting.date);
    setEditingMeeting(meeting);
    setFormInitial({
      title: meeting.title,
      meetingType: meeting.meetingType,
      date,
      time,
      location: meeting.location ?? "",
      meetingLink: meeting.meetingLink ?? "",
      agenda: meeting.agenda ?? "",
      isRecurring: meeting.isRecurring,
      recurrencePattern: meeting.recurrencePattern ?? "weekly",
    });
    setModalOpen(true);
  };

  const cancelMeeting = async (meeting: ClubMeeting) => {
    if (!window.confirm(`Cancel "${meeting.title}"?`)) return;
    const { error } = await supabase
      .from("club_meetings")
      .update({ status: "cancelled" })
      .eq("id", meeting.id);
    if (!error) void loadMeetings();
  };

  const saveMeeting = async (form: MeetingFormState) => {
    if (!clubId || !user?.id) return;
    setSaving(true);

    const payload = {
      club_id: clubId,
      title: form.title.trim(),
      meeting_type: form.meetingType,
      date: combineDateTime(form.date, form.time),
      location: form.location.trim() || null,
      meeting_link: form.meetingLink.trim() || null,
      agenda: form.agenda.trim() || null,
      is_recurring: form.isRecurring,
      recurrence_pattern: form.isRecurring ? form.recurrencePattern || null : null,
      created_by: user.id,
    };

    if (editingMeeting) {
      const { error } = await supabase
        .from("club_meetings")
        .update({
          title: payload.title,
          meeting_type: payload.meeting_type,
          date: payload.date,
          location: payload.location,
          meeting_link: payload.meeting_link,
          agenda: payload.agenda,
          is_recurring: payload.is_recurring,
          recurrence_pattern: payload.recurrence_pattern,
        })
        .eq("id", editingMeeting.id);
      setSaving(false);
      if (!error) {
        setModalOpen(false);
        void loadMeetings();
      }
      return;
    }

    const { error } = await supabase.from("club_meetings").insert(payload);
    setSaving(false);
    if (!error) {
      setModalOpen(false);
      void loadMeetings();
    }
  };

  if (meetingId && clubId) {
    return (
      <MeetingDetailView
        clubId={clubId}
        meetingId={meetingId}
        isPrivileged={isPrivileged}
        userId={user?.id}
      />
    );
  }

  return (
    <div style={{ padding: isMobile ? "20px 16px" : "24px 28px", maxWidth: "960px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
            Meetings
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
            Organize club meetings, agendas, and action items.
          </p>
        </div>
        {isPrivileged ? (
          <button type="button" style={primaryButtonStyle} onClick={openCreateModal}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Plus size={16} aria-hidden /> New Meeting
            </span>
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading meetings…" />
        </div>
      ) : (
        <>
          <section style={{ marginBottom: "32px" }}>
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                fontWeight: 700,
                color: "#555555",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Upcoming Meetings
            </h2>
            {upcomingMeetings.length === 0 ? (
              <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
                No upcoming meetings scheduled.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                }}
              >
                {upcomingMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    clubId={clubId!}
                    isPrivileged={isPrivileged}
                    onEdit={openEditModal}
                    onCancel={cancelMeeting}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                padding: 0,
                marginBottom: showPast ? "16px" : 0,
              }}
            >
              {showPast ? "Hide past meetings" : "Show past meetings"}
              <ChevronDown
                size={16}
                aria-hidden
                style={{
                  transform: showPast ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              />
            </button>

            {showPast ? (
              pastMeetings.length === 0 ? (
                <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>No past meetings.</p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {pastMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      clubId={clubId!}
                      isPrivileged={isPrivileged}
                      onEdit={openEditModal}
                      onCancel={cancelMeeting}
                    />
                  ))}
                </div>
              )
            ) : null}
          </section>
        </>
      )}

      <MeetingFormModal
        open={modalOpen}
        initial={formInitial}
        editingId={editingMeeting?.id ?? null}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={(form) => void saveMeeting(form)}
      />
    </div>
  );
}
