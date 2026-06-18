import { useState, type CSSProperties, type ReactNode } from "react";
import {
  BarChart2,
  Bookmark,
  ChevronDown,
  Globe,
  Heart,
  Image as ImageIcon,
  Lock,
  Pin,
  Users,
} from "lucide-react";
import { formatRelativeTime } from "../../../lib/formatRelativeTime";
import { normalizeVisibility } from "../../../lib/contentVisibility";
import type { Post, Visibility } from "../../../types";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

export type VisibilityFilter = "all" | Visibility;
export type AnnouncementSort = "newest" | "oldest" | "most_liked" | "most_seen";

export const VISIBILITY_FILTER_OPTIONS: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "All Visibility" },
  { value: "public", label: "Public Only" },
  { value: "members_only", label: "Members Only" },
  { value: "executives_only", label: "Executives Only" },
];

export const SORT_OPTIONS: { value: AnnouncementSort; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "most_liked", label: "Most Liked" },
  { value: "most_seen", label: "Most Seen" },
];

const dropdownButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "#1a1a1a",
  border: `1px solid ${CARD_BORDER}`,
  color: "#ffffff",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "13px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label;

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} style={dropdownButtonStyle}>
        {current}
        <ChevronDown size={14} color="#777777" aria-hidden />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            minWidth: "180px",
            background: "#151515",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            overflow: "hidden",
            zIndex: 20,
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                background: value === option.value ? "#1f1f1f" : "transparent",
                border: "none",
                textAlign: "left",
                color: value === option.value ? "#ffffff" : "#999999",
                fontSize: "13px",
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VisibilityFilterDropdown({
  value,
  onChange,
}: {
  value: VisibilityFilter;
  onChange: (value: VisibilityFilter) => void;
}) {
  return <FilterDropdown value={value} options={VISIBILITY_FILTER_OPTIONS} onChange={onChange} />;
}

export function AnnouncementSortDropdown({
  value,
  onChange,
}: {
  value: AnnouncementSort;
  onChange: (value: AnnouncementSort) => void;
}) {
  return <FilterDropdown value={value} options={SORT_OPTIONS} onChange={onChange} />;
}

export function AnnouncementVisibilityBadge({
  visibility,
}: {
  visibility?: Visibility | string | null;
}) {
  const level = normalizeVisibility(visibility);

  if (level === "executives_only") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          fontSize: "11px",
          color: ACCENT_RED,
          border: `1px solid ${ACCENT_RED}`,
          background: "rgba(229,25,55,0.1)",
          borderRadius: "12px",
          padding: "3px 8px",
        }}
      >
        <Lock size={12} aria-hidden />
        Executives Only
      </span>
    );
  }

  if (level === "members_only") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          fontSize: "11px",
          color: GOLD,
          border: `1px solid ${GOLD}`,
          background: "rgba(255,196,41,0.1)",
          borderRadius: "12px",
          padding: "3px 8px",
        }}
      >
        <Lock size={12} aria-hidden />
        Members Only
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        color: "#555555",
        border: "1px solid #333333",
        borderRadius: "12px",
        padding: "3px 8px",
      }}
    >
      <Globe size={12} aria-hidden />
      Public
    </span>
  );
}

function RoleTitlePill({ title }: { title: string }) {
  return (
    <span
      style={{
        background: "rgba(255, 196, 41, 0.15)",
        border: `1px solid ${GOLD}`,
        color: GOLD,
        fontSize: "11px",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "12px",
        marginLeft: "8px",
        flexShrink: 0,
      }}
    >
      {title}
    </span>
  );
}

export function isPostEdited(post: Post): boolean {
  if (!post.updatedAt) return false;
  const created = new Date(post.createdAt).getTime();
  const updated = new Date(post.updatedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 60_000;
}

export function EngagementTipsSidebar() {
  const tips: { Icon: typeof Pin; text: string }[] = [
    { Icon: Pin, text: "Pin important announcements" },
    { Icon: Users, text: "Use visibility settings to target the right audience" },
    { Icon: ImageIcon, text: "Add images to grab attention" },
    { Icon: BarChart2, text: "Track engagement and seen counts" },
  ];

  return (
    <aside
      style={{
        width: "260px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "10px",
          padding: "20px",
        }}
      >
        <h2
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 16px",
          }}
        >
          Create Engaging Posts
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {tips.map(({ Icon, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <Icon size={16} color={ACCENT_RED} aria-hidden style={{ flexShrink: 0, marginTop: "1px" }} />
              <p style={{ margin: 0, fontSize: "13px", color: "#777777", lineHeight: 1.45 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function DotsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AnnouncementCard({
  post,
  isPinned,
  isHovered,
  isExpanded,
  showReadMore,
  authorName,
  roleTitle,
  avatarUrl,
  heartCount,
  heartActive,
  bookmarkActive,
  seenCount,
  isPrivileged,
  showMenu,
  menuOpen,
  isMemberRole,
  canReport,
  onMouseEnter,
  onMouseLeave,
  onToggleMenu,
  onToggleExpand,
  onHeartToggle,
  onBookmarkToggle,
  onViewSeenList,
  onPin,
  onEdit,
  onDelete,
  onReport,
  attachment,
  formatDate,
}: {
  post: Post;
  isPinned: boolean;
  isHovered: boolean;
  isExpanded: boolean;
  showReadMore: boolean;
  authorName: string;
  roleTitle?: string;
  avatarUrl?: string;
  heartCount: number;
  heartActive: boolean;
  bookmarkActive: boolean;
  seenCount: number;
  isPrivileged: boolean;
  showMenu: boolean;
  menuOpen: boolean;
  isMemberRole: boolean;
  canReport: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggleMenu: () => void;
  onToggleExpand: () => void;
  onHeartToggle: () => void;
  onBookmarkToggle: () => void;
  onViewSeenList: () => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  attachment?: ReactNode;
  formatDate: (dateStr: string) => string;
}) {
  const edited = isPostEdited(post);
  const borderColor = isHovered ? "#333333" : CARD_BORDER;

  function initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "relative",
        background: CARD_BG,
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "16px",
        transition: "border-color 0.15s ease",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {isPinned ? (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            fontWeight: 600,
            color: GOLD,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: "0 0 12px",
          }}
        >
          <Pin size={12} aria-hidden />
          PINNED
        </p>
      ) : null}

      <div style={{ position: "absolute", top: "16px", right: "48px", zIndex: 1 }}>
        <AnnouncementVisibilityBadge visibility={post.visibility} />
      </div>

      {showMenu ? (
        <div style={{ position: "absolute", top: "16px", right: "16px", zIndex: 2 }}>
          <button
            type="button"
            aria-label="Post options"
            onClick={onToggleMenu}
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              padding: "4px",
              cursor: "pointer",
            }}
          >
            <DotsIcon />
          </button>
          {menuOpen ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "24px",
                background: "#151515",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: "8px",
                minWidth: "140px",
                zIndex: 5,
                overflow: "hidden",
              }}
            >
              {isPrivileged ? (
                <>
                  <button type="button" onClick={onPin} style={menuItemButtonStyle()}>
                    {isPinned ? "Unpin" : "Pin"}
                  </button>
                  <button type="button" onClick={onEdit} style={menuItemButtonStyle()}>
                    Edit
                  </button>
                  <button type="button" onClick={onDelete} style={menuItemButtonStyle(true)}>
                    Delete
                  </button>
                </>
              ) : null}
              {canReport && isMemberRole ? (
                <button type="button" onClick={onReport} style={menuItemButtonStyle()}>
                  Report Post
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          paddingRight: "88px",
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#2a2a2a",
              color: "#888888",
              fontWeight: 600,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {initials(authorName)}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>{authorName}</span>
          {roleTitle ? <RoleTitlePill title={roleTitle} /> : null}
          <span style={{ fontSize: "12px", color: "#555555" }}>{formatDate(post.createdAt)}</span>
          {edited && post.updatedAt ? (
            <span style={{ fontSize: "11px", color: "#555555" }}>
              · edited {formatRelativeTime(post.updatedAt)}
            </span>
          ) : null}
        </div>
      </div>

      <h3
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "12px 0 8px",
          maxWidth: "720px",
        }}
      >
        {post.title}
      </h3>

      <div
        style={{
          display: isExpanded ? "block" : "-webkit-box",
          WebkitLineClamp: isExpanded ? "unset" : 4,
          WebkitBoxOrient: "vertical",
          overflow: isExpanded ? "visible" : "hidden",
          fontSize: "15px",
          color: "#cccccc",
          lineHeight: 1.6,
          maxWidth: "720px",
          whiteSpace: "pre-wrap",
        }}
      >
        {post.content}
      </div>

      {showReadMore ? (
        <button
          type="button"
          onClick={onToggleExpand}
          style={{
            background: "none",
            border: "none",
            color: ACCENT_RED,
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            padding: "4px 0",
            marginTop: "4px",
          }}
        >
          {isExpanded ? "Show less" : "Read more"}
        </button>
      ) : null}

      {attachment}

      {post.linkUrl ? (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: "12px",
            color: ACCENT_RED,
            fontSize: "13px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          View Link →
        </a>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            aria-label={heartActive ? "Unlike announcement" : "Like announcement"}
            onClick={onHeartToggle}
            style={reactionButtonStyle}
          >
            <Heart
              size={16}
              color={heartActive ? ACCENT_RED : "#555555"}
              fill={heartActive ? ACCENT_RED : "none"}
              aria-hidden
            />
            <span style={{ fontSize: "13px", color: heartActive ? ACCENT_RED : "#555555" }}>
              {heartCount}
            </span>
          </button>
          <button
            type="button"
            aria-label={bookmarkActive ? "Remove bookmark" : "Bookmark announcement"}
            onClick={onBookmarkToggle}
            style={reactionButtonStyle}
          >
            <Bookmark
              size={16}
              color="#555555"
              fill={bookmarkActive ? "#555555" : "none"}
              aria-hidden
            />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "#555555" }}>
            Seen by {seenCount} members
          </span>
          {isPrivileged ? (
            <button
              type="button"
              onClick={onViewSeenList}
              style={{
                background: "transparent",
                border: `1px solid ${CARD_BORDER}`,
                color: "#777777",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              View Seen List
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const reactionButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 0",
  borderRadius: "20px",
  cursor: "pointer",
};

function menuItemButtonStyle(destructive = false): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: destructive ? ACCENT_RED : "#cccccc",
    padding: "9px 12px",
    fontSize: "13px",
    cursor: "pointer",
  };
}

export function SeenListModal({
  postTitle,
  seenCount,
  onClose,
}: {
  postTitle: string;
  seenCount: number;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "400px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", margin: "0 0 8px" }}>
          Seen List
        </h3>
        <p style={{ fontSize: "13px", color: "#777777", margin: "0 0 16px" }}>{postTitle}</p>
        <p style={{ fontSize: "14px", color: "#cccccc", margin: 0 }}>
          {seenCount === 0
            ? "No members have viewed this announcement yet."
            : `${seenCount} member${seenCount === 1 ? "" : "s"} have viewed this announcement.`}
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: "20px",
            width: "100%",
            background: "transparent",
            border: `1px solid ${CARD_BORDER}`,
            color: "#cccccc",
            borderRadius: "6px",
            padding: "8px 16px",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
