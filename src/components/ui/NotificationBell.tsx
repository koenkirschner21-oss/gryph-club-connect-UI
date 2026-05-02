import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../context/NotificationsProvider";
import type { NotificationType } from "../../types";

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  task_assigned: "📋",
  new_event: "📅",
  announcement: "📢",
  join_approved: "✅",
  club_update: "🔔",
};

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  function handleBlur(e: React.FocusEvent) {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.relatedTarget as Node)
    ) {
      setOpen(false);
    }
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2 text-[var(--text-2)] transition-colors hover:bg-[var(--bg-3)] hover:text-[var(--text-1)]"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {/* Bell icon */}
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--red)]" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="fixed inset-x-2 top-16 z-50 mx-auto max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="cursor-pointer text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                  }}
                  className={`flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  {/* Dot indicator */}
                  <span
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      n.read ? "bg-transparent" : "bg-primary"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      <span className="mr-1.5">{NOTIFICATION_ICONS[n.type] ?? "🔔"}</span>
                      {n.message}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(n.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
