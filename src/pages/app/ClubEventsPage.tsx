import { useState } from "react";
import { useParams } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import type { ClubEvent } from "../../types";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

export default function ClubEventsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");

  const [localEvents, setLocalEvents] = useState<ClubEvent[]>(
    club?.events ?? [],
  );
  const [showForm, setShowForm] = useState(false);

  // New event form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");

  function handleAddEvent() {
    if (!title.trim() || !date) return;

    const event: ClubEvent = {
      id: `event-${Date.now()}`,
      clubId: clubId,
      title: title.trim(),
      description: description.trim(),
      date,
      time: time || "TBD",
      location: location.trim() || "TBD",
      createdAt: new Date().toISOString(),
    };

    setLocalEvents((prev) => [...prev, event]);
    setTitle("");
    setDescription("");
    setDate("");
    setTime("");
    setLocation("");
    setShowForm(false);
  }

  const upcomingEvents = localEvents
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastEvents = localEvents
    .filter((e) => new Date(e.date) < new Date())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-accent">Events</h1>
          <p className="text-sm text-muted">
            {upcomingEvents.length} upcoming event
            {upcomingEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Event"}
        </Button>
      </div>

      {/* New event form */}
      {showForm && (
        <Card className="mb-6 p-5">
          <h3 className="mb-4 font-semibold text-accent">Create New Event</h3>
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
                className="mb-1 block text-sm font-medium text-accent"
              >
                Description
              </label>
              <textarea
                id="eventDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Add details…"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-accent placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleAddEvent}
                disabled={!title.trim() || !date}
              >
                Add Event
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Upcoming Events */}
      <h2 className="mb-3 text-lg font-bold text-accent">Upcoming</h2>
      {upcomingEvents.length === 0 ? (
        <Card className="mb-8 p-8 text-center">
          <p className="text-sm text-muted">
            No upcoming events. Create one to get started!
          </p>
        </Card>
      ) : (
        <div className="mb-8 space-y-3">
          {upcomingEvents.map((event) => (
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
                  <h3 className="font-semibold text-accent">{event.title}</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    {event.time} · {event.location}
                  </p>
                  {event.description && (
                    <p className="mt-2 text-sm text-muted">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold text-accent">Past Events</h2>
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
                  <div>
                    <h3 className="font-semibold text-accent">{event.title}</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {event.time} · {event.location}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
