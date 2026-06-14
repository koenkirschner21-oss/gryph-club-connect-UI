import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, MapPin, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useClubMembers } from "../../../hooks/useClubMembers";
import { useIsMobile } from "../../../hooks/useWindowWidth";
import { formatNameWithRoleTitle } from "../../../lib/memberRoleTitle";
import {
  inviteeCountLabel,
  parseAgendaItems,
  parseMeetingNotes,
  serializeAgendaItems,
  serializeMeetingNotes,
  type MeetingMetadata,
} from "../../../lib/meetingMetadata";
import { supabase } from "../../../lib/supabaseClient";
import { MeetingTypeBadge } from "./MeetingCard";
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
  meetingLinkButtonLabel,
} from "./meetingUtils";

function useDebouncedSave(
  value: string,
  onSave: (value: string) => Promise<void>,
  delay = 900,
) {
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  const [newItemAssignee, setNewItemAssignee] = useState("");
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
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
        `id, meeting_id, title, assignee_id, due_date, status, linked_task_id, created_at,
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
      await supabase.from("club_meetings").update({ agenda: serialized }).eq("id", meeting.id);
      setMeeting((current) => (current ? { ...current, agenda: serialized } : current));
    },
    [isPrivileged, meeting],
  );

  const saveNotesBundle = useCallback(
    async (notes: string, decisions: string) => {
      if (!isPrivileged || !meeting || !metadata) return;
      const nextMetadata: MeetingMetadata = { ...metadata, decisions: decisions.trim() || undefined };
      const serialized = serializeMeetingNotes(nextMetadata, notes);
      await supabase.from("club_meetings").update({ notes: serialized }).eq("id", meeting.id);
      setMetadata(nextMetadata);
      setMeeting((current) => (current ? { ...current, notes: serialized } : current));
    },
    [isPrivileged, meeting, metadata],
  );

  const agendaSaved = useDebouncedSave(
    JSON.stringify(agendaItems),
    async () => saveAgenda(agendaItems),
  );

  const notesSaved = useDebouncedSave(
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
      assignee_id: newItemAssignee || null,
      due_date: newItemDueDate || null,
    });
    setAddingItem(false);
    setNewItemTitle("");
    setNewItemAssignee("");
    setNewItemDueDate("");
    void loadActionItems();
    void loadMeeting();
  };

  const convertToTask = async (item: MeetingActionItem) => {
    if (!isPrivileged || !userId || item.linkedTaskId || !meeting) return;
    setConvertingId(item.id);
    const { data: taskRow, error } = await supabase
      .from("tasks")
      .insert({
        club_id: clubId,
        title: item.title,
        description: `From meeting: ${meeting.title}`,
        status: "todo",
        priority: "medium",
        task_type: "meeting",
        linked_meeting_id: meetingId,
        assigned_to: item.assigneeId,
        due_date: item.dueDate,
        created_by: userId,
      })
      .select("id")
      .single();

    if (!error && taskRow) {
      await supabase
        .from("meeting_action_items")
        .update({ linked_task_id: taskRow.id as string })
        .eq("id", item.id);
    }
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

  const inviteeLabel = inviteeCountLabel(
    metadata.inviteeGroup,
    members,
    metadata.customInviteeIds,
  );

  return (
    <div style={{ padding: "24px 20px", maxWidth: "1100px" }}>
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

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
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
            {metadata.format === "online"
              ? "Online"
              : metadata.format === "hybrid"
                ? "Hybrid"
                : "In-Person"}
            {" · "}
            {inviteeLabel}
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
            <button type="button" style={outlineButtonStyle} onClick={() => onEdit(meeting)}>
              Edit Meeting
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "16px",
        }}
      >
        <div>
          <section style={sectionCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>Agenda</h2>
              {isPrivileged ? (
                <span style={{ fontSize: "11px", color: agendaSaved ? "#4ade80" : "#777777" }}>
                  {agendaSaved ? "Saved" : "Saving…"}
                </span>
              ) : null}
            </div>
            {isPrivileged ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {agendaItems.map((item, index) => (
                  <input
                    key={`detail-agenda-${index}`}
                    style={inputStyle}
                    value={item}
                    onChange={(e) =>
                      setAgendaItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? e.target.value : value,
                        ),
                      )
                    }
                  />
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
                <span style={{ fontSize: "11px", color: notesSaved ? "#4ade80" : "#777777" }}>
                  {notesSaved ? "Saved" : "Saving…"}
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
                      />
                    ) : null}
                    <div style={{ flex: 1, minWidth: "160px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>
                        {item.title}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#777777" }}>
                        {item.assigneeName ?? "Unassigned"}
                        {item.dueDate ? ` · Due ${item.dueDate}` : ""}
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
                ))}
              </div>
            )}
            {isPrivileged ? (
              <div style={{ borderTop: `1px solid ${CARD_BORDER}`, paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
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
            <h2 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
              Meeting Details
            </h2>
            <dl style={{ margin: 0, fontSize: "13px", color: "#cccccc" }}>
              <DetailRow label="Type" value={meeting.meetingType.replace("_", " ")} />
              <DetailRow label="Date" value={formatMeetingDateTime(meeting.date)} />
              <DetailRow
                label="Format"
                value={
                  metadata.format === "online"
                    ? "Online"
                    : metadata.format === "hybrid"
                      ? "Hybrid"
                      : "In-Person"
                }
              />
              <DetailRow label="Invitees" value={inviteeLabel} />
              {meeting.meetingLink ? <DetailRow label="Link" value={meeting.meetingLink} /> : null}
              {meeting.location ? <DetailRow label="Location" value={meeting.location} /> : null}
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
            <h2 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#ffffff" }}>
              Linked Work
            </h2>
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#cccccc" }}>
              {actionItems.length} action item{actionItems.length === 1 ? "" : "s"}
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

          {meeting.location && metadata.format !== "online" ? (
            <section style={{ ...sectionCardStyle, background: CARD_BG }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#777777", display: "flex", gap: "8px" }}>
                <MapPin size={16} aria-hidden />
                {meeting.location}
              </p>
            </section>
          ) : null}
          {metadata.format !== "in_person" && meeting.meetingLink ? (
            <section style={{ ...sectionCardStyle, background: CARD_BG }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#777777", display: "flex", gap: "8px" }}>
                <Video size={16} aria-hidden />
                Online meeting
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <dt style={{ margin: 0, fontSize: "11px", color: "#777777" }}>{label}</dt>
      <dd style={{ margin: "4px 0 0", color: "#cccccc", wordBreak: "break-word" }}>{value}</dd>
    </div>
  );
}
