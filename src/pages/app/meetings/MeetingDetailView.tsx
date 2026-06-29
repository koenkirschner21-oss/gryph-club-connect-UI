import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Link2, MapPin, Trash2, Users, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useClubMembers } from "../../../hooks/useClubMembers";
import { useIsMobile } from "../../../hooks/useWindowWidth";
import { formatNameWithRoleTitle } from "../../../lib/memberRoleTitle";
import {
  inviteeCountLabel,
  isUserInvitedToMeeting,
  parseAgendaItems,
  parseMeetingNotes,
  resolveInviteeUserIds,
  serializeAgendaItems,
  serializeMeetingNotes,
  type MeetingMetadata,
} from "../../../lib/meetingMetadata";
import { supabase } from "../../../lib/supabaseClient";
import type { TaskPriority } from "../../../types";
import { MeetingTypeBadge } from "./MeetingCard";
import { MeetingDateBadge } from "./MeetingsListUI";
import {
  canJoinMeeting,
  formatLinkLocationStatus,
} from "./meetingDisplayHelpers";
import {
  CARD_BG,
  CARD_BORDER,
  inputStyle,
  outlineButtonStyle,
  primaryButtonStyle,
  sectionCardStyle,
} from "./meetingStyles";
import type { ClubMeeting, MeetingActionItem } from "./meetingTypes";
import {
  formatMeetingDateTime,
  mapActionItemRow,
  mapMeetingRow,
  meetingTypeLabel,
} from "./meetingUtils";

function useDebouncedSave(
  value: string,
  onSave: (value: string) => Promise<void>,
  delay = 900,
): "saved" | "saving" | "error" {
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialRef = useRef(true);

  useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }

    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void onSave(value)
        .then(() => setStatus("saved"))
        .catch(() => setStatus("error"));
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, onSave, delay]);

  return status;
}

function saveStatusLabel(status: "saved" | "saving" | "error"): string {
  if (status === "saved") return "Saved";
  if (status === "error") return "Save failed";
  return "Saving…";
}

function saveStatusColor(status: "saved" | "saving" | "error"): string {
  if (status === "saved") return "#4ade80";
  if (status === "error") return "#E51937";
  return "#777777";
}

export function MeetingDetailView({
  clubId,
  meetingId,
  isPrivileged,
  userId,
  onEdit,
}: {
  clubId: string;
  meetingId: string;
  isPrivileged: boolean;
  userId: string | undefined;
  onEdit: (meeting: ClubMeeting) => void;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { members } = useClubMembers(clubId);
  const [meeting, setMeeting] = useState<ClubMeeting | null>(null);
  const [metadata, setMetadata] = useState<MeetingMetadata | null>(null);
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendaItems, setAgendaItems] = useState<string[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [decisionsDraft, setDecisionsDraft] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPriority, setNewItemPriority] = useState<TaskPriority>("medium");
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );

  const canViewMeeting = useMemo(() => {
    if (!meeting || !metadata) return false;
    return isUserInvitedToMeeting(userId, members, metadata, isPrivileged);
  }, [meeting, metadata, userId, members, isPrivileged]);

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

    const { data: itemRows } = await supabase
      .from("meeting_action_items")
      .select("status")
      .eq("meeting_id", meetingId);

    const total = itemRows?.length ?? 0;
    const open =
      itemRows?.filter((row) => (row.status as string) !== "completed").length ?? 0;

    const mapped = mapMeetingRow(data as Record<string, unknown>, total, open);
    const parsedNotes = parseMeetingNotes(mapped.notes);
    setMeeting(mapped);
    setMetadata(parsedNotes.metadata);
    setAgendaItems(parseAgendaItems(mapped.agenda));
    setNotesDraft(parsedNotes.meetingNotes);
    setDecisionsDraft(parsedNotes.metadata.decisions ?? "");
    setLoading(false);
  }, [clubId, meetingId]);

  const loadActionItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("meeting_action_items")
      .select(
        `id, meeting_id, title, description, priority, assignee_id, due_date, status, linked_task_id, created_at,
         assignee:profiles!meeting_action_items_assignee_profile_fkey ( full_name )`,
      )
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (error) {
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

  const saveAgenda = useCallback(
    async (items: string[]) => {
      if (!isPrivileged || !meeting) return;
      const serialized = serializeAgendaItems(items);
      const { error } = await supabase
        .from("club_meetings")
        .update({ agenda: serialized })
        .eq("id", meeting.id);
      if (error) throw error;
      setMeeting((current) => (current ? { ...current, agenda: serialized } : current));
    },
    [isPrivileged, meeting],
  );

  const saveNotesBundle = useCallback(
    async (notes: string, decisions: string) => {
      if (!isPrivileged || !meeting || !metadata) return;
      const nextMetadata: MeetingMetadata = { ...metadata, decisions: decisions.trim() || undefined };
      const serialized = serializeMeetingNotes(nextMetadata, notes);
      const { error } = await supabase
        .from("club_meetings")
        .update({ notes: serialized })
        .eq("id", meeting.id);
      if (error) throw error;
      setMetadata(nextMetadata);
      setMeeting((current) => (current ? { ...current, notes: serialized } : current));
    },
    [isPrivileged, meeting, metadata],
  );

  const agendaSaveStatus = useDebouncedSave(
    JSON.stringify(agendaItems),
    async () => saveAgenda(agendaItems),
  );

  const notesSaveStatus = useDebouncedSave(
    `${notesDraft}|||${decisionsDraft}`,
    async () => saveNotesBundle(notesDraft, decisionsDraft),
  );

  const convertedCount = actionItems.filter((item) => item.linkedTaskId).length;

  const toggleActionItem = async (item: MeetingActionItem) => {
    if (!isPrivileged) return;
    const nextStatus = item.status === "completed" ? "pending" : "completed";
    await supabase.from("meeting_action_items").update({ status: nextStatus }).eq("id", item.id);
    void loadActionItems();
  };

  const addActionItem = async () => {
    if (!isPrivileged || !newItemTitle.trim()) return;
    setAddingItem(true);
    await supabase.from("meeting_action_items").insert({
      meeting_id: meetingId,
      title: newItemTitle.trim(),
      description: newItemDescription.trim(),
      priority: newItemPriority,
      assignee_id: newItemAssignee || null,
      due_date: newItemDueDate || null,
    });
    setAddingItem(false);
    setNewItemTitle("");
    setNewItemDescription("");
    setNewItemPriority("medium");
    setNewItemAssignee("");
    setNewItemDueDate("");
    void loadActionItems();
    void loadMeeting();
  };

  const convertToTask = async (item: MeetingActionItem) => {
    if (!isPrivileged || !userId || item.linkedTaskId || !meeting) return;
    setConvertingId(item.id);
    setConvertError(null);
    const { data: taskRow, error } = await supabase
      .from("tasks")
      .insert({
        club_id: clubId,
        title: item.title,
        description: item.description?.trim()
          ? item.description
          : `From meeting: ${meeting.title}`,
        status: "todo",
        priority: item.priority,
        task_type: "meeting",
        linked_meeting_id: meetingId,
        assigned_to: item.assigneeId,
        due_date: item.dueDate,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !taskRow) {
      setConvertError("Could not create task from this action item. Please try again.");
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

  if (loading) {
    return <div style={{ padding: "48px", textAlign: "center", color: "#777777" }}>Loading meeting…</div>;
  }

  if (!meeting || !metadata) {
    return (
      <div style={{ padding: "24px" }}>
        <p style={{ color: "#777777" }}>Meeting not found.</p>
        <Link to={`/app/clubs/${clubId}/meetings`} style={{ color: "#E51937" }}>Back to meetings</Link>
      </div>
    );
  }

  if (!canViewMeeting) {
    return (
      <div style={{ padding: "24px" }}>
        <p style={{ color: "#777777" }}>You don&apos;t have access to this meeting.</p>
        <Link to={`/app/clubs/${clubId}/meetings`} style={{ color: "#E51937" }}>Back to meetings</Link>
      </div>
    );
  }

  const inviteeLabel = inviteeCountLabel(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds,
  );

  const invitedMemberIds = resolveInviteeUserIds(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds ?? [],
  );
  const invitedMembers = activeMembers.filter((member) =>
    invitedMemberIds.includes(member.userId),
  );

  const meetingFormat = metadata.format ?? "in_person";
  const showJoin = canJoinMeeting(meeting, meetingFormat);
  const formatLabel =
    meetingFormat === "online"
      ? "Online"
      : meetingFormat === "hybrid"
        ? "Hybrid"
        : "In-Person";

  const priorityColor = (priority: TaskPriority) => {
    if (priority === "high") return "#E51937";
    if (priority === "low") return "#777777";
    return "#FFC429";
  };

  return (
    <div style={{ padding: isMobile ? "16px" : "24px", width: "100%" }}>
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
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
          <MeetingDateBadge iso={meeting.date} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
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
              {" · "}
              {formatLabel}
              {" · "}
              {inviteeLabel}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#777777" }}>
              {formatLinkLocationStatus(meeting, meetingFormat)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {showJoin && meeting.meetingLink?.trim() ? (
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
              Join Meeting
            </a>
          ) : null}
          {isPrivileged ? (
            <button type="button" style={outlineButtonStyle} onClick={() => onEdit(meeting)}>
              Edit Meeting
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.5fr) minmax(0, 1fr)",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <div>
          <section style={sectionCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>Agenda</h2>
              {isPrivileged ? (
                <span
                  style={{
                    fontSize: "11px",
                    color: saveStatusColor(agendaSaveStatus),
                  }}
                >
                  {saveStatusLabel(agendaSaveStatus)}
                </span>
              ) : null}
            </div>
            {isPrivileged ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {agendaItems.map((item, index) => (
                  <div key={`detail-agenda-${index}`} style={{ display: "flex", gap: "8px" }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={item}
                      onChange={(e) =>
                        setAgendaItems((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index ? e.target.value : value,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label="Remove agenda item"
                      onClick={() =>
                        setAgendaItems((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      style={{
                        ...outlineButtonStyle,
                        padding: "8px 10px",
                        color: "#777777",
                      }}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAgendaItems((current) => [...current, ""])}
                  style={{ ...outlineButtonStyle, alignSelf: "flex-start" }}
                >
                  Add agenda item
                </button>
              </div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "18px", color: "#cccccc", fontSize: "14px" }}>
                {agendaItems.map((item, index) => (
                  <li key={`agenda-read-${index}`}>{item}</li>
                ))}
              </ul>
            )}
          </section>

          <section style={sectionCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>Notes</h2>
              {isPrivileged ? (
                <span
                  style={{
                    fontSize: "11px",
                    color: saveStatusColor(notesSaveStatus),
                  }}
                >
                  {saveStatusLabel(notesSaveStatus)}
                </span>
              ) : null}
            </div>
            {isPrivileged ? (
              <textarea
                style={{ ...inputStyle, minHeight: "120px", resize: "vertical" }}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Meeting notes…"
              />
            ) : (
              <p style={{ margin: 0, fontSize: "14px", color: "#cccccc", whiteSpace: "pre-wrap" }}>
                {notesDraft || "No notes yet."}
              </p>
            )}
          </section>

          <section style={sectionCardStyle}>
            <h2 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
              Decisions Made
            </h2>
            {isPrivileged ? (
              <textarea
                style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
                value={decisionsDraft}
                onChange={(e) => setDecisionsDraft(e.target.value)}
                placeholder="Record decisions from this meeting…"
              />
            ) : (
              <p style={{ margin: 0, fontSize: "14px", color: "#cccccc", whiteSpace: "pre-wrap" }}>
                {decisionsDraft || "No decisions recorded."}
              </p>
            )}
          </section>

          <section style={sectionCardStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
              Action Items
            </h2>
            {convertError ? (
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#E51937" }}>{convertError}</p>
            ) : null}
            {actionItems.length === 0 ? (
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#777777" }}>No action items yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "12px 0",
                      borderTop: `1px solid ${CARD_BORDER}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      {isPrivileged ? (
                        <input
                          type="checkbox"
                          checked={item.status === "completed"}
                          onChange={() => void toggleActionItem(item)}
                          style={{ marginTop: "4px" }}
                        />
                      ) : null}
                      <div style={{ flex: 1, minWidth: "160px" }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>
                            {item.title}
                          </p>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              color: priorityColor(item.priority),
                              textTransform: "uppercase",
                            }}
                          >
                            {item.priority}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              color: item.status === "completed" ? "#4ade80" : "#999999",
                            }}
                          >
                            {item.status === "completed" ? "Done" : "Open"}
                          </span>
                        </div>
                        {item.description ? (
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: "12px",
                              color: "#999999",
                              lineHeight: 1.45,
                            }}
                          >
                            {item.description}
                          </p>
                        ) : null}
                        <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#777777" }}>
                          {item.assigneeName ?? "Unassigned"}
                          {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                        </p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#666666" }}>
                          Source: {meeting.title}
                        </p>
                      </div>
                      {item.linkedTaskId ? (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#4ade80",
                            border: "1px solid #22c55e",
                            borderRadius: "4px",
                            padding: "2px 8px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Linked Task ✓
                        </span>
                      ) : isPrivileged ? (
                        <button
                          type="button"
                          style={outlineButtonStyle}
                          disabled={convertingId === item.id}
                          onClick={() => void convertToTask(item)}
                        >
                          {convertingId === item.id ? "Converting…" : "Convert to Task"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isPrivileged ? (
              <div style={{ borderTop: `1px solid ${CARD_BORDER}`, paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  style={inputStyle}
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="Follow-up title"
                />
                <textarea
                  style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }}
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="Optional description"
                />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "10px" }}>
                  <select
                    style={inputStyle}
                    value={newItemPriority}
                    onChange={(e) => setNewItemPriority(e.target.value as TaskPriority)}
                  >
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                  <select
                    style={inputStyle}
                    value={newItemAssignee}
                    onChange={(e) => setNewItemAssignee(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {activeMembers.map((member) => (
                      <option key={member.userId} value={member.userId}>
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
                <p style={{ margin: 0, fontSize: "11px", color: "#666666" }}>
                  Source meeting: {meeting.title}
                </p>
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

        <div>
          <section style={sectionCardStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
              Meeting Details
            </h2>
            <dl style={{ margin: 0 }}>
              <DetailRow label="Type" value={meetingTypeLabel(meeting.meetingType)} />
              <DetailRow label="Date & time" value={formatMeetingDateTime(meeting.date)} />
              <DetailRow
                label="Format"
                value={formatLabel}
              />
              <DetailRow label="Invitees" value={inviteeLabel} />
              <DetailRow
                label="Open follow-ups"
                value={String(meeting.openActionItemCount)}
              />
            </dl>
            {metadata.preparation ? (
              <div style={{ marginTop: "12px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#777777" }}>Preparation</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#cccccc", whiteSpace: "pre-wrap" }}>
                  {metadata.preparation}
                </p>
              </div>
            ) : null}
          </section>

          <section style={sectionCardStyle}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "15px",
                fontWeight: 600,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Users size={16} aria-hidden />
              Invitees / Attendees
            </h2>
            {invitedMembers.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>No invitees listed.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {invitedMembers.map((member) => (
                  <li
                    key={member.userId}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid #222222",
                      fontSize: "13px",
                      color: "#cccccc",
                    }}
                  >
                    {formatNameWithRoleTitle(member.fullName ?? "Member", member.roleTitle)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={sectionCardStyle}>
            <h2 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
              Linked Work
            </h2>
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#cccccc" }}>
              {actionItems.length} action item{actionItems.length === 1 ? "" : "s"}
              {" · "}
              {meeting.openActionItemCount} open
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>
              {convertedCount} converted task{convertedCount === 1 ? "" : "s"}
            </p>
          </section>

          {metadata.linkedEventTitle || metadata.linkedHiringTitle ? (
            <section style={sectionCardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
                Related
              </h2>
              {metadata.linkedEventTitle ? (
                <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#cccccc" }}>
                  Event: {metadata.linkedEventTitle}
                </p>
              ) : null}
              {metadata.linkedHiringTitle ? (
                <p style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>
                  Role: {metadata.linkedHiringTitle}
                </p>
              ) : null}
            </section>
          ) : null}

          {meetingFormat !== "online" && meeting.location?.trim() ? (
            <section style={{ ...sectionCardStyle, background: CARD_BG }}>
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <MapPin size={16} aria-hidden />
                Location
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#cccccc", lineHeight: 1.45 }}>
                {meeting.location}
              </p>
            </section>
          ) : meetingFormat !== "online" ? (
            <section style={{ ...sectionCardStyle, background: CARD_BG }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#777777", display: "flex", gap: "8px" }}>
                <MapPin size={16} aria-hidden />
                Location missing
              </p>
            </section>
          ) : null}
          {meetingFormat !== "in_person" ? (
            <section style={{ ...sectionCardStyle, background: CARD_BG }}>
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Video size={16} aria-hidden />
                Meeting Link
              </h2>
              {meeting.meetingLink?.trim() ? (
                <a
                  href={meeting.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "13px",
                    color: "#E51937",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    wordBreak: "break-all",
                  }}
                >
                  <Link2 size={14} aria-hidden />
                  {meeting.meetingLink}
                </a>
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>Meeting link missing</p>
              )}
              {showJoin && meeting.meetingLink?.trim() ? (
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
                    marginTop: "12px",
                  }}
                >
                  <ExternalLink size={14} aria-hidden />
                  Join Meeting
                </a>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        marginBottom: "14px",
        paddingBottom: "14px",
        borderBottom: "1px solid #222222",
      }}
    >
      <dt
        style={{
          margin: 0,
          fontSize: "11px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: "6px 0 0",
          fontSize: "13px",
          color: "#cccccc",
          wordBreak: "break-word",
          lineHeight: 1.45,
        }}
      >
        {value}
      </dd>
    </div>
  );
}
