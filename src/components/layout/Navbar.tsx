import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuthContext } from "../../context/useAuthContext";
import NotificationBell from "../ui/NotificationBell";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore Clubs" },
];

const authNavLinks = [
  { to: "/app", label: "Dashboard" },
  { to: "/explore", label: "Explore" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const initials =
    user?.email?.slice(0, 2).toUpperCase() ??
    "GC";

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
        className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* Logo — gryphon + wordmark matching brand identity */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src="/assets/gryphon-logo.svg"
            alt=""
            className="h-10 w-10"
            aria-hidden="true"
          />
          <span className="text-lg font-extrabold tracking-tight leading-none">
            <span className="tracking-[0.02em] text-white">Club</span>
            <span className="text-secondary/90">Connect</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-6 md:flex">
          {(user ? authNavLinks : navLinks).map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive ? "page" : undefined}
                className={`border-b-2 px-0 py-2 text-sm transition-all ${
                  isActive
                    ? "border-[var(--red)] font-medium text-[var(--text-1)]"
                    : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {user ? (
            <div className="ml-3 flex items-center gap-3">
              <NotificationBell />
              <div className="relative">
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
                      to="/app/profile"
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
        <div className="border-t border-border bg-page-bg md:hidden">
          <div className="space-y-1 px-4 py-3">
            {(user ? authNavLinks : navLinks).map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="my-2 border-t border-border" aria-hidden="true" />

            {user ? (
              <>
                <span className="block px-3 py-2 text-sm text-muted">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-primary-dark"
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
