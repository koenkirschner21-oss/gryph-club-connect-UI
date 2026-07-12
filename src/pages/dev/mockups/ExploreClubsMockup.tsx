import {
  MOCK_CATEGORIES,
  MOCK_CLUBS,
  MOCKUP_BORDER,
  MOCKUP_CARD,
  MOCKUP_GOLD,
  MOCKUP_MUTED,
  MOCKUP_MUTED_SOFT,
  MOCKUP_RED,
  MOCKUP_TEXT,
} from "../../../dev/mockupFixtures";

function statusStyle(status: (typeof MOCK_CLUBS)[number]["status"]) {
  if (status === "Recruiting") {
    return {
      background: "#1a0505",
      border: `1px solid ${MOCKUP_RED}`,
      color: MOCKUP_RED,
    };
  }
  if (status === "Following") {
    return {
      background: "#1a1a1a",
      border: "1px solid #555555",
      color: "#747676",
    };
  }
  if (status === "Request to Join") {
    return {
      background: "#1a1500",
      border: "1px solid #3a3010",
      color: MOCKUP_GOLD,
    };
  }
  return {
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#cccccc",
  };
}

export default function ExploreClubsMockup() {
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
          <span style={{ fontSize: "13px", color: MOCKUP_MUTED }}>Dashboard</span>
          <span
            style={{
              fontSize: "13px",
              color: "#ffffff",
              borderBottom: `2px solid ${MOCKUP_RED}`,
              paddingBottom: "4px",
              fontWeight: 600,
            }}
          >
            Explore
          </span>
          <span style={{ fontSize: "13px", color: MOCKUP_MUTED }}>Events</span>
          <span style={{ fontSize: "13px", color: MOCKUP_GOLD, fontWeight: 600 }}>Hiring</span>
        </div>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#ffffff" }}>
          Explore Clubs
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: MOCKUP_MUTED, maxWidth: "520px" }}>
          Discover campus clubs, see how they meet, and join the ones that fit you.
        </p>
      </div>

      <div
        style={{
          marginTop: "20px",
          marginBottom: "16px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "42px",
            borderRadius: "10px",
            border: `1px solid ${MOCKUP_BORDER}`,
            background: "#131313",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            color: MOCKUP_MUTED_SOFT,
            fontSize: "14px",
          }}
        >
          Search clubs by name, interest, or category…
        </div>
        <span
          style={{
            height: "42px",
            padding: "0 18px",
            borderRadius: "10px",
            background: MOCKUP_RED,
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Search
        </span>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
        {MOCK_CATEGORIES.map((cat, i) => (
          <span
            key={cat}
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "9999px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 600,
              background: i === 0 ? MOCKUP_RED : MOCKUP_CARD,
              color: i === 0 ? "#ffffff" : MOCKUP_MUTED,
              border: i === 0 ? "none" : `1px solid ${MOCKUP_BORDER}`,
            }}
          >
            {cat}
          </span>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
        }}
      >
        {MOCK_CLUBS.map((club) => {
          const badge = statusStyle(club.status);
          return (
            <div
              key={club.id}
              style={{
                background: MOCKUP_CARD,
                border: "1px solid #242424",
                borderTop: `2px solid ${MOCKUP_RED}`,
                borderRadius: "10px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                minHeight: "220px",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "8px",
                    background: "#2a2a2a",
                    border: "1px solid #333",
                    color: "#888",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "13px",
                    flexShrink: 0,
                  }}
                >
                  {club.abbreviation}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#fff" }}>
                    {club.name}
                  </p>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "6px",
                      fontSize: "11px",
                      color: "#747676",
                      background: "#111",
                      border: "1px solid #222",
                      borderRadius: "20px",
                      padding: "3px 10px",
                    }}
                  >
                    {club.category}
                  </span>
                </div>
              </div>

              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: "13px",
                  color: "#999999",
                  lineHeight: 1.5,
                  flex: 1,
                }}
              >
                {club.description}
              </p>

              <p style={{ margin: "12px 0 0", fontSize: "12px", color: MOCKUP_MUTED }}>
                {club.meeting}
              </p>

              <div
                style={{
                  marginTop: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    borderRadius: "4px",
                    padding: "2px 8px",
                    ...badge,
                  }}
                >
                  {club.status}
                </span>
                <span style={{ fontSize: "12px", color: MOCKUP_MUTED_SOFT }}>
                  {club.memberCount} members
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
