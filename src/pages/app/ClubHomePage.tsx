import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { Megaphone, Calendar, Users } from "../../components/icons/WorkspaceIcons";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { useClubEvents } from "../../hooks/useClubEvents";
import { useClubPosts } from "../../hooks/useClubPosts";
import { useClubTasks } from "../../hooks/useClubTasks";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole, Task, TaskStatus } from "../../types";
import Spinner from "../../components/ui/Spinner";

const sectionHeadingRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "16px",
};

const sectionHeading: CSSProperties = {
  fontWeight: 600,
  fontSize: "15px",
  color: "#ffffff",
  margin: 0,
};

const viewAllLink: CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#E51937",
  textDecoration: "none",
};

function isHiddenLocation(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const upper = trimmed.toUpperCase();
  return upper === "TBD" || upper === "LOCATION TBD";
}

const quickActionButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "#E51937",
  backgroundColor: "#E51937",
  color: "#ffffff",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
};

const quickActionOutlineButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "transparent",
  backgroundColor: "transparent",
  border: "1px solid #E51937",
  color: "#E51937",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
};

function normalizeUserRole(role: MemberRole | string | null | undefined): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function taskStatusAccent(status: TaskStatus): string {
  switch (status) {
    case "in_progress":
      return "#FFC429";
    case "done":
      return "#4ade80";
    default:
      return "#747676";
  }
}

function ClubStatCard({
  label,
  value,
  sublabel,
  accentColor,
  to,
  valueFontSize = "2rem",
}: {
  label: string;
  value: string | number;
  sublabel: string;
  accentColor: string;
  to?: string;
  valueFontSize?: string;
}) {
  const [hovered, setHovered] = useState(false);

  const card = (
    <div
      className="flex h-full min-h-[120px] flex-col justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#1a1a1a",
        border: `1px solid ${hovered ? "#333333" : "#242424"}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "8px",
        padding: "16px",
        cursor: to ? "pointer" : undefined,
      }}
    >
      <p
        className="uppercase"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          color: "#747676",
          margin: 0,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: valueFontSize,
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.15,
          margin: "8px 0 0",
        }}
      >
        {value}
      </p>
      {sublabel ? (
        <p
          style={{
            fontSize: "11px",
            color: "#555555",
            margin: "4px 0 0",
          }}
        >
          {sublabel}
        </p>
      ) : null}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full no-underline">
        {card}
      </Link>
    );
  }

  return card;
}

function ClubEventCard({
  title,
  date,
  time,
  location,
}: {
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

  const timeLabel =
    time && time.trim() !== "" && time.toUpperCase() !== "TBD" ? time : null;
  const locationLabel =
    location && !isHiddenLocation(location) ? location.trim() : null;
  const meta = [timeLabel, locationLabel].filter(Boolean).join(" · ");

  return (
    <div
      className="flex gap-3.5"
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #242424",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "8px",
      }}
    >
      <div
        className="flex shrink-0 flex-col items-center justify-center"
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: "#E51937",
          borderRadius: "6px",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            textTransform: "uppercase",
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {monthLabel}
        </span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          {dayLabel}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#ffffff",
            margin: 0,
          }}
        >
          {title}
        </h3>
        {meta ? (
          <p
            style={{
              fontSize: "12px",
              color: "#555555",
              margin: "4px 0 0",
            }}
          >
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ClubTaskCard({ task }: { task: Task }) {
  const statusLabel =
    task.status === "in_progress"
      ? "In progress"
      : task.status === "done"
        ? "Done"
        : "To do";

  return (
    <Link to="tasks" className="block no-underline">
      <div
        style={{
          background: "#1a1a1a",
          borderTop: "1px solid #242424",
          borderRight: "1px solid #242424",
          borderBottom: "1px solid #242424",
          borderLeft: `3px solid ${taskStatusAccent(task.status)}`,
          borderRadius: "8px",
          padding: "14px 16px",
          marginBottom: "8px",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#ffffff",
            margin: "0 0 4px",
          }}
        >
          {task.title}
        </p>
        <p style={{ fontSize: "11px", color: "#555555", margin: 0 }}>
          {statusLabel}
          {task.assigneeName ? ` · ${task.assigneeName}` : ""}
          {task.dueDate
            ? ` · Due ${new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}`
            : ""}
        </p>
      </div>
    </Link>
  );
}

export default function ClubHomePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getClubById, getUserRole, userRoles } = useClubContext();
  const club = getClubById(clubId ?? "");

  const contextRole = clubId
    ? getUserRole(clubId) ?? userRoles[clubId] ?? null
    : null;

  const [userRole, setUserRole] = useState<MemberRole>("member");

  useEffect(() => {
    if (contextRole) {
      setUserRole(normalizeUserRole(contextRole as MemberRole));
      return;
    }
    const fetchRole = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (data?.role) {
        setUserRole(normalizeUserRole(data.role as MemberRole));
      }
    };
    fetchRole();
  }, [clubId, user?.id, contextRole]);

  const { events, loading: eventsLoading } = useClubEvents(clubId);
  const { posts, loading: postsLoading } = useClubPosts(clubId);
  const { tasks, loading: tasksLoading } = useClubTasks(clubId);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((e) => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events],
  );

  const recentPosts = posts.slice(0, 3);
  const previewEvents = upcomingEvents.slice(0, 3);
  const meetingSublabel =
    club?.location && !isHiddenLocation(club.location) ? club.location.trim() : "";

  const dashboardTasks = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    if (userRole === "owner") {
      return open;
    }
    if (userRole === "executive") {
      return open.filter(
        (t) => t.assignedTo === user?.id || t.createdBy === user?.id,
      );
    }
    return open.filter((t) => t.assignedTo === user?.id);
  }, [tasks, userRole, user?.id]);

  const previewTasks = dashboardTasks.slice(0, 5);
  const tasksSectionTitle =
    userRole === "owner" ? "Club Tasks" : "My Tasks";

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

  return (
    <div className="p-6" style={{ backgroundColor: "#0f0f0f" }}>
      <div className="mb-6">
        <h1
          style={{
            fontWeight: 700,
            fontSize: "22px",
            color: "#ffffff",
            margin: 0,
          }}
        >
          {club.name}
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "#555555",
            margin: "6px 0 0",
          }}
        >
          {club.description}
        </p>
      </div>

      {userRole === "owner" ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link to="announcements" style={quickActionButton}>
            <Megaphone size={16} strokeWidth={2} aria-hidden />
            New Announcement
          </Link>
          <Link to="events" style={quickActionButton}>
            <Calendar size={16} strokeWidth={2} aria-hidden />
            New Event
          </Link>
          <Link to="members" style={quickActionOutlineButton}>
            <Users size={16} strokeWidth={2} aria-hidden />
            Invite Member
          </Link>
        </div>
      ) : null}

      {userRole === "executive" ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link to="announcements" style={quickActionButton}>
            <Megaphone size={16} strokeWidth={2} aria-hidden />
            New Announcement
          </Link>
          <Link to="events" style={quickActionButton}>
            <Calendar size={16} strokeWidth={2} aria-hidden />
            New Event
          </Link>
        </div>
      ) : null}

      <div
        className={`grid grid-cols-1 items-stretch gap-4 ${
          userRole === "member" ? "sm:grid-cols-2" : "sm:grid-cols-3"
        }`}
      >
        {userRole !== "member" ? (
          <ClubStatCard
            label="Members"
            value={club.memberCount}
            sublabel="Active members"
            accentColor="#E51937"
            to="members"
          />
        ) : null}
        <ClubStatCard
          label="Upcoming Events"
          value={eventsLoading ? "…" : upcomingEvents.length}
          sublabel="Scheduled events"
          accentColor="#FFC429"
          to="events"
        />
        <ClubStatCard
          label="Meeting"
          value={club.meetingSchedule || "Not set"}
          sublabel={meetingSublabel}
          accentColor="#747676"
          to="events"
          valueFontSize="1.2rem"
        />
      </div>

      <div className="mt-8">
        <div style={sectionHeadingRow}>
          <h2 style={sectionHeading}>{tasksSectionTitle}</h2>
          {dashboardTasks.length > 0 ? (
            <Link to="tasks" style={viewAllLink}>
              View All →
            </Link>
          ) : null}
        </div>
        {tasksLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading tasks…" />
          </div>
        ) : previewTasks.length === 0 ? (
          <div
            className="text-center"
            style={{
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <p style={{ color: "#555555", fontSize: "13px", margin: 0 }}>
              {userRole === "owner"
                ? "No active tasks in this club."
                : "No active tasks assigned to you."}
            </p>
          </div>
        ) : (
          <div>
            {previewTasks.map((task) => (
              <ClubTaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div style={sectionHeadingRow}>
          <h2 style={sectionHeading}>Recent Announcements</h2>
          {posts.length > 0 ? (
            <Link to="announcements" style={viewAllLink}>
              View All →
            </Link>
          ) : null}
        </div>
        {postsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading announcements…" />
          </div>
        ) : posts.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "8px",
            }}
          >
            <p className="text-sm" style={{ color: "#555555" }}>
              No announcements yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <article
                key={post.id}
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #242424",
                  borderLeft: "3px solid #E51937",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                    margin: 0,
                  }}
                >
                  {post.title}
                </h3>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#555555",
                    margin: "6px 0 0",
                  }}
                >
                  {post.authorName ?? "Unknown"} ·{" "}
                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p
                  className="line-clamp-2"
                  style={{
                    fontSize: "13px",
                    color: "#777777",
                    lineHeight: 1.5,
                    margin: "8px 0 0",
                  }}
                >
                  {post.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div style={sectionHeadingRow}>
          <h2 style={sectionHeading}>Upcoming Events</h2>
          {upcomingEvents.length > 0 ? (
            <Link to="events" style={viewAllLink}>
              View All →
            </Link>
          ) : null}
        </div>
        {upcomingEvents.length === 0 ? (
          <div
            className="p-6 text-center"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "8px",
            }}
          >
            <p className="text-sm" style={{ color: "#555555" }}>
              No upcoming events scheduled.
            </p>
            <Link to="events" className="mt-3 inline-block" style={viewAllLink}>
              View Events Page →
            </Link>
          </div>
        ) : (
          <div>
            {previewEvents.map((event) => (
              <ClubEventCard
                key={event.id}
                title={event.title}
                date={event.date}
                time={event.time}
                location={event.location}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
