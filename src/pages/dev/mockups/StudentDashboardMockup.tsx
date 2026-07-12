import type { CSSProperties, ReactNode } from "react";
import {
  MOCK_ANNOUNCEMENTS,
  MOCK_APPLICATIONS,
  MOCK_CLUBS,
  MOCK_EVENTS,
  MOCK_PENDING_REQUESTS,
  MOCK_STUDENTS,
  MOCK_TASKS,
  MOCKUP_BORDER,
  MOCKUP_CARD,
  MOCKUP_CARD_ALT,
  MOCKUP_GOLD,
  MOCKUP_MUTED,
  MOCKUP_MUTED_SOFT,
  MOCKUP_RED,
  MOCKUP_TEXT,
} from "../../../dev/mockupFixtures";

function InitialsAvatar({
  initials,
  size = 32,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size >= 40 ? "10px" : "8px",
        background: "#2a2a2a",
        color: "#888888",
        border: "1px solid #333333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size >= 40 ? "12px" : "11px",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function ColumnCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: string;
}) {
  return (
    <div
      style={{
        background: MOCKUP_CARD_ALT,
        border: `1px solid #2a2a2a`,
        borderRadius: "10px",
        padding: "16px",
        minHeight: "280px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: "15px",
          fontWeight: 700,
          color: MOCKUP_TEXT,
          marginBottom: "12px",
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      {footer ? (
        <button
          type="button"
          style={{
            marginTop: "12px",
            background: "none",
            border: "none",
            padding: 0,
            color: MOCKUP_RED,
            fontSize: "13px",
            fontWeight: 500,
            textAlign: "left",
            cursor: "default",
          }}
        >
          {footer}
        </button>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: MOCKUP_CARD,
        borderRadius: "8px",
        padding: "14px 16px",
        borderLeft: `3px solid ${accent}`,
        borderTop: "1px solid transparent",
        borderRight: "1px solid transparent",
        borderBottom: "1px solid transparent",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontSize: "11px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#747676",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "0 0 3px",
          fontSize: "28px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      <p style={{ margin: 0, fontSize: "11px", color: MOCKUP_MUTED_SOFT }}>{sublabel}</p>
    </div>
  );
}

const rowDivider: CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #1a1a1a",
};

export default function StudentDashboardMockup() {
  const student = MOCK_STUDENTS[0]!;
  const myClubs = MOCK_CLUBS.filter((c) => c.role);
  const upcoming = MOCK_EVENTS.slice(0, 3);
  const tasks = MOCK_TASKS.slice(0, 3);
  const announcements = MOCK_ANNOUNCEMENTS.slice(0, 3);

  return (
    <div
      style={{
        background: "#0B0B0B",
        minHeight: "900px",
        padding: "32px 40px 40px",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        color: MOCKUP_TEXT,
      }}
    >
      {/* App chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
          paddingBottom: "16px",
          borderBottom: `1px solid ${MOCKUP_BORDER}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src="/assets/gryph-icon.png"
            alt=""
            style={{ height: "36px", width: "auto" }}
            aria-hidden
          />
          <span style={{ fontWeight: 800, fontStyle: "italic", fontSize: "20px" }}>
            <span style={{ color: MOCKUP_RED }}>Club</span>
            <span style={{ color: MOCKUP_GOLD }}>Connect</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "13px", color: "#ffffff", borderBottom: `2px solid ${MOCKUP_RED}`, paddingBottom: "4px", fontWeight: 600 }}>
            Dashboard
          </span>
          <span style={{ fontSize: "13px", color: MOCKUP_MUTED }}>Explore</span>
          <span style={{ fontSize: "13px", color: MOCKUP_MUTED }}>Events</span>
          <span style={{ fontSize: "13px", color: MOCKUP_GOLD, fontWeight: 600 }}>Hiring</span>
          <InitialsAvatar initials={student.initials} size={32} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#ffffff" }}>
            Welcome back, {student.name.split(" ")[0]}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#999999" }}>
            Here&apos;s what&apos;s happening across your clubs this week.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span
            style={{
              height: "36px",
              padding: "0 16px",
              borderRadius: "8px",
              background: MOCKUP_RED,
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Create a Club
          </span>
          <span
            style={{
              height: "36px",
              padding: "0 16px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.12)",
              color: MOCKUP_TEXT,
              fontSize: "13px",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Join with Code
          </span>
        </div>
      </div>

      {/* Pending request banner */}
      {MOCK_PENDING_REQUESTS.map((req) => (
        <div
          key={req.id}
          style={{
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "14px 18px",
            background: "rgba(153, 153, 136, 0.08)",
            border: "1px solid rgba(153, 153, 136, 0.28)",
            borderRadius: "12px",
          }}
        >
          <InitialsAvatar initials={req.abbreviation} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "14px" }}>{req.clubName}</p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#999988" }}>
              Your join request is awaiting approval.
            </p>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#999988",
              border: "1px solid #666655",
              borderRadius: "12px",
              padding: "3px 10px",
            }}
          >
            {req.statusLabel}
          </span>
        </div>
      ))}

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <StatCard label="My Clubs" value={String(myClubs.length)} sublabel="Active memberships" accent={MOCKUP_RED} />
        <StatCard label="Upcoming" value="4" sublabel="Events this month" accent={MOCKUP_GOLD} />
        <StatCard label="Tasks" value="3" sublabel="My open tasks" accent={MOCKUP_RED} />
        <StatCard label="Applications" value="2" sublabel="Roles in progress" accent="#747676" />
      </div>

      <div
        style={{
          width: "100%",
          background: "#1a1500",
          border: "1px solid #3a2f00",
          borderRadius: "8px",
          padding: "10px 16px",
          marginBottom: "20px",
          fontSize: "13px",
          color: MOCKUP_GOLD,
        }}
      >
        You have 2 tasks due in the next 3 days
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          borderBottom: `1px solid ${MOCKUP_BORDER}`,
          marginBottom: "20px",
        }}
      >
        {["Overview", "This Month", "Inbox", "My Clubs", "Tasks", "Events"].map((tab, i) => (
          <span
            key={tab}
            style={{
              paddingBottom: "10px",
              fontSize: "14px",
              fontWeight: i === 0 ? 600 : 500,
              color: i === 0 ? "#ffffff" : MOCKUP_MUTED,
              borderBottom: i === 0 ? `2px solid ${MOCKUP_RED}` : "2px solid transparent",
            }}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Overview grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "34fr 34fr 28fr",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        <ColumnCard title="My Tasks" footer="View All Tasks →">
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                ...rowDivider,
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <InitialsAvatar
                initials={MOCK_CLUBS.find((c) => c.name === task.clubName)?.abbreviation ?? "CL"}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{task.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: MOCKUP_MUTED }}>{task.clubName}</p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "11px",
                    color: task.urgency === "soon" ? MOCKUP_GOLD : MOCKUP_MUTED,
                  }}
                >
                  {task.dueLabel}
                </p>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  borderRadius: "5px",
                  padding: "3px 8px",
                  background: task.status === "In Progress" ? "#1f1a00" : "#1a1a1a",
                  border: `1px solid ${task.status === "In Progress" ? "#2a2400" : "#333"}`,
                  color: task.status === "In Progress" ? "#9a7a00" : "#666",
                }}
              >
                {task.status}
              </span>
            </div>
          ))}
        </ColumnCard>

        <ColumnCard title="Upcoming Events" footer="View All Events →">
          {upcoming.map((event) => (
            <div
              key={event.id}
              style={{
                ...rowDivider,
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <InitialsAvatar
                initials={MOCK_CLUBS.find((c) => c.name === event.clubName)?.abbreviation ?? "CL"}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{event.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: MOCKUP_MUTED }}>{event.clubName}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: MOCKUP_MUTED }}>
                  {event.location} · {event.time}
                </p>
              </div>
              <div
                style={{
                  width: "40px",
                  height: "44px",
                  borderRadius: "8px",
                  background: MOCKUP_RED,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  lineHeight: 1.1,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "9px", fontWeight: 600 }}>{event.month}</span>
                <span style={{ fontSize: "16px", fontWeight: 700 }}>{event.day}</span>
              </div>
            </div>
          ))}
        </ColumnCard>

        <ColumnCard title="My Clubs" footer="View All Clubs →">
          {myClubs.map((club) => (
            <div
              key={club.id}
              style={{
                ...rowDivider,
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
              }}
            >
              <InitialsAvatar initials={club.abbreviation} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{club.name}</p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: club.role === "Executive" ? MOCKUP_RED : "#747676",
                    border: `1px solid ${club.role === "Executive" ? MOCKUP_RED : "#747676"}`,
                    background: club.role === "Executive" ? "#1a0505" : "#1a1a1a",
                    borderRadius: "12px",
                    padding: "2px 10px",
                  }}
                >
                  {club.role}
                </span>
              </div>
            </div>
          ))}
        </ColumnCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <ColumnCard title="Role Applications" footer="View Hiring →">
          {MOCK_APPLICATIONS.slice(0, 3).map((app) => (
            <div key={app.id} style={{ ...rowDivider }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{app.roleTitle}</p>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: MOCKUP_MUTED }}>{app.clubName}</p>
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: MOCKUP_GOLD }}>{app.status}</p>
            </div>
          ))}
        </ColumnCard>

        <ColumnCard title="Recent Announcements" footer="View All Announcements →">
          {announcements.map((a) => (
            <div key={a.id} style={{ ...rowDivider }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{a.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: MOCKUP_MUTED }}>{a.clubName}</p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: MOCKUP_MUTED_SOFT }}>{a.timeAgo}</p>
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: MOCKUP_MUTED, lineHeight: 1.45 }}>
                {a.preview}
              </p>
            </div>
          ))}
        </ColumnCard>
      </div>
    </div>
  );
}
