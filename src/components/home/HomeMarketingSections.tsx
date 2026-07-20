import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Calendar,
  CheckSquare,
  MessageSquare,
  Search,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getClubInitials } from "../../lib/clubUtils";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";

const sectionShell: CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "0 16px",
};

export function HomePathSection() {
  const paths = [
    {
      title: "Discover",
      description: "Browse student clubs at the University of Guelph by interest, category, or keyword.",
      to: "/explore",
      cta: "Explore Clubs",
      accent: ACCENT_RED,
      Icon: Search,
    },
    {
      title: "Join",
      description: "Create an account, request to join clubs, and keep events, tasks, and chats in one place.",
      to: "/signup",
      cta: "Sign Up Free",
      accent: GOLD,
      Icon: UserPlus,
    },
    {
      title: "Manage",
      description: "Run your club workspace — announcements, hiring, documents, events, and membership.",
      to: "/explore?claim=true",
      cta: "Claim or Create a Club",
      accent: ACCENT_RED,
      Icon: Settings,
    },
  ] as const;

  return (
    <section
      aria-labelledby="home-paths-heading"
      style={{
        padding: "56px 0",
        background:
          "linear-gradient(180deg, #141010 0%, #0f0f0f 42%, #0f0f0f 100%)",
        borderTop: "1px solid #1e1e1e",
        borderBottom: "1px solid #1e1e1e",
      }}
    >
      <div style={sectionShell}>
        <h2
          id="home-paths-heading"
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          Discover · Join · Manage
        </h2>
        <p
          style={{
            margin: "8px auto 28px",
            maxWidth: "520px",
            fontSize: "14px",
            color: "#777777",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Whether you are exploring campus life or leading a club, start from the path that fits.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          {paths.map((path) => (
            <Link
              key={path.title}
              to={path.to}
              className="block no-underline"
              style={{
                background: "#141414",
                border: "1px solid #242424",
                borderTop: `3px solid ${path.accent}`,
                borderRadius: "12px",
                padding: "22px 20px",
                transition: "border-color 0.15s ease, transform 0.15s ease",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = "#333333";
                event.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = "#242424";
                event.currentTarget.style.transform = "none";
              }}
            >
              <path.Icon size={20} color={path.accent} aria-hidden />
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {path.title}
              </p>
              <p
                style={{
                  margin: "8px 0 16px",
                  fontSize: "13px",
                  color: "#777777",
                  lineHeight: 1.55,
                  minHeight: "60px",
                }}
              >
                {path.description}
              </p>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: path.accent,
                }}
              >
                {path.cta} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

type HomeOpenPosition = {
  id: string;
  title: string;
  clubName: string;
  clubLogoUrl: string | null;
  deadline: string | null;
};

export function HomeOpenPositionsBlock() {
  const [positions, setPositions] = useState<HomeOpenPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("club_positions")
        .select(
          `
          id,
          title,
          deadline,
          clubs (
            name,
            logo_url
          )
        `,
        )
        .eq("is_open", true)
        .order("created_at", { ascending: false })
        .limit(4);

      if (cancelled) return;

      if (error) {
        console.error("Failed to load open positions for home:", error.message);
        setPositions([]);
        setLoading(false);
        return;
      }

      const mapped = (data ?? []).map((row) => {
        const clubRaw = row.clubs as unknown;
        const club = (
          Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
        ) as Record<string, unknown>;
        return {
          id: row.id as string,
          title: (row.title as string) ?? "Open role",
          clubName: (club.name as string) ?? "Club",
          clubLogoUrl: (club.logo_url as string | null) ?? null,
          deadline: (row.deadline as string | null) ?? null,
        };
      });

      setPositions(mapped);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || positions.length === 0) return null;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          Open Positions
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#777777" }}>
          Roles clubs are hiring for right now
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {positions.map((position) => (
          <Link
            key={position.id}
            to={`/hiring?listing=${encodeURIComponent(position.id)}`}
            className="no-underline"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 14px",
              background: "#141414",
              border: "1px solid #242424",
              borderRadius: "10px",
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = "#333333";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = "#242424";
            }}
          >
            {position.clubLogoUrl ? (
              <img
                src={position.clubLogoUrl}
                alt=""
                width={36}
                height={36}
                loading="lazy"
                decoding="async"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  objectFit: "cover",
                  background: "#1a1a1a",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  color: "#888888",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {getClubInitials({ name: position.clubName })}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {position.title}
              </p>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: "12px",
                  color: "#777777",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {position.clubName}
                {position.deadline
                  ? ` · Closes ${new Date(position.deadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}`
                  : ""}
              </p>
            </div>
            <Briefcase size={16} color={GOLD} aria-hidden />
          </Link>
        ))}
      </div>
      <Link
        to="/hiring"
        style={{
          display: "inline-block",
          marginTop: 14,
          fontSize: 13,
          fontWeight: 600,
          color: ACCENT_RED,
          textDecoration: "none",
        }}
      >
        Browse all open positions →
      </Link>
    </div>
  );
}

const CLUB_NEEDS = [
  {
    title: "Announcements",
    description: "Pin updates members actually see.",
    Icon: MessageSquare,
  },
  {
    title: "Tasks",
    description: "Assign work and track deadlines.",
    Icon: CheckSquare,
  },
  {
    title: "Events",
    description: "Publish, RSVP, and review responses.",
    Icon: Calendar,
  },
  {
    title: "Hiring",
    description: "Post roles and review applications.",
    Icon: Briefcase,
  },
  {
    title: "Members",
    description: "Manage roles, join requests, and access.",
    Icon: Users,
  },
  {
    title: "Documents",
    description: "Keep files and resource links organized.",
    Icon: Settings,
  },
] as const;

export function HomeEverythingSection() {
  return (
    <section
      aria-labelledby="home-everything-heading"
      style={{
        padding: "64px 0",
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(229,25,55,0.12), transparent 55%), #0f0f0f",
        borderTop: "1px solid #1e1e1e",
      }}
    >
      <div style={sectionShell}>
        <h2
          id="home-everything-heading"
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          Everything Your Club Needs
        </h2>
        <p
          style={{
            margin: "8px auto 32px",
            maxWidth: "540px",
            fontSize: "14px",
            color: "#777777",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Private club operations in one workspace — without turning ClubConnect into another social network.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
          }}
        >
          {CLUB_NEEDS.map((item) => (
            <div
              key={item.title}
              style={{
                background: "#141414",
                border: "1px solid #242424",
                borderRadius: "10px",
                padding: "18px 16px",
              }}
            >
              <item.Icon size={18} color={ACCENT_RED} aria-hidden />
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "13px",
                  color: "#777777",
                  lineHeight: 1.45,
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "36px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          {[
            {
              src: "/mockup-exports/explore-clubs.png",
              alt: "Explore clubs screen with club cards and filters",
            },
            {
              src: "/mockup-exports/club-workspace.png",
              alt: "Club workspace command center with member activity",
            },
            {
              src: "/mockup-exports/student-dashboard.png",
              alt: "Student dashboard with joined clubs and tasks",
            },
          ].map((shot) => (
            <img
              key={shot.src}
              src={shot.src}
              alt={shot.alt}
              width={1440}
              height={900}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                borderRadius: "10px",
                border: "1px solid #2a2a2a",
                background: "#141414",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeProductShowcase({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 600,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-12% -8%",
          background:
            "radial-gradient(circle at 30% 20%, rgba(229,25,55,0.28), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,196,41,0.16), transparent 40%)",
          filter: "blur(8px)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
