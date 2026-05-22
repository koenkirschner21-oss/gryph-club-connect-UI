import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import type { ClubEvent, RsvpStatus } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";
import { isPrivilegedClubRole } from "../../lib/clubRoles";

type EventVisibility = "public" | "members_only" | "featured";

const VISIBILITY_OPTIONS: {
  value: EventVisibility;
  label: string;
  description: string;
  Icon: () => ReactNode;
}[] = [
  {
    value: "members_only",
    label: "Members Only",
    description: "Only visible to club members",
    Icon: LockIcon,
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone can attend, not shown on campus feed",
    Icon: GlobeIcon,
  },
  {
    value: "featured",
    label: "Featured on Campus",
    description: "Promoted on the home page for all students",
    Icon: StarIcon,
  },
];

function GlobeIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E51937"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

const visibilityCardBase: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: "12px 16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
};

function visibilityCardSelected(base: CSSProperties): CSSProperties {
  return {
    ...base,
    border: "1px solid #E51937",
    background: "#1f0a0a",
  };
}

function VisibilitySelector({
  value,
  onChange,
}: {
  value: EventVisibility;
  onChange: (value: EventVisibility) => void;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#ffffff",
          marginBottom: 10,
        }}
      >
        Who can see this event?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {VISIBILITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={
              value === option.value
                ? visibilityCardSelected(visibilityCardBase)
                : visibilityCardBase
            }
          >
            <option.Icon />
            <span style={{ textAlign: "left" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                {option.label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#555555",
                  marginTop: 2,
                }}
              >
                {option.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Not Going" },
];

function EventDateBlock({ date, muted }: { date: string; muted?: boolean }) {
  const parsedDate = new Date(date);
  const monthLabel = Number.isNaN(parsedDate.getTime())
    ? "---"
    : parsedDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayLabel = Number.isNaN(parsedDate.getTime())
    ? "?"
    : String(parsedDate.getDate());

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center"
      style={{
        width: "44px",
        height: "44px",
        backgroundColor: muted ? "#333333" : "#E51937",
        borderRadius: "6px" }}
    >
      <span
        style={{
          fontSize: "9px",
          textTransform: "uppercase",
          color: "#ffffff",
          lineHeight: 1.1 }}
      >
        {monthLabel}
      </span>
      <span
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.1 }}
      >
        {dayLabel}
      </span>
    </div>
  );
}

function rsvpButtonStyle(value: RsvpStatus, active: boolean): CSSProperties {
  const base: CSSProperties = {
    borderRadius: "6px",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer" };
  if (!active) {
    return {
      ...base,
      backgroundColor: "#111111",
      color: "#555555",
      border: "1px solid #222222" };
  }
  if (value === "going") {
    return {
      ...base,
      backgroundColor: "#0d2b0d",
      color: "#4ade80",
      border: "1px solid #1a4a1a" };
  }
  if (value === "maybe") {
    return {
      ...base,
      backgroundColor: "#2a2a0d",
      color: "#FFC429",
      border: "1px solid #3a3a1a" };
  }
  return {
    ...base,
    backgroundColor: "#1a1a1a",
    color: "#555555",
    border: "1px solid #2a2a2a" };
}

const eventCardStyle: CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "8px",
  padding: "16px",
  borderLeft: "3px solid #E51937" };

const sectionHeadingStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "15px",
  color: "#ffffff",
  marginBottom: "12px" };

export default function ClubEventsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getUserRole } = useClubContext();
  const { events, loading, createEvent, updateEvent, deleteEvent } =
    useClubEvents(clubId);

  const role = getUserRole(clubId ?? "");
  const isPrivileged = isPrivilegedClubRole(role);

  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { myRsvps, counts, attendees, setRsvp, removeRsvp, loadAttendees } =
    useEventRsvps(eventIds);
  const [expandedAttendees, setExpandedAttendees] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state for create / edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<EventVisibility>("public");

  function resetForm() {
    setTitle("");
    setDescription("");
    setDate("");
    setTime("");
    setLocation("");
    setVisibility("public");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(event: ClubEvent) {
    const current = events.find((e) => e.id === event.id) ?? event;
    setEditingId(current.id);
    setTitle(current.title);
    setDescription(current.description);
    setDate(current.date);
    setTime(current.time);
    setLocation(current.location);
    if (current.visibility === "members_only") {
      setVisibility("members_only");
    } else if (current.visibility === "featured") {
      setVisibility("featured");
    } else {
      setVisibility("public");
    }
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!title.trim() || !date) return;
    setSaving(true);
    setFeedback(null);

    const fields = {
      title: title.trim(),
      description: description.trim(),
      date,
      time: time || "TBD",
      location: location.trim() || "TBD",
      visibility,
    };

    let ok: boolean;
    if (editingId) {
      ok = !!(await updateEvent(editingId, fields));
    } else {
      ok = !!(await createEvent(fields));
    }

    setSaving(false);
    if (ok) {
      setFeedback({ type: "success", text: editingId ? "Event updated." : "Event created." });
    } else {
      setFeedback({ type: "error", text: "Failed to save event." });
    }
    resetForm();
  }

  async function handleDelete(eventId: string) {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    setFeedback(null);
    const ok = await deleteEvent(eventId);
    if (ok) {
      setFeedback({ type: "success", text: "Event deleted." });
    } else {
      setFeedback({ type: "error", text: "Failed to delete event." });
    }
  }

  async function handleRsvp(eventId: string, status: RsvpStatus) {
    if (myRsvps[eventId] === status) {
      await removeRsvp(eventId);
    } else {
      await setRsvp(eventId, status);
    }
  }

  async function toggleAttendees(eventId: string) {
    if (expandedAttendees === eventId) {
      setExpandedAttendees(null);
    } else {
      await loadAttendees(eventId);
      setExpandedAttendees(eventId);
    }
  }

  const now = new Date();
  const upcomingEvents = events
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastEvents = events
    .filter((e) => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading events…" />
      </div>
    );
  }

  return (
    <div className="p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            style={{
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff" }}
          >
            Events
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#555555" }}
          >
            {upcomingEvents.length} upcoming event
            {upcomingEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isPrivileged && (
          <Button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="!border-0 !bg-[#E51937] !px-[18px] !py-[9px] !text-[13px] !font-medium !text-white hover:!bg-[#cc0020]"
            style={{ borderRadius: "6px" }}
          >
            {showForm ? "Cancel" : "+ New Event"}
          </Button>
        )}
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Create / edit form — admin/exec only */}
      {showForm && isPrivileged && (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 font-semibold text-white">
            {editingId ? "Edit Event" : "Create New Event"}
          </h3>
          <div className="space-y-3">
            <FormInput
              id="eventTitle"
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Meeting"
              required
            />
            <div>
              <label
                htmlFor="eventDesc"
                className="mb-1 block text-sm font-medium text-white"
              >
                Description
              </label>
              <textarea
                id="eventDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Add details…"
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors"
              />
            </div>
            <VisibilitySelector
              key={editingId ?? "create"}
              value={visibility}
              onChange={setVisibility}
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <FormInput
                  id="eventDate"
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1">
                <FormInput
                  id="eventTime"
                  label="Time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <FormInput
              id="eventLocation"
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Thornbrough Building, Room 1307"
            />
            <div className="flex justify-end gap-3 pt-2">
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel Edit
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || !date || saving}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save Changes"
                    : "Add Event"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Upcoming Events */}
      <h2 style={sectionHeadingStyle}>Upcoming</h2>
      {upcomingEvents.length === 0 ? (
        <div className="mb-8 py-12 text-center">
          <p style={{ fontSize: "14px", color: "#555555" }}>
            No upcoming events.
            {isPrivileged ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="cursor-pointer border-none bg-transparent p-0 underline-offset-2 hover:underline"
                  style={{ color: "#E51937", fontSize: "14px" }}
                >
                  Create your first event
                </button>
              </>
            ) : (
              " Check back soon!"
            )}
          </p>
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {upcomingEvents.map((event) => {
            const c = counts[event.id] ?? { going: 0, maybe: 0, not_going: 0 };
            const myStatus = myRsvps[event.id];
            return (
            <div key={event.id} style={eventCardStyle}>
              <div className="flex items-start gap-4">
                <EventDateBlock date={event.date} />
                <div className="min-w-0 flex-1">
                  <h3
                    style={{
                      fontWeight: 600,
                      fontSize: "15px",
                      color: "#ffffff" }}
                  >
                    {event.title}
                  </h3>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"
                    style={{
                      fontSize: "12px",
                      color: "#555555" }}
                  >
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {event.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {event.location}
                    </span>
                  </div>
                  {event.description && (
                    <p
                      className="mt-2"
                      style={{
                        fontSize: "13px",
                        color: "#777777",
                        lineHeight: 1.5 }}
                    >
                      {event.description}
                    </p>
                  )}

                  {/* RSVP counts */}
                  <p className="mt-3" style={{ fontSize: "12px" }}>
                    <span style={{ color: "#4ade80" }}>{c.going} going</span>
                    <span style={{ color: "#555555" }}> · </span>
                    <span style={{ color: "#FFC429" }}>{c.maybe} maybe</span>
                    <span style={{ color: "#555555" }}> · </span>
                    <span style={{ color: "#555555" }}>{c.not_going} not going</span>
                  </p>

                  {/* RSVP buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RSVP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleRsvp(event.id, opt.value)}
                        style={rsvpButtonStyle(opt.value, myStatus === opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Admin: attendee list toggle */}
                  {isPrivileged && (
                    <button
                      type="button"
                      onClick={() => toggleAttendees(event.id)}
                      className="mt-3 cursor-pointer text-xs font-medium text-primary hover:underline"
                    >
                      {expandedAttendees === event.id
                        ? "Hide attendees"
                        : "View attendees"}
                    </button>
                  )}

                  {/* Attendee list */}
                  {expandedAttendees === event.id && attendees[event.id] && (
                    <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-3">
                      {attendees[event.id].length === 0 ? (
                        <p className="text-xs text-muted">No RSVPs yet.</p>
                      ) : (
                        attendees[event.id].map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-3"
                          >
                            {a.avatarUrl ? (
                              <img
                                src={a.avatarUrl}
                                alt=""
                                className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {(a.fullName ?? "U")[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {a.fullName ?? "Unknown"}
                              </p>
                              {a.program && (
                                <p className="truncate text-xs text-muted">
                                  {a.program}
                                </p>
                              )}
                            </div>
                            <span
                              className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                a.status === "going"
                                  ? "bg-green-500/10 text-green-400"
                                  : a.status === "maybe"
                                    ? "bg-yellow-500/10 text-yellow-400"
                                    : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {a.status === "not_going" ? "Not Going" : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {isPrivileged && (
                  <div className="flex flex-shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(event)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(event.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <>
          <h2 style={sectionHeadingStyle}>Past Events</h2>
          <div className="space-y-3 opacity-60">
            {pastEvents.map((event) => (
              <div key={event.id} style={eventCardStyle}>
                <div className="flex items-start gap-4">
                  <EventDateBlock date={event.date} muted />
                  <div className="min-w-0 flex-1">
                    <h3
                      style={{
                        fontWeight: 600,
                        fontSize: "15px",
                        color: "#ffffff" }}
                    >
                      {event.title}
                    </h3>
                    <div
                      className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"
                      style={{
                        fontSize: "12px",
                        color: "#555555" }}
                    >
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {event.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {event.location}
                      </span>
                    </div>
                  </div>
                  {isPrivileged && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(event.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
