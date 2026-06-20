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
  Lightbulb,
  Mail,
  Megaphone,
  Shield,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { OUTLINED_BUTTON_STYLE } from "../../components/inbox/inboxMessageUi";

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

export type InboxOverviewFilterTarget =
  | "all"
  | "unread"
  | "action_required"
  | "applications"
  | "invites"
  | "club_updates"
  | "admin";

function OverviewRow({
  icon: Icon,
  label,
  count,
  countColor = "#cccccc",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  countColor?: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const interactive = Boolean(onClick);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "10px",
        borderRadius: "6px",
        padding: interactive ? "4px 6px" : undefined,
        marginLeft: interactive ? "-6px" : undefined,
        marginRight: interactive ? "-6px" : undefined,
        background: interactive && hovered ? "#1a1a1a" : "transparent",
        cursor: interactive ? "pointer" : "default",
        transition: "background 0.15s ease",
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
  onFilterSelect,
}: {
  stats: InboxOverviewStats;
  onFilterSelect: (target: InboxOverviewFilterTarget) => void;
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

      <OverviewRow
        icon={Inbox}
        label="Total Messages"
        count={stats.total}
        onClick={() => onFilterSelect("all")}
      />
      <OverviewRow
        icon={Mail}
        label="Unread"
        count={stats.unread}
        countColor={stats.unread > 0 ? RED : "#555555"}
        onClick={() => onFilterSelect("unread")}
      />
      <OverviewRow
        icon={Bell}
        label="Action Required"
        count={stats.actionRequired}
        countColor={stats.actionRequired > 0 ? GOLD : "#555555"}
        onClick={() => onFilterSelect("action_required")}
      />
      <OverviewRow
        icon={Briefcase}
        label="Applications"
        count={stats.applications}
        onClick={() => onFilterSelect("applications")}
      />
      <OverviewRow
        icon={Star}
        label="Invites"
        count={stats.invites}
        onClick={() => onFilterSelect("invites")}
      />
      <OverviewRow
        icon={Users}
        label="Club Updates"
        count={stats.clubUpdates}
        onClick={() => onFilterSelect("club_updates")}
      />
      <OverviewRow
        icon={Shield}
        label="Admin / Support"
        count={stats.admin}
        onClick={() => onFilterSelect("admin")}
      />
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

export function InboxTipsCard() {
  const tips = [
    "Use Action Required to find messages needing attention",
    "Use category filters to narrow message types",
    "Open a message to view full details",
  ];

  return (
    <div style={SIDEBAR_CARD_STYLE}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <Lightbulb size={16} color={GOLD} aria-hidden />
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
          Inbox Tips
        </h3>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#999999", lineHeight: 1.5 }}>
        Messages with action buttons may require you to review requests, open clubs, respond to
        invites, or check important updates.
      </p>

      <ul
        style={{
          margin: 0,
          paddingLeft: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {tips.map((tip) => (
          <li key={tip} style={{ fontSize: "12px", color: "#777777", lineHeight: 1.45 }}>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
