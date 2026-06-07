import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import NotificationsDropdown from "../ui/NotificationsDropdown";

const wordmarkFont: CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  fontSize: "22px",
  letterSpacing: "-0.02em",
  lineHeight: 1,
};

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/events", label: "Events" },
  { to: "/hiring", label: "Hiring" },
];

function isPublicNavLinkActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function publicNavLinkStyle(isActive: boolean): CSSProperties {
  return {
    color: isActive ? "#ffffff" : "#777777",
    fontWeight: isActive ? 600 : 400,
  };
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const initials =
    user?.email?.slice(0, 2).toUpperCase() ??
    "GC";

  useEffect(() => {
    if (!user?.id) {
      setIsPlatformAdmin(false);
      return;
    }

    let cancelled = false;

    supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to check platform admin:", error.message);
          setIsPlatformAdmin(false);
          return;
        }
        setIsPlatformAdmin(Boolean(data));
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  async function handleLogout() {
    try {
      await signOut();
      navigate("/login");
    } catch {
      /* signOut errors are non-critical */
    }
  }

  return (
    <header className="sticky top-0 z-[100] border-b border-[var(--border)] bg-[rgba(10,10,10,0.85)] backdrop-blur-[12px]">
      <nav
        className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-[4.5rem] lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          to="/"
          aria-label="Gryph Club Connect home"
          className="group flex shrink-0 items-center rounded-md px-2 py-1 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(10,10,10,0.85)]"
        >
          <span className="inline-flex items-center" style={{ gap: "6px" }}>
            <img
              src="/assets/gryph-icon.png"
              alt=""
              aria-hidden
              className="shrink-0 object-contain"
              style={{ height: "36px", width: "auto" }}
            />
            <span>
              <span style={{ ...wordmarkFont, color: "#E51937" }}>Club</span>
              <span style={{ ...wordmarkFont, color: "#FFC429" }}>Connect</span>
            </span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-6 md:flex">
          {user ? (
            <>
              <Link
                to="/app"
                aria-current={location.pathname === "/app" ? "page" : undefined}
                className={`border-b-2 px-0 py-2 text-sm font-medium text-white transition-all ${
                  location.pathname === "/app"
                    ? "border-[#E51937]"
                    : "border-transparent hover:border-[#E51937]"
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/explore"
                aria-current={
                  isPublicNavLinkActive(location.pathname, "/explore")
                    ? "page"
                    : undefined
                }
                className="px-0 py-2 text-sm transition-colors"
                style={publicNavLinkStyle(
                  isPublicNavLinkActive(location.pathname, "/explore"),
                )}
              >
                Explore
              </Link>
              <Link
                to="/events"
                aria-current={
                  isPublicNavLinkActive(location.pathname, "/events")
                    ? "page"
                    : undefined
                }
                className="px-0 py-2 text-sm transition-colors"
                style={publicNavLinkStyle(
                  isPublicNavLinkActive(location.pathname, "/events"),
                )}
              >
                Events
              </Link>
              <Link
                to="/hiring"
                aria-current={
                  isPublicNavLinkActive(location.pathname, "/hiring")
                    ? "page"
                    : undefined
                }
                className="px-0 py-2 text-sm transition-colors"
                style={publicNavLinkStyle(
                  isPublicNavLinkActive(location.pathname, "/hiring"),
                )}
              >
                Hiring
              </Link>
            </>
          ) : (
            navLinks.map((link) => {
              const isActive = isPublicNavLinkActive(location.pathname, link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={isActive ? "page" : undefined}
                  className="px-0 py-2 text-sm transition-colors"
                  style={publicNavLinkStyle(isActive)}
                >
                  {link.label}
                </Link>
              );
            })
          )}

          {user ? (
            <div className="ml-3 flex items-center gap-3">
              {isPlatformAdmin ? (
                <Link
                  to="/admin"
                  aria-current={
                    location.pathname === "/admin" ? "page" : undefined
                  }
                  className="border-b-2 border-transparent px-0 py-2 text-[13px] font-semibold text-[#FFC429] transition-all hover:border-[#FFC429]"
                  style={
                    location.pathname === "/admin"
                      ? { borderBottomColor: "#FFC429" }
                      : undefined
                  }
                >
                  Admin
                </Link>
              ) : null}
              <NotificationsDropdown />
              <div ref={profileDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-xs font-medium text-[var(--text-1)] transition hover:bg-[var(--bg-3)]"
                >
                  {initials}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-10 z-[120] w-44 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-2)] p-1 shadow-[var(--shadow-md)]">
                    <Link
                      to="/app/profile"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded-[var(--r-sm)] px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text-1)]"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/app/settings"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded-[var(--r-sm)] px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text-1)]"
                    >
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      className="block w-full cursor-pointer rounded-[var(--r-sm)] px-3 py-2 text-left text-sm text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text-1)]"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="ml-3 flex items-center gap-2">
              <Link
                to="/login"
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  location.pathname === "/login"
                    ? "text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="w-full border-t border-border bg-page-bg md:hidden">
          <div className="w-full space-y-1 py-3">
            {user ? (
              <>
                <Link
                  to="/app"
                  onClick={() => setMobileOpen(false)}
                  aria-current={location.pathname === "/app" ? "page" : undefined}
                  className={`block min-h-[44px] rounded-lg px-4 py-[14px] text-sm font-medium transition-colors ${
                    location.pathname === "/app"
                      ? "bg-white/10 text-white"
                      : "text-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/explore"
                  onClick={() => setMobileOpen(false)}
                  aria-current={
                    isPublicNavLinkActive(location.pathname, "/explore")
                      ? "page"
                      : undefined
                  }
                  className="block min-h-[44px] rounded-lg px-4 py-[14px] text-sm transition-colors"
                  style={publicNavLinkStyle(
                    isPublicNavLinkActive(location.pathname, "/explore"),
                  )}
                >
                  Explore
                </Link>
                <Link
                  to="/events"
                  onClick={() => setMobileOpen(false)}
                  aria-current={
                    isPublicNavLinkActive(location.pathname, "/events")
                      ? "page"
                      : undefined
                  }
                  className="block min-h-[44px] rounded-lg px-4 py-[14px] text-sm transition-colors"
                  style={publicNavLinkStyle(
                    isPublicNavLinkActive(location.pathname, "/events"),
                  )}
                >
                  Events
                </Link>
                <Link
                  to="/hiring"
                  onClick={() => setMobileOpen(false)}
                  aria-current={
                    isPublicNavLinkActive(location.pathname, "/hiring")
                      ? "page"
                      : undefined
                  }
                  className="block min-h-[44px] rounded-lg px-4 py-[14px] text-sm transition-colors"
                  style={publicNavLinkStyle(
                    isPublicNavLinkActive(location.pathname, "/hiring"),
                  )}
                >
                  Hiring
                </Link>
                <Link
                  to="/app/profile"
                  onClick={() => setMobileOpen(false)}
                  aria-current={
                    location.pathname === "/app/profile" ? "page" : undefined
                  }
                  className={`block min-h-[44px] rounded-lg px-4 py-[14px] text-sm font-medium transition-colors ${
                    location.pathname === "/app/profile"
                      ? "bg-white/10 text-white"
                      : "text-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Profile
                </Link>
                <Link
                  to="/app/settings"
                  onClick={() => setMobileOpen(false)}
                  aria-current={
                    location.pathname === "/app/settings" ? "page" : undefined
                  }
                  className={`block min-h-[44px] rounded-lg px-4 py-[14px] text-sm font-medium transition-colors ${
                    location.pathname === "/app/settings"
                      ? "bg-white/10 text-white"
                      : "text-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Settings
                </Link>
                {isPlatformAdmin ? (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    aria-current={
                      location.pathname === "/admin" ? "page" : undefined
                    }
                    className={`block min-h-[44px] rounded-lg px-4 py-[14px] text-sm font-semibold transition-colors ${
                      location.pathname === "/admin"
                        ? "bg-[#FFC429]/15 text-[#FFC429]"
                        : "text-[#FFC429] hover:bg-white/5"
                    }`}
                  >
                    Admin
                  </Link>
                ) : null}
              </>
            ) : (
              navLinks.map((link) => {
                const isActive = isPublicNavLinkActive(location.pathname, link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className="block min-h-[44px] rounded-lg px-4 py-[14px] text-sm transition-colors"
                    style={publicNavLinkStyle(isActive)}
                  >
                    {link.label}
                  </Link>
                );
              })
            )}

            <div className="my-2 border-t border-border" aria-hidden="true" />

            {user ? (
              <>
                <span className="block px-4 py-[14px] text-sm text-muted">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="block min-h-[44px] w-full cursor-pointer rounded-lg px-4 py-[14px] text-left text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block min-h-[44px] rounded-lg px-4 py-[14px] text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block min-h-[44px] w-full rounded-lg bg-primary px-4 py-[14px] text-center text-sm font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
