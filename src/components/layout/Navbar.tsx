import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuthContext } from "../../context/useAuthContext";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore Clubs" },
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
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/assets/placeholders/logo-gryph-placeholder.svg"
            alt="Gryph Club Connect"
            className="h-8 w-8"
          />
          <span className="text-lg font-bold text-accent">
            Gryph Club Connect
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.pathname === link.to
                  ? "text-primary"
                  : "text-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">{user.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-muted transition-colors hover:text-primary"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === "/login"
                    ? "text-primary"
                    : "text-muted"
                }`}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted hover:text-accent md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
        <div className="border-t border-border md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-alt ${
                  location.pathname === link.to
                    ? "text-primary"
                    : "text-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}

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
                  className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-alt"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-alt"
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
