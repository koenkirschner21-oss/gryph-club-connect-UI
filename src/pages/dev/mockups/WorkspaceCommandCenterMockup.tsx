import type { ReactNode } from "react";
import {
  MOCK_ANNOUNCEMENTS,
  MOCK_EVENTS,
  MOCK_JOIN_QUEUE,
  MOCK_SETUP_CHECKLIST,
  MOCK_TASKS,
  MOCK_WORKSPACE_NAV,
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
  size = 28,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#242424",
        color: MOCKUP_RED,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "11px",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function Panel({
  title,
  children,
  accent,
}: {
  title: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: MOCKUP_CARD_ALT,
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
        padding: "16px",
        borderTop: accent ? `2px solid ${accent}` : "1px solid #2a2a2a",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          color: MOCKUP_TEXT,
          marginBottom: "12px",
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export default function WorkspaceCommandCenterMockup() {
  const setupDone = MOCK_SETUP_CHECKLIST.filter((s) => s.done).length;
  const setupTotal = MOCK_SETUP_CHECKLIST.length;
  const setupPct = Math.round((setupDone / setupTotal) * 100);

  return (
    <div
      style={{
        background: "#0B0B0B",
        minHeight: "900px",
        display: "flex",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        color: MOCKUP_TEXT,
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: "240px",
          flexShrink: 0,
          background: "#111111",
          borderRight: "1px solid #1e1e1e",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: "#1a1a1a",
                border: "1px solid #333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
                color: "#888",
              }}
            >
              ADC
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Agora Design Club
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: MOCKUP_GOLD }}>
                President
              </p>
            </div>
          </div>
        </div>

        <nav style={{ padding: "12px 8px", flex: 1 }}>
          {MOCK_WORKSPACE_NAV.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: "6px",
                borderLeft: item.active ? `3px solid ${MOCKUP_RED}` : "3px solid transparent",
                background: item.active ? "#1f1f1f" : "transparent",
                padding: item.active ? "9px 14px 9px 11px" : "9px 14px",
                marginBottom: "2px",
                fontSize: "13px",
                color: item.active ? "#ffffff" : "#777777",
                fontWeight: item.active ? 500 : 400,
              }}
            >
              <span>{item.label}</span>
              {"badge" in item && item.badge ? (
                <span
                  style={{
                    background: MOCKUP_RED,
                    color: "#fff",
                    borderRadius: "20px",
                    minWidth: "18px",
                    height: "18px",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "0 5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </div>
          ))}
        </nav>

        <div style={{ padding: "12px", borderTop: "1px solid #1e1e1e" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px",
              background: "#141414",
              borderRadius: "8px",
            }}
          >
            <InitialsAvatar initials="AC" size={32} />
            <div>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 600 }}>Alex Chen</p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: MOCKUP_MUTED }}>
                Managing Agora Design
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px", background: "#0f0f0f" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: MOCKUP_MUTED_SOFT,
              }}
            >
              Club Workspace
            </p>
            <h1 style={{ margin: "4px 0 0", fontSize: "24px", fontWeight: 800, color: "#fff" }}>
              Command Center
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: MOCKUP_MUTED }}>
              Run Agora Design Club from one place — setup, people, events, and hiring.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["New Announcement", "Create Event", "Assign Task"].map((label, i) => (
              <span
                key={label}
                style={{
                  height: "34px",
                  padding: "0 14px",
                  borderRadius: "8px",
                  background: i === 0 ? MOCKUP_RED : "transparent",
                  border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.12)",
                  color: i === 0 ? "#fff" : MOCKUP_TEXT,
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Setup checklist */}
        <div
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            background: "rgba(255, 196, 41, 0.08)",
            border: "1px solid rgba(255, 196, 41, 0.28)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: MOCKUP_GOLD, fontSize: "14px" }}>
                Finish setup for Agora Design Club
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#cccccc" }}>
                {setupDone} of {setupTotal} checklist items complete — publish on Explore when ready.
              </p>
            </div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: MOCKUP_GOLD }}>{setupPct}%</span>
          </div>
          <div
            style={{
              height: "6px",
              background: "#2a2a2a",
              borderRadius: "3px",
              overflow: "hidden",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: `${setupPct}%`,
                height: "100%",
                background: MOCKUP_GOLD,
                borderRadius: "3px",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {MOCK_SETUP_CHECKLIST.map((item) => (
              <span
                key={item.label}
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: item.done ? "rgba(34,197,94,0.12)" : "#1a1a1a",
                  border: `1px solid ${item.done ? "#166534" : "#333"}`,
                  color: item.done ? "#22c55e" : MOCKUP_MUTED,
                }}
              >
                {item.done ? "✓ " : ""}
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Summary strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {[
            { label: "Members", value: "32", accent: MOCKUP_RED },
            { label: "Pending joins", value: "3", accent: MOCKUP_GOLD },
            { label: "Open tasks", value: "4", accent: MOCKUP_RED },
            { label: "Applicants", value: "5", accent: "#747676" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: MOCKUP_CARD,
                borderRadius: "8px",
                padding: "12px 14px",
                borderLeft: `3px solid ${stat.accent}`,
              }}
            >
              <p style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#fff" }}>{stat.value}</p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: MOCKUP_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <Panel title="Pending Join Requests" accent={MOCKUP_GOLD}>
            {MOCK_JOIN_QUEUE.map((person) => (
              <div
                key={person.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 0",
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <InitialsAvatar initials={person.initials} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>{person.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: MOCKUP_MUTED }}>
                    {person.program}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#fff",
                    background: MOCKUP_RED,
                    borderRadius: "6px",
                    padding: "4px 10px",
                  }}
                >
                  Review
                </span>
              </div>
            ))}
          </Panel>

          <Panel title="Upcoming Events" accent={MOCKUP_RED}>
            {MOCK_EVENTS.slice(1, 4).map((event) => (
              <div
                key={event.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>{event.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: MOCKUP_MUTED }}>
                  {event.dateLabel} · {event.time} · {event.location}
                </p>
              </div>
            ))}
          </Panel>

          <Panel title="Open Tasks">
            {MOCK_TASKS.filter((t) => t.clubName === "Agora Design Club")
              .concat(MOCK_TASKS.slice(0, 2))
              .slice(0, 4)
              .map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #1a1a1a",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>{task.title}</p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "11px",
                      color: task.urgency === "soon" ? MOCKUP_GOLD : MOCKUP_MUTED,
                    }}
                  >
                    {task.dueLabel} · {task.status}
                  </p>
                </div>
              ))}
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Panel title="Recent Announcements">
            {MOCK_ANNOUNCEMENTS.slice(0, 2).map((a) => (
              <div
                key={a.id}
                style={{ padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}
              >
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>{a.title}</p>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: MOCKUP_MUTED, lineHeight: 1.45 }}>
                  {a.preview}
                </p>
              </div>
            ))}
          </Panel>

          <Panel title="Hiring Snapshot" accent={MOCKUP_RED}>
            {[
              { role: "Events Coordinator", count: "3 applicants" },
              { role: "Social Media Coordinator", count: "2 applicants" },
            ].map((row) => (
              <div
                key={row.role}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>{row.role}</p>
                <p style={{ margin: 0, fontSize: "12px", color: MOCKUP_GOLD }}>{row.count}</p>
              </div>
            ))}
            <p style={{ margin: "12px 0 0", fontSize: "12px", color: MOCKUP_MUTED }}>
              5 candidates in pipeline · review in Hiring
            </p>
          </Panel>
        </div>
      </main>
    </div>
  );
}
