import {
  Bell,
  Briefcase,
  Building,
  Shield,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { InboxMessage } from "../../lib/inboxUtils";

const GOLD = "#FFC429";
const RED = "#E51937";

export const OUTLINED_BUTTON_STYLE = {
  border: "1px solid #2a2a2a",
  background: "transparent",
  color: "#cccccc",
  borderRadius: "8px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
} as const;

export const SOLID_RED_BUTTON_STYLE = {
  background: RED,
  color: "#ffffff",
  border: `1px solid ${RED}`,
  borderRadius: "8px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
} as const;

function deriveAbbreviation(name: string, maxLen = 3): string {
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

export function normalizeInboxUiType(message: InboxMessage): string {
  if (message.actionType === "view_claim_status") return "claim_submitted";
  if (message.actionType === "review_claim_request") return "new_claim_request";

  switch (message.type) {
    case "club_claim_approved":
      return "claim_approved";
    case "club_claim_rejected":
      return "claim_rejected";
    default:
      return message.type;
  }
}

export function inboxCategoryLabel(message: InboxMessage): string {
  const uiType = normalizeInboxUiType(message);

  switch (uiType) {
    case "new_join_request":
      return "Join Request";
    case "join_approved":
    case "join_rejected":
      return "Membership Update";
    case "claim_approved":
    case "claim_rejected":
    case "claim_submitted":
      return "Club Claim";
    case "executive_invite":
      return "Executive Invite";
    case "application_update":
      return "Application Update";
    case "new_claim_request":
      return "Admin";
    case "admin_message":
    case "system_message":
      return "Admin / Support";
    default:
      return "Club Update";
  }
}

export type InboxStatusBadge = {
  label: string;
  color: string;
  background: string;
  border: string;
};

function isApplicationPending(message: InboxMessage): boolean {
  const subStatus = message.actionData.subStatus;
  if (typeof subStatus === "string" && subStatus.toLowerCase().includes("pending")) {
    return true;
  }

  const status = message.actionData.status;
  if (typeof status === "string" && status.toLowerCase() === "pending") {
    return true;
  }

  const title = message.title.toLowerCase();
  const body = message.message.toLowerCase();
  if (title.includes("reject") || body.includes("reject")) return false;
  if (title.includes("declin") || body.includes("declin")) return false;
  if (title.includes("offer") || body.includes("offer")) return false;
  return true;
}

export function inboxStatusBadge(message: InboxMessage): InboxStatusBadge | null {
  const uiType = normalizeInboxUiType(message);

  switch (uiType) {
    case "claim_approved":
      return {
        label: "Approved ✓",
        color: GOLD,
        background: "rgba(255,196,41,0.1)",
        border: `1px solid ${GOLD}`,
      };
    case "claim_rejected":
      return {
        label: "Declined",
        color: RED,
        background: "rgba(229,25,55,0.1)",
        border: `1px solid ${RED}`,
      };
    case "join_approved":
      return {
        label: "Approved ✓",
        color: GOLD,
        background: "rgba(255,196,41,0.1)",
        border: `1px solid ${GOLD}`,
      };
    case "join_rejected":
      return {
        label: "Not Approved",
        color: "#555555",
        background: "rgba(85,85,85,0.1)",
        border: "1px solid #555555",
      };
    case "application_update":
      if (isApplicationPending(message)) {
        return {
          label: "Under Review",
          color: GOLD,
          background: "rgba(255,196,41,0.1)",
          border: `1px solid ${GOLD}`,
        };
      }
      return null;
    default:
      return null;
  }
}

type AvatarIconConfig = {
  Icon: LucideIcon;
  background: string;
  color: string;
};

function inboxAvatarIcon(message: InboxMessage): AvatarIconConfig {
  const uiType = normalizeInboxUiType(message);

  switch (uiType) {
    case "join_approved":
    case "join_rejected":
    case "new_join_request":
      return { Icon: Users, background: GOLD, color: "#111111" };
    case "claim_approved":
    case "claim_rejected":
    case "claim_submitted":
    case "new_claim_request":
      return { Icon: Building, background: RED, color: "#ffffff" };
    case "application_update":
      return { Icon: Briefcase, background: "#555555", color: "#ffffff" };
    case "executive_invite":
      return { Icon: Star, background: GOLD, color: "#111111" };
    case "admin_message":
    case "system_message":
      return { Icon: Shield, background: "#555555", color: "#ffffff" };
    default:
      return { Icon: Bell, background: "#333333", color: "#ffffff" };
  }
}

const AVATAR_SIZE = 44;
const AVATAR_RADIUS = "8px";

export type InboxActionButton = {
  label: string;
  variant: "solid" | "outlined" | "link";
};

export function resolveActionButtons(message: InboxMessage): InboxActionButton[] {
  const uiType = normalizeInboxUiType(message);

  switch (uiType) {
    case "claim_approved":
    case "join_approved":
      return [{ label: "Open Club Dashboard", variant: "solid" }];
    case "claim_rejected":
      return [{ label: "View Club Profile", variant: "outlined" }];
    case "claim_submitted":
      return [{ label: "View Status", variant: "outlined" }];
    case "join_rejected":
      return [{ label: "Read More →", variant: "link" }];
    case "new_join_request":
      return [{ label: "Review Request", variant: "outlined" }];
    case "executive_invite":
      return [{ label: "Review Invite", variant: "outlined" }];
    case "application_update":
      return [{ label: "Review Application", variant: "outlined" }];
    case "new_claim_request":
      return [{ label: "Review in Admin", variant: "outlined" }];
    default:
      return [{ label: "Read More →", variant: "link" }];
  }
}

export function InboxMessageAvatar({
  message,
  logoUrl,
}: {
  message: InboxMessage;
  logoUrl?: string;
}) {
  const clubName = message.clubName?.trim();

  if (message.clubId && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${AVATAR_SIZE}px`,
          height: `${AVATAR_SIZE}px`,
          borderRadius: AVATAR_RADIUS,
          border: "1px solid #2a2a2a",
          objectFit: "cover",
          flexShrink: 0,
          background: "#2a2a2a",
        }}
      />
    );
  }

  if (message.clubId && clubName) {
    return (
      <div
        style={{
          width: `${AVATAR_SIZE}px`,
          height: `${AVATAR_SIZE}px`,
          borderRadius: AVATAR_RADIUS,
          border: "1px solid #2a2a2a",
          background: "#2a2a2a",
          color: "#888888",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {deriveAbbreviation(clubName)}
      </div>
    );
  }

  const { Icon, background, color } = inboxAvatarIcon(message);

  return (
    <div
      style={{
        width: `${AVATAR_SIZE}px`,
        height: `${AVATAR_SIZE}px`,
        borderRadius: AVATAR_RADIUS,
        border: "1px solid #2a2a2a",
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={20} color={color} aria-hidden />
    </div>
  );
}

export function InboxStatusBadgePill({ badge }: { badge: InboxStatusBadge }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "11px",
        fontWeight: 600,
        color: badge.color,
        background: badge.background,
        border: badge.border,
        borderRadius: "4px",
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {badge.label}
    </span>
  );
}
