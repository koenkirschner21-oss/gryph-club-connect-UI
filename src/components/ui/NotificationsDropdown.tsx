import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { useAuthContext } from "../../context/useAuthContext";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { parseNotificationDisplay } from "../../lib/parseNotificationDisplay";
import type { Notification, NotificationType } from "../../types";

const openListeners = new Set<() => void>();
const unreadRefreshListeners = new Set<() => void>();

export function requestOpenNotificationsDropdown(): void {
  openListeners.forEach((listener) => listener());
}

export function registerOpenNotificationsDropdown(listener: () => void): () => void {
  openListeners.add(listener);
  return () => openListeners.delete(listener);
}

export function registerUnreadCountRefresh(listener: () => void): () => void {
  unreadRefreshListeners.add(listener);
  return () => unreadRefreshListeners.delete(listener);
}

export function notifyUnreadCountRefresh(): void {
  unreadRefreshListeners.forEach((listener) => listener());
}

function mapRow(row: Record<string, unknown>): Notification {
  const clubRaw = row.clubs as { name?: string } | { name?: string }[] | null | undefined;
  const clubRecord = Array.isArray(clubRaw) ? clubRaw[0] : clubRaw;

  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: (row.type as Notification["type"]) ?? "club_update",
    message: (row.message as string) ?? "",
    read: (row.read as boolean) ?? false,
    clubId: (row.club_id as string) ?? undefined,
    referenceId: (row.reference_id as string) ?? undefined,
    link: (row.link as string) ?? undefined,
    clubName: (clubRecord?.name as string) ?? undefined,
    createdAt: (row.created_at as string) ?? "",
  };
}

function resolveNotificationLink(notification: Notification): string | null {
  if (notification.link?.trim()) {
    return notification.link.trim();
  }
  if (!notification.clubId) return null;

  const base = `/app/clubs/${notification.clubId}`;
  switch (notification.type as string) {
    case "new_event":
    case "event":
      return `${base}/events`;
    case "announcement":
      return `${base}/announcements`;
    case "task_assigned":
    case "task":
      return `${base}/tasks`;
    case "new_join_request":
      return `${base}/members`;
    case "direct_message":
      return `${base}/chat`;
    default:
      return base;
  }
}

function notificationIconColor(type: string): string {
  switch (type) {
    case "announcement":
      return "#E51937";
    case "new_event":
    case "event":
      return "#FFC429";
    case "task_assigned":
    case "task":
      return "#747676";
    case "member_joined":
    case "join_approved":
      return "#FFC429";
    case "new_join_request":
      return "#E51937";
    case "join_rejected":
      return "#777777";
    case "join_request_submitted":
      return "#777777";
    case "new_claim_request":
      return "#E51937";
    case "claim_approved":
      return "#22c55e";
    case "claim_rejected":
      return "#777777";
    case "claim_more_info":
      return "#FFC429";
    default:
      return "#747676";
  }
}

function NotificationTypeIcon({ type }: { type: NotificationType | string }) {
  if (type === "direct_message") {
    return (
      <MessageSquare
        size={16}
        color="#6b7cff"
        strokeWidth={2}
        aria-hidden
        style={{ flexShrink: 0, marginTop: 2 }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: notificationIconColor(type),
        flexShrink: 0,
        marginTop: 4,
      }}
    />
  );
}

export default function NotificationsDropdown() {
  const { user } = useAuthContext();
  const userId = user?.id;
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const syncUnreadCount = useCallback((items: Notification[]) => {
    setUnreadCount(items.filter((n) => !n.read).length);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*, clubs(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Failed to load notifications:", error.message);
      return;
    }

    const mapped = (data ?? []).map(mapRow);
    setNotifications(mapped);
    syncUnreadCount(mapped);
  }, [syncUnreadCount, userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Failed to mark notifications as read:", error.message);
      await fetchNotifications();
    } else {
      notifyUnreadCountRefresh();
    }
  }, [fetchNotifications, userId]);

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n,
        );
        syncUnreadCount(next);
        return next;
      });

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) {
        console.error("Failed to mark notification as read:", error.message);
        await fetchNotifications();
      } else {
        notifyUnreadCountRefresh();
      }
    },
    [fetchNotifications, syncUnreadCount],
  );

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      if (!notification.read) {
        await markNotificationRead(notification.id);
      }

      const destination = resolveNotificationLink(notification);
      setOpen(false);
      if (destination) {
        navigate(destination);
      }
    },
    [markNotificationRead, navigate],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    markAllAsRead();
  }, [open, markAllAsRead]);

  useEffect(() => {
    return registerOpenNotificationsDropdown(() => setOpen(true));
  }, []);

  useEffect(() => {
    if (!userId) return;

    const upsertNotification = (next: Notification) => {
      setNotifications((prev) => {
        const existingIndex = prev.findIndex((n) => n.id === next.id);
        let merged: Notification[];

        if (existingIndex === -1) {
          merged = [next, ...prev];
        } else {
          merged = prev.map((n, i) =>
            i === existingIndex ? { ...n, ...next } : n,
          );
        }

        const sorted = merged
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 20);

        syncUnreadCount(sorted);
        return sorted;
      });
    };

    const removeNotification = (id: string) => {
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id);
        syncUnreadCount(next);
        return next;
      });
    };

    const onNotificationChange = (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) => {
      if (payload.eventType === "INSERT") {
        if (payload.new && Object.keys(payload.new).length > 0) {
          upsertNotification(mapRow(payload.new));
          notifyUnreadCountRefresh();
        }
        return;
      }

      if (payload.eventType === "UPDATE") {
        if (payload.new && Object.keys(payload.new).length > 0) {
          upsertNotification(mapRow(payload.new));
          notifyUnreadCountRefresh();
        }
        return;
      }

      if (payload.eventType === "DELETE") {
        const deletedId = payload.old?.id;
        if (typeof deletedId === "string" && deletedId.length > 0) {
          removeNotification(deletedId);
          notifyUnreadCountRefresh();
        }
      }
    };

    const channel = supabase
      .channel(`notifications-dropdown:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onNotificationChange,
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [syncUnreadCount, userId]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={notifRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2 text-[var(--text-2)] transition-colors hover:bg-[var(--bg-3)] hover:text-[var(--text-1)]"
        aria-label={`Alerts${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
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

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "#E51937",
              color: "#ffffff",
              fontSize: "10px",
              borderRadius: "50%",
              width: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 8,
            width: 320,
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 120,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #222",
              background: "linear-gradient(180deg, #1e1a12 0%, #1a1a1a 100%)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: "#FFC429",
              }}
            >
              Alerts
            </div>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 11,
                color: "#555555",
                lineHeight: 1.4,
              }}
            >
              Quick club activity — full messages live in Dashboard Inbox
            </p>
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <p
                style={{
                  color: "#555555",
                  textAlign: "center",
                  padding: 24,
                  margin: 0,
                  fontSize: 13,
                }}
              >
                No notifications yet
              </p>
            ) : (
              notifications.map((notification) => {
                const { title, body } = parseNotificationDisplay(
                  notification.type,
                  notification.message,
                );
                return (
                  <button
                    key={notification.id}
                    type="button"
                    role="menuitem"
                    onClick={() => void handleNotificationClick(notification)}
                    style={{
                      display: "flex",
                      width: "100%",
                      gap: 10,
                      padding: "12px 16px",
                      borderBottom: "1px solid #1e1e1e",
                      cursor: "pointer",
                      textAlign: "left",
                      background: notification.read ? "transparent" : "#1a1a1a",
                      border: "none",
                      borderLeft: notification.read
                        ? "none"
                        : "3px solid #E51937",
                      borderBottomWidth: 1,
                      borderBottomStyle: "solid",
                      borderBottomColor: "#1e1e1e",
                    }}
                  >
                    <NotificationTypeIcon type={notification.type} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#ffffff",
                            margin: 0,
                            lineHeight: 1.4,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {title}
                        </p>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#444444",
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                      {body ? (
                        <p
                          style={{
                            fontSize: 12,
                            color: "#777777",
                            margin: "4px 0 0",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {body}
                        </p>
                      ) : null}
                      {notification.clubName ? (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#555555",
                            margin: "4px 0 0",
                          }}
                        >
                          {notification.clubName}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid #222",
              padding: "10px 16px",
              background: "#141414",
            }}
          >
            <Link
              to="/app"
              onClick={() => {
                sessionStorage.setItem("dashboardTab", "inbox");
                setOpen(false);
              }}
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "#E51937",
                textDecoration: "none",
              }}
            >
              Open Dashboard Inbox →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
