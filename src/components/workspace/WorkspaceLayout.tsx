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
import { Briefcase, FileText } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole } from "../../types";
import Spinner from "../ui/Spinner";

const workspaceLinks: {
  to: string;
  label: string;
  end: boolean;
  Icon: (props: IconProps) => ReactElement;
  badgeKey?: "chat" | "tasks" | "announcements";
}[] = [
  { to: "", label: "Dashboard", end: true, Icon: LayoutDashboard },
  {
    to: "announcements",
    label: "Announcements",
    end: false,
    Icon: Megaphone,
    badgeKey: "announcements",
  },
  { to: "chat", label: "Chat", end: false, Icon: MessageSquare, badgeKey: "chat" },
  { to: "tasks", label: "Tasks", end: false, Icon: CheckSquare, badgeKey: "tasks" },
  {
    to: "documents",
    label: "Documents",
    end: false,
    Icon: ({ size = 16, strokeWidth = 2, "aria-hidden": ariaHidden = true }) => (
      <FileText size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
    ),
  },
  { to: "events", label: "Events", end: false, Icon: Calendar },
  {
    to: "recruiting",
    label: "Hiring",
    end: false,
    Icon: ({ size = 16, strokeWidth = 2, "aria-hidden": ariaHidden = true }) => (
      <Briefcase size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
    ),
  },
  { to: "members", label: "Members", end: false, Icon: Users },
  { to: "settings", label: "Settings", end: false, Icon: Settings },
];

const analyticsLink = {
  to: "analytics",
  label: "Analytics",
  Icon: BarChart2,
} as const;

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

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
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
  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [chatUnread, setChatUnread] = useState(0);
  const [tasksUnread, setTasksUnread] = useState(0);
  const [announcementsUnread, setAnnouncementsUnread] = useState(0);
  const showAnalytics =
    userRole === "owner" || userRole === "executive";

  const workspaceBasePath = resolvedClubId
    ? `/app/workspace/${resolvedClubId}`
    : "";

  const loadBadgeCounts = useCallback(async () => {
    if (!user?.id || !resolvedClubId) {
      setChatUnread(0);
      setTasksUnread(0);
      setAnnouncementsUnread(0);
      return;
    }

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
    const fetchRole = async () => {
      if (!user?.id || !resolvedClubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", resolvedClubId)
        .eq("user_id", user.id)
        .single();
      if (data?.role) {
        setUserRole(normalizeUserRole(data.role));
      }
    };
    void fetchRole();
  }, [resolvedClubId, user?.id]);

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
  const [clubHeaderHovered, setClubHeaderHovered] = useState(false);

  const clubProfilePath = club
    ? club.slug
      ? `/clubs/${club.slug}`
      : `/app/clubs/${resolvedClubId}`
    : "/app";

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

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside
        className="hidden w-44 flex-shrink-0 border-r md:block"
        style={{ backgroundColor: "#111111", borderColor: "#1e1e1e" }}
      >
        <div className="flex h-full flex-col">
          {/* Club header */}
          <div className="border-b p-4" style={{ borderColor: "#1e1e1e" }}>
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-3"
              onClick={() => navigate(clubProfilePath)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
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

          {/* Nav links */}
          <nav
            className="flex flex-1 flex-col space-y-0.5 p-3"
            aria-label="Workspace navigation"
          >
            {workspaceLinks.map(({ to, label, end, Icon, badgeKey }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => workspaceNavClass(isActive)}
                onClick={() => handleBadgeNavClick(badgeKey)}
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
            {showAnalytics ? (
              <NavLink
                to={analyticsLink.to}
                className={({ isActive }) => workspaceNavClass(isActive)}
              >
                <analyticsLink.Icon size={16} strokeWidth={2} aria-hidden />
                {analyticsLink.label}
              </NavLink>
            ) : null}
          </nav>

          {/* Public profile link */}
          <div className="border-t p-3" style={{ borderColor: "#1e1e1e" }}>
            <NavLink
              to={`/clubs/${club.slug}`}
              className="flex items-center gap-1.5 rounded-[6px] px-[14px] py-2 transition-colors hover:bg-[#1a1a1a] hover:text-[#cccccc]"
              style={{
                fontSize: "12px",
                color: "#555555",
              }}
            >
              <ExternalLink size={14} strokeWidth={2} aria-hidden />
              View Public Profile
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Mobile workspace tabs */}
      <div className="flex flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 md:hidden">
          {workspaceLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-surface-alt"
                }`
              }
            >
              {link.label}
              {link.badgeKey && badgeCountFor(link.badgeKey) > 0
                ? ` (${badgeCountFor(link.badgeKey)})`
                : ""}
            </NavLink>
          ))}
          {showAnalytics && (
            <NavLink
              to={analyticsLink.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-surface-alt"
                }`
              }
            >
              {analyticsLink.label}
            </NavLink>
          )}
        </nav>

        {/* Workspace content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
