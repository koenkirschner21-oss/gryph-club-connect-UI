import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  createLucideIcon,
  Globe,
  Heart,
  Users,
} from "lucide-react";

const Linkedin = createLucideIcon("linkedin", [
  ["path", { d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z", key: "0" }],
  ["rect", { width: "4", height: "12", x: "2", y: "9", key: "1" }],
  ["circle", { cx: "4", cy: "4", r: "2", key: "2" }],
]);

const Twitter = createLucideIcon("twitter", [
  [
    "path",
    {
      d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
      key: "0",
    },
  ],
]);
import { useClubContext } from "../context/useClubContext";
import { useEventRsvps } from "../hooks/useEventRsvps";
import { getClubInitials } from "../lib/clubUtils";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import type { Club, ClubEvent, RsvpStatus } from "../types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";

interface PublicClubProfile {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  logoUrl?: string;
  bannerUrl?: string;
  category: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  createdAt?: string;
}

interface ClubOwnerContact {
  fullName: string;
  email: string;
  avatarUrl?: string;
}

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Not Going" },
];

function formatMemberCount(count: number): string {
  if (count >= 100) return "100+ members";
  if (count >= 50) return "50+ members";
  if (count >= 20) return "20+ members";
  if (count >= 10) return "10+ members";
  if (count === 1) return "1 member";
  return `${count} members`;
}

function categoryBadgeStyle(): CSSProperties {
  return {
    background: "#111111",
    border: "1px solid #222222",
    color: "#747676",
    borderRadius: "20px",
    padding: "3px 12px",
    fontSize: "11px",
    display: "inline-block",
  };
}

function rsvpButtonClass(value: RsvpStatus, active: boolean): string {
  const base =
    "cursor-pointer rounded-md border px-3 py-1 text-xs font-medium transition-colors";
  if (!active) {
    if (value === "going") return `${base} border-[#1a4a1a] bg-transparent text-[#4ade80]`;
    if (value === "maybe") return `${base} border-[#3a3a1a] bg-transparent text-[#FFC429]`;
    return `${base} border-[#333333] bg-transparent text-[#888888]`;
  }
  if (value === "going") return `${base} border-[#1a4a1a] bg-[#0d2b0d] text-[#4ade80]`;
  if (value === "maybe") return `${base} border-[#3a3a1a] bg-[#2a2a0d] text-[#FFC429]`;
  return `${base} border-[#333333] bg-[#1a1a1a] text-[#888888]`;
}

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
  );
}

function mapEventRow(row: Record<string, unknown>): ClubEvent {
  return {
    id: row.id as string,
    clubId: row.club_id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    date: (row.date as string) ?? "",
    time: (row.time as string) ?? "",
    location: (row.location as string) ?? "",
    visibility:
      row.visibility === "members_only" || row.visibility === "featured"
        ? row.visibility
        : "public",
  };
}

function SocialPill({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
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
        background: "#1a1a1a",
        border: `1px solid ${hovered ? "#444444" : "#2a2a2a"}`,
        borderRadius: "8px",
        padding: "9px 14px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        marginBottom: "8px",
        textDecoration: "none",
        color: hovered ? "#ffffff" : "#cccccc",
        fontSize: "13px",
        fontWeight: 500,
        transition: "all 0.15s ease",
      }}
    >
      {icon}
      {label}
    </a>
  );
}

export default function ClubPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    getClubBySlug,
    getClubById,
    loading: contextLoading,
    isJoined,
    isPending,
    joinClub,
    leaveClub,
    isSaved,
    toggleSaveClub,
  } = useClubContext();
  const { user } = useAuthContext();

  const contextClub = getClubBySlug(slug ?? "") ?? getClubById(slug ?? "");

  const [profile, setProfile] = useState<PublicClubProfile | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [owners, setOwners] = useState<ClubOwnerContact[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [joinError, setJoinError] = useState(false);
  const [joining, setJoining] = useState(false);

  const clubId = profile?.id ?? contextClub?.id;
  const joined = clubId ? isJoined(clubId) : false;
  const pending = clubId ? isPending(clubId) : false;
  const saved = clubId ? isSaved(clubId) : false;

  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { myRsvps, counts, setRsvp, removeRsvp } = useEventRsvps(eventIds);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!slug && !contextClub?.id) {
        setPageLoading(false);
        return;
      }

      setPageLoading(true);

      let query = supabase
        .from("clubs")
        .select(
          "id, name, slug, short_description, long_description, logo_url, banner_url, category, instagram_url, linkedin_url, twitter_url, website_url, created_at",
        );

      if (contextClub?.id) {
        query = query.eq("id", contextClub.id);
      } else {
        query = query.eq("slug", slug);
      }

      const { data: clubRow, error } = await query.maybeSingle();

      if (cancelled) return;

      if (error || !clubRow) {
        setProfile(null);
        setOwners([]);
        setPageLoading(false);
        return;
      }

      const loaded: PublicClubProfile = {
        id: clubRow.id as string,
        name: (clubRow.name as string) ?? "",
        slug: (clubRow.slug as string) ?? slug ?? "",
        shortDescription: (clubRow.short_description as string) ?? "",
        longDescription: (clubRow.long_description as string) ?? "",
        logoUrl: (clubRow.logo_url as string) ?? undefined,
        bannerUrl: (clubRow.banner_url as string) ?? undefined,
        category: (clubRow.category as string) ?? "",
        instagramUrl: (clubRow.instagram_url as string) ?? undefined,
        linkedinUrl: (clubRow.linkedin_url as string) ?? undefined,
        twitterUrl: (clubRow.twitter_url as string) ?? undefined,
        websiteUrl: (clubRow.website_url as string) ?? undefined,
        createdAt: (clubRow.created_at as string) ?? undefined,
      };

      setProfile(loaded);

      let isMember = false;
      if (user?.id) {
        const { data: membership } = await supabase
          .from("club_members")
          .select("id")
          .eq("club_id", loaded.id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        isMember = !!membership;
      }

      const [{ count: members }, { count: positions }, eventsRes, ownersRes] =
        await Promise.all([
        supabase
          .from("club_members")
          .select("id", { count: "exact", head: true })
          .eq("club_id", loaded.id)
          .eq("status", "active"),
        supabase
          .from("club_positions")
          .select("id", { count: "exact", head: true })
          .eq("club_id", loaded.id)
          .eq("is_open", true),
        supabase
          .from("events")
          .select("id, club_id, title, description, date, time, location, visibility")
          .eq("club_id", loaded.id)
          .gte("date", new Date().toISOString().slice(0, 10))
          .order("date", { ascending: true }),
        supabase
          .from("club_members")
          .select(`
            user_id,
            member_profile:profiles!club_members_user_profile_fkey (
              full_name,
              email,
              avatar_url
            )
          `)
          .eq("club_id", loaded.id)
          .eq("role", "owner")
          .eq("status", "active"),
      ]);

      if (cancelled) return;

      setMemberCount(members ?? 0);
      setOpenPositionsCount(positions ?? 0);

      const loadedOwners: ClubOwnerContact[] = [];
      for (const row of ownersRes.data ?? []) {
        const rawProfile = row.member_profile;
        const profile = (
          Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
        ) as Record<string, unknown> | null | undefined;
        const email = (profile?.email as string) ?? "";
        const fullName = (profile?.full_name as string) ?? "Unknown";
        if (!email) continue;
        const avatarUrl = profile?.avatar_url as string | undefined;
        loadedOwners.push({
          fullName,
          email,
          ...(avatarUrl ? { avatarUrl } : {}),
        });
      }
      setOwners(loadedOwners);

      const allEvents = (eventsRes.data ?? []).map((row) =>
        mapEventRow(row as Record<string, unknown>),
      );
      setEvents(
        isMember
          ? allEvents
          : allEvents.filter(
              (e) => e.visibility === "public" || e.visibility === "featured",
            ),
      );
      setPageLoading(false);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [slug, contextClub?.id, user?.id, joined]);

  async function handleJoinOrLeave() {
    if (!clubId) return;
    if (joined || pending) {
      leaveClub(clubId);
      return;
    }
    setJoining(true);
    setJoinError(false);
    const ok = await joinClub(clubId);
    if (!ok) setJoinError(true);
    setJoining(false);
  }

  const loading = user ? contextLoading || pageLoading : pageLoading;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading club profile…" />
      </div>
    );
  }

  if (!profile && !contextClub) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="mt-5 text-3xl font-bold text-white">Club Not Found</h1>
        <p className="mt-3 text-muted">
          The club you&apos;re looking for doesn&apos;t exist or may have been removed.
        </p>
        <Link to="/explore" className="mt-6 inline-block">
          <Button>Back to Explore</Button>
        </Link>
      </div>
    );
  }

  const club: PublicClubProfile = profile ?? {
    id: contextClub!.id,
    name: contextClub!.name,
    slug: contextClub!.slug,
    shortDescription: contextClub!.shortDescription ?? "",
    longDescription: contextClub!.longDescription ?? contextClub!.description,
    logoUrl: contextClub!.logoUrl,
    bannerUrl: contextClub!.bannerUrl,
    category: contextClub!.category,
    createdAt: contextClub!.createdAt,
  };

  const aboutText =
    club.longDescription?.trim() ||
    club.shortDescription?.trim() ||
    "No description yet";

  const hasSocialLinks =
    !!club.instagramUrl ||
    !!club.linkedinUrl ||
    !!club.twitterUrl ||
    !!club.websiteUrl;

  const initialsClub: Pick<Club, "name" | "abbreviation"> = {
    name: club.name,
    abbreviation: contextClub?.abbreviation,
  };

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh" }}>
      <div
        style={
          club.bannerUrl
            ? {
                width: "100%",
                height: "220px",
                backgroundImage: `url(${club.bannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                width: "100%",
                height: "220px",
                background: "linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)",
              }
        }
      />

      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        style={{ paddingBottom: "64px" }}
      >
        <div style={{ marginTop: "-45px", position: "relative", zIndex: 2 }}>
          {club.logoUrl ? (
            <img
              src={club.logoUrl}
              alt={club.name}
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "12px",
                border: "3px solid #0f0f0f",
                background: "#1a1a1a",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "12px",
                border: "3px solid #0f0f0f",
                background: "#1a1a1a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#888888",
                fontWeight: 800,
                fontSize: "24px",
              }}
            >
              {getClubInitials(initialsClub as Club)}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1
              style={{
                fontWeight: 800,
                fontSize: "26px",
                color: "#ffffff",
                marginTop: "12px",
                marginBottom: 0,
              }}
            >
              {club.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span style={categoryBadgeStyle()}>{club.category || "Club"}</span>
              <span style={{ fontSize: "13px", color: "#747676" }}>
                {formatMemberCount(memberCount)}
              </span>
              {joined ? (
                <span
                  style={{
                    backgroundColor: "#0d2b0d",
                    color: "#4ade80",
                    border: "1px solid #1a4a1a",
                    borderRadius: "20px",
                    padding: "4px 12px",
                    fontSize: "12px",
                  }}
                >
                  Joined
                </span>
              ) : null}
              {pending ? (
                <span className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-xs font-semibold text-yellow-400">
                  Pending Approval
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
            {user && joined && (
              <Link to={`/app/clubs/${club.id}`}>
                <Button
                  size="lg"
                  className="!border-0 !bg-[#E51937] !text-white hover:!bg-[#c41430]"
                >
                  Open Workspace
                </Button>
              </Link>
            )}
            <button
              type="button"
              onClick={() => toggleSaveClub(club.id)}
              aria-label={saved ? "Unsave club" : "Save club"}
              className="cursor-pointer rounded-lg border-2 border-border bg-surface p-2.5 transition-colors hover:bg-surface-alt"
            >
              <svg
                className={`h-5 w-5 transition-colors ${saved ? "fill-primary text-primary" : "fill-none text-muted"}`}
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>
            <Button
              size="lg"
              variant={joined ? "outline" : pending ? "outline" : "primary"}
              disabled={joining}
              onClick={() => void handleJoinOrLeave()}
              className={
                joined
                  ? "!border !border-[#E51937] !bg-transparent !text-[#E51937] hover:!bg-[#E51937]/10"
                  : pending
                    ? "!border !border-[#333333] !bg-transparent !text-[#888888]"
                    : "!border-0 !bg-[#E51937] !text-white hover:!bg-[#c41430]"
              }
            >
              {joining
                ? "Joining…"
                : joined
                  ? "Leave Club"
                  : pending
                    ? "Cancel Request"
                    : "Join Club"}
            </Button>
            {joinError ? (
              <p className="text-sm text-primary" role="alert">
                Failed to join club. Please try again.
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="mt-8 flex flex-col gap-6 lg:flex-row"
          style={{ alignItems: "flex-start" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                background: "#1a1a1a",
                border: "1px solid #242424",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "#ffffff",
                  marginBottom: "12px",
                }}
              >
                About
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: "#aaaaaa",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {aboutText}
              </p>
            </div>

            <EventsSection
              events={events}
              joined={joined}
              user={user}
              counts={counts}
              myRsvps={myRsvps}
              setRsvp={setRsvp}
              removeRsvp={removeRsvp}
            />
          </div>

          <aside style={{ width: "280px", flexShrink: 0 }}>
            <div
              style={{
                background: "#1a1a1a",
                border: "1px solid #242424",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#555555",
                  marginBottom: "12px",
                }}
              >
                Club Details
              </h3>

              <SidebarDetails
                memberCount={memberCount}
                owners={owners}
                hasSocialLinks={hasSocialLinks}
                club={club}
                openPositionsCount={openPositionsCount}
                user={user}
                joined={joined}
                navigate={navigate}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function EventsSection({
  events,
  joined,
  user,
  counts,
  myRsvps,
  setRsvp,
  removeRsvp,
}: {
  events: ClubEvent[];
  joined: boolean;
  user: ReturnType<typeof useAuthContext>["user"];
  counts: Record<string, { going: number; maybe: number; not_going: number }>;
  myRsvps: Record<string, RsvpStatus>;
  setRsvp: (eventId: string, status: RsvpStatus) => void;
  removeRsvp: (eventId: string) => void;
}) {
  return (
    <div>
      <h2
        style={{
          fontWeight: 600,
          fontSize: "15px",
          color: "#ffffff",
          marginBottom: "12px",
        }}
      >
        Upcoming Events
      </h2>
      {events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event) => {
            const c = counts[event.id] ?? { going: 0, maybe: 0, not_going: 0 };
            const myStatus = myRsvps[event.id];
            return (
              <div
                key={event.id}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #242424",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div className="flex items-start gap-4">
                  <EventDateBlock date={event.date} />
                  <div className="min-w-0 flex-1">
                    <h3
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#ffffff",
                      }}
                    >
                      {event.title}
                    </h3>
                    <p
                      className="mt-1 flex flex-wrap items-center gap-x-2 text-sm"
                      style={{ color: "#555555" }}
                    >
                      <span>{event.time}</span>
                      {event.location ? (
                        <>
                          <span>·</span>
                          <span>{event.location}</span>
                        </>
                      ) : null}
                    </p>
                    {event.description ? (
                      <p
                        className="mt-2 text-sm"
                        style={{ color: "#cccccc", lineHeight: 1.6 }}
                      >
                        {event.description}
                      </p>
                    ) : null}

                    {joined ? (
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <span style={{ color: "#4ade80" }}>{c.going} going</span>
                        <span style={{ color: "#FFC429" }}>{c.maybe} maybe</span>
                        <span style={{ color: "#888888" }}>
                          {c.not_going} not going
                        </span>
                      </div>
                    ) : null}

                    {joined && user ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {RSVP_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              myStatus === opt.value
                                ? removeRsvp(event.id)
                                : setRsvp(event.id, opt.value)
                            }
                            className={rsvpButtonClass(
                              opt.value,
                              myStatus === opt.value,
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs" style={{ color: "#555555" }}>
                        Join to RSVP
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="font-medium text-white">No upcoming events</p>
          <p className="mt-1 text-sm text-muted">Check back soon for new events.</p>
        </Card>
      )}
    </div>
  );
}

function ContactOwnerRow({ owner }: { owner: ClubOwnerContact }) {
  const [emailHovered, setEmailHovered] = useState(false);
  const initials = owner.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "10px",
      }}
    >
      {owner.avatarUrl ? (
        <img
          src={owner.avatarUrl}
          alt=""
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#2a2a2a",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#cccccc",
          }}
        >
          {initials}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#cccccc",
            margin: 0,
          }}
        >
          {owner.fullName}
        </p>
        <a
          href={`mailto:${owner.email}`}
          onMouseEnter={() => setEmailHovered(true)}
          onMouseLeave={() => setEmailHovered(false)}
          style={{
            fontSize: "12px",
            color: emailHovered ? "#E51937" : "#747676",
            textDecoration: "none",
            transition: "color 0.15s ease",
          }}
        >
          {owner.email}
        </a>
      </div>
    </div>
  );
}

function SidebarDetails({
  memberCount,
  owners,
  hasSocialLinks,
  club,
  openPositionsCount,
  user,
  joined,
  navigate,
}: {
  memberCount: number;
  owners: ClubOwnerContact[];
  hasSocialLinks: boolean;
  club: PublicClubProfile;
  openPositionsCount: number;
  user: ReturnType<typeof useAuthContext>["user"];
  joined: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "14px",
          fontSize: "13px",
          color: "#cccccc",
        }}
      >
        <Users size={16} strokeWidth={2} color="#747676" aria-hidden />
        {formatMemberCount(memberCount)}
      </div>

      {owners.length > 0 ? (
        <div style={{ marginTop: "16px" }}>
          <p
            style={{
              fontSize: "11px",
              color: "#555555",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            Contact
          </p>
          {owners.map((owner) => (
            <ContactOwnerRow key={owner.email} owner={owner} />
          ))}
        </div>
      ) : null}

      {hasSocialLinks ? (
        <div style={{ marginTop: "16px" }}>
          <p
            style={{
              fontSize: "11px",
              color: "#555555",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            Connect
          </p>
          {club.instagramUrl ? (
            <SocialPill
              href={club.instagramUrl}
              label="Instagram"
              icon={
                <Heart size={16} color="#E1306C" className="shrink-0" aria-hidden />
              }
            />
          ) : null}
          {club.linkedinUrl ? (
            <SocialPill
              href={club.linkedinUrl}
              label="LinkedIn"
              icon={
                <Linkedin size={16} color="#0077b5" className="shrink-0" aria-hidden />
              }
            />
          ) : null}
          {club.twitterUrl ? (
            <SocialPill
              href={club.twitterUrl}
              label="Twitter/X"
              icon={
                <Twitter size={16} color="#888888" className="shrink-0" aria-hidden />
              }
            />
          ) : null}
          {club.websiteUrl ? (
            <SocialPill
              href={club.websiteUrl}
              label="Website"
              icon={
                <Globe size={16} color="#888888" className="shrink-0" aria-hidden />
              }
            />
          ) : null}
        </div>
      ) : null}

      {openPositionsCount > 0 ? (
        <div
          style={{
            background: "#1a0a0a",
            border: "1px solid #3a1a1a",
            borderRadius: "8px",
            padding: "14px",
            marginTop: "12px",
          }}
        >
          <p
            style={{
              color: "#E51937",
              fontWeight: 600,
              fontSize: "13px",
              margin: "0 0 4px",
            }}
          >
            We&apos;re Hiring
          </p>
          <p style={{ color: "#cccccc", fontSize: "12px", margin: 0 }}>
            {openPositionsCount} open position
            {openPositionsCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(
                user && joined
                  ? `/app/clubs/${club.id}/recruiting`
                  : "/app/hiring",
              )
            }
            style={{
              width: "100%",
              marginTop: "8px",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            View Positions
          </button>
        </div>
      ) : null}
    </>
  );
}
