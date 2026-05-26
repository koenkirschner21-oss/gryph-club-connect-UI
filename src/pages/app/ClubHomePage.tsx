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

const quickActionNeutralButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "transparent",
  backgroundColor: "transparent",
  border: "1px solid #333333",
  color: "#cccccc",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
};

function formatEventTime12h(timeStr: string): string {
  const t = timeStr.trim();
  const ampmMatch = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2];
    if (hour >= 1 && hour <= 12) {
      return `${hour}:${minute} ${ampmMatch[3].toUpperCase()}`;
    }
  }
  const m24 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    let hour = parseInt(m24[1], 10);
    const minute = m24[2];
    if (hour <= 23) {
      const period = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${minute} ${period}`;
    }
  }
  return t;
}

function formatEventDateShort(dateStr: string): string {
  const trimmed = dateStr.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
      return "#E51937";
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
  valueColor = "#ffffff",
}: {
  label: string;
  value: string | number;
  sublabel: string;
  accentColor: string;
  to?: string;
  valueFontSize?: string;
  valueColor?: string;
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
        transform: hovered && to ? "translateY(-1px)" : undefined,
        transition: "all 0.15s ease",
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
          color: valueColor,
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
    time && time.trim() !== "" && time.toUpperCase() !== "TBD"
      ? formatEventTime12h(time)
      : null;
  const dateShort = formatEventDateShort(date);
  const locationLabel =
    location && !isHiddenLocation(location) ? location.trim() : null;

  const metaParts = [dateShort, timeLabel, locationLabel].filter(Boolean);

  return (
    <div
      className="flex"
      style={{
        gap: "14px",
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
        {metaParts.length > 0 ? (
          <p
            style={{
              fontSize: "12px",
              color: "#555555",
              margin: "4px 0 0",
            }}
          >
            {metaParts.join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ClubTaskCard({ task }: { task: Task }) {
  const [hovered, setHovered] = useState(false);
  const statusLabel =
    task.status === "in_progress"
      ? "In progress"
      : task.status === "done"
        ? "Done"
        : "To do";

  return (
    <Link to="tasks" className="block no-underline">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#1a1a1a",
          borderTop: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderRight: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderBottom: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderLeft: `3px solid ${taskStatusAccent(task.status)}`,
          borderRadius: "8px",
          padding: "14px 16px",
          marginBottom: "8px",
          transform: hovered ? "translateY(-1px)" : undefined,
          transition: "all 0.15s ease",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 4px",
          }}
        >
          {task.title}
        </p>
        <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
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
          <Link to="events" style={quickActionOutlineButton}>
            <Calendar size={16} strokeWidth={2} aria-hidden />
            New Event
          </Link>
          <Link to="members" style={quickActionNeutralButton}>
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
          <Link to="events" style={quickActionOutlineButton}>
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
          value={club.meetingSchedule?.trim() || "Not scheduled"}
          sublabel={meetingSublabel}
          accentColor="#747676"
          to="events"
          valueFontSize={club.meetingSchedule?.trim() ? "2rem" : "14px"}
          valueColor={club.meetingSchedule?.trim() ? "#ffffff" : "#555555"}
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
