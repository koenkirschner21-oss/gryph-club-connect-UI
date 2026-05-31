import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Globe, Users } from "lucide-react";
import { useClubContext } from "../context/useClubContext";
import { getClubInitials } from "../lib/clubUtils";
import {
  joinTypeBadgeLabel,
  joinTypeBadgeStyle,
  normalizeJoinType,
  parseJoinQuestions,
} from "../lib/clubJoinUtils";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import type { Club, ClubEvent, ClubJoinType, JoinAnswer, JoinQuestion } from "../types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import { darkInputStyle, modalOverlayStyle } from "./app/HiringBoardPage";

interface PublicClubProfile {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  logoUrl?: string;
  bannerUrl?: string;
  imageUrl?: string;
  category: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  createdAt?: string;
  joinType: ClubJoinType;
  joinQuestions: JoinQuestion[];
}

type JoinApplicationStatus = "pending" | "approved" | "rejected" | null;

interface ClubOwnerContact {
  fullName: string;
  email: string;
  avatarUrl?: string;
}

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

function LinkedInBrandIcon() {
  return (
    <div style={{ ...brandIconBox, background: "#0077B5", color: "#ffffff" }}>
      <span style={{ fontWeight: 700, fontSize: "11px", lineHeight: 1 }}>in</span>
    </div>
  );
}

function TwitterBrandIcon() {
  return (
    <div style={{ ...brandIconBox, background: "#000000" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
    border: "1px solid #222",
    color: "#747676",
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "12px",
    display: "inline-block",
  };
}

const CLUB_EVENT_DATE_SIZE = 48;
const CLUB_EVENT_LOGO_SIZE = 40;

function ClubEventLogo({
  name,
  abbreviation,
  logoUrl,
}: {
  name: string;
  abbreviation?: string;
  logoUrl?: string;
}) {
  const abbr =
    abbreviation?.trim() ||
    name
      .split(" ")
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
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

function SocialLinkRow({
  href,
  label,
  icon,
  isLast,
}: {
  href: string;
  label: string;
  icon: ReactNode;
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
  const [bookmarkHovered, setBookmarkHovered] = useState(false);
  const [applicationStatus, setApplicationStatus] =
    useState<JoinApplicationStatus>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);

  const clubId = profile?.id ?? contextClub?.id;
  const joined = clubId ? isJoined(clubId) : false;
  const pending = clubId ? isPending(clubId) : false;
  const saved = clubId ? isSaved(clubId) : false;

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
        .select("*");

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
        imageUrl: (clubRow.image_url as string) ?? undefined,
        category: (clubRow.category as string) ?? "",
        instagramUrl: (clubRow.instagram_url as string) ?? undefined,
        linkedinUrl: (clubRow.linkedin_url as string) ?? undefined,
        twitterUrl: (clubRow.twitter_url as string) ?? undefined,
        websiteUrl: (clubRow.website_url as string) ?? undefined,
        createdAt: (clubRow.created_at as string) ?? undefined,
        joinType: normalizeJoinType(clubRow.join_type),
        joinQuestions: parseJoinQuestions(clubRow.join_questions),
      };

      setProfile(loaded);

      let isMember = false;
      let userApplicationStatus: JoinApplicationStatus = null;
      if (user?.id) {
        const [{ data: membership }, { data: application }] = await Promise.all([
          supabase
            .from("club_members")
            .select("id")
            .eq("club_id", loaded.id)
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle(),
          supabase
            .from("club_join_applications")
            .select("status")
            .eq("club_id", loaded.id)
            .eq("applicant_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        isMember = !!membership;
        if (application?.status === "pending" ||
            application?.status === "approved" ||
            application?.status === "rejected") {
          userApplicationStatus = application.status;
        }
      }
      setApplicationStatus(userApplicationStatus);

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
    const joinType = profile?.joinType ?? contextClub?.joinType ?? "open";
    if (joinType !== "open") return;
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

  async function handleRequestVoteJoin() {
    if (!clubId || !user?.id) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (applicationStatus === "pending" || joined) return;

    setSubmittingApplication(true);
    setJoinError(false);
    const { error } = await supabase.from("club_join_applications").insert({
      club_id: clubId,
      applicant_id: user.id,
      answers: [],
      status: "pending",
    });

    setSubmittingApplication(false);
    if (error) {
      console.error("Failed to submit join request:", error.message);
      setJoinError(true);
      return;
    }
    setApplicationStatus("pending");
  }

  async function handleSubmitJoinApplication(answers: JoinAnswer[]) {
    if (!clubId || !user?.id) return;

    setSubmittingApplication(true);
    setJoinError(false);
    const { error } = await supabase.from("club_join_applications").insert({
      club_id: clubId,
      applicant_id: user.id,
      answers,
      status: "pending",
    });

    setSubmittingApplication(false);
    if (error) {
      console.error("Failed to submit application:", error.message);
      setJoinError(true);
      return;
    }

    setApplicationStatus("pending");
    setShowApplicationModal(false);
  }

  function openApplicationFlow() {
    if (!user?.id) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setShowApplicationModal(true);
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
    imageUrl: contextClub!.imageUrl,
    category: contextClub!.category,
    createdAt: contextClub!.createdAt,
    joinType: contextClub!.joinType ?? "open",
    joinQuestions: contextClub!.joinQuestions ?? [],
  };

  const joinType = club.joinType ?? "open";
  const joinQuestions = club.joinQuestions ?? [];
  const joinBadgeStyle = joinTypeBadgeStyle(joinType);
  const joinBadgeLabel = joinTypeBadgeLabel(joinType);

  const aboutText =
    club.longDescription?.trim() || club.shortDescription?.trim() || "";

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
        style={{ paddingBottom: "64px" }}
      >
        <div className="relative mb-6">
          <div
            className="relative z-10 flex-shrink-0"
            style={{ marginTop: "-36px", marginLeft: "24px" }}
          >
            {club.logoUrl ? (
              <img
                src={club.logoUrl}
                alt={club.name}
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "12px",
                  border: "3px solid #0f0f0f",
                  background: "#1a1a1a",
                  objectFit: "cover",
                  display: "block",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "12px",
                  border: "3px solid #0f0f0f",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  background: "#1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#888888",
                  fontWeight: 800,
                  fontSize: "20px",
                }}
              >
                {getClubInitials(initialsClub as Club)}
              </div>
            )}
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
                  <span style={categoryBadgeStyle()}>{club.category || "Club"}</span>
                  <span style={{ fontSize: "13px", color: "#747676" }}>
                    {formatMemberCount(memberCount)}
                  </span>
                  {joined ? (
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
                  ) : null}
                  {pending ? (
                    <span className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-xs font-semibold text-yellow-400">
                      Pending Approval
                    </span>
                  ) : null}
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
                {joinBadgeStyle && joinBadgeLabel ? (
                  <span style={{ ...joinBadgeStyle, marginTop: "8px" }}>
                    {joinBadgeLabel}
                  </span>
                ) : null}
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
                <ClubJoinAction
                  joinType={joinType}
                  joined={joined}
                  pending={pending}
                  joining={joining}
                  submittingApplication={submittingApplication}
                  applicationStatus={applicationStatus}
                  onOpenJoin={() => void handleJoinOrLeave()}
                  onOpenApplication={openApplicationFlow}
                  onRequestVote={() => void handleRequestVoteJoin()}
                />
              </div>
            </div>
            {joinError ? (
              <p className="mt-2 text-sm text-primary" role="alert">
                Something went wrong. Please try again.
              </p>
            ) : null}
          </div>
        </div>

        {showApplicationModal ? (
          <ClubJoinApplicationModal
            clubName={club.name}
            questions={joinQuestions}
            submitting={submittingApplication}
            onClose={() => setShowApplicationModal(false)}
            onSubmit={(answers) => void handleSubmitJoinApplication(answers)}
          />
        ) : null}

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

            <EventsSection
              events={events}
              joined={joined}
              clubId={club.id}
              clubName={club.name}
              clubLogoUrl={club.logoUrl}
              clubAbbreviation={contextClub?.abbreviation}
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
  clubId,
  clubName,
  clubLogoUrl,
  clubAbbreviation,
}: {
  events: ClubEvent[];
  joined: boolean;
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  clubAbbreviation?: string;
}) {
  const eventsUrl = `/app/clubs/${clubId}/events`;
  const visibleEvents = events.slice(0, 4);
  const cardStyle: CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid #242424",
    borderRadius: "10px",
    padding: "16px 20px",
    marginBottom: "10px",
    display: "block",
    textDecoration: "none",
  };

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
          {visibleEvents.map((event) => {
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
                  name={clubName}
                  abbreviation={clubAbbreviation}
                  logoUrl={clubLogoUrl}
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
          {events.length > 4 ? (
            <div style={{ textAlign: "right", marginTop: "4px" }}>
              <Link
                to={eventsUrl}
                style={{
                  color: "#E51937",
                  fontSize: "13px",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                View All Events
              </Link>
            </div>
          ) : null}
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
          <p style={connectHeadingStyle()}>Connect</p>
          {(
            [
              club.instagramUrl && {
                href: club.instagramUrl,
                label: "Instagram",
                icon: <InstagramBrandIcon />,
              },
              club.linkedinUrl && {
                href: club.linkedinUrl,
                label: "LinkedIn",
                icon: <LinkedInBrandIcon />,
              },
              club.twitterUrl && {
                href: club.twitterUrl,
                label: "Twitter/X",
                icon: <TwitterBrandIcon />,
              },
              club.websiteUrl && {
                href: club.websiteUrl,
                label: "Website",
                icon: <WebsiteBrandIcon />,
              },
            ].filter(Boolean) as {
              href: string;
              label: string;
              icon: ReactNode;
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
      ) : null}

      {openPositionsCount > 0 ? (
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: "10px",
            padding: "16px",
            marginTop: "12px",
            borderLeft: "3px solid #FFC429",
          }}
        >
          <p
            style={{
              color: "#FFC429",
              fontWeight: 700,
              fontSize: "15px",
              margin: 0,
            }}
          >
            We&apos;re Hiring
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#555555",
              marginTop: "4px",
              marginBottom: 0,
            }}
          >
            {openPositionsCount} open position
            {openPositionsCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(
                user && joined
                  ? `/app/clubs/${club.id}/recruiting`
                  : "/hiring",
              )
            }
            style={{
              width: "100%",
              marginTop: "12px",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
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

function statusBadgeStyle(base: CSSProperties): CSSProperties {
  return {
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    ...base,
  };
}

function ClubJoinAction({
  joinType,
  joined,
  pending,
  joining,
  submittingApplication,
  applicationStatus,
  onOpenJoin,
  onOpenApplication,
  onRequestVote,
}: {
  joinType: ClubJoinType;
  joined: boolean;
  pending: boolean;
  joining: boolean;
  submittingApplication: boolean;
  applicationStatus: JoinApplicationStatus;
  onOpenJoin: () => void;
  onOpenApplication: () => void;
  onRequestVote: () => void;
}) {
  if (joined) {
    return (
      <button
        type="button"
        disabled={joining}
        onClick={onOpenJoin}
        style={{
          background: "transparent",
          border: "1px solid #E51937",
          color: "#E51937",
          borderRadius: "8px",
          padding: "10px 24px",
          fontWeight: 600,
          fontSize: "14px",
          cursor: joining ? "wait" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {joining ? "Leaving…" : "Leave Club"}
      </button>
    );
  }

  if (joinType === "application") {
    if (applicationStatus === "pending") {
      return (
        <span
          style={statusBadgeStyle({
            background: "#1a1500",
            border: "1px solid #FFC429",
            color: "#FFC429",
          })}
        >
          Application Submitted
        </span>
      );
    }
    if (applicationStatus === "rejected") {
      return (
        <span
          style={statusBadgeStyle({
            background: "#1a1a1a",
            border: "1px solid #333333",
            color: "#747676",
          })}
        >
          Application Declined
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={submittingApplication}
        onClick={onOpenApplication}
        style={{
          background: "#E51937",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          padding: "10px 24px",
          fontWeight: 600,
          fontSize: "14px",
          cursor: submittingApplication ? "wait" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {submittingApplication ? "Submitting…" : "Apply to Join"}
      </button>
    );
  }

  if (joinType === "vote") {
    if (applicationStatus === "pending") {
      return (
        <span
          style={statusBadgeStyle({
            background: "#0a0a1a",
            border: "1px solid #6b7cff",
            color: "#6b7cff",
          })}
        >
          Vote in Progress
        </span>
      );
    }
    if (applicationStatus === "rejected") {
      return (
        <span
          style={statusBadgeStyle({
            background: "#1a1a1a",
            border: "1px solid #333333",
            color: "#747676",
          })}
        >
          Declined
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={submittingApplication}
        onClick={onRequestVote}
        style={{
          background: "#E51937",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          padding: "10px 24px",
          fontWeight: 600,
          fontSize: "14px",
          cursor: submittingApplication ? "wait" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {submittingApplication ? "Submitting…" : "Request to Join"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={joining}
      onClick={onOpenJoin}
      style={
        pending
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
        : pending
          ? "Cancel Request"
          : "Join Club"}
    </button>
  );
}

function ClubJoinApplicationModal({
  clubName,
  questions,
  submitting,
  onClose,
  onSubmit,
}: {
  clubName: string;
  questions: JoinQuestion[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (answers: JoinAnswer[]) => void;
}) {
  const effectiveQuestions =
    questions.length > 0
      ? questions
      : [
          {
            id: "default-why",
            question: "Why do you want to join?",
            question_type: "long" as const,
            required: true,
            order_index: 0,
          },
        ];

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const q of effectiveQuestions) {
      if (q.required && !(answers[q.id] ?? "").trim()) {
        next[q.id] = "This field is required.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload: JoinAnswer[] = effectiveQuestions
      .map((q) => ({
        id: q.id,
        question: q.question,
        answer: (answers[q.id] ?? "").trim(),
      }))
      .filter((row) => row.answer);
    onSubmit(payload);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ ...modalOverlayStyle, zIndex: 60 }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "28px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontWeight: 700,
            fontSize: "18px",
            color: "#ffffff",
            margin: "0 0 20px",
          }}
        >
          Apply to Join {clubName}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {effectiveQuestions.map((q) => (
            <div key={q.id}>
              <label
                htmlFor={`join-q-${q.id}`}
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#cccccc",
                  marginBottom: "6px",
                }}
              >
                {q.question}
                {q.required ? " *" : ""}
              </label>
              {q.question_type === "long" ? (
                <textarea
                  id={`join-q-${q.id}`}
                  rows={4}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  style={{ ...darkInputStyle, width: "100%", resize: "vertical" }}
                />
              ) : (
                <input
                  id={`join-q-${q.id}`}
                  type="text"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  style={{ ...darkInputStyle, width: "100%" }}
                />
              )}
              {errors[q.id] ? (
                <p style={{ fontSize: "12px", color: "#E51937", margin: "4px 0 0" }}>
                  {errors[q.id]}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          style={{
            width: "100%",
            marginTop: "20px",
            background: "#E51937",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Submitting…" : "Submit Application"}
        </button>
      </div>
    </div>
  );
}
