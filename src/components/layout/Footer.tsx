import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-2)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-6 text-sm sm:justify-between">
        <span>© 2026 Gryph Club Connect · University of Guelph</span>
        <div className="flex items-center gap-3">
          <Link to="/" className="hover:text-[var(--text-1)]">Privacy</Link>
          <span>·</span>
          <Link to="/" className="hover:text-[var(--text-1)]">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
