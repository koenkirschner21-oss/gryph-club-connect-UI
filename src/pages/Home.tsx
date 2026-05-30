import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import { useClubContext } from "../context/useClubContext";
import { getClubInitials } from "../lib/clubUtils";
import { supabase } from "../lib/supabaseClient";
import BrandLogo from "../components/ui/BrandLogo";
import UpcomingEventsSection from "../components/ui/UpcomingEventsSection";
import Spinner from "../components/ui/Spinner";
import type { Club } from "../types";

const CLUB_AVATAR_BACKGROUNDS = ["#1a0505", "#1a1500", "#0a0a1a", "#0a1a0a", "#1a0a1a"] as const;

const CLUB_AVATAR_BORDERS: Record<(typeof CLUB_AVATAR_BACKGROUNDS)[number], string> = {
  "#1a0505": "#2a1515",
  "#1a1500": "#2a2510",
  "#0a0a1a": "#1a1a2a",
  "#0a1a0a": "#1a2a1a",
  "#1a0a1a": "#2a1a2a",
};

function getClubAvatarColors(clubName: string): { bg: string; border: string } {
  const bgIndex = clubName.charCodeAt(0) % CLUB_AVATAR_BACKGROUNDS.length;
  const bg = CLUB_AVATAR_BACKGROUNDS[bgIndex];
  return { bg, border: CLUB_AVATAR_BORDERS[bg] };
}

function clubInitials(club: Pick<Club, "abbreviation" | "name">): string {
  return getClubInitials(club).slice(0, 3);
}

function mapClubFromRow(row: Record<string, unknown>): Club {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    slug: (row.slug as string) ?? (row.id as string),
    description: (row.description as string) ?? "",
    shortDescription: (row.short_description as string) ?? undefined,
    category: (row.category as string) ?? "",
    memberCount: (row.member_count as number) ?? 0,
    meetingSchedule: (row.meeting_schedule as string) ?? "",
    location: (row.location as string) ?? "",
    imageUrl:
      (row.image_url as string) ??
      (row.logo_url as string) ??
      "/assets/placeholders/placeholder-rect.svg",
    logoUrl: (row.logo_url as string) ?? undefined,
    tags: [],
    contactEmail: (row.contact_email as string) ?? "",
    isPublic: (row.is_public as boolean) ?? true,
    events: [],
    abbreviation: (row.abbreviation as string) ?? undefined,
  };
}

const MOCK_NAV_ITEMS = [
  { label: "Dashboard", dot: "#E51937", active: true },
  { label: "Announcements", dot: "#FFC429", active: false },
  { label: "Chat", dot: "#555555", active: false },
  { label: "Tasks", dot: "#555555", active: false },
  { label: "Events", dot: "#555555", active: false },
] as const;

function DashboardHeroMockup() {
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1e1e1e",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        width: "100%",
        maxWidth: "520px",
      }}
    >
      <div
        style={{
          background: "#0f0f0f",
          borderBottom: "1px solid #1e1e1e",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {["#E51937", "#FFC429", "#555555"].map((color) => (
            <span
              key={color}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: color,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            fontSize: "10px",
          }}
        >
          <img
            src="/assets/gryph-icon.png"
            alt=""
            style={{ width: "16px", height: "16px", objectFit: "contain" }}
            aria-hidden
          />
          <span style={{ fontWeight: 700, fontStyle: "italic" }}>
            <span style={{ color: "#E51937" }}>Club</span>
            <span style={{ color: "#FFC429" }}>Connect</span>
          </span>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "300px" }}>
        <div
          style={{
            width: "108px",
            flexShrink: 0,
            background: "#111111",
            borderRight: "1px solid #1e1e1e",
            padding: "10px 0",
          }}
        >
          {MOCK_NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 8px",
                marginBottom: "2px",
                fontSize: "8px",
                color: item.active ? "#ffffff" : "#555555",
                background: item.active ? "#1f1f1f" : "transparent",
                borderLeft: item.active
                  ? "2px solid #E51937"
                  : "2px solid transparent",
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: item.dot,
                  flexShrink: 0,
                }}
              />
              <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, padding: "16px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "10px", color: "#555555" }}>
            Welcome back
          </p>
          <p
            style={{
              margin: "2px 0 12px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            Koen
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
            }}
          >
            {[
              { value: "12", label: "MEMBERS", accent: "#E51937" },
              { value: "3", label: "EVENTS", accent: "#FFC429" },
              { value: "7", label: "TASKS", accent: "#555555" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "6px",
                  padding: "8px",
                  boxSizing: "border-box",
                  borderLeft: `3px solid ${stat.accent}`,
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.2,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "7px",
                    color: "#555555",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginTop: "2px",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              margin: "10px 0 6px",
              fontSize: "10px",
              color: "#555555",
            }}
          >
            Upcoming Events
          </p>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  alignSelf: "stretch",
                  minHeight: "28px",
                  background: "#E51937",
                  borderRadius: "2px",
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  background: "#2a2a2a",
                  borderRadius: "3px",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    height: "6px",
                    background: "#2a2a2a",
                    borderRadius: "3px",
                    marginBottom: "4px",
                  }}
                />
                <div
                  style={{
                    height: "4px",
                    width: "65%",
                    background: "#1e1e1e",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>
          ))}

          <p
            style={{
              margin: "8px 0 6px",
              fontSize: "10px",
              color: "#555555",
            }}
          >
            My Tasks
          </p>
          {[
            { accent: "#FFC429" },
            { accent: "#555555" },
          ].map((task, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  width: "3px",
                  height: "28px",
                  background: task.accent,
                  borderRadius: "2px",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: "6px",
                    background: "#2a2a2a",
                    borderRadius: "3px",
                    marginBottom: "4px",
                  }}
                />
                <div
                  style={{
                    height: "4px",
                    width: "55%",
                    background: "#1e1e1e",
                    borderRadius: "3px",
                  }}
                />
              </div>
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  background: "#2a2a2a",
                  border: "1px solid #333333",
                  borderRadius: "3px",
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomeFeaturedClubCard({ club }: { club: Club }) {
  const [hovered, setHovered] = useState(false);
  const { bg, border } = getClubAvatarColors(club.name);
  const logoUrl = club.logoUrl?.trim();

  return (
    <Link
      to={`/clubs/${club.slug}`}
      className="block no-underline"
      style={{ cursor: "pointer", height: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article
        style={{
          background: "#1a1a1a",
          border: `1px solid ${hovered ? "#333333" : "#242424"}`,
          borderRadius: "12px",
          overflow: "hidden",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "border-color 0.15s ease, transform 0.15s ease",
          transform: hovered ? "translateY(-2px)" : undefined,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            style={{
              width: "100%",
              height: "100px",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              height: "100px",
              background: bg,
              borderBottom: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden
          >
            <span
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: border,
                letterSpacing: "0.04em",
              }}
            >
              {clubInitials(club)}
            </span>
          </div>
        )}

        <div style={{ padding: "16px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {club.name}
          </h3>
          {club.category ? (
            <span
              style={{
                display: "inline-block",
                marginTop: "6px",
                background: "#111111",
                border: "1px solid #1e1e1e",
                color: "#747676",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "10px",
              }}
            >
              {club.category}
            </span>
          ) : null}
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "12px",
              color: "#E51937",
              fontWeight: 500,
            }}
          >
            View Club →
          </p>
        </div>
      </article>
    </Link>
  );
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Sign Up",
    description: "Create your account with your UofG email in seconds",
  },
  {
    step: "2",
    title: "Find Your Club",
    description: "Browse 200+ clubs by category, size, or interest",
  },
  {
    step: "3",
    title: "Get Involved",
    description: "Join clubs, attend events, and connect with your community",
  },
] as const;

export default function Home() {
  const { clubs, savedClubs } = useClubContext();
  const [featuredClubs, setFeaturedClubs] = useState<Club[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const savedClubList = clubs.filter((c) => savedClubs.includes(c.id));

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedClubs() {
      setFeaturedLoading(true);
      const { data, error } = await supabase.from("clubs").select("*");

      if (cancelled) return;

      if (error) {
        console.error("Failed to load featured clubs:", error.message);
        setFeaturedClubs([]);
      } else {
        const mapped = (data ?? []).map((row) =>
          mapClubFromRow(row as Record<string, unknown>),
        );
        setFeaturedClubs(
          [...mapped].sort(() => Math.random() - 0.5).slice(0, 4),
        );
      }

      setFeaturedLoading(false);
    }

    void loadFeaturedClubs();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section
        className="relative overflow-hidden"
        style={{ background: "#0f0f0f" }}
      >
        <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8">
          <div className="flex items-center gap-12 lg:gap-16">
            <div className="max-w-3xl flex-1">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <BrandLogo variant="hero" />
                <span
                  style={{
                    color: "#E51937",
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  University of Guelph
                </span>
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.05]">
                <span style={{ color: "#ffffff" }}>Discover Your</span>{" "}
                <span style={{ color: "#FFC429" }}>Community</span>{" "}
                <span style={{ color: "#ffffff" }}>at Guelph</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Browse 200+ student clubs, find your passion, and connect with
                like-minded Gryphons. Your university experience starts here.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/explore"
                  style={{
                    display: "inline-block",
                    backgroundColor: "#E51937",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "12px 28px",
                    fontWeight: 600,
                    fontSize: "15px",
                    textDecoration: "none",
                  }}
                >
                  Explore Clubs
                </Link>
              </div>
            </div>

            <div className="hidden w-[520px] max-w-[42vw] shrink-0 lg:block">
              <DashboardHeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{ backgroundColor: "#0f0f0f" }}>
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: "261", label: "Active Clubs" },
            { value: "5,000+", label: "Student Members" },
            { value: "50+", label: "Categories" },
            { value: "100+", label: "Events Monthly" },
          ].map((stat, index) => (
            <div key={stat.label} className="text-center">
              <p
                style={{
                  fontSize: "36px",
                  fontWeight: 800,
                  color: index % 2 === 0 ? "#E51937" : "#FFC429",
                  margin: 0,
                }}
              >
                {stat.value}
              </p>
              <p
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#555555",
                }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Clubs */}
      <section
        className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <div className="mb-10 text-center">
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
            }}
          >
            Featured Clubs
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#555555",
              marginTop: "8px",
              marginBottom: 0,
            }}
          >
            Discover what&apos;s happening on campus
          </p>
        </div>
        {featuredLoading ? (
          <div className="flex justify-center py-12">
            <Spinner label="Loading clubs…" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredClubs.map((club) => (
              <HomeFeaturedClubCard key={club.id} club={club} />
            ))}
          </div>
        )}
        <div className="mt-10 text-center">
          <Link to="/explore">
            <Button variant="outline">View All Clubs</Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "#0f0f0f", padding: "60px 24px" }}>
        <div className="mx-auto max-w-7xl">
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              margin: "0 0 8px",
            }}
          >
            How it works
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#555555",
              textAlign: "center",
              margin: "0 0 40px",
            }}
          >
            Get connected in three simple steps
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "10px",
                  padding: "24px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "#E51937",
                    margin: "0 0 8px",
                  }}
                >
                  {item.step}
                </p>
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#ffffff",
                    margin: "0 0 8px",
                  }}
                >
                  {item.title}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#555555",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div
        style={{
          paddingTop: 60,
          paddingBottom: 60,
          maxWidth: 1100,
          margin: "0 auto",
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        <UpcomingEventsSection />
      </div>

      {/* Saved Clubs */}
      {savedClubList.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold text-white">Your Saved Clubs</h2>
            <p className="mt-3 text-muted">
              Clubs you&apos;ve bookmarked for later
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedClubList.map((club) => (
              <HomeFeaturedClubCard key={club.id} club={club} />
            ))}
          </div>
          {savedClubList.length < 3 && (
            <p className="text-center" style={{ marginTop: 16 }}>
              <Link
                to="/explore"
                style={{
                  color: "#E51937",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Explore 200+ clubs →
              </Link>
            </p>
          )}
        </section>
      )}

      {/* CTA Section */}
      <CtaSection />
    </>
  );
}

function CtaSection() {
  const [signupHovered, setSignupHovered] = useState(false);

  const signupButtonStyle: CSSProperties = {
    display: "inline-block",
    background: "transparent",
    border: `1px solid ${signupHovered ? "#E51937" : "#333333"}`,
    color: signupHovered ? "#ffffff" : "#cccccc",
    borderRadius: "8px",
    padding: "12px 28px",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    transition: "border-color 0.15s ease, color 0.15s ease",
  };

  return (
    <section
      style={{
        background: "#0f0f0f",
        padding: "60px 40px",
        textAlign: "center",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <h2
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#ffffff",
            margin: 0,
          }}
        >
          Ready to find your community?
        </h2>
        <p
          style={{
            fontSize: "15px",
            color: "#555555",
            marginTop: "8px",
            marginBottom: 0,
          }}
        >
          Join thousands of Guelph students already on GryphClubConnect
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "12px",
            marginTop: "24px",
          }}
        >
          <Link
            to="/explore"
            style={{
              display: "inline-block",
              background: "#E51937",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "12px 28px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Explore Clubs
          </Link>
          <Link
            to="/signup"
            style={signupButtonStyle}
            onMouseEnter={() => setSignupHovered(true)}
            onMouseLeave={() => setSignupHovered(false)}
          >
            Sign Up Free
          </Link>
        </div>
      </div>
    </section>
  );
}
