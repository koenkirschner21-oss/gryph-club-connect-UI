import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  Navigate,
} from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  CheckSquare,
  Calendar,
  Users,
  BarChart2,
  Settings,
  ExternalLink,
  type IconProps,
} from "../icons/WorkspaceIcons";
import { Briefcase, Calendar as LucideCalendar, FileText, Menu, X } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { useClubContext } from "../../context/useClubContext";
import { supabase } from "../../lib/supabaseClient";
import { useClubWorkspaceNav } from "../../hooks/useClubWorkspaceNav";
import type { WorkspaceNavKey } from "../../lib/workspaceNavVisibility";
import { formatAccessLevelWithMemberTitle } from "../../lib/memberRoleTitle";
import Spinner from "../ui/Spinner";

const workspaceLinks: {
  key: WorkspaceNavKey;
  to: string;
  label: string;
  end: boolean;
  Icon: (props: IconProps) => ReactElement;
  badgeKey?: "chat" | "tasks" | "announcements";
}[] = [
  { key: "dashboard", to: "", label: "Dashboard", end: true, Icon: LayoutDashboard },
  {
    key: "announcements",
    to: "announcements",
    label: "Announcements",
    end: false,
    Icon: Megaphone,
    badgeKey: "announcements",
  },
  { key: "chat", to: "chat", label: "Chat", end: false, Icon: MessageSquare, badgeKey: "chat" },
  { key: "tasks", to: "tasks", label: "Tasks", end: false, Icon: CheckSquare, badgeKey: "tasks" },
  { key: "events", to: "events", label: "Events", end: false, Icon: Calendar },
  {
    key: "meetings",
    to: "meetings",
    label: "Meetings",
    end: false,
    Icon: ({ size = 16, strokeWidth = 2, "aria-hidden": ariaHidden = true }) => (
      <LucideCalendar size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
    ),
  },
  {
    key: "documents",
    to: "documents",
    label: "Documents",
    end: false,
    Icon: ({ size = 16, strokeWidth = 2, "aria-hidden": ariaHidden = true }) => (
      <FileText size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
    ),
  },
  { key: "members", to: "members", label: "Members", end: false, Icon: Users },
  {
    key: "recruiting",
    to: "recruiting",
    label: "Hiring",
    end: false,
    Icon: ({ size = 16, strokeWidth = 2, "aria-hidden": ariaHidden = true }) => (
      <Briefcase size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
    ),
  },
];

const analyticsLink = {
  to: "analytics",
  label: "Analytics",
  Icon: BarChart2,
} as const;

const settingsLink = {
  to: "settings",
  label: "Club Settings",
  Icon: Settings,
} as const;

function sidebarRoleLabel(
  role: ReturnType<typeof useClubWorkspaceNav>["role"],
  accessLevel: ReturnType<typeof useClubWorkspaceNav>["accessLevel"],
  memberTitle?: string | null,
): string {
  return formatAccessLevelWithMemberTitle(accessLevel, role, memberTitle);
}

const badgeStyle: CSSProperties = {
  background: "#E51937",
  color: "#ffffff",
  borderRadius: "20px",
  minWidth: "18px",
  height: "18px",
  fontSize: "10px",
  fontWeight: 700,
  padding: "0 5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function announcementsVisitedKey(clubId: string): string {
  return `last_visited_announcements_${clubId}`;
}

function tasksVisitedKey(clubId: string): string {
  return `last_visited_tasks_${clubId}`;
}

function visitedTimestampForQuery(value: string | null): string | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    return new Date(Number(value)).toISOString();
  }
  return value;
}

function workspaceNavClass(isActive: boolean) {
  const base =
    "flex w-full items-center justify-between rounded-[6px] border-l-[3px] py-[9px] pr-[14px] text-[13px] font-normal transition-colors";
  if (isActive) {
    return `${base} border-l-[#E51937] bg-[#1f1f1f] pl-[11px] text-white`;
  }
  return `${base} border-l-transparent pl-[14px] text-[#777777] hover:bg-[#1a1a1a] hover:text-[#cccccc]`;
}

function NavCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span style={badgeStyle} aria-label={`${count} unread`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function WorkspaceLayout() {
  const { clubId } = useParams<{ clubId: string }>();
  const location = useLocation();
  const { user } = useAuthContext();
  const { getClubById, loading, activeClubId, switchClub } = useClubContext();
  const resolvedClubId = clubId ?? activeClubId ?? "";
  const workspaceNav = useClubWorkspaceNav(resolvedClubId);
  const [chatUnread, setChatUnread] = useState(0);
  const [tasksUnread, setTasksUnread] = useState(0);
  const [announcementsUnread, setAnnouncementsUnread] = useState(0);

  const workspaceBasePath = resolvedClubId
    ? `/app/clubs/${resolvedClubId}`
    : "";

  const loadBadgeCounts = useCallback(async () => {
    if (!user?.id || !resolvedClubId) {
      setChatUnread(0);
      setTasksUnread(0);
      setAnnouncementsUnread(0);
      return;
    }

    try {
      const { data: memberships, error: membershipsError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (membershipsError) {
        console.error("Failed to load chat memberships for badges:", membershipsError.message);
        setChatUnread(0);
      } else {
        const membershipIds = (memberships ?? []).map((row) => row.conversation_id as string);
        if (membershipIds.length === 0) {
          setChatUnread(0);
        } else {
          const { data: clubConvos, error: convosError } = await supabase
            .from("conversations")
            .select("id")
            .eq("club_id", resolvedClubId)
            .in("id", membershipIds);

          if (convosError) {
            console.error("Failed to load club conversations for badges:", convosError.message);
            setChatUnread(0);
          } else {
            const clubConversationIds = (clubConvos ?? []).map((row) => row.id as string);
            if (clubConversationIds.length === 0) {
              setChatUnread(0);
            } else {
              const { data: unreadMessages, error: messagesError } = await supabase
                .from("direct_messages")
                .select("id, read_by, sender_id")
                .in("conversation_id", clubConversationIds)
                .neq("sender_id", user.id);

              if (messagesError) {
                console.error("Failed to load chat unread for badges:", messagesError.message);
                setChatUnread(0);
              } else {
                setChatUnread(
                  (unreadMessages ?? []).filter(
                    (row) => !(row.read_by ?? []).includes(user.id),
                  ).length,
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load chat badge count:", err);
      setChatUnread(0);
    }

    const lastTasksVisited = visitedTimestampForQuery(
      localStorage.getItem(tasksVisitedKey(resolvedClubId)),
    );
    let tasksQuery = supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("club_id", resolvedClubId)
      .eq("assigned_to", user.id)
      .neq("status", "done");

    if (lastTasksVisited) {
      tasksQuery = tasksQuery.gt("created_at", lastTasksVisited);
    }

    const { count: openTasks, error: tasksError } = await tasksQuery;

    if (tasksError) {
      console.error("Failed to load task badge count:", tasksError.message);
      setTasksUnread(0);
    } else {
      setTasksUnread(openTasks ?? 0);
    }

    const lastVisited = visitedTimestampForQuery(
      localStorage.getItem(announcementsVisitedKey(resolvedClubId)),
    );
    let announcementsQuery = supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("club_id", resolvedClubId);

    if (lastVisited) {
      announcementsQuery = announcementsQuery.gt("created_at", lastVisited);
    }

    const { count: newAnnouncements, error: announcementsError } = await announcementsQuery;

    if (announcementsError) {
      console.error("Failed to load announcements badge count:", announcementsError.message);
      setAnnouncementsUnread(0);
    } else {
      setAnnouncementsUnread(newAnnouncements ?? 0);
    }
  }, [resolvedClubId, user?.id]);

  useEffect(() => {
    if (clubId && clubId !== activeClubId) {
      switchClub(clubId);
    }
  }, [activeClubId, clubId, switchClub]);

  useEffect(() => {
    void loadBadgeCounts();
  }, [loadBadgeCounts]);

  useEffect(() => {
    if (!resolvedClubId || !workspaceBasePath) return;

    const path = location.pathname;
    if (path.startsWith(`${workspaceBasePath}/chat`)) {
      setChatUnread(0);
      return;
    }
    if (path.startsWith(`${workspaceBasePath}/tasks`)) {
      localStorage.setItem(tasksVisitedKey(resolvedClubId), String(Date.now()));
      setTasksUnread(0);
      return;
    }
    if (path.startsWith(`${workspaceBasePath}/announcements`)) {
      localStorage.setItem(
        announcementsVisitedKey(resolvedClubId),
        String(Date.now()),
      );
      setAnnouncementsUnread(0);
    }
  }, [location.pathname, resolvedClubId, workspaceBasePath]);

  const handleBadgeNavClick = useCallback(
    (badgeKey?: "chat" | "tasks" | "announcements") => {
      if (!resolvedClubId || !badgeKey) return;
      if (badgeKey === "chat") {
        setChatUnread(0);
        return;
      }
      if (badgeKey === "tasks") {
        localStorage.setItem(tasksVisitedKey(resolvedClubId), String(Date.now()));
        setTasksUnread(0);
        return;
      }
      if (badgeKey === "announcements") {
        localStorage.setItem(
          announcementsVisitedKey(resolvedClubId),
          String(Date.now()),
        );
        setAnnouncementsUnread(0);
      }
    },
    [resolvedClubId],
  );

  useEffect(() => {
    const previewRole = localStorage.getItem("previewRole");
    if (previewRole || !user?.id || !resolvedClubId) {
      setWorkspaceAccess("allowed");
      return;
    }

    let cancelled = false;

    async function verifyMembership() {
      setWorkspaceAccess("checking");
      const currentUserId = user?.id;
      if (!currentUserId) {
        setWorkspaceAccess("allowed");
        return;
      }

      const [{ data: membership }, { data: clubRow }] = await Promise.all([
        supabase
          .from("club_members")
          .select("status")
          .eq("club_id", resolvedClubId)
          .eq("user_id", currentUserId)
          .maybeSingle(),
        supabase
          .from("clubs")
          .select("slug")
          .eq("id", resolvedClubId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (membership?.status === "active") {
        setWorkspaceAccess("allowed");
        return;
      }

      setDeniedClubSlug((clubRow?.slug as string | undefined) ?? null);
      setWorkspaceAccess("denied");
    }

    void verifyMembership();

    return () => {
      cancelled = true;
    };
  }, [resolvedClubId, user?.id]);

  useEffect(() => {
    if (!user?.id || !resolvedClubId) return;

    const channel: RealtimeChannel = supabase
      .channel(`workspace-badges:${resolvedClubId}:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => {
          void loadBadgeCounts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `club_id=eq.${resolvedClubId}`,
        },
        () => {
          void loadBadgeCounts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `club_id=eq.${resolvedClubId}`,
        },
        () => {
          void loadBadgeCounts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBadgeCounts, resolvedClubId, user?.id]);

  const badgeCountFor = (key?: "chat" | "tasks" | "announcements") => {
    if (key === "chat") return chatUnread;
    if (key === "tasks") return tasksUnread;
    if (key === "announcements") return announcementsUnread;
    return 0;
  };

  const club = getClubById(resolvedClubId);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clubHeaderHovered, setClubHeaderHovered] = useState(false);
  const [workspaceAccess, setWorkspaceAccess] = useState<"checking" | "allowed" | "denied">(
    "checking",
  );
  const [deniedClubSlug, setDeniedClubSlug] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{
    fullName: string;
    avatarUrl?: string;
    program?: string;
    yearOfStudy?: string;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setUserProfile(null);
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, program, year_of_study")
        .eq("id", user.id)
        .maybeSingle();

      if (!data) {
        setUserProfile(null);
        return;
      }

      setUserProfile({
        fullName: (data.full_name as string | null)?.trim() || "Member",
        avatarUrl: (data.avatar_url as string | null) ?? undefined,
        program: (data.program as string | null)?.trim() || undefined,
        yearOfStudy: (data.year_of_study as string | null)?.trim() || undefined,
      });
    })();
  }, [user?.id]);

  const clubProfilePath = club?.slug ? `/clubs/${club.slug}` : "/explore";
  const profileMeta = [userProfile?.program, userProfile?.yearOfStudy]
    .filter(Boolean)
    .join(" · ");

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading workspace…" />
      </div>
    );
  }

  if (!club) {
    return <Navigate to="/app" replace />;
  }

  if (workspaceAccess === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Checking workspace access…" />
      </div>
    );
  }

  if (workspaceAccess === "denied") {
    const redirectPath = deniedClubSlug ? `/clubs/${deniedClubSlug}` : "/explore";
    return (
      <Navigate
        to={redirectPath}
        replace
        state={{
          workspaceAccessDenied: true,
          flashMessage: "You don't have access to this club workspace",
        }}
      />
    );
  }

  const closeDrawer = () => setDrawerOpen(false);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b p-4" style={{ borderColor: "#1e1e1e" }}>
        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-3"
          onClick={() => {
            closeDrawer();
            navigate(clubProfilePath);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              closeDrawer();
              navigate(clubProfilePath);
            }
          }}
          onMouseEnter={() => setClubHeaderHovered(true)}
          onMouseLeave={() => setClubHeaderHovered(false)}
          style={{
            cursor: "pointer",
            opacity: clubHeaderHovered ? 0.8 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          <img
            src={club.imageUrl}
            alt=""
            className="h-10 w-10 shrink-0 object-cover"
            style={{ borderRadius: "8px", backgroundColor: "#1a1a1a" }}
          />
          <div className="min-w-0 flex-1">
            <h2
              className="truncate"
              style={{
                fontWeight: 600,
                fontSize: "13px",
                color: "#ffffff",
              }}
            >
              {club.name}
            </h2>
            <p
              className="truncate"
              style={{
                fontSize: "11px",
                color: "#555555",
              }}
            >
              {club.category}
            </p>
          </div>
        </div>
      </div>

      <nav
        className="flex flex-1 flex-col space-y-0.5 overflow-y-auto p-3"
        aria-label="Workspace navigation"
      >
        {workspaceLinks
          .filter(({ key }) => workspaceNav.isLinkVisible(key))
          .map(({ to, label, end, Icon, badgeKey }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => workspaceNavClass(isActive)}
            onClick={() => {
              handleBadgeNavClick(badgeKey);
              closeDrawer();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: 0,
              }}
            >
              <Icon size={16} strokeWidth={2} aria-hidden />
              {label}
            </span>
            <NavCountBadge count={badgeCountFor(badgeKey)} />
          </NavLink>
        ))}
        <div className="flex-1" aria-hidden />
        {workspaceNav.showAnalytics ? (
          <NavLink
            to={analyticsLink.to}
            className={({ isActive }) => workspaceNavClass(isActive)}
            onClick={closeDrawer}
          >
            <analyticsLink.Icon size={16} strokeWidth={2} aria-hidden />
            {analyticsLink.label}
          </NavLink>
        ) : null}
        <NavLink
          to={settingsLink.to}
          className={({ isActive }) => workspaceNavClass(isActive)}
          onClick={closeDrawer}
        >
          <settingsLink.Icon size={16} strokeWidth={2} aria-hidden />
          {workspaceNav.settingsLabel}
        </NavLink>
      </nav>

      <div className="border-t px-2 py-2" style={{ borderColor: "#1e1e1e" }}>
        {userProfile ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "8px",
              marginBottom: "6px",
              borderRadius: "8px",
              background: "#141414",
            }}
          >
            {userProfile.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt=""
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#242424",
                  color: "#E51937",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "11px",
                  flexShrink: 0,
                }}
              >
                {userProfile.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ffffff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.3,
                }}
              >
                {userProfile.fullName}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "10px",
                  color: "#888888",
                  lineHeight: 1.35,
                }}
              >
                {sidebarRoleLabel(
                  workspaceNav.role,
                  workspaceNav.accessLevel,
                  workspaceNav.memberTitle,
                )}
              </p>
              {profileMeta ? (
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "10px",
                    color: "#555555",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.35,
                  }}
                >
                  {profileMeta}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <NavLink
          to={`/clubs/${club.slug}`}
          className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 transition-colors hover:bg-[#1a1a1a] hover:text-[#cccccc]"
          style={{
            fontSize: "11px",
            color: "#555555",
          }}
          onClick={closeDrawer}
        >
          <ExternalLink size={13} strokeWidth={2} aria-hidden />
          View Public Profile
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {!isMobile ? (
        <aside
          className="hidden w-44 flex-shrink-0 border-r md:block"
          style={{ backgroundColor: "#111111", borderColor: "#1e1e1e" }}
        >
          {sidebarContent}
        </aside>
      ) : null}

      <div className="flex flex-1 flex-col">
        {isMobile ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid #1e1e1e",
              backgroundColor: "#0f0f0f",
            }}
          >
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setDrawerOpen(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Menu size={22} aria-hidden />
            </button>
          </div>
        ) : null}

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {isMobile && drawerOpen ? (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 99,
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "280px",
              height: "100%",
              background: "#111111",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={closeDrawer}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                zIndex: 1,
              }}
            >
              <X size={20} aria-hidden />
            </button>
            {sidebarContent}
          </aside>
        </>
      ) : null}
    </div>
  );
}
