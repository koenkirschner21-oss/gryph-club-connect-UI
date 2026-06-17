import { useEffect, useMemo, useState } from "react";
import Spinner from "../../components/ui/Spinner";
import { inboxEmptyMessage, type InboxFilter } from "../../lib/inboxUtils";
import type { UseInboxReturn } from "../../hooks/useInbox";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import InboxMessageCard from "../../components/inbox/InboxMessageCard";
import {
  InboxAchievementSidebarCard,
  InboxOverviewCard,
  InboxQuickActionsCard,
  type InboxOverviewStats,
} from "./InboxTabUI";

const FILTER_CHIPS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "action_required", label: "Action Required" },
  { id: "applications", label: "Applications" },
  { id: "invites", label: "Invites" },
  { id: "club_updates", label: "Club Updates" },
  { id: "admin", label: "Admin/Support" },
];

type ClubOption = { id: string; name: string };

type InboxTabProps = UseInboxReturn & {
  clubLogos?: Record<string, string>;
  displayName?: string;
  joinedClubs?: ClubOption[];
  onViewMyClubs?: () => void;
};

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function InboxTab({
  loading,
  messages,
  markAsRead,
  markAllAsRead,
  filterMessages,
  unreadCount,
  actionRequiredMessages,
  refresh,
  clubLogos = {},
  displayName = "there",
  joinedClubs = [],
  onViewMyClubs,
}: InboxTabProps) {
  const isMobile = useIsMobile();
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [monthlyCompleted, setMonthlyCompleted] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);

  const visibleMessages = useMemo(
    () => filterMessages(activeFilter),
    [activeFilter, filterMessages],
  );

  const overviewStats = useMemo<InboxOverviewStats>(
    () => ({
      total: messages.length,
      unread: unreadCount,
      actionRequired: actionRequiredMessages.length,
      applications: filterMessages("applications").length,
      invites: filterMessages("invites").length,
      clubUpdates: filterMessages("club_updates").length,
      admin: filterMessages("admin").length,
    }),
    [actionRequiredMessages.length, filterMessages, messages.length, unreadCount],
  );

  const joinedClubIds = useMemo(() => joinedClubs.map((club) => club.id), [joinedClubs]);

  useEffect(() => {
    if (isMobile || joinedClubIds.length === 0) {
      setMonthlyCompleted(0);
      setMonthlyTotal(0);
      return;
    }

    let cancelled = false;
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartIso = localIsoDate(monthStart);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const monthEndIso = localIsoDate(monthEnd);

    supabase
      .from("tasks")
      .select("status")
      .in("club_id", joinedClubIds)
      .gte("due_date", monthStartIso)
      .lte("due_date", monthEndIso)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load monthly task stats:", error.message);
          setMonthlyCompleted(0);
          setMonthlyTotal(0);
          return;
        }

        const rows = data ?? [];
        setMonthlyTotal(rows.length);
        setMonthlyCompleted(rows.filter((row) => row.status === "done").length);
      });

    return () => {
      cancelled = true;
    };
  }, [isMobile, joinedClubIds]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "#ffffff",
          }}
        >
          Inbox
        </h2>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            style={{
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: "6px",
              color: "#999999",
              cursor: "pointer",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            Mark all as read
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        {FILTER_CHIPS.map((chip) => {
          const selected = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              style={{
                background: selected ? "#E51937" : "#111111",
                border: `1px solid ${selected ? "#E51937" : "#2a2a2a"}`,
                borderRadius: "999px",
                color: selected ? "#ffffff" : "#999999",
                cursor: "pointer",
                fontSize: "12px",
                padding: "6px 12px",
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
              <Spinner />
            </div>
          ) : visibleMessages.length === 0 ? (
            <p
              style={{
                color: "#555555",
                fontSize: "13px",
                margin: 0,
                textAlign: "center",
                padding: "48px 16px",
              }}
            >
              {inboxEmptyMessage()}
            </p>
          ) : (
            <div
              style={{
                border: "1px solid #1a1a1a",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              {visibleMessages.map((message) => (
                <InboxMessageCard
                  key={message.id}
                  message={message}
                  onMarkAsRead={markAsRead}
                  onRefresh={refresh}
                  clubLogoUrl={message.clubId ? clubLogos[message.clubId] : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {!isMobile ? (
          <aside style={{ width: "260px", flexShrink: 0 }}>
            <InboxOverviewCard
              stats={overviewStats}
              onViewAll={() => setActiveFilter("all")}
            />
            <InboxQuickActionsCard
              clubs={joinedClubs}
              onViewMyClubs={() => onViewMyClubs?.()}
            />
            <InboxAchievementSidebarCard
              displayName={displayName}
              completedCount={monthlyCompleted}
              totalCount={monthlyTotal}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
