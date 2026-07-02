import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  switch (notification.type) {
    case "new_club_request":
      return notification.referenceId
        ? `/app/admin?tab=requests&request=${notification.referenceId}`
        : "/app/admin?tab=requests";
    case "new_claim_request":
      return notification.referenceId
        ? `/app/admin?tab=claims&claim=${notification.referenceId}`
        : "/app/admin?tab=claims";
    case "club_request_submitted":
    case "claim_submitted":
      return "/app";
    case "club_request_rejected":
    case "claim_rejected":
      return "/explore";
    case "club_request_approved":
    case "claim_approved":
      return notification.clubId ? `/app/clubs/${notification.clubId}` : "/app";
    case "club_request_more_info":
    case "claim_more_info":
      return "/app";
    default:
      break;
  }

  if (!notification.clubId) return null;

  const base = `/app/clubs/${notification.clubId}`;
  const ref = notification.referenceId;

  switch (notification.type as string) {
    case "new_event":
    case "event":
    case "event_cancelled":
      return `${base}/events`;
    case "meeting_invite":
    case "meeting_updated":
    case "meeting_cancelled":
      return `${base}/meetings`;
    case "new_document":
      return `${base}/documents`;
    case "new_hiring_role":
      return `${base}/recruiting`;
    case "announcement":
      return `${base}/announcements`;
    case "task_assigned":
    case "task":
      return `${base}/tasks`;
    case "new_join_request":
    case "join_approved":
    case "join_rejected":
    case "join_request_submitted":
    case "member_joined":
    case "role_updated":
    case "member_removed":
      return `${base}/members`;
    case "direct_message":
    case "mention":
      return ref ? `${base}/chat?conversation=${ref}` : `${base}/chat`;
    default:
      return base;
  }
}

type NotificationGroupId =
  | "messages"
  | "membership"
  | "events"
  | "work"
  | "announcements"
  | "claims"
  | "other";

const GROUP_ORDER: NotificationGroupId[] = [
  "messages",
  "membership",
  "events",
  "work",
  "announcements",
  "claims",
  "other",
];

const GROUP_LABELS: Record<NotificationGroupId, string> = {
  messages: "Messages",
  membership: "Membership",
  events: "Events",
  work: "Tasks",
  announcements: "Announcements",
  claims: "Claims & requests",
  other: "Updates",
};

function notificationGroupId(type: string): NotificationGroupId {
  switch (type) {
    case "direct_message":
    case "mention":
      return "messages";
    case "new_join_request":
    case "join_approved":
    case "join_rejected":
    case "join_request_submitted":
    case "member_joined":
      return "membership";
    case "new_event":
    case "event":
    case "event_cancelled":
      return "events";
    case "meeting_invite":
    case "meeting_updated":
    case "meeting_cancelled":
      return "events";
    case "task_assigned":
    case "task":
      return "work";
    case "announcement":
      return "announcements";
    case "new_claim_request":
    case "claim_submitted":
    case "claim_approved":
    case "claim_rejected":
    case "claim_more_info":
    case "new_club_request":
    case "club_request_submitted":
    case "club_request_approved":
    case "club_request_rejected":
    case "club_request_more_info":
      return "claims";
    default:
      return "other";
  }
}

function groupNotifications(items: Notification[]) {
  const buckets = new Map<NotificationGroupId, Notification[]>();
  for (const item of items) {
    const key = notificationGroupId(item.type);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return GROUP_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map(
    (id) => ({
      id,
      label: GROUP_LABELS[id],
      items: buckets.get(id)!,
    }),
  );
}

function openDashboardInbox() {
  sessionStorage.setItem("dashboardTab", "inbox");
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
    case "claim_submitted":
      return "#777777";
    case "claim_approved":
      return "#22c55e";
    case "claim_rejected":
      return "#777777";
    case "claim_more_info":
      return "#FFC429";
    case "new_club_request":
      return "#E51937";
    case "club_request_submitted":
      return "#777777";
    case "club_request_approved":
      return "#22c55e";
    case "club_request_rejected":
      return "#777777";
    case "club_request_more_info":
      return "#FFC429";
    default:
      return "#747676";
  }
}

function NotificationTypeIcon({ type }: { type: NotificationType | string }) {
  if (type === "direct_message" || type === "mention") {
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

  const groupedNotifications = useMemo(
    () => groupNotifications(notifications),
    [notifications],
  );

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
    void fetchNotifications();

    if (!userId) return;

    const pollId = window.setInterval(() => {
      void fetchNotifications();
    }, 30_000);

    return () => {
      window.clearInterval(pollId);
    };
  }, [fetchNotifications, userId]);

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

    const onInsert = (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) => {
      if (payload.new && Object.keys(payload.new).length > 0) {
        upsertNotification(mapRow(payload.new));
        notifyUnreadCountRefresh();
      }
      void fetchNotifications();
    };

    const onNotificationChange = (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) => {
      if (payload.eventType === "INSERT") {
        onInsert(payload);
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
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onNotificationChange,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onNotificationChange,
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onNotificationChange,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Notifications dropdown realtime channel error for user:", userId);
          void fetchNotifications();
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [fetchNotifications, syncUnreadCount, userId]);

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
            width: 360,
            background: "#1a1a1a",
            border: "1px solid #242424",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            zIndex: 120,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid #2a2a2a",
              background: "linear-gradient(180deg, #1e1a12 0%, #1a1a1a 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#FFC429",
                  }}
                >
                  Alerts
                </div>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 12,
                    color: "#666666",
                    lineHeight: 1.45,
                  }}
                >
                  Quick activity updates — open Inbox for full messages
                </p>
              </div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  style={{
                    background: "transparent",
                    border: "1px solid #333333",
                    borderRadius: "6px",
                    color: "#aaaaaa",
                    fontSize: "11px",
                    fontWeight: 500,
                    padding: "5px 8px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>

          <div
            className="notification-dropdown-scroll"
            style={{
              maxHeight: 420,
              overflowY: "auto",
              padding: "8px 0",
            }}
          >
            {notifications.length === 0 ? (
              <p
                style={{
                  color: "#555555",
                  textAlign: "center",
                  padding: "32px 20px",
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                No notifications yet
              </p>
            ) : (
              groupedNotifications.map((group) => (
                <div key={group.id} style={{ marginBottom: "4px" }}>
                  <p
                    style={{
                      margin: "8px 18px 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#555555",
                    }}
                  >
                    {group.label}
                  </p>
                  {group.items.map((notification) => {
                    const { title, body } = parseNotificationDisplay(
                      notification.type,
                      notification.message,
                    );
                    const isUnread = !notification.read;
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        role="menuitem"
                        onClick={() => void handleNotificationClick(notification)}
                        style={{
                          display: "flex",
                          width: "100%",
                          gap: 12,
                          padding: "12px 18px",
                          cursor: "pointer",
                          textAlign: "left",
                          background: isUnread ? "#1f1f1f" : "transparent",
                          border: "none",
                          borderLeft: isUnread
                            ? "3px solid #E51937"
                            : "3px solid transparent",
                        }}
                      >
                        <NotificationTypeIcon type={notification.type} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: "10px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: isUnread ? 700 : 500,
                                color: isUnread ? "#ffffff" : "#999999",
                                margin: 0,
                                lineHeight: 1.45,
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {title}
                            </p>
                            <span
                              style={{
                                fontSize: 11,
                                color: "#555555",
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
                                color: isUnread ? "#888888" : "#666666",
                                margin: "6px 0 0",
                                lineHeight: 1.45,
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
                                margin: "6px 0 0",
                              }}
                            >
                              {notification.clubName}
                            </p>
                          ) : null}
                        </div>
                        {isUnread ? (
                          <span
                            aria-hidden
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#E51937",
                              flexShrink: 0,
                              marginTop: 6,
                            }}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid #2a2a2a",
              padding: "12px 18px",
              background: "#141414",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <Link
              to="/app"
              onClick={() => {
                openDashboardInbox();
                setOpen(false);
              }}
              style={{
                display: "block",
                textAlign: "center",
                fontSize: "13px",
                fontWeight: 600,
                color: "#ffffff",
                textDecoration: "none",
                background: "#E51937",
                borderRadius: "8px",
                padding: "10px 14px",
              }}
            >
              Open Inbox
            </Link>
            <Link
              to="/app"
              onClick={() => {
                openDashboardInbox();
                setOpen(false);
              }}
              style={{
                display: "block",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: 500,
                color: "#777777",
                textDecoration: "none",
              }}
            >
              View all in Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
