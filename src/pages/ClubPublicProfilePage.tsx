import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Globe, Users, X, MoreHorizontal } from "lucide-react";
import { useClubContext } from "../context/useClubContext";
import { getClubInitials } from "../lib/clubUtils";
import {
  membershipBadgeLabel,
  membershipBadgeStyle,
  normalizeMembershipType,
  parseJoinQuestions,
} from "../lib/clubJoinUtils";
import JoinRequestForm from "../components/club/JoinRequestForm";
import ReportClubModal from "../components/club/ReportClubModal";
import { normalizeVisibility } from "../lib/contentVisibility";
import { normalizeClaimStatus } from "../lib/clubClaimUtils";
import { useAuthContext } from "../context/useAuthContext";
import { useIsMobile } from "../hooks/useWindowWidth";
import { supabase } from "../lib/supabaseClient";
import {
  notifyJoinRequestSubmitted,
  resolveStudentDisplayName,
} from "../lib/notifications";
import type {
  ClaimStatus,
  Club,
  ClubEvent,
  JoinAnswer,
  JoinQuestion,
  MembershipType,
} from "../types";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import { modalOverlayStyle } from "./app/HiringBoardPage";

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
  membershipType: MembershipType;
  claimStatus: ClaimStatus;
  joinQuestions: JoinQuestion[];
  allowJoinFileUpload?: boolean;
}

type JoinApplicationStatus = "pending" | "approved" | "rejected" | null;

interface ClubOwnerContact {
  fullName: string;
  email: string;
  avatarUrl?: string;
}

const ABOUT_PREVIEW_LENGTH = 300;

const leaveClubButtonStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  color: "#777777",
  borderRadius: "8px",
  padding: "10px 20px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const profileModalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.8)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const profileModalPanelStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #242424",
  borderRadius: "16px",
  maxWidth: "600px",
  width: "100%",
  maxHeight: "80vh",
  overflowY: "auto",
  padding: "32px",
  position: "relative",
};

function ClubLogoCircle({
  club,
  initialsClub,
  size = 96,
}: {
  club: Pick<PublicClubProfile, "name" | "logoUrl">;
  initialsClub: Pick<Club, "name" | "abbreviation">;
  size?: number;
}) {
  const borderWidth = size >= 96 ? 4 : 3;
  const shared: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    border: `${borderWidth}px solid #0f0f0f`,
    overflow: "hidden",
    flexShrink: 0,
    display: "block",
  };

  if (club.logoUrl) {
    return (
      <img
        src={club.logoUrl}
        alt={club.name}
        style={{ ...shared, objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      style={{
        ...shared,
        background: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#888888",
        fontWeight: 800,
        fontSize: size >= 96 ? "26px" : "22px",
      }}
    >
      {getClubInitials(initialsClub as Club)}
    </div>
  );
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
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#888888",
    borderRadius: "4px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    display: "inline-block",
    width: "fit-content",
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
    visibility: normalizeVisibility(row.visibility as string | null, "public"),
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
  const isMobile = useIsMobile();
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
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [bookmarkHovered, setBookmarkHovered] = useState(false);
  const [applicationStatus, setApplicationStatus] =
    useState<JoinApplicationStatus>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null);
  const [leaveHovered, setLeaveHovered] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportConfirmation, setReportConfirmation] = useState<string | null>(null);

  const clubId = profile?.id ?? contextClub?.id;
  const joined = clubId ? isJoined(clubId) : false;
  const pending = clubId ? isPending(clubId) : false;
  const saved = clubId ? isSaved(clubId) : false;

  useEffect(() => {
    if (!showReportMenu) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-report-menu]")) {
        setShowReportMenu(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showReportMenu]);

  useEffect(() => {
    if (!reportConfirmation) return;
    const timer = window.setTimeout(() => setReportConfirmation(null), 6000);
    return () => window.clearTimeout(timer);
  }, [reportConfirmation]);

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

      let loaded: PublicClubProfile = {
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
        membershipType: normalizeMembershipType(clubRow.membership_type),
        claimStatus: normalizeClaimStatus(clubRow.claim_status),
        joinQuestions: parseJoinQuestions(clubRow.join_questions),
        allowJoinFileUpload: Boolean(clubRow.allow_join_file_upload),
      };

      if (loaded.claimStatus === "unclaimed") {
        const { count: pendingClaimCount } = await supabase
          .from("club_claim_requests")
          .select("id", { count: "exact", head: true })
          .eq("club_id", loaded.id)
          .in("status", ["pending", "more_info"]);

        if ((pendingClaimCount ?? 0) > 0) {
          loaded = { ...loaded, claimStatus: "claim_pending" };
        }
      }

      let isMember = false;
      let userApplicationStatus: JoinApplicationStatus = null;
      if (user?.id) {
        const [{ data: membership }, { data: pendingClaim }] = await Promise.all([
          supabase
            .from("club_members")
            .select("status")
            .eq("club_id", loaded.id)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("club_claim_requests")
            .select("id, status")
            .eq("club_id", loaded.id)
            .eq("submitted_by", user.id)
            .in("status", ["pending", "more_info"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        isMember = membership?.status === "active";
        if (membership?.status === "pending") {
          userApplicationStatus = "pending";
        }

        if (
          pendingClaim &&
          loaded.claimStatus !== "claimed" &&
          loaded.claimStatus !== "active"
        ) {
          loaded = { ...loaded, claimStatus: "claim_pending" };
        }
      }

      setProfile(loaded);
      setApplicationStatus(userApplicationStatus);

      const [{ count: members }, { count: positions }, eventsRes, ownersRes] =
        await Promise.all([
        supabase
          .from("club_members")
          .select("id", { count: "exact", head: true })
          .eq("club_id", loaded.id)
          .eq("status", "active"),
        supabase
          .from("hiring_listings")
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
              (e) => e.visibility === "public",
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
    const membershipType =
      profile?.membershipType ?? contextClub?.membershipType ?? "open";
    if (membershipType !== "open") return;
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

  async function handleSubmitJoinRequest(payload: {
    answers: JoinAnswer[];
    message: string;
    attachmentUrl?: string | null;
  }) {
    if (!clubId || !user?.id) return;

    setSubmittingApplication(true);
    setJoinError(false);
    setJoinNotice(null);

    const answers = [...payload.answers];
    if (payload.attachmentUrl) {
      answers.push({
        question: "Attachment",
        answer: payload.attachmentUrl,
      });
    }

    const joined = await joinClub(clubId, {
      joinAnswers: answers,
      joinMessage: payload.message || null,
    });

    setSubmittingApplication(false);
    if (!joined) {
      setJoinError(true);
      return;
    }

    setApplicationStatus("pending");
    setShowApplicationModal(false);

    const clubName = profile?.name ?? contextClub?.name ?? "this club";
    const studentName = resolveStudentDisplayName(
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : profile?.name ?? null,
      user.email,
    );

    void notifyJoinRequestSubmitted(supabase, {
      clubId,
      clubName,
      studentUserId: user.id,
      studentName,
    });
  }

  function openApplicationFlow() {
    if (!user?.id) {
      navigate(`/signup?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setShowApplicationModal(true);
  }

  function handleOpenReportClub() {
    setShowReportMenu(false);
    if (!user?.id) {
      navigate(`/signup?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setShowReportModal(true);
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
    membershipType: contextClub!.membershipType ?? "open",
    claimStatus: contextClub!.claimStatus ?? "unclaimed",
    joinQuestions: contextClub!.joinQuestions ?? [],
  };

  const membershipType = club.membershipType ?? "open";
  const claimStatus = club.claimStatus ?? "unclaimed";
  const claimPending = claimStatus === "claim_pending";
  const joinQuestions = club.joinQuestions ?? [];
  const joinBadgeStyle = membershipBadgeStyle(membershipType);
  const joinBadgeLabel = membershipBadgeLabel(membershipType);

  const aboutText =
    club.longDescription?.trim() || club.shortDescription?.trim() || "";

  const aboutPreview =
    aboutText.length > ABOUT_PREVIEW_LENGTH
      ? `${aboutText.slice(0, ABOUT_PREVIEW_LENGTH).trimEnd()}…`
      : aboutText;
  const showAboutReadMore = aboutText.length > ABOUT_PREVIEW_LENGTH;

  function handleReadMore() {
    if (!user) {
      navigate(`/signup?redirect=/clubs/${club.slug}`);
      return;
    }
    setShowAboutModal(true);
  }

  function handleEventCardClick(event: ClubEvent) {
    if (joined) {
      navigate(`/app/clubs/${club.id}/events`);
      return;
    }
    setSelectedEvent(event);
  }

  function handleEventJoinAction() {
    setSelectedEvent(null);
    const type = club.membershipType ?? "open";
    if (type === "approval_required") {
      openApplicationFlow();
      return;
    }
    if (type === "open") {
      void handleJoinOrLeave();
    }
  }

  const headerPadding = isMobile ? "0 16px" : "0 32px";
  const headerContainerPadding = isMobile ? "0 16px 20px" : "0 32px 20px";

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
          height: "360px",
          overflow: "hidden",
          position: "relative",
          background: club.bannerUrl || club.imageUrl
            ? "#0f0f0f"
            : "linear-gradient(135deg, #1a0505 0%, #0f0f0f 100%)",
        }}
      >
        {club.bannerUrl || club.imageUrl ? (
          <img
            src={club.bannerUrl || club.imageUrl}
            alt="Club banner"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center center",
              display: "block",
            }}
          />
        ) : null}
      </div>

      <div
        className="mx-auto max-w-7xl sm:px-6 lg:px-8"
        style={{ paddingBottom: "64px", paddingLeft: isMobile ? 16 : undefined, paddingRight: isMobile ? 16 : undefined }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            padding: headerContainerPadding,
            gap: "20px",
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              minWidth: 0,
            }}
          >
            <div style={{ position: "relative", zIndex: 10, marginTop: "-48px" }}>
              <ClubLogoCircle club={club} initialsClub={initialsClub} />
            </div>
            <h1
              style={{
                fontSize: "30px",
                fontWeight: 800,
                color: "#ffffff",
                marginTop: "10px",
                marginBottom: 0,
                lineHeight: 1.2,
              }}
            >
              {club.name}
            </h1>
            {club.category ? (
              <span style={{ ...categoryBadgeStyle(), marginTop: "12px" }}>
                {club.category}
              </span>
            ) : null}
            {pending ? (
              <span
                className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-xs font-semibold text-yellow-400"
                style={{ display: "inline-block", marginTop: "8px" }}
              >
                Pending Approval
              </span>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "flex-end",
              paddingBottom: "4px",
              flexShrink: 0,
              width: isMobile ? "100%" : undefined,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "12px",
                alignItems: isMobile ? "stretch" : "center",
              }}
            >
              <button
                type="button"
                onClick={() => toggleSaveClub(club.id)}
                onMouseEnter={() => setBookmarkHovered(true)}
                onMouseLeave={() => setBookmarkHovered(false)}
                aria-label={saved ? "Unsave club" : "Save club"}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "10px",
                  color: bookmarkHovered || saved ? "#ffffff" : "#555555",
                  cursor: "pointer",
                  transition: "color 0.15s ease",
                  alignSelf: isMobile ? "flex-start" : undefined,
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
              {joined ? (
                <>
                  <Link
                    to={`/app/clubs/${club.id}`}
                    style={{
                      background: "#E51937",
                      color: "#ffffff",
                      borderRadius: "8px",
                      padding: "10px 20px",
                      fontWeight: 600,
                      fontSize: "14px",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                    }}
                  >
                    Open Workspace
                  </Link>
                  <button
                    type="button"
                    disabled={joining}
                    onClick={() => void handleJoinOrLeave()}
                    onMouseEnter={() => setLeaveHovered(true)}
                    onMouseLeave={() => setLeaveHovered(false)}
                    style={{
                      ...leaveClubButtonStyle,
                      borderColor: leaveHovered ? "#555555" : "#333333",
                      color: leaveHovered ? "#cccccc" : "#777777",
                      width: isMobile ? "100%" : undefined,
                      boxSizing: "border-box",
                      cursor: joining ? "wait" : "pointer",
                    }}
                  >
                    {joining ? "Leaving…" : "Leave Club"}
                  </button>
                </>
              ) : claimStatus === "unclaimed" ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(`/clubs/${club.slug}/claim`)}
                    style={{
                      background: "#E51937",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px 24px",
                      fontWeight: 600,
                      fontSize: "14px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      width: isMobile ? "100%" : undefined,
                      boxSizing: "border-box",
                    }}
                  >
                    Claim This Club
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSaveClub(club.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid #333333",
                      color: "#cccccc",
                      borderRadius: "8px",
                      padding: "10px 20px",
                      fontWeight: 600,
                      fontSize: "14px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      width: isMobile ? "100%" : undefined,
                      boxSizing: "border-box",
                    }}
                  >
                    Save Club
                  </button>
                </>
              ) : claimPending ? (
                <button
                  type="button"
                  onClick={() => toggleSaveClub(club.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid #333333",
                    color: "#cccccc",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    width: isMobile ? "100%" : undefined,
                    boxSizing: "border-box",
                  }}
                >
                  Save Club
                </button>
              ) : (
                <ClubJoinAction
                  membershipType={membershipType}
                  pending={pending}
                  joining={joining}
                  submittingApplication={submittingApplication}
                  applicationStatus={applicationStatus}
                  onOpenJoin={() => void handleJoinOrLeave()}
                  onOpenApplication={openApplicationFlow}
                  fullWidth={isMobile}
                />
              )}
              <div style={{ position: "relative" }} data-report-menu>
                <button
                  type="button"
                  aria-label="More options"
                  aria-expanded={showReportMenu}
                  onClick={() => setShowReportMenu((open) => !open)}
                  style={{
                    background: "transparent",
                    border: "1px solid #333333",
                    borderRadius: "8px",
                    color: "#777777",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 12px",
                    alignSelf: isMobile ? "flex-start" : undefined,
                  }}
                >
                  <MoreHorizontal size={18} aria-hidden />
                </button>
                {showReportMenu ? (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 6px)",
                      minWidth: "160px",
                      background: "#151515",
                      border: "1px solid #2a2a2a",
                      borderRadius: "8px",
                      overflow: "hidden",
                      zIndex: 30,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleOpenReportClub}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        color: "#cccccc",
                        padding: "10px 14px",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Report Club
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {claimPending ? (
          <p
            style={{
              fontSize: "13px",
              color: "#FFC429",
              marginTop: "12px",
              padding: headerPadding,
              lineHeight: 1.5,
            }}
          >
            A claim request is pending review for this club.
          </p>
        ) : claimStatus === "unclaimed" && !joined ? (
          <p
            style={{
              fontSize: "13px",
              color: "#777777",
              marginTop: "12px",
              padding: headerPadding,
              lineHeight: 1.5,
            }}
          >
            Are you a President or executive? Claim this club to manage events, announcements, and members.
          </p>
        ) : null}

        {joinNotice ? (
          <p className="mt-2 text-sm text-[#FFC429]" role="status" style={{ padding: headerPadding }}>
            {joinNotice}
          </p>
        ) : null}
        {joinError ? (
          <p className="mt-2 text-sm text-primary" role="alert" style={{ padding: headerPadding }}>
            Something went wrong. Please try again.
          </p>
        ) : null}
        {reportConfirmation ? (
          <p
            className="mt-2 text-sm"
            role="status"
            style={{ padding: headerPadding, color: "#4ade80" }}
          >
            {reportConfirmation}
          </p>
        ) : null}

        {showApplicationModal ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{ ...modalOverlayStyle, zIndex: 60 }}
            onClick={() => setShowApplicationModal(false)}
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
                Request to Join {club.name}
              </h2>
              <JoinRequestForm
                questions={joinQuestions}
                allowFileUpload={profile?.allowJoinFileUpload}
                submitting={submittingApplication}
                pending={applicationStatus === "pending"}
                onSubmit={(payload) => void handleSubmitJoinRequest(payload)}
              />
            </div>
          </div>
        ) : null}

        <div
          className="flex flex-col gap-6 lg:flex-row"
          style={{ alignItems: "flex-start", marginTop: "16px" }}
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
                  fontSize: "15px",
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
                  fontSize: "15px",
                  color: aboutText ? "#cccccc" : "#555555",
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                {aboutText ? aboutPreview : "No description provided yet."}
                {showAboutReadMore ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={handleReadMore}
                      style={{
                        color: "#E51937",
                        fontSize: "13px",
                        fontWeight: 500,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Read More
                    </button>
                  </>
                ) : null}
              </p>
            </div>

            <EventsSection
              events={events}
              joined={joined}
              clubId={club.id}
              clubName={club.name}
              clubLogoUrl={club.logoUrl}
              clubAbbreviation={contextClub?.abbreviation}
              onEventClick={handleEventCardClick}
            />
          </div>

          <aside style={{ width: isMobile ? "100%" : "280px", flexShrink: 0 }}>
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

      {showAboutModal ? (
        <ClubAboutModal
          club={club}
          initialsClub={initialsClub}
          memberCount={memberCount}
          membershipType={membershipType}
          joinBadgeLabel={joinBadgeLabel}
          joinBadgeStyle={joinBadgeStyle}
          events={events.slice(0, 2)}
          joined={joined}
          hasSocialLinks={hasSocialLinks}
          onClose={() => setShowAboutModal(false)}
          onOpenWorkspace={() => navigate(`/app/clubs/${club.id}`)}
          onJoin={() => {
            setShowAboutModal(false);
            if (membershipType === "approval_required") {
              openApplicationFlow();
            } else if (membershipType === "open") {
              void handleJoinOrLeave();
            }
          }}
        />
      ) : null}

      {selectedEvent ? (
        <EventDetailModal
          event={selectedEvent}
          user={user}
          joined={joined}
          clubSlug={club.slug}
          onClose={() => setSelectedEvent(null)}
          onJoinClub={handleEventJoinAction}
        />
      ) : null}

      {showReportModal && user?.id ? (
        <ReportClubModal
          clubId={club.id}
          clubName={club.name}
          reporterId={user.id}
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => {
            setShowReportModal(false);
            setReportConfirmation("Thanks for your report. Our team will review it.");
          }}
        />
      ) : null}
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
  onEventClick,
}: {
  events: ClubEvent[];
  joined: boolean;
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  clubAbbreviation?: string;
  onEventClick: (event: ClubEvent) => void;
}) {
  const eventsUrl = `/app/clubs/${clubId}/events`;
  const visibleEvents = events.slice(0, 4);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const cardStyle = (eventId: string): CSSProperties => ({
    background: "#1a1a1a",
    border: "1px solid",
    borderColor: hoveredId === eventId ? "#333333" : "#242424",
    borderRadius: "12px",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    cursor: "pointer",
    marginBottom: "12px",
    transition: "all 0.15s ease",
  });

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
        <div>
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              role="button"
              tabIndex={0}
              onClick={() => onEventClick(event)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEventClick(event);
                }
              }}
              onMouseEnter={() => setHoveredId(event.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={cardStyle(event.id)}
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
          ))}
          {joined && events.length > 4 ? (
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

function ModalCloseButton({ onClose }: { onClose: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Close"
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        background: "transparent",
        border: "none",
        color: hovered ? "#ffffff" : "#747676",
        cursor: "pointer",
        padding: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <X size={20} />
    </button>
  );
}

function CompactEventPreview({
  event,
  clubName,
  clubLogoUrl,
  clubAbbreviation,
}: {
  event: ClubEvent;
  clubName: string;
  clubLogoUrl?: string;
  clubAbbreviation?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid #1e1e1e",
      }}
    >
      <EventDateBlock date={event.date} />
      <ClubEventLogo
        name={clubName}
        abbreviation={clubAbbreviation}
        logoUrl={clubLogoUrl}
      />
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 2px",
          }}
        >
          {event.title}
        </p>
        <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>
          {formatEventScheduleLine(event.date, event.time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
    </div>
  );
}

function ClubAboutModal({
  club,
  initialsClub,
  memberCount,
  membershipType,
  joinBadgeLabel,
  joinBadgeStyle,
  events,
  joined,
  hasSocialLinks,
  onClose,
  onOpenWorkspace,
  onJoin,
}: {
  club: PublicClubProfile;
  initialsClub: Pick<Club, "name" | "abbreviation">;
  memberCount: number;
  membershipType: MembershipType;
  joinBadgeLabel: string | null;
  joinBadgeStyle: CSSProperties | null;
  events: ClubEvent[];
  joined: boolean;
  hasSocialLinks: boolean;
  onClose: () => void;
  onOpenWorkspace: () => void;
  onJoin: () => void;
}) {
  const aboutText =
    club.longDescription?.trim() || club.shortDescription?.trim() || "";

  const joinLabel =
    membershipType === "approval_required"
      ? "Apply to Join"
      : membershipType === "no_membership" || membershipType === "invite_only"
        ? "Save Club"
        : "Join Club";

  return (
    <div
      style={profileModalOverlayStyle}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={profileModalPanelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-about-modal-title"
      >
        <ModalCloseButton onClose={onClose} />

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          <ClubLogoCircle club={club} initialsClub={initialsClub} size={56} />
          <h2
            id="club-about-modal-title"
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "#ffffff",
              margin: 0,
            }}
          >
            {club.name}
          </h2>
        </div>

        <p
          style={{
            fontSize: "15px",
            color: "#cccccc",
            lineHeight: 1.8,
            margin: "0 0 24px",
            whiteSpace: "pre-wrap",
          }}
        >
          {aboutText || "No description provided yet."}
        </p>

        <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: "20px", marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", color: "#cccccc" }}>
              {formatMemberCount(memberCount)}
            </span>
            {club.category ? (
              <span style={categoryBadgeStyle()}>{club.category}</span>
            ) : null}
            {joinBadgeStyle && joinBadgeLabel ? (
              <span style={joinBadgeStyle}>{joinBadgeLabel}</span>
            ) : null}
          </div>
        </div>

        {hasSocialLinks ? (
          <div style={{ marginBottom: "20px" }}>
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

        {events.length > 0 ? (
          <div style={{ marginBottom: "24px" }}>
            <p
              style={{
                fontSize: "11px",
                color: "#555555",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              Upcoming Events
            </p>
            {events.map((event) => (
              <CompactEventPreview
                key={event.id}
                event={event}
                clubName={club.name}
                clubLogoUrl={club.logoUrl}
                clubAbbreviation={initialsClub.abbreviation}
              />
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: "8px" }}>
          {joined ? (
            <button
              type="button"
              onClick={onOpenWorkspace}
              style={{
                width: "100%",
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open Workspace
            </button>
          ) : membershipType === "no_membership" ||
            membershipType === "invite_only" ? null : (
            <button
              type="button"
              onClick={onJoin}
              style={{
                width: "100%",
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {joinLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventDetailModal({
  event,
  user,
  joined,
  clubSlug,
  onClose,
  onJoinClub,
}: {
  event: ClubEvent;
  user: ReturnType<typeof useAuthContext>["user"];
  joined: boolean;
  clubSlug: string;
  onClose: () => void;
  onJoinClub: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      style={profileModalOverlayStyle}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={profileModalPanelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-modal-title"
      >
        <ModalCloseButton onClose={onClose} />

        <h2
          id="event-detail-modal-title"
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 16px",
            paddingRight: "32px",
          }}
        >
          {event.title}
        </h2>

        <p style={{ fontSize: "14px", color: "#cccccc", margin: "0 0 8px" }}>
          {formatEventScheduleLine(event.date, event.time)}
        </p>
        {event.location ? (
          <p style={{ fontSize: "14px", color: "#747676", margin: "0 0 20px" }}>
            {event.location}
          </p>
        ) : (
          <div style={{ marginBottom: "20px" }} />
        )}

        {event.description?.trim() ? (
          <p
            style={{
              fontSize: "15px",
              color: "#cccccc",
              lineHeight: 1.8,
              margin: "0 0 24px",
              whiteSpace: "pre-wrap",
            }}
          >
            {event.description.trim()}
          </p>
        ) : null}

        {!joined ? (
          <button
            type="button"
            onClick={() => {
              if (!user) {
                navigate(`/signup?redirect=/clubs/${clubSlug}`);
                return;
              }
              onJoinClub();
            }}
            style={{
              width: "100%",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {!user ? "Sign Up to RSVP" : "Join Club to RSVP"}
          </button>
        ) : null}
      </div>
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
          gap: "8px",
          marginBottom: "14px",
          fontSize: "13px",
          color: "#cccccc",
          fontWeight: 500,
        }}
      >
        <Users size={14} strokeWidth={2} color="#555555" aria-hidden />
        {memberCount} {memberCount === 1 ? "Member" : "Members"}
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
  membershipType,
  pending,
  joining,
  submittingApplication,
  applicationStatus,
  onOpenJoin,
  onOpenApplication,
  fullWidth,
}: {
  membershipType: MembershipType;
  pending: boolean;
  joining: boolean;
  submittingApplication: boolean;
  applicationStatus: JoinApplicationStatus;
  onOpenJoin: () => void;
  onOpenApplication: () => void;
  fullWidth?: boolean;
}) {
  if (membershipType === "no_membership") {
    return (
      <span
        style={statusBadgeStyle({
          background: "#1a1a1a",
          border: "1px solid #333333",
          color: "#777777",
        })}
      >
        No general membership
      </span>
    );
  }

  if (membershipType === "invite_only") {
    return (
      <span
        style={statusBadgeStyle({
          background: "#0a0a1a",
          border: "1px solid #6b7cff",
          color: "#6b7cff",
        })}
      >
        Invite only
      </span>
    );
  }

  if (membershipType === "approval_required") {
    if (applicationStatus === "pending") {
      return (
        <span
          style={statusBadgeStyle({
            background: "#1a1500",
            border: "1px solid #FFC429",
            color: "#FFC429",
          })}
        >
          Request Pending
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
          width: fullWidth ? "100%" : undefined,
          boxSizing: "border-box",
        }}
      >
        {submittingApplication ? "Submitting…" : "Submit Request"}
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
              width: fullWidth ? "100%" : undefined,
              boxSizing: "border-box",
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
              width: fullWidth ? "100%" : undefined,
              boxSizing: "border-box",
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
