import { useParams, Link } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useClubPosts } from "../../hooks/useClubPosts";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

export default function ClubHomePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");
  const { events, loading: eventsLoading } = useClubEvents(clubId);
  const { posts, loading: postsLoading } = useClubPosts(clubId);

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

      {/* Recent Activity — real data from announcements */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-white">Recent Announcements</h2>
        {postsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading announcements…" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              No announcements yet. Check back soon!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.slice(0, 3).map((post) => (
              <Card key={post.id} className="p-4">
                <h3 className="font-semibold text-white">{post.title}</h3>
                <p className="mt-1 text-xs text-muted">
                  {post.authorName ?? "Unknown"} ·{" "}
                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-white/80">
                  {post.content}
                </p>
              </Card>
            ))}
            {posts.length > 3 && (
              <Link to="announcements">
                <Button variant="ghost" size="sm">
                  View all announcements →
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-white">
          Upcoming Events
        </h2>
        {upcomingEvents.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">No upcoming events scheduled.</p>
            <Link to="events" className="mt-3 inline-block">
              <Button variant="ghost" size="sm">
                View Events Page →
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.slice(0, 3).map((event) => (
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
            {upcomingEvents.length > 3 && (
              <Link to="events">
                <Button variant="ghost" size="sm">
                  View all events →
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
