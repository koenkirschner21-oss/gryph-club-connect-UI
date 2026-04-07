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
    <header className="sticky top-0 z-50 border-b border-border bg-page-bg/95 backdrop-blur supports-[backdrop-filter]:bg-page-bg/80">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm transition-all group-hover:shadow-[0_0_12px_rgba(194,4,48,0.5)]">
            <img
              src="/assets/placeholders/logo-gryph-placeholder.svg"
              alt=""
              className="h-6 w-6 brightness-0 invert"
              aria-hidden="true"
            />
          </div>
          <span className="text-base font-extrabold tracking-tight text-white">
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
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="ml-3 h-5 w-px bg-border" aria-hidden="true" />

          {user ? (
            <div className="ml-3 flex items-center gap-3">
              <span className="text-sm text-muted" aria-label="Logged in as">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-muted transition-all duration-200 hover:border-primary/50 hover:text-white hover:shadow-[0_0_10px_rgba(194,4,48,0.2)]"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="ml-3 flex items-center gap-2">
              <Link
                to="/login"
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                  location.pathname === "/login"
                    ? "text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="btn-gradient-red rounded-lg px-5 py-2 text-sm font-bold text-white transition-all duration-200"
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
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
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
                  className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg btn-gradient-red px-3 py-2.5 text-center text-sm font-bold text-white"
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
