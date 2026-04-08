import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useEventRsvps } from "../../hooks/useEventRsvps";
import type { ClubEvent, RsvpStatus } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import Spinner from "../../components/ui/Spinner";

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Not Going" },
];

export default function ClubEventsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getUserRole } = useClubContext();
  const { events, loading, createEvent, updateEvent, deleteEvent } =
    useClubEvents(clubId);

  const role = getUserRole(clubId ?? "");
  const isAdminOrExec = role === "admin" || role === "exec";

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

  function resetForm() {
    setTitle("");
    setDescription("");
    setDate("");
    setTime("");
    setLocation("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(event: ClubEvent) {
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description);
    setDate(event.date);
    setTime(event.time);
    setLocation(event.location);
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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Events</h1>
          <p className="text-sm text-muted">
            {upcomingEvents.length} upcoming event
            {upcomingEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdminOrExec && (
          <Button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
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
      {showForm && isAdminOrExec && (
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
      <h2 className="mb-3 text-lg font-bold text-white">Upcoming</h2>
      {upcomingEvents.length === 0 ? (
        <Card className="mb-8 p-8 text-center">
          <p className="text-sm text-muted">
            No upcoming events.{" "}
            {isAdminOrExec ? "Create one to get started!" : "Check back soon!"}
          </p>
        </Card>
      ) : (
        <div className="mb-8 space-y-3">
          {upcomingEvents.map((event) => {
            const c = counts[event.id] ?? { going: 0, maybe: 0, not_going: 0 };
            const myStatus = myRsvps[event.id];
            return (
            <Card key={event.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-center">
                  <p className="text-xs font-medium text-primary">
                    {new Date(event.date).toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </p>
                  <p className="text-xl font-bold text-primary">
                    {new Date(event.date).getDate()}
                  </p>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{event.title}</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    {event.time} · {event.location}
                  </p>
                  {event.description && (
                    <p className="mt-2 text-sm text-muted">
                      {event.description}
                    </p>
                  )}

                  {/* RSVP counts */}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-green-400">
                      {c.going} going
                    </span>
                    <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-400">
                      {c.maybe} maybe
                    </span>
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-400">
                      {c.not_going} not going
                    </span>
                  </div>

                  {/* RSVP buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RSVP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleRsvp(event.id, opt.value)}
                        className={`cursor-pointer rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                          myStatus === opt.value
                            ? opt.value === "going"
                              ? "border-green-500 bg-green-500/20 text-green-400"
                              : opt.value === "maybe"
                                ? "border-yellow-500 bg-yellow-500/20 text-yellow-400"
                                : "border-red-500 bg-red-500/20 text-red-400"
                            : "border-border bg-surface text-muted hover:bg-surface-alt hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Admin: attendee list toggle */}
                  {isAdminOrExec && (
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
                {isAdminOrExec && (
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
            </Card>
            );
          })}
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold text-white">Past Events</h2>
          <div className="space-y-3 opacity-60">
            {pastEvents.map((event) => (
              <Card key={event.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 rounded-lg bg-surface-alt px-3 py-2 text-center">
                    <p className="text-xs font-medium text-muted">
                      {new Date(event.date).toLocaleDateString("en-US", {
                        month: "short",
                      })}
                    </p>
                    <p className="text-xl font-bold text-muted">
                      {new Date(event.date).getDate()}
                    </p>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{event.title}</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {event.time} · {event.location}
                    </p>
                  </div>
                  {isAdminOrExec && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(event.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
