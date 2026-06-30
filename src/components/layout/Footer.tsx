import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-2)]">
      <div className="mx-auto max-w-7xl px-4 py-6 text-left text-sm sm:px-6 lg:px-8">
        <p className="m-0">© 2026 Gryph Club Connect · University of Guelph</p>
        <div className="mt-3 flex items-center gap-3">
          <Link to="/privacy" className="hover:text-[var(--text-1)]">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="hover:text-[var(--text-1)]">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
