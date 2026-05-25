import { useState, type CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { Globe } from "lucide-react";
import { useClubContext } from "../context/useClubContext";
import { useClubEvents } from "../hooks/useClubEvents";
import { normalizeTags } from "../lib/normalizeTags";
import { getClubInitials } from "../lib/clubUtils";
import { useAuthContext } from "../context/useAuthContext";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";

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

function formatEventDateLong(dateStr: string): string {
  const trimmed = dateStr.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventScheduleLine(
  dateStr: string,
  timeStr?: string | null,
): string {
  const datePart = formatEventDateLong(dateStr);
  const time = timeStr?.trim();
  if (!time) return datePart;
  const formattedTime = formatEventTime12h(time);
  return formattedTime ? `${datePart} · ${formattedTime}` : datePart;
}

const brandIconBox: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function InstagramBrandIcon() {
  return (
    <div
      style={{
        ...brandIconBox,
        background:
          "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="5"
          stroke="white"
          strokeWidth="2"
        />
        <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="white" />
      </svg>
    </div>
  );
}

function WebsiteBrandIcon() {
  return (
    <div style={{ ...brandIconBox, background: "#E51937" }}>
      <Globe size={16} color="#ffffff" strokeWidth={2} aria-hidden />
    </div>
  );
}

function DiscordBrandIcon() {
  return (
    <div style={{ ...brandIconBox, background: "#5865F2" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.445.864-.608 1.25-1.845-.276-3.68-.276-5.487 0-.164-.394-.406-.874-.618-1.25a.077.077 0 0 0-.078-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.056c2.053 1.508 4.041 2.423 5.993 3.029a.077.077 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 12.3 12.3 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.099.246.198.372.292a.077.077 0 0 1-.007.128 12.299 12.299 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028c1.961-.607 3.95-1.522 6.002-3.029a.077.077 0 0 0 .031-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.42 0 1.333-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
      </svg>
    </div>
  );
}

function connectHeadingStyle(): CSSProperties {
  return {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#555555",
    marginBottom: "10px",
  };
}

const CLUB_EVENT_DATE_SIZE = 48;
const CLUB_EVENT_LOGO_SIZE = 40;

function EventDateBlock({ date }: { date: string }) {
  const parsedDate = new Date(date);
  const monthLabel = Number.isNaN(parsedDate.getTime())
    ? "---"
    : parsedDate.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dayLabel = Number.isNaN(parsedDate.getTime())
    ? "?"
    : String(parsedDate.getDate());

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center"
      style={{
        width: `${CLUB_EVENT_DATE_SIZE}px`,
        height: `${CLUB_EVENT_DATE_SIZE}px`,
        backgroundColor: "#E51937",
        borderRadius: "8px",
      }}
    >
      <span
        style={{
          fontSize: "9px",
          textTransform: "uppercase",
          color: "#ffffff",
          lineHeight: 1,
          letterSpacing: "0.08em",
        }}
      >
        {monthLabel}
      </span>
      <span
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1,
        }}
      >
        {dayLabel}
      </span>
    </div>
  );
}

function ClubEventLogo({
  club,
}: {
  club: { name: string; abbreviation?: string; logoUrl?: string };
}) {
  const abbr =
    club.abbreviation?.trim() ||
    club.name
      .split(" ")
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();

  if (club.logoUrl) {
    return (
      <img
        src={club.logoUrl}
        alt=""
        style={{
          width: `${CLUB_EVENT_LOGO_SIZE}px`,
          height: `${CLUB_EVENT_LOGO_SIZE}px`,
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
        width: `${CLUB_EVENT_LOGO_SIZE}px`,
        height: `${CLUB_EVENT_LOGO_SIZE}px`,
        borderRadius: "8px",
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888",
        fontSize: "12px",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {abbr}
    </div>
  );
}

function SocialLinkRow({
  href,
  label,
  icon,
  isLast,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isLast?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 0",
        borderBottom: isLast ? "none" : "1px solid #1e1e1e",
        color: hovered ? "#ffffff" : "#cccccc",
        fontSize: "13px",
        textDecoration: "none",
      }}
    >
      {icon}
      {label}
    </a>
  );
}

export default function ClubDetails() {
  const { slug } = useParams<{ slug: string }>();
  const {
    getClubBySlug,
    getClubById,
    loading,
    isJoined,
    isPending,
    joinClub,
    leaveClub,
    isSaved,
    toggleSaveClub } = useClubContext();
  const { user } = useAuthContext();

  // Look up by slug first (primary), fall back to id for legacy /explore/:id links
  const club = getClubBySlug(slug ?? "") ?? getClubById(slug ?? "");
  const { events: clubEvents } = useClubEvents(club?.id);
  const joined = club ? isJoined(club.id) : false;
  const eventsUrl = club ? `/app/clubs/${club.id}/events` : "";
  const pending = club ? isPending(club.id) : false;
  const saved = club ? isSaved(club.id) : false;
  const [joinError, setJoinError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [bookmarkHovered, setBookmarkHovered] = useState(false);

  const aboutText = (club?.longDescription ?? club?.description)?.trim();

  async function handleJoinOrLeave() {
    if (!club) return;
    if (joined || pending) {
      leaveClub(club.id);
      return;
    }
    setJoining(true);
    setJoinError(false);
    const ok = await joinClub(club.id);
    if (!ok) setJoinError(true);
    setJoining(false);
  }

  const upcomingEvents = clubEvents
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading club details…" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-alt">
          <svg
            className="h-10 w-10 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="mt-5 text-3xl font-bold text-white">Club Not Found</h1>
        <p className="mt-3 text-muted">
          The club you&apos;re looking for doesn&apos;t exist or may have been
          removed.
        </p>
        <Link to="/explore" className="mt-6 inline-block">
          <Button>Back to Explore</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          width: "100%",
          height: "240px",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#1a0505",
        }}
      >
        {club.bannerUrl || club.imageUrl ? (
          <img
            src={club.bannerUrl || club.imageUrl}
            alt="Club banner"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(135deg, #2d0808 0%, #E51937 50%, #2d0808 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "48px",
                fontWeight: 800,
                color: "rgba(255,255,255,0.1)",
                letterSpacing: "-0.02em",
              }}
            >
              {club.name}
            </span>
          </div>
        )}
      </div>

      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        {/* Club identity — overlaps banner */}
        <div className="relative mb-10">
          <div
            className="relative z-10 flex-shrink-0"
            style={{ marginTop: "-36px", marginLeft: "24px" }}
          >
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "12px",
                border: "3px solid #0f0f0f",
                backgroundColor: "#2a2a2a",
                color: "#888888",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              {club.logoUrl ? (
                <img
                  src={club.logoUrl}
                  alt={club.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  className="text-xl font-extrabold"
                  style={{ color: "#888888" }}
                  aria-hidden="true"
                >
                  {getClubInitials(club)}
                </span>
              )}
            </div>
          </div>

          <div className="relative z-10" style={{ marginLeft: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "16px",
                gap: "16px",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    style={{
                      display: "inline-block",
                      background: "#111111",
                      border: "1px solid #222",
                      color: "#747676",
                      borderRadius: "20px",
                      padding: "4px 12px",
                      fontSize: "12px",
                    }}
                  >
                    {club.category}
                  </span>
                  {club.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  )}
                  {joined && (
                    <span
                      style={{
                        display: "inline-block",
                        background: "#1a0505",
                        border: "1px solid #E51937",
                        color: "#E51937",
                        borderRadius: "20px",
                        padding: "4px 12px",
                        fontSize: "12px",
                      }}
                    >
                      Joined
                    </span>
                  )}
                  {pending && (
                    <span className="inline-block rounded-full bg-yellow-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
                      Pending Approval
                    </span>
                  )}
                </div>
                <h1
                  style={{
                    fontWeight: 700,
                    fontSize: "28px",
                    color: "#ffffff",
                    lineHeight: 1.2,
                    margin: 0,
                  }}
                >
                  {club.name}
                </h1>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "12px",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleSaveClub(club.id)}
                  onMouseEnter={() => setBookmarkHovered(true)}
                  onMouseLeave={() => setBookmarkHovered(false)}
                  aria-label={saved ? "Unsave club" : "Save club"}
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    padding: "10px",
                    color: bookmarkHovered || saved ? "#FFC429" : "#747676",
                    cursor: "pointer",
                    transition: "color 0.15s ease",
                  }}
                >
                  <svg
                    className="h-5 w-5"
                    fill={saved ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                </button>
                {user && joined && (
                  <Link
                    to={`/app/clubs/${club.id}`}
                    style={{
                      background: "#E51937",
                      color: "#ffffff",
                      borderRadius: "8px",
                      padding: "10px 24px",
                      fontWeight: 600,
                      fontSize: "14px",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open Workspace
                  </Link>
                )}
                <button
                  type="button"
                  disabled={joining}
                  onClick={handleJoinOrLeave}
                  style={
                    joined
                      ? {
                          background: "transparent",
                          border: "1px solid #E51937",
                          color: "#E51937",
                          borderRadius: "8px",
                          padding: "10px 24px",
                          fontWeight: 600,
                          fontSize: "14px",
                          cursor: joining ? "wait" : "pointer",
                          whiteSpace: "nowrap",
                        }
                      : pending
                        ? {
                            background: "transparent",
                            border: "1px solid #333333",
                            color: "#888888",
                            borderRadius: "8px",
                            padding: "10px 24px",
                            fontWeight: 600,
                            fontSize: "14px",
                            cursor: joining ? "wait" : "pointer",
                            whiteSpace: "nowrap",
                          }
                        : {
                            background: "#E51937",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "10px 24px",
                            fontWeight: 600,
                            fontSize: "14px",
                            cursor: joining ? "wait" : "pointer",
                            whiteSpace: "nowrap",
                          }
                  }
                >
                  {joining
                    ? "Joining…"
                    : joined
                      ? "Leave Club"
                      : pending
                        ? "Cancel Request"
                        : "Join Club"}
                </button>
              </div>
            </div>

            <div
              className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
              style={{ color: "#747676" }}
            >
              {club.memberCount > 0 && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {club.memberCount} members
                </span>
              )}
              {club.location && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {club.location}
                </span>
              )}
            </div>
            {joinError && (
              <p className="mt-2 text-sm text-primary" role="alert">
                Failed to join club. Please try again.
              </p>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        <nav className="mb-7 text-sm text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span className="mx-2 text-border">/</span>
          <Link to="/explore" className="hover:text-primary transition-colors">
            Explore
          </Link>
          <span className="mx-2 text-border">/</span>
          <span className="font-medium text-white">{club.name}</span>
        </nav>

        <div className="grid gap-8 pb-16 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 col-span-full lg:col-span-2">
            {/* Description */}
            <div
              style={{
                background: "#1a1a1a",
                border: "1px solid #242424",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  marginBottom: "10px",
                  marginTop: 0,
                }}
              >
                About
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: aboutText ? "#cccccc" : "#555555",
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                {aboutText || "No description provided yet."}
              </p>
            </div>

            {/* Events */}
            <div>
              <h2
                className="mb-4"
                style={{
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "#ffffff" }}
              >
                Upcoming Events
              </h2>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => {
                    const cardStyle = {
                      background: "#1a1a1a",
                      border: "1px solid #242424",
                      borderRadius: "10px",
                      padding: "16px 20px",
                      marginBottom: "10px",
                      display: "block",
                      textDecoration: "none",
                    } as const;
                    const inner = (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: "14px",
                        }}
                      >
                        <EventDateBlock date={event.date} />
                        <ClubEventLogo
                          club={{
                            name: club.name,
                            abbreviation: club.abbreviation,
                            logoUrl: club.logoUrl,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3
                            style={{
                              fontSize: "15px",
                              fontWeight: 600,
                              color: "#ffffff",
                              margin: "0 0 4px",
                            }}
                          >
                            {event.title}
                          </h3>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "#555555",
                              margin: 0,
                            }}
                          >
                            {formatEventScheduleLine(event.date, event.time)}
                          </p>
                          {event.location ? (
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#555555",
                                margin: "4px 0 0",
                              }}
                            >
                              {event.location}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );

                    if (joined) {
                      return (
                        <Link
                          key={event.id}
                          to={eventsUrl}
                          style={{ ...cardStyle, cursor: "pointer" }}
                        >
                          {inner}
                        </Link>
                      );
                    }

                    return (
                      <div key={event.id} style={cardStyle}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt">
                    <svg
                      className="h-6 w-6 text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="font-medium text-white">No upcoming events</p>
                  <p className="mt-1 text-sm text-muted">
                    Check back soon for new events.
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-full space-y-6 lg:col-span-1">
            {/* Details Card */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #222222",
                borderRadius: "8px",
                padding: "16px" }}
            >
              <h3
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#555555",
                  marginBottom: "12px" }}
              >
                Club Details
              </h3>
              <dl className="space-y-4">
                {club.memberCount > 0 && (
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div>
                    <dt className="uppercase" style={{ fontSize: "10px", color: "#555555", letterSpacing: "0.1em" }}>
                      Members
                    </dt>
                    <dd className="mt-0.5 text-sm" style={{ color: "#d0d0d0", fontSize: "13px" }}>
                      {club.memberCount} members
                    </dd>
                  </div>
                </div>
                )}
                {club.meetingSchedule && (
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <dt className="uppercase" style={{ fontSize: "10px", color: "#555555", letterSpacing: "0.1em" }}>
                      Meeting Schedule
                    </dt>
                    <dd className="mt-0.5 text-sm" style={{ color: "#d0d0d0", fontSize: "13px" }}>
                      {club.meetingSchedule}
                    </dd>
                  </div>
                </div>
                )}
                {club.location && (
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div>
                    <dt className="uppercase" style={{ fontSize: "10px", color: "#555555", letterSpacing: "0.1em" }}>
                      Location
                    </dt>
                    <dd className="mt-0.5 text-sm" style={{ color: "#d0d0d0", fontSize: "13px" }}>
                      {club.location}
                    </dd>
                  </div>
                </div>
                )}
                {club.contactEmail && (
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <dt className="uppercase" style={{ fontSize: "10px", color: "#555555", letterSpacing: "0.1em" }}>
                      Contact
                    </dt>
                    <dd className="mt-0.5 text-sm">
                      <a
                        href={`mailto:${club.contactEmail}`}
                        className="font-medium hover:underline" style={{ color: "#E51937", fontSize: "13px" }}
                      >
                        {club.contactEmail}
                      </a>
                    </dd>
                  </div>
                </div>
                )}
              </dl>
            </div>

            {/* Tags Card */}
            {normalizeTags(club.tags).length > 0 && (
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {normalizeTags(club.tags).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border bg-surface-alt px-2.5 py-1 text-xs font-medium text-muted"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Social Links Card */}
            {club.socialLinks && (
              <Card className="p-5">
                <p style={connectHeadingStyle()}>Connect</p>
                <div>
                  {(
                    [
                      club.socialLinks.website && {
                        href: club.socialLinks.website,
                        label: "Website",
                        icon: <WebsiteBrandIcon />,
                      },
                      club.socialLinks.instagram && {
                        href: club.socialLinks.instagram,
                        label: "Instagram",
                        icon: <InstagramBrandIcon />,
                      },
                      club.socialLinks.discord && {
                        href: club.socialLinks.discord,
                        label: "Discord",
                        icon: <DiscordBrandIcon />,
                      },
                    ].filter(Boolean) as {
                      href: string;
                      label: string;
                      icon: React.ReactNode;
                    }[]
                  ).map((link, index, arr) => (
                    <SocialLinkRow
                      key={link.label}
                      href={link.href}
                      label={link.label}
                      icon={link.icon}
                      isLast={index === arr.length - 1}
                    />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

