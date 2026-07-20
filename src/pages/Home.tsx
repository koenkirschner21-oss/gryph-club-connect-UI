import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, UserPlus, Users, Check } from "lucide-react";
import { useClubContext } from "../context/useClubContext";
import { useAuthContext } from "../context/useAuthContext";
import {
  getClubInitials,
  isUploadedClubBanner,
} from "../lib/clubUtils";
import { supabase } from "../lib/supabaseClient";
import BrandLogo from "../components/ui/BrandLogo";
import Spinner from "../components/ui/Spinner";
import type { Club } from "../types";
import {
  HomeEverythingSection,
  HomeOpenPositionsBlock,
  HomePathSection,
  HomeProductShowcase,
} from "../components/home/HomeMarketingSections";

const ACCENT_RED = "#E51937";

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
    bannerUrl: (row.banner_url as string) ?? undefined,
    tags: [],
    contactEmail: (row.contact_email as string) ?? "",
    isPublic: (row.is_public as boolean) ?? true,
    events: [],
    abbreviation: (row.abbreviation as string) ?? undefined,
  };
}

function HomeFeaturedClubBanner({ bannerUrl }: { bannerUrl: string }) {
  return (
    <div
      style={{
        height: "168px",
        flexShrink: 0,
        overflow: "hidden",
        width: "100%",
        background: "#111111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={bannerUrl}
        alt=""
        loading="lazy"
        decoding="async"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center",
          display: "block",
        }}
      />
    </div>
  );
}

function HomeFeaturedClubCard({
  club,
  joined = false,
}: {
  club: Club;
  joined?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const description = (club.shortDescription || club.description)?.trim();
  const bannerUrl = club.bannerUrl?.trim();
  const showBannerImage = isUploadedClubBanner(bannerUrl);
  const bannerFallbackLabel = (
    club.abbreviation?.trim().slice(0, 2) ||
    club.name.trim().slice(0, 2)
  ).toUpperCase();

  return (
    <Link
      to={`/clubs/${club.slug}`}
      className="block min-w-0 no-underline"
      style={{
        cursor: "pointer",
        width: "100%",
        minWidth: 0,
        display: "block",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article
        style={{
          width: "100%",
          minWidth: 0,
          height: "348px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "12px",
          background: "#1a1a1a",
          border: `1px solid ${hovered ? "#333333" : "#242424"}`,
          cursor: "pointer",
          transition: "all 0.15s ease",
          transform: hovered ? "translateY(-2px)" : undefined,
          boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.4)" : undefined,
          boxSizing: "border-box",
        }}
      >
        {showBannerImage ? (
          <HomeFeaturedClubBanner bannerUrl={bannerUrl!} />
        ) : (
          <div
            style={{
              height: "168px",
              flexShrink: 0,
              overflow: "hidden",
              width: "100%",
              position: "relative",
              isolation: "isolate",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1a1a1a 0%, #2a1a1a 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
              aria-hidden
            >
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#ffffff",
                  opacity: 0.15,
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                {bannerFallbackLabel}
              </span>
            </div>
          </div>
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: "16px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            boxSizing: "border-box",
            position: "relative",
            zIndex: 1,
            background: "#1a1a1a",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {club.name}
          </h3>

          {description ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#999999",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxHeight: "39px",
                flexShrink: 0,
              }}
            >
              {description}
            </p>
          ) : (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#555555",
                lineHeight: 1.5,
              }}
            >
              No description available
            </p>
          )}

          {club.category ? (
            <div style={{ marginTop: "10px" }}>
              <span
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333333",
                  color: "#666666",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  display: "inline-block",
                }}
              >
                {club.category}
              </span>
            </div>
          ) : null}

          <div
            style={{
              marginTop: "auto",
              paddingTop: "10px",
              borderTop: "1px solid #1e1e1e",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              {joined ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  <Check size={12} strokeWidth={2.5} aria-hidden />
                  Joined
                </span>
              ) : null}
            </div>
            <span
              style={{
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              View Club →
            </span>
          </div>
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
    to: "/signup",
    borderTop: "#E51937",
    Icon: UserPlus,
    iconColor: "#E51937",
  },
  {
    step: "2",
    title: "Find Your Club",
    description: "Browse clubs by category, size, or interest",
    to: "/explore",
    borderTop: "#FFC429",
    Icon: Search,
    iconColor: "#FFC429",
  },
  {
    step: "3",
    title: "Get Involved",
    description: "Join clubs, attend events, and connect with your community",
    to: "/events",
    borderTop: "#E51937",
    Icon: Users,
    iconColor: "#ffffff",
  },
] as const;

type HomeCampusEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  start_time: string;
  location: string;
  clubName: string;
  clubSlug: string;
  clubLogoUrl: string | null;
  clubAbbreviation?: string;
};

function buildEventStartTime(date: string, time: string): string | null {
  const dateOnly = date?.trim();
  if (!dateOnly) return null;

  const noon = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(noon.getTime())) return null;

  const timeTrim = time?.trim();
  if (!timeTrim || timeTrim === "TBD") {
    return noon.toISOString();
  }

  const combined = new Date(`${dateOnly}T${timeTrim}`);
  if (!Number.isNaN(combined.getTime())) {
    return combined.toISOString();
  }

  const parsedTime = new Date(timeTrim);
  if (!Number.isNaN(parsedTime.getTime())) {
    return parsedTime.toISOString();
  }

  return noon.toISOString();
}

function isValidHomeEvent(event: HomeCampusEvent): boolean {
  if ((event.title?.trim().length ?? 0) < 3) return false;
  const start = new Date(event.start_time);
  if (Number.isNaN(start.getTime())) return false;
  return start > new Date();
}

const HOME_EVENT_DATE_BLOCK_SIZE = 48;
const HOME_EVENT_CLUB_LOGO_SIZE = 40;

const homeEventCardTextEllipsis: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  margin: 0,
};

function hasHomeEventLocation(location: string | null | undefined): boolean {
  const trimmed = location?.trim();
  return !!trimmed && trimmed !== "TBD";
}

function formatHomeEventDateShort(dateStr: string): string {
  const trimmedDate = dateStr.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)
    ? new Date(`${trimmedDate}T12:00:00`)
    : new Date(trimmedDate);

  if (Number.isNaN(d.getTime())) return trimmedDate;

  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function parseHomeEventDate(
  dateStr: string | null | undefined,
): { month: string; day: string } | null {
  if (dateStr == null || typeof dateStr !== "string") return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);

  if (Number.isNaN(d.getTime())) return null;

  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function HomeEventDateBlock({ date }: { date: string }) {
  const parsed = parseHomeEventDate(date);

  return (
    <div
      style={{
        backgroundColor: "#E51937",
        borderRadius: "8px",
        width: `${HOME_EVENT_DATE_BLOCK_SIZE}px`,
        height: `${HOME_EVENT_DATE_BLOCK_SIZE}px`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {parsed ? (
        <>
          <span
            style={{
              fontSize: "9px",
              textTransform: "uppercase",
              color: "#ffffff",
              lineHeight: 1,
              letterSpacing: "0.08em",
            }}
          >
            {parsed.month}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            {parsed.day}
          </span>
        </>
      ) : (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
          }}
        >
          TBD
        </span>
      )}
    </div>
  );
}

function HomeEventClubLogo({
  clubName,
  logoUrl,
  abbreviation,
}: {
  clubName: string;
  logoUrl: string | null;
  abbreviation?: string;
}) {
  const abbr = getClubInitials({ name: clubName, abbreviation }).slice(0, 3);

  if (logoUrl?.trim()) {
    return (
      <img
        src={logoUrl.trim()}
        alt=""
        style={{
          width: `${HOME_EVENT_CLUB_LOGO_SIZE}px`,
          height: `${HOME_EVENT_CLUB_LOGO_SIZE}px`,
          borderRadius: "8px",
          border: "1px solid #2a2a2a",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${HOME_EVENT_CLUB_LOGO_SIZE}px`,
        height: `${HOME_EVENT_CLUB_LOGO_SIZE}px`,
        borderRadius: "8px",
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: "12px",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {abbr}
    </div>
  );
}

function HomeUpcomingEventCard({
  event,
  onOpen,
  compact = false,
}: {
  event: HomeCampusEvent;
  onOpen: () => void;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const dateLine = hasHomeEventLocation(event.location)
    ? `${formatHomeEventDateShort(event.date)} · ${event.location.trim()}`
    : formatHomeEventDateShort(event.date);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "14px",
        background: "#1a1a1a",
        border: `1px solid ${hovered ? "#333333" : "#242424"}`,
        borderRadius: "10px",
        padding: compact ? "12px 16px" : "16px 20px",
        marginBottom: compact ? "8px" : "10px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        transform: hovered ? "translateY(-1px)" : undefined,
        boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.3)" : undefined,
      }}
    >
      <HomeEventDateBlock date={event.date} />
      <HomeEventClubLogo
        clubName={event.clubName}
        logoUrl={event.clubLogoUrl}
        abbreviation={event.clubAbbreviation}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            ...homeEventCardTextEllipsis,
            fontSize: "15px",
            fontWeight: 600,
            color: "#ffffff",
            marginBottom: "4px",
          }}
        >
          {event.clubName}
        </p>
        <p
          style={{
            ...homeEventCardTextEllipsis,
            fontSize: "14px",
            fontWeight: 500,
            color: "#cccccc",
            marginBottom: "4px",
          }}
        >
          {event.title}
        </p>
        <p
          style={{
            ...homeEventCardTextEllipsis,
            fontSize: "12px",
            color: "#555555",
          }}
        >
          {dateLine}
        </p>
        <p
          style={{
            ...homeEventCardTextEllipsis,
            fontSize: "12px",
            color: "#555555",
          }}
        >
          Open to all students
        </p>
      </div>
      <span
        style={{
          flexShrink: 0,
          color: "#E51937",
          fontSize: "13px",
          fontWeight: 500,
        }}
      >
        View Event →
      </span>
    </article>
  );
}

const HOME_UPCOMING_EVENTS_LIMIT = 5;

function HomeUpcomingEventsBlock({
  savedClubList,
}: {
  savedClubList?: Club[];
}) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<HomeCampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const combinedLayout = Boolean(savedClubList && savedClubList.length > 0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          title,
          date,
          time,
          location,
          visibility,
          clubs:club_id ( name, logo_url, abbreviation, slug )
        `)
        .in("visibility", ["public"])
        .gte("date", todayStr)
        .order("date", { ascending: true })
        .limit(20);

      if (cancelled) return;

      if (error) {
        console.error("Failed to load campus events for home:", error.message);
        setEvents([]);
        setLoading(false);
        return;
      }

      const mapped = (data ?? [])
        .map((row): HomeCampusEvent | null => {
          const clubRaw = row.clubs as unknown;
          const club = (
            Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
          ) as Record<string, unknown>;
          const date = (row.date as string) ?? "";
          const time = (row.time as string) ?? "";
          const startIso = buildEventStartTime(date, time);

          if (!startIso) return null;

          return {
            id: row.id as string,
            title: (row.title as string) ?? "",
            date,
            time,
            start_time: startIso,
            location: (row.location as string) ?? "",
            clubName: (club.name as string) ?? "Club",
            clubSlug: (club.slug as string) ?? "",
            clubLogoUrl: (club.logo_url as string) ?? null,
            clubAbbreviation: (club.abbreviation as string) ?? undefined,
          };
        })
        .filter((ev): ev is HomeCampusEvent => ev !== null)
        .filter(isValidHomeEvent)
        .slice(0, HOME_UPCOMING_EVENTS_LIMIT);

      setEvents(mapped);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function openEvent(event: HomeCampusEvent) {
    navigate(`/events/${event.id}`);
  }

  if (!loading && events.length === 0 && !combinedLayout) return null;

  const eventsColumn = (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: combinedLayout ? 20 : 28 }}>
        <h2
          style={{
            fontWeight: 700,
            fontSize: 22,
            color: "#ffffff",
            margin: 0,
          }}
        >
          Upcoming Events
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "#777777",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Public events from clubs across the University of Guelph
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading events…" />
      ) : events.length === 0 ? (
        <p style={{ fontSize: 13, color: "#555555", margin: 0 }}>
          No upcoming public events right now.
        </p>
      ) : (
        <>
          <div>
            {events.map((ev) => (
              <HomeUpcomingEventCard
                key={ev.id}
                event={ev}
                onOpen={() => openEvent(ev)}
                compact={combinedLayout}
              />
            ))}
          </div>
          <Link
            to="/events"
            style={{
              fontSize: "13px",
              color: "#E51937",
              textAlign: combinedLayout ? "left" : "center",
              marginTop: "16px",
              display: "block",
              textDecoration: "none",
            }}
          >
            See all upcoming events →
          </Link>
        </>
      )}
    </div>
  );

  const savedClubsColumn =
    combinedLayout && savedClubList ? (
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h2
            className="text-3xl font-extrabold text-white"
            style={{ margin: 0 }}
          >
            Your Saved Clubs
          </h2>
          <p className="mt-3 text-muted" style={{ marginBottom: 0 }}>
            Clubs you&apos;ve bookmarked for later
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {savedClubList.map((club) => (
            <HomeFeaturedClubCard key={club.id} club={club} />
          ))}
        </div>
        <p style={{ marginTop: 16, marginBottom: 0 }}>
          <Link
            to="/explore"
            style={{
              color: "#E51937",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Explore clubs →
          </Link>
        </p>
      </div>
    ) : null;

  if (combinedLayout) {
    return (
      <section
        className="mx-auto max-w-[1100px] px-4 py-[60px]"
        style={{
          background:
            "linear-gradient(180deg, #0f0f0f 0%, #121010 50%, #0f0f0f 100%)",
        }}
      >
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {eventsColumn}
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {savedClubsColumn}
            <HomeOpenPositionsBlock />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto max-w-[1100px] px-4 py-[60px]"
      style={{
        background:
          "linear-gradient(180deg, #0f0f0f 0%, #121010 50%, #0f0f0f 100%)",
      }}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {eventsColumn}
        <HomeOpenPositionsBlock />
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuthContext();
  const { clubs, savedClubs, isJoined } = useClubContext();
  const [featuredClubs, setFeaturedClubs] = useState<Club[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const savedClubList = clubs.filter((c) => savedClubs.includes(c.id));

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedClubs() {
      setFeaturedLoading(true);
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .eq("is_public", true)
        .order("member_count", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load featured clubs:", error.message);
        setFeaturedClubs([]);
        setFeaturedLoading(false);
        return;
      }

      const mapped = (data ?? []).map((row) =>
        mapClubFromRow(row as Record<string, unknown>),
      );

      setFeaturedClubs(mapped.slice(0, 8));
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
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 15% 10%, rgba(229,25,55,0.18), transparent 50%), radial-gradient(ellipse 70% 50% at 90% 30%, rgba(255,196,41,0.08), transparent 45%), #0f0f0f",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "64px 16px 40px",
          boxSizing: "border-box",
        }}
      >
        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center sm:px-8">
          <div className="flex w-full flex-col items-center gap-14 md:flex-row md:items-center lg:gap-20">
            <div className="w-full max-w-4xl flex-1">
              <div className="mb-8" style={{ marginTop: "-12px" }}>
                <BrandLogo
                  variant="hero"
                  className="gap-3 [&_img]:!h-10 [&_img]:md:!h-12 [&_span]:!text-xl [&_span]:md:!text-2xl"
                />
              </div>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: ACCENT_RED,
                }}
              >
                Built for students at the University of Guelph
              </p>
              <h1 className="text-[2.25rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4rem]">
                <span style={{ color: "#ffffff" }}>Discover Your</span>{" "}
                <span style={{ color: "#FFC429" }}>Community</span>
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted md:text-xl lg:text-[1.25rem]">
                Find clubs that match your interests, join with your UofG email, and help
                executives run the work that keeps campus groups moving.
              </p>
              <div className="mt-12 flex w-full flex-col gap-4 sm:flex-row sm:flex-wrap">
                <Link
                  to="/signup"
                  className="inline-flex min-h-[52px] w-full items-center justify-center no-underline sm:w-auto"
                  style={{
                    background: "#E51937",
                    color: "#ffffff",
                    borderRadius: "8px",
                    padding: "14px 32px",
                    fontSize: "16px",
                    fontWeight: 600,
                  }}
                >
                  Sign Up Free
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex min-h-[52px] w-full items-center justify-center no-underline sm:w-auto"
                  style={{
                    background: "transparent",
                    border: "1px solid #333333",
                    color: "#cccccc",
                    borderRadius: "8px",
                    padding: "14px 32px",
                    fontSize: "16px",
                    fontWeight: 600,
                  }}
                >
                  Explore Clubs
                </Link>
              </div>
            </div>

            <div className="hidden w-full max-w-[600px] shrink-0 lg:block lg:max-w-[48vw]">
              <HomeProductShowcase>
                <img
                  src="/mockup-exports/student-dashboard.png"
                  alt="ClubConnect student dashboard showing clubs, tasks, and upcoming events"
                  width={1440}
                  height={900}
                  decoding="async"
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    borderRadius: "12px",
                    border: "1px solid #2a2a2a",
                    boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
                  }}
                />
              </HomeProductShowcase>
            </div>
          </div>
        </div>
      </section>

      <HomePathSection />

      {/* Featured Clubs */}
      {!featuredLoading && featuredClubs.length > 0 ? (
      <section
        className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8"
        style={{
          background:
            "linear-gradient(180deg, #0f0f0f 0%, #151212 100%)",
        }}
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
              color: "#777777",
              marginTop: "8px",
              marginBottom: 0,
            }}
          >
            Real clubs from the directory, ranked by activity
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "20px",
            width: "100%",
          }}
        >
          {featuredClubs.map((club) => (
            <div key={club.id} style={{ minWidth: 0 }}>
              <HomeFeaturedClubCard
                club={club}
                joined={Boolean(user && isJoined(club.id))}
              />
            </div>
          ))}
        </div>
        <Link
          to="/explore"
          style={{
            fontSize: "13px",
            color: "#E51937",
            textAlign: "center",
            marginTop: "16px",
            display: "block",
            textDecoration: "none",
          }}
        >
          Browse all clubs →
        </Link>
      </section>
      ) : null}

      <HomeUpcomingEventsBlock
        savedClubList={user && savedClubList.length > 0 ? savedClubList : undefined}
      />

      {/* How it works */}
      <section
        className="px-4 py-[60px]"
        style={{
          background:
            "linear-gradient(180deg, #121010 0%, #0f0f0f 100%)",
          borderTop: "1px solid #1e1e1e",
        }}
      >
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
            How It Works
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#777777",
              textAlign: "center",
              margin: "0 0 40px",
            }}
          >
            Get connected in three simple steps
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <Link
                key={item.step}
                to={item.to}
                className="block no-underline"
                style={{
                  background: "#141414",
                  border: "1px solid #242424",
                  borderTop: `2px solid ${item.borderTop}`,
                  borderRadius: "10px",
                  padding: "24px",
                  textAlign: "left",
                  transition: "border-color 0.15s ease, transform 0.15s ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = "#333333";
                  event.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = "#242424";
                  event.currentTarget.style.transform = "none";
                }}
              >
                <item.Icon
                  size={20}
                  color={item.iconColor}
                  style={{ marginBottom: 8 }}
                  aria-hidden
                />
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#1a0505",
                    border: "1px solid #E51937",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#E51937",
                    }}
                  >
                    {item.step}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#ffffff",
                    marginTop: "12px",
                    marginBottom: 0,
                    textAlign: "left",
                  }}
                >
                  {item.title}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#777777",
                    lineHeight: 1.6,
                    marginTop: "6px",
                    marginBottom: 0,
                    textAlign: "left",
                  }}
                >
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <HomeEverythingSection />

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
      className="px-4 py-8 text-center sm:px-10 md:py-[30px]"
      style={{
        borderTop: "1px solid #2a2a2a",
        background: "linear-gradient(to bottom, #141414, #0f0f0f)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 md:flex-row md:items-center md:justify-between md:gap-8 md:text-left">
        <div className="flex flex-col">
          <h2
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#ffffff",
              margin: 0,
            }}
          >
            Your campus. Your clubs.
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "#555555",
              marginTop: "8px",
              marginBottom: 0,
            }}
          >
            Join Guelph students managing club life on ClubConnect.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:shrink-0">
          <Link
            to="/signup"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg px-7 py-3 text-sm font-semibold text-white no-underline sm:w-auto"
            style={{
              background: "#E51937",
            }}
          >
            Sign Up Free
          </Link>
          <Link
            to="/explore"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg px-7 py-3 text-sm font-semibold no-underline sm:w-auto"
            style={signupButtonStyle}
            onMouseEnter={() => setSignupHovered(true)}
            onMouseLeave={() => setSignupHovered(false)}
          >
            Explore Clubs
          </Link>
        </div>
      </div>
    </section>
  );
}
