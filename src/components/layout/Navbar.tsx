import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuthContext } from "../../context/useAuthContext";

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

  async function handleLogout() {
    try {
      await signOut();
      navigate("/login");
    } catch {
      /* signOut errors are non-critical */
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-nav-bg shadow-lg">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm transition-opacity group-hover:opacity-90">
            <img
              src="/assets/placeholders/logo-gryph-placeholder.svg"
              alt=""
              className="h-6 w-6 brightness-0 invert"
              aria-hidden="true"
            />
          </div>
          <span className="text-base font-extrabold tracking-tight text-text-primary">
            Gryph<span className="text-primary">Club</span>Connect
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 md:flex">
          {(user ? authNavLinks : navLinks).map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary-light"
                    : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="ml-2 h-5 w-px bg-border" aria-hidden="true" />

          {user ? (
            <div className="ml-2 flex items-center gap-3">
              <span className="text-sm text-text-secondary" aria-label="Logged in as">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Link
                to="/login"
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  location.pathname === "/login"
                    ? "text-primary-light"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-text-secondary hover:bg-surface-alt hover:text-text-primary md:hidden"
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
        <div className="border-t border-border bg-nav-bg md:hidden">
          <div className="space-y-1 px-4 py-3">
            {(user ? authNavLinks : navLinks).map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary-light"
                      : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="my-2 border-t border-border" aria-hidden="true" />

            {user ? (
              <>
                <span className="block px-3 py-2 text-sm text-text-secondary">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-alt hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
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
