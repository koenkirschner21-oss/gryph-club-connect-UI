import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Briefcase,
  Building,
  Calendar,
  CheckSquare,
  ChevronRight,
  Inbox,
  Mail,
  Megaphone,
  Shield,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { OUTLINED_BUTTON_STYLE } from "../../components/inbox/inboxMessageUi";
import { WeekAchievementCard } from "./ThisWeekTabUI";

const GOLD = "#FFC429";
const RED = "#E51937";

const SIDEBAR_CARD_STYLE = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "16px",
  marginBottom: "16px",
} as const;

export type InboxOverviewStats = {
  total: number;
  unread: number;
  actionRequired: number;
  applications: number;
  invites: number;
  clubUpdates: number;
  admin: number;
};

function OverviewRow({
  icon: Icon,
  label,
  count,
  countColor = "#cccccc",
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  countColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "10px",
      }}
    >
      <Icon size={14} color="#555555" aria-hidden style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: "12px", color: "#999999" }}>{label}</span>
      <span style={{ fontSize: "12px", color: countColor, fontWeight: 600 }}>{count}</span>
    </div>
  );
}

export function InboxOverviewCard({
  stats,
  onViewAll,
}: {
  stats: InboxOverviewStats;
  onViewAll: () => void;
}) {
  return (
    <div style={SIDEBAR_CARD_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        <Zap size={16} color={RED} aria-hidden />
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
          Inbox Overview
        </h3>
      </div>

      <OverviewRow icon={Inbox} label="Total Messages" count={stats.total} />
      <OverviewRow
        icon={Mail}
        label="Unread"
        count={stats.unread}
        countColor={stats.unread > 0 ? RED : "#555555"}
      />
      <OverviewRow
        icon={Bell}
        label="Action Required"
        count={stats.actionRequired}
        countColor={stats.actionRequired > 0 ? GOLD : "#555555"}
      />
      <OverviewRow icon={Briefcase} label="Applications" count={stats.applications} />
      <OverviewRow icon={Star} label="Invites" count={stats.invites} />
      <OverviewRow icon={Users} label="Club Updates" count={stats.clubUpdates} />
      <OverviewRow icon={Shield} label="Admin / Support" count={stats.admin} />

      <button
        type="button"
        onClick={onViewAll}
        style={{
          marginTop: "4px",
          background: "transparent",
          border: "none",
          color: RED,
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          padding: 0,
        }}
      >
        View all messages →
      </button>
    </div>
  );
}

type ClubOption = { id: string; name: string };

type QuickActionTarget = "announcements" | "events" | "tasks" | "members";

function ClubPickerModal({
  clubs,
  title,
  onSelect,
  onClose,
}: {
  clubs: ClubOption[];
  title: string;
  onSelect: (clubId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        <p style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
          {title}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {clubs.map((club) => (
            <button
              key={club.id}
              type="button"
              onClick={() => onSelect(club.id)}
              style={{
                ...OUTLINED_BUTTON_STYLE,
                width: "100%",
                textAlign: "left",
              }}
            >
              {club.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            ...OUTLINED_BUTTON_STYLE,
            width: "100%",
            marginTop: "10px",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function QuickActionRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: hovered ? "#1a1a1a" : "transparent",
        border: "none",
        borderRadius: "6px",
        padding: "8px 6px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Icon size={16} color={RED} aria-hidden style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: "13px", color: "#cccccc" }}>{label}</span>
      <ChevronRight size={16} color="#555555" aria-hidden />
    </button>
  );
}

export function InboxQuickActionsCard({
  clubs,
  onViewMyClubs,
}: {
  clubs: ClubOption[];
  onViewMyClubs: () => void;
}) {
  const navigate = useNavigate();
  const [pickerTarget, setPickerTarget] = useState<QuickActionTarget | null>(null);

  function navigateToClubTarget(target: QuickActionTarget, clubId: string) {
    const openCreate =
      target === "announcements" || target === "events" || target === "tasks"
        ? "?openCreate=true"
        : "";
    navigate(`/app/clubs/${clubId}/${target}${openCreate}`);
    setPickerTarget(null);
  }

  function startQuickAction(target: QuickActionTarget) {
    if (clubs.length === 0) {
      navigate("/app/join");
      return;
    }
    if (clubs.length === 1) {
      navigateToClubTarget(target, clubs[0].id);
      return;
    }
    setPickerTarget(target);
  }

  const pickerTitle =
    pickerTarget === "announcements"
      ? "Choose a club for announcements"
      : pickerTarget === "events"
        ? "Choose a club for events"
        : pickerTarget === "tasks"
          ? "Choose a club for tasks"
          : pickerTarget === "members"
            ? "Choose a club to invite members"
            : "Choose a club";

  return (
    <>
      <div style={SIDEBAR_CARD_STYLE}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <Zap size={16} color={GOLD} aria-hidden />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            Quick Actions
          </h3>
        </div>

        <QuickActionRow
          icon={Megaphone}
          label="Create an announcement"
          onClick={() => startQuickAction("announcements")}
        />
        <QuickActionRow
          icon={Calendar}
          label="Create an event"
          onClick={() => startQuickAction("events")}
        />
        <QuickActionRow
          icon={CheckSquare}
          label="Add a task"
          onClick={() => startQuickAction("tasks")}
        />
        <QuickActionRow
          icon={Users}
          label="Invite members"
          onClick={() => startQuickAction("members")}
        />
        <QuickActionRow icon={Building} label="View my clubs" onClick={onViewMyClubs} />
      </div>

      {pickerTarget ? (
        <ClubPickerModal
          clubs={clubs}
          title={pickerTitle}
          onSelect={(clubId) => navigateToClubTarget(pickerTarget, clubId)}
          onClose={() => setPickerTarget(null)}
        />
      ) : null}
    </>
  );
}

export function InboxAchievementSidebarCard({
  displayName,
  completedCount,
  totalCount,
}: {
  displayName: string;
  completedCount: number;
  totalCount: number;
}) {
  return (
    <div style={{ marginBottom: 0 }}>
      <WeekAchievementCard
        displayName={displayName}
        completedCount={completedCount}
        totalCount={totalCount}
      />
    </div>
  );
}
