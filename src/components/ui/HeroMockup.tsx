import { useState } from "react";

export default function HeroMockup() {
  const [activeTab, setActiveTab] = useState<"events" | "chat" | "tasks">("events");

  return (
    <div
      style={{
        background: "#1a1a1a",
        borderRadius: 12,
        overflow: "hidden",
        width: 520,
        maxWidth: "100%",
        border: "1px solid #2a2a2a",
        fontFamily: "inherit",
      }}
    >
      <div style={{ background: "#141414", borderBottom: "1px solid #222", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 16, background: "#E51937", borderRadius: 3 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>GryphClubConnect</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 10, color: "#fff", borderBottom: "1.5px solid #E51937", paddingBottom: 1 }}>Dashboard</span>
          <span style={{ fontSize: 10, color: "#555" }}>Explore</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", height: 280 }}>
        <div style={{ background: "#111", borderRight: "1px solid #1e1e1e", padding: "12px 8px" }}>
          <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, padding: "0 4px" }}>My Clubs</div>
          {[{ initials: "BFG", color: "#E51937", name: "Beta for Gryph", active: true },
            { initials: "GCC", color: "#FFC429", name: "Gryph Connect", active: false },
            { initials: "MKT", color: "#1f1f1f", name: "Marketing", active: false }
          ].map((club) => (
            <div key={club.initials} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 5, marginBottom: 3, background: club.active ? "#1f1f1f" : "transparent", borderLeft: club.active ? "2px solid #E51937" : "2px solid transparent" }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: club.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: club.color === "#FFC429" ? "#000" : "#fff", border: club.color === "#1f1f1f" ? "1px solid #333" : "none" }}>{club.initials}</div>
              <span style={{ fontSize: 9, color: club.active ? "#fff" : "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{club.name}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, borderTop: "1px solid #1e1e1e", paddingTop: 8 }}>
            <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, padding: "0 4px" }}>Workspace</div>
            {[{ icon: "📊", label: "Dashboard", active: true }, { icon: "💬", label: "Chat", active: false }, { icon: "✅", label: "Tasks", active: false }, { icon: "📅", label: "Events", active: false }].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 5, marginBottom: 2, background: item.active ? "#1f1f1f" : "transparent", borderLeft: item.active ? "2px solid #E51937" : "2px solid transparent" }}>
                <span style={{ fontSize: 9 }}>{item.icon}</span>
                <span style={{ fontSize: 9, color: item.active ? "#fff" : "#666" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "14px 16px", overflow: "hidden", minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Dashboard</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 10 }}>
            {[{ num: "12", label: "Members", color: "#E51937" }, { num: "3", label: "Events", color: "#FFC429" }, { num: "7", label: "Tasks", color: "#747676" }].map((stat) => (
              <div key={stat.label} style={{ background: "#222", borderRadius: 5, padding: "6px 7px", borderLeft: `2px solid ${stat.color}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{stat.num}</div>
                <div style={{ fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {(["events", "chat", "tasks"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: activeTab === tab ? "#E51937" : "#1a1a1a", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 9, color: activeTab === tab ? "#fff" : "#777", cursor: "pointer" }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "events" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff", marginBottom: 6 }}>Upcoming Events</div>
              {[{ month: "MAY", day: "24", title: "Weekly Meeting", meta: "Zoom · 6:00 PM", badge: "✓ Going", badgeBg: "#0d2b0d", badgeColor: "#4ade80" },
                { month: "JUN", day: "01", title: "End of Year Social", meta: "UC Courtyard", badge: "? Maybe", badgeBg: "#2a2a0d", badgeColor: "#FFC429" }
              ].map((ev) => (
                <div key={ev.title} style={{ background: "#222", borderRadius: 5, padding: "7px 8px", display: "flex", alignItems: "center", gap: 7, marginBottom: 5, border: "1px solid #2a2a2a" }}>
                  <div style={{ width: 26, height: 26, background: "#E51937", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 6, color: "#fff", textTransform: "uppercase", lineHeight: 1 }}>{ev.month}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{ev.day}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#ddd", fontWeight: 500 }}>{ev.title}</div>
                    <div style={{ fontSize: 8, color: "#555" }}>{ev.meta}</div>
                  </div>
                  <div style={{ fontSize: 7, padding: "2px 6px", borderRadius: 10, background: ev.badgeBg, color: ev.badgeColor, whiteSpace: "nowrap" }}>{ev.badge}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "chat" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff", marginBottom: 6 }}># general</div>
              {[{ initials: "KK", bg: "#E51937", name: "Koen Kirschner", time: "11:11 AM", msg: "Weekly check-in at 6 PM tonight!" },
                { initials: "JD", bg: "#FFC429", name: "Jane Doe", time: "11:14 AM", msg: "See everyone there 👍" }
              ].map((m) => (
                <div key={m.name} style={{ background: "#222", borderRadius: 5, padding: "7px 8px", display: "flex", alignItems: "flex-start", gap: 6, border: "1px solid #2a2a2a", marginBottom: 5 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: m.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: m.bg === "#FFC429" ? "#000" : "#fff" }}>{m.initials}</div>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 600, color: "#fff" }}>{m.name} <span style={{ color: "#444", fontWeight: 400 }}>{m.time}</span></div>
                    <div style={{ fontSize: 8, color: "#888", marginTop: 1 }}>{m.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "tasks" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff", marginBottom: 6 }}>Active Tasks</div>
              {[{ title: "Review sponsorship deck", due: "Due May 20", priority: "medium", priorityColor: "#FFC429", priorityBg: "#2a1500" },
                { title: "Post Instagram update", due: "Due May 22", priority: "high", priorityColor: "#E51937", priorityBg: "#2a0a0a" }
              ].map((task) => (
                <div key={task.title} style={{ background: "#222", borderRadius: 5, padding: "7px 8px", display: "flex", alignItems: "center", gap: 7, marginBottom: 5, border: "1px solid #2a2a2a" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, border: "1.5px solid #E51937", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#ddd", fontWeight: 500 }}>{task.title}</div>
                    <div style={{ fontSize: 8, color: "#555" }}>{task.due}</div>
                  </div>
                  <div style={{ fontSize: 7, padding: "2px 6px", borderRadius: 10, background: task.priorityBg, color: task.priorityColor }}>{task.priority}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
