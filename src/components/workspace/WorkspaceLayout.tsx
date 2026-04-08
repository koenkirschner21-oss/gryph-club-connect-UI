import { NavLink, Outlet, useParams, Navigate } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import Spinner from "../ui/Spinner";

const workspaceLinks = [
  { to: "", label: "Dashboard", end: true },
  { to: "announcements", label: "Announcements", end: false },
  { to: "chat", label: "Chat", end: false },
  { to: "tasks", label: "Tasks", end: false },
  { to: "events", label: "Events", end: false },
  { to: "members", label: "Members", end: false },
];

export default function WorkspaceLayout() {
  const { clubId } = useParams<{ clubId: string }>();
  const { getClubById, loading, getUserRole } = useClubContext();

  const club = getClubById(clubId ?? "");
  const role = getUserRole(clubId ?? "");
  const isAdminOrExec = role === "admin" || role === "exec";

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
      <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-card md:block">
        <div className="flex h-full flex-col">
          {/* Club header */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <img
                src={club.imageUrl}
                alt=""
                className="h-10 w-10 rounded-lg bg-surface-alt object-cover"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold text-white">
                  {club.name}
                </h2>
                <p className="truncate text-xs text-muted">{club.category}</p>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 space-y-1 p-3" aria-label="Workspace navigation">
            {workspaceLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-surface-alt hover:text-white"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {isAdminOrExec && (
              <>
                <NavLink
                  to="analytics"
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:bg-surface-alt hover:text-white"
                    }`
                  }
                >
                  Analytics
                </NavLink>
                <NavLink
                  to="settings"
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:bg-surface-alt hover:text-white"
                    }`
                  }
                >
                  Settings
                </NavLink>
              </>
            )}
          </nav>

          {/* Public profile link */}
          <div className="border-t border-border p-3">
            <NavLink
              to={`/clubs/${club.slug}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-white"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
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
          {isAdminOrExec && (
            <>
              <NavLink
                to="analytics"
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-surface-alt"
                  }`
                }
              >
                Analytics
              </NavLink>
              <NavLink
                to="settings"
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-surface-alt"
                  }`
                }
              >
                Settings
              </NavLink>
            </>
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
