import { useParams } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import Card from "../../components/ui/Card";

export default function ClubHomePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");
  const { events, loading: eventsLoading } = useClubEvents(clubId);

  if (!club) return null;

  const upcomingEvents = events
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-white">{club.name}</h1>
      <p className="mb-6 text-sm text-muted">{club.description}</p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Quick Stats */}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Members
          </h3>
          <p className="text-3xl font-bold text-primary">
            {club.memberCount}
          </p>
          <p className="mt-1 text-xs text-muted">Active members</p>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Upcoming Events
          </h3>
          <p className="text-3xl font-bold text-primary">
            {eventsLoading ? "…" : upcomingEvents.length}
          </p>
          <p className="mt-1 text-xs text-muted">Scheduled events</p>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Meeting
          </h3>
          <p className="text-lg font-semibold text-white">
            {club.meetingSchedule || "Not set"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {club.location || "Location TBD"}
          </p>
        </Card>
      </div>

      {/* Recent Activity placeholder */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-white">Recent Activity</h2>
        <Card className="p-8 text-center">
          <svg
            className="mx-auto h-10 w-10 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-3 text-sm text-muted">
            Activity feed will appear here as members interact with the
            workspace.
          </p>
        </Card>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-white">
            Upcoming Events
          </h2>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <Card key={event.id} className="flex items-center gap-4 p-4">
                <div className="flex-shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-center">
                  <p className="text-xs font-medium text-primary">
                    {new Date(event.date).toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {new Date(event.date).getDate()}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white">{event.title}</h3>
                  <p className="text-xs text-muted">
                    {event.time} · {event.location}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
