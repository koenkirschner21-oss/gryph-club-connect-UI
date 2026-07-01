import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClubMembers } from "../../../hooks/useClubMembers";
import { formatNameWithRoleTitle } from "../../../lib/memberRoleTitle";
import {
  AGENDA_TEMPLATES,
  DEFAULT_INVITEE_BY_TYPE,
  INVITEE_GROUP_LABELS,
  type InviteeGroup,
  type MeetingFormat,
  type MeetingType,
} from "../../../lib/meetingMetadata";
import { supabase } from "../../../lib/supabaseClient";
import {
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  sectionCardStyle,
  sectionHeadingStyle,
} from "./meetingStyles";
import type { MeetingCreateFormState } from "./meetingTypes";
import { MEETING_TYPES } from "./meetingTypes";
import { buildMeetingUpdatePayload, emptyCreateForm } from "./meetingUtils";

interface LinkOption {
  id: string;
  title: string;
}

function moveAgendaItem(items: string[], from: number, to: number): string[] {
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export function MeetingCreateFlow({
  clubId,
  userId,
  editingId,
  initial,
  onSaved,
}: {
  clubId: string;
  userId: string;
  editingId: string | null;
  initial: MeetingCreateFormState;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const { members } = useClubMembers(clubId);
  const [form, setForm] = useState<MeetingCreateFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [eventOptions, setEventOptions] = useState<LinkOption[]>([]);
  const [hiringOptions, setHiringOptions] = useState<LinkOption[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  useEffect(() => {
    const now = new Date().toISOString();
    void Promise.all([
      supabase
        .from("events")
        .select("id, title")
        .eq("club_id", clubId)
        .gte("date", now.slice(0, 10))
        .order("date", { ascending: true }),
      supabase
        .from("hiring_listings")
        .select("id, title")
        .eq("club_id", clubId)
        .eq("is_open", true)
        .order("created_at", { ascending: false }),
    ]).then(([eventsRes, hiringRes]) => {
      setEventOptions(
        (eventsRes.data ?? []).map((row) => ({
          id: row.id as string,
          title: (row.title as string) ?? "Event",
        })),
      );
      setHiringOptions(
        (hiringRes.data ?? []).map((row) => ({
          id: row.id as string,
          title: (row.title as string) ?? "Role",
        })),
      );
    });
  }, [clubId]);

  const applyMeetingTypeDefaults = (meetingType: MeetingType) => {
    setForm((current) => ({
      ...current,
      meetingType,
      inviteeGroup: DEFAULT_INVITEE_BY_TYPE[meetingType] ?? current.inviteeGroup,
      agendaItems: AGENDA_TEMPLATES[meetingType]
        ? [...AGENDA_TEMPLATES[meetingType]!]
        : current.agendaItems.length > 0
          ? current.agendaItems
          : [""],
      linkedEventId: meetingType === "event_planning" ? current.linkedEventId : "",
      linkedHiringListingId: meetingType === "hiring" ? current.linkedHiringListingId : "",
    }));
  };

  const updateAgendaItem = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      agendaItems: current.agendaItems.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    }));
  };

  const removeAgendaItem = (index: number) => {
    setForm((current) => ({
      ...current,
      agendaItems:
        current.agendaItems.length <= 1
          ? [""]
          : current.agendaItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addAgendaItem = () => {
    setForm((current) => ({
      ...current,
      agendaItems: [...current.agendaItems, ""],
    }));
  };

  const addActionItem = () => {
    setForm((current) => ({
      ...current,
      actionItems: [...current.actionItems, { title: "", assigneeId: "", dueDate: "" }],
    }));
  };

  const updateActionItem = (
    index: number,
    field: "title" | "assigneeId" | "dueDate",
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      actionItems: current.actionItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const removeActionItem = (index: number) => {
    setForm((current) => ({
      ...current,
      actionItems: current.actionItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const toggleCustomInvitee = (userIdToToggle: string) => {
    setForm((current) => ({
      ...current,
      customInviteeIds: current.customInviteeIds.includes(userIdToToggle)
        ? current.customInviteeIds.filter((id) => id !== userIdToToggle)
        : [...current.customInviteeIds, userIdToToggle],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.date || !form.time) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const eventTitle = eventOptions.find((option) => option.id === form.linkedEventId)?.title;
      const hiringTitle = hiringOptions.find((option) => option.id === form.linkedHiringListingId)?.title;
      const payload = buildMeetingUpdatePayload(form, eventTitle, hiringTitle);

      let meetingId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from("club_meetings")
          .update(payload)
          .eq("id", editingId);
        if (error) {
          setSaveError(error.message);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("club_meetings")
          .insert({ ...payload, club_id: clubId, created_by: userId })
          .select("id")
          .single();
        if (error || !data) {
          setSaveError(error?.message ?? "Could not create meeting.");
          return;
        }
        meetingId = data.id as string;

        const draftItems = form.actionItems.filter((item) => item.title.trim());
        if (draftItems.length > 0) {
          const { error: itemsError } = await supabase.from("meeting_action_items").insert(
            draftItems.map((item) => ({
              meeting_id: meetingId,
              title: item.title.trim(),
              assignee_id: item.assigneeId || null,
              due_date: item.dueDate || null,
            })),
          );
          if (itemsError) {
            setSaveError(itemsError.message);
            return;
          }
        }
      }

      setSaveSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, 450));

      if (meetingId) {
        navigate(`/app/clubs/${clubId}/meetings/${meetingId}`);
        onSaved();
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save meeting.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "#0d0d0d",
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "24px 20px 48px" }}>
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

        <h1 style={{ margin: "0 0 24px", fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
          {editingId ? "Edit Meeting" : "New Meeting"}
        </h1>

        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>Meeting Basics</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={labelStyle} htmlFor="meeting-title">Title</label>
              <input
                id="meeting-title"
                style={inputStyle}
                value={form.title}
                onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                placeholder="Weekly exec meeting"
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="meeting-type">Meeting Type</label>
              <select
                id="meeting-type"
                style={inputStyle}
                value={form.meetingType}
                onChange={(e) => applyMeetingTypeDefaults(e.target.value as MeetingType)}
              >
                {MEETING_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
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
                  onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="meeting-time">Time</label>
                <input
                  id="meeting-time"
                  type="time"
                  style={inputStyle}
                  value={form.time}
                  onChange={(e) => setForm((current) => ({ ...current, time: e.target.value }))}
                />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#cccccc" }}>
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    isRecurring: e.target.checked,
                    recurrencePattern: e.target.checked
                      ? current.recurrencePattern || "weekly"
                      : "",
                  }))
                }
              />
              Recurring meeting
            </label>
            {form.isRecurring ? (
              <div>
                <label style={labelStyle} htmlFor="recurrence-pattern">Recurrence Pattern</label>
                <select
                  id="recurrence-pattern"
                  style={inputStyle}
                  value={form.recurrencePattern}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      recurrencePattern: e.target.value as MeetingCreateFormState["recurrencePattern"],
                    }))
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            ) : null}
          </div>
        </section>

        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>Location / Format</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
            {(["online", "in_person", "hybrid"] as MeetingFormat[]).map((format) => (
              <label
                key={format}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  color: "#cccccc",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="meeting-format"
                  checked={form.format === format}
                  onChange={() => setForm((current) => ({ ...current, format }))}
                />
                {format === "online" ? "Online" : format === "in_person" ? "In-Person" : "Hybrid"}
              </label>
            ))}
          </div>
          {form.format !== "in_person" ? (
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle} htmlFor="meeting-link">Meeting Link</label>
              <input
                id="meeting-link"
                style={inputStyle}
                value={form.meetingLink}
                onChange={(e) => setForm((current) => ({ ...current, meetingLink: e.target.value }))}
                placeholder="Teams, Zoom, or Google Meet link"
              />
            </div>
          ) : null}
          {form.format !== "online" ? (
            <div>
              <label style={labelStyle} htmlFor="meeting-location">Location</label>
              <input
                id="meeting-location"
                style={inputStyle}
                value={form.location}
                onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
                placeholder="University Centre Room 103"
              />
            </div>
          ) : null}
        </section>

        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>Invitees</h2>
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#777777" }}>
            Who should attend this meeting?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            {(Object.keys(INVITEE_GROUP_LABELS) as InviteeGroup[]).map((group) => (
              <label
                key={group}
                style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#cccccc" }}
              >
                <input
                  type="radio"
                  name="invitee-group"
                  checked={form.inviteeGroup === group}
                  onChange={() => setForm((current) => ({ ...current, inviteeGroup: group }))}
                />
                {INVITEE_GROUP_LABELS[group]}
              </label>
            ))}
          </div>
          {form.inviteeGroup === "custom" ? (
            <div
              style={{
                maxHeight: "180px",
                overflowY: "auto",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "8px",
              }}
            >
              {activeMembers.map((member) => (
                <label
                  key={member.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 4px",
                    fontSize: "13px",
                    color: "#cccccc",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.customInviteeIds.includes(member.userId)}
                    onChange={() => toggleCustomInvitee(member.userId)}
                  />
                  {formatNameWithRoleTitle(member.fullName ?? "Member", member.roleTitle)}
                </label>
              ))}
            </div>
          ) : null}
        </section>

        {form.meetingType === "event_planning" ? (
          <section style={sectionCardStyle}>
            <h2 style={sectionHeadingStyle}>Linked Event</h2>
            <label style={labelStyle} htmlFor="linked-event">Which event is this meeting for?</label>
            <select
              id="linked-event"
              style={inputStyle}
              value={form.linkedEventId}
              onChange={(e) => setForm((current) => ({ ...current, linkedEventId: e.target.value }))}
            >
              <option value="">Select an event…</option>
              {eventOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.title}</option>
              ))}
            </select>
          </section>
        ) : null}

        {form.meetingType === "hiring" ? (
          <section style={sectionCardStyle}>
            <h2 style={sectionHeadingStyle}>Linked Role</h2>
            <label style={labelStyle} htmlFor="linked-hiring">Which role/application?</label>
            <select
              id="linked-hiring"
              style={inputStyle}
              value={form.linkedHiringListingId}
              onChange={(e) =>
                setForm((current) => ({ ...current, linkedHiringListingId: e.target.value }))
              }
            >
              <option value="">Select a role…</option>
              {hiringOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.title}</option>
              ))}
            </select>
          </section>
        ) : null}

        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>Agenda</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {form.agendaItems.map((item, index) => (
              <div
                key={`agenda-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === index) return;
                  setForm((current) => ({
                    ...current,
                    agendaItems: moveAgendaItem(current.agendaItems, dragIndex, index),
                  }));
                  setDragIndex(null);
                }}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <GripVertical size={16} color="#555555" aria-hidden style={{ cursor: "grab" }} />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={item}
                  onChange={(e) => updateAgendaItem(index, e.target.value)}
                  placeholder={`Agenda item ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeAgendaItem(index)}
                  aria-label="Remove agenda item"
                  style={{ background: "transparent", border: "none", color: "#777777", cursor: "pointer" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addAgendaItem}
            style={{
              marginTop: "12px",
              background: "transparent",
              border: "1px dashed #333333",
              color: "#cccccc",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={14} aria-hidden />
            Add agenda item
          </button>
        </section>

        <section style={sectionCardStyle}>
          <h2 style={sectionHeadingStyle}>Preparation</h2>
          <textarea
            style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
            value={form.preparation}
            onChange={(e) => setForm((current) => ({ ...current, preparation: e.target.value }))}
            placeholder="Notes, links, or context to review before the meeting…"
          />
        </section>

        {!editingId ? (
          <section style={sectionCardStyle}>
            <h2 style={sectionHeadingStyle}>Action Items</h2>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#777777" }}>
              Optional pre-planned follow-ups for after the meeting.
            </p>
            {form.actionItems.map((item, index) => (
              <div key={`action-${index}`} style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={item.title}
                    onChange={(e) => updateActionItem(index, "title", e.target.value)}
                    placeholder="Action item title"
                  />
                  <button
                    type="button"
                    onClick={() => removeActionItem(index)}
                    style={{ background: "transparent", border: "none", color: "#777777", cursor: "pointer" }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <select
                    style={inputStyle}
                    value={item.assigneeId}
                    onChange={(e) => updateActionItem(index, "assigneeId", e.target.value)}
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
                    value={item.dueDate}
                    onChange={(e) => updateActionItem(index, "dueDate", e.target.value)}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addActionItem}
              style={{
                background: "transparent",
                border: "1px dashed #333333",
                color: "#cccccc",
                borderRadius: "6px",
                padding: "8px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Add action item
            </button>
          </section>
        ) : null}

        <button
          type="button"
          disabled={saving || !form.title.trim() || !form.date || !form.time}
          onClick={() => void handleSave()}
          style={{
            ...primaryButtonStyle,
            width: "100%",
            padding: "12px 16px",
            fontSize: "14px",
            opacity: saving || !form.title.trim() ? 0.6 : 1,
          }}
        >
          {saving
            ? "Saving…"
            : saveSuccess
              ? "Saved"
              : editingId
                ? "Save Changes"
                : "Create Meeting"}
        </button>
        {saveError ? (
          <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#E51937" }}>
            {saveError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { emptyCreateForm };
