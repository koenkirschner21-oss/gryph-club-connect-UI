import type { CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useClubPosts } from "../../hooks/useClubPosts";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";


const sectionHeading: CSSProperties = {
  fontWeight: 600,
  fontSize: "15px",
  color: "#ffffff" };

function ClubStatCard({
  label,
  value,
  sublabel,
  accentColor,
  valueIsText }: {
  label: string;
  value: string | number;
  sublabel: string;
  accentColor: string;
  valueIsText?: boolean;
}) {
  return (
    <div
      className="relative rounded-lg px-4 py-3"
      style={{
        backgroundColor: "#1a1a1a",
        borderLeft: `3px solid ${accentColor}` }}
    >
      <p
        className="uppercase"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          color: "#555555" }}
      >
        {label}
      </p>
      <p
        className="mt-2"
        style={{
          fontSize: valueIsText ? "1.125rem" : "2rem",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.15 }}
      >
        {value}
      </p>
      <p
        className="mt-0.5"
        style={{
          fontSize: "11px",
          color: "#555555" }}
      >
        {sublabel}
      </p>
    </div>
  );
}

function ClubEventCard({
  title,
  date,
  time,
  location }: {
  title: string;
  date: string;
  time?: string;
  location?: string;
}) {
  const parsedDate = new Date(date);
  const monthLabel = Number.isNaN(parsedDate.getTime())
    ? "---"
    : parsedDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayLabel = Number.isNaN(parsedDate.getTime())
    ? "?"
    : String(parsedDate.getDate());
  const meta = [time, location].filter(Boolean).join(" · ");

  return (
    <div
      className="flex gap-3.5"
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #242424",
        borderRadius: "8px",
        padding: "14px" }}
    >
      <div
        className="flex shrink-0 flex-col items-center justify-center"
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: "#E51937",
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
            fontSize: "16px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1 }}
        >
          {dayLabel}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#e0e0e0" }}
        >
          {title}
        </h3>
        {meta ? (
          <p
            className="mt-1"
            style={{
              fontSize: "11px",
              color: "#555555" }}
          >
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function ClubHomePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getClubById } = useClubContext();
  const club = getClubById(clubId ?? "");
  const { events, loading: eventsLoading } = useClubEvents(clubId);
  const { posts, loading: postsLoading } = useClubPosts(clubId);

  if (!club) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p
            className="text-lg font-semibold"
            style={{ color: "#ffffff" }}
          >
            Club not found
          </p>
          <p className="mt-1 text-sm" style={{ color: "#555555" }}>
            This club may have been removed or you don&apos;t have access.
          </p>
        </div>
      </div>
    );
  }

  const upcomingEvents = events
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <h1
        className="mb-1"
        style={{
          fontWeight: 700,
          fontSize: "1.25rem",
          color: "#ffffff" }}
      >
        {club.name}
      </h1>
      <p className="mb-6 text-sm" style={{ color: "#747676" }}>
        {club.description}
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ClubStatCard
          label="Members"
          value={club.memberCount}
          sublabel="Active members"
          accentColor="#E51937"
        />
        <ClubStatCard
          label="Upcoming Events"
          value={eventsLoading ? "…" : upcomingEvents.length}
          sublabel="Scheduled events"
          accentColor="#FFC429"
        />
        <ClubStatCard
          label="Meeting"
          value={club.meetingSchedule || "Not set"}
          sublabel={club.location || "Location TBD"}
          accentColor="#747676"
          valueIsText
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-4" style={sectionHeading}>
          Recent Announcements
        </h2>
        {postsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading announcements…" />
          </div>
        ) : posts.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #222222",
              borderRadius: "8px" }}
          >
            <p className="text-sm" style={{ color: "#555555" }}>
              No announcements yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.slice(0, 3).map((post) => (
              <article
                key={post.id}
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "8px",
                  padding: "16px" }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff" }}
                >
                  {post.title}
                </h3>
                <p
                  className="mt-1"
                  style={{
                    fontSize: "11px",
                    color: "#555555" }}
                >
                  {post.authorName ?? "Unknown"} ·{" "}
                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric" })}
                </p>
                <p
                  className="mt-2 line-clamp-2"
                  style={{
                    fontSize: "13px",
                    color: "#cccccc",
                    lineHeight: 1.6 }}
                >
                  {post.content}
                </p>
              </article>
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

      <div className="mt-8">
        <h2 className="mb-4" style={sectionHeading}>
          Upcoming Events
        </h2>
        {upcomingEvents.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #222222",
              borderRadius: "8px" }}
          >
            <p className="text-sm" style={{ color: "#555555" }}>
              No upcoming events scheduled.
            </p>
            <Link to="events" className="mt-3 inline-block">
              <Button variant="ghost" size="sm">
                View Events Page →
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.slice(0, 3).map((event) => (
              <ClubEventCard
                key={event.id}
                title={event.title}
                date={event.date}
                time={event.time}
                location={event.location}
              />
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
