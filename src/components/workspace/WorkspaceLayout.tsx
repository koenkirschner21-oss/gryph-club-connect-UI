import { useEffect, useState, type ReactElement } from "react";
import { NavLink, Outlet, useParams, Navigate } from "react-router-dom";
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
}[] = [
  { to: "", label: "Dashboard", end: true, Icon: LayoutDashboard },
  { to: "announcements", label: "Announcements", end: false, Icon: Megaphone },
  { to: "chat", label: "Chat", end: false, Icon: MessageSquare },
  { to: "tasks", label: "Tasks", end: false, Icon: CheckSquare },
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
    label: "Recruiting",
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

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

function workspaceNavClass(isActive: boolean) {
  const base =
    "flex items-center gap-2 rounded-[6px] border-l-[3px] py-[9px] pr-[14px] text-[13px] font-normal transition-colors";
  if (isActive) {
    return `${base} border-l-[#E51937] bg-[#1f1f1f] pl-[11px] text-white`;
  }
  return `${base} border-l-transparent pl-[14px] text-[#777777] hover:bg-[#1a1a1a] hover:text-[#cccccc]`;
}

export default function WorkspaceLayout() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();
  const { getClubById, loading, activeClubId, switchClub } = useClubContext();
  const resolvedClubId = clubId ?? activeClubId ?? "";
  const [userRole, setUserRole] = useState<MemberRole>("member");
  const showAnalytics =
    userRole === "owner" || userRole === "executive";

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
    fetchRole();
  }, [resolvedClubId, user?.id]);

  const club = getClubById(resolvedClubId);

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
        className="hidden w-52 flex-shrink-0 border-r md:block"
        style={{ backgroundColor: "#111111", borderColor: "#1e1e1e" }}
      >
        <div className="flex h-full flex-col">
          {/* Club header */}
          <div className="border-b p-4" style={{ borderColor: "#1e1e1e" }}>
            <div className="flex items-center gap-3">
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
          <nav className="flex-1 space-y-0.5 p-3" aria-label="Workspace navigation">
            {workspaceLinks.map(({ to, label, end, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => workspaceNavClass(isActive)}
              >
                <Icon size={16} strokeWidth={2} aria-hidden />
                {label}
              </NavLink>
            ))}
            {showAnalytics && (
              <NavLink
                to={analyticsLink.to}
                className={({ isActive }) => workspaceNavClass(isActive)}
              >
                <analyticsLink.Icon size={16} strokeWidth={2} aria-hidden />
                {analyticsLink.label}
              </NavLink>
            )}
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
