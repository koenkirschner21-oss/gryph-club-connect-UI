import type { CSSProperties, ReactNode } from "react";
import { Calendar, Check, Clock, ExternalLink, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import VisibilityBadge from "../club/VisibilityBadge";
import type { RsvpStatus, Visibility } from "../../types";

const CARD_STYLE: CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  padding: "20px",
};

export type EventRsvpCounts = {
  going: number;
  maybe: number;
  not_going: number;
};

function deriveClubInitials(name: string, abbreviation?: string): string {
  const abbr = abbreviation?.trim();
  if (abbr) return abbr.slice(0, 3).toUpperCase();
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function formatEventDate(date: string): string {
  const parsed = new Date(`${date.trim()}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  const parsed = new Date(`1970-01-01T${raw}`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function cleanLocation(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.toUpperCase() === "TBD") return null;
  return raw;
}

function rsvpStatusLabel(status: RsvpStatus | null | undefined): string {
  if (status === "going") return "Going";
  if (status === "maybe") return "Maybe";
  if (status === "not_going") return "Not Going";
  return "No response yet";
}

function rsvpStatusStyle(status: RsvpStatus | null | undefined): CSSProperties {
  if (status === "going") {
    return {
      background: "rgba(255, 196, 41, 0.12)",
      border: "1px solid #FFC429",
      color: "#FFC429",
    };
  }
  if (status === "maybe") {
    return {
      background: "#1a1a1a",
      border: "1px solid #555555",
      color: "#aaaaaa",
    };
  }
  if (status === "not_going") {
    return {
      background: "rgba(229, 25, 55, 0.1)",
      border: "1px solid #E51937",
      color: "#E51937",
    };
  }
  return {
    background: "#1a1a1a",
    border: "1px solid #333333",
    color: "#777777",
  };
}

export function EventDetailClubHeader({
  clubName,
  logoUrl,
  abbreviation,
  clubSlug,
  compact = false,
}: {
  clubName: string;
  logoUrl?: string;
  abbreviation?: string;
  clubSlug?: string;
  compact?: boolean;
}) {
  const size = compact ? 40 : 48;
  const initials = deriveClubInitials(clubName, abbreviation);

  const avatar = logoUrl ? (
    <img
      src={logoUrl}
      alt=""
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "10px",
        border: "1px solid #2a2a2a",
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
  ) : (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "10px",
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#888888",
        fontSize: compact ? "12px" : "13px",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );

  const nameStyle: CSSProperties = {
    fontSize: compact ? "14px" : "15px",
    fontWeight: 600,
    color: "#cccccc",
    textDecoration: "none",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
      {avatar}
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 2px",
            fontSize: "11px",
            fontWeight: 600,
            color: "#555555",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Hosted by
        </p>
        {clubSlug ? (
          <Link to={`/clubs/${clubSlug}`} style={nameStyle}>
            {clubName}
          </Link>
        ) : (
          <span style={{ ...nameStyle, color: "#ffffff" }}>{clubName}</span>
        )}
      </div>
    </div>
  );
}

export function EventDetailBadges({
  visibility,
  categoryLabel,
  isRecurring,
  recurrenceDetail,
}: {
  visibility: Visibility | string;
  categoryLabel?: string;
  isRecurring?: boolean;
  recurrenceDetail?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        marginBottom: "12px",
      }}
    >
      <VisibilityBadge visibility={visibility} />
      {categoryLabel ? (
        <span
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            color: "#777777",
            borderRadius: "20px",
            padding: "3px 10px",
            fontSize: "11px",
            fontWeight: 500,
          }}
        >
          {categoryLabel}
        </span>
      ) : null}
      {isRecurring ? (
        <span
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            color: "#777777",
            borderRadius: "20px",
            padding: "3px 10px",
            fontSize: "11px",
            fontWeight: 500,
          }}
        >
          Recurring{recurrenceDetail ? ` · ${recurrenceDetail}` : ""}
        </span>
      ) : null}
    </div>
  );
}

export function EventDetailTitle({
  title,
  size = "large",
}: {
  title: string;
  size?: "large" | "medium";
}) {
  return (
    <h1
      style={{
        margin: "0 0 16px",
        fontSize: size === "large" ? "32px" : "26px",
        fontWeight: 800,
        color: "#ffffff",
        lineHeight: 1.2,
      }}
    >
      {title}
    </h1>
  );
}

export function EventDetailMeta({
  date,
  time,
  location,
}: {
  date: string;
  time: string;
  location: string;
}) {
  const timeLabel = formatEventTime(time);
  const locationLabel = cleanLocation(location);

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    fontSize: "14px",
    color: "#aaaaaa",
    margin: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
      <p style={rowStyle}>
        <Calendar size={16} color="#555555" aria-hidden style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>{formatEventDate(date)}</span>
      </p>
      <p style={rowStyle}>
        <Clock size={16} color="#555555" aria-hidden style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>{timeLabel ?? "Time TBD"}</span>
      </p>
      <p style={rowStyle}>
        <MapPin size={16} color="#555555" aria-hidden style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>{locationLabel ?? "Location TBD"}</span>
      </p>
    </div>
  );
}

export function EventDetailDescription({ description }: { description: string }) {
  const text = description?.trim();

  return (
    <section style={{ ...CARD_STYLE, marginBottom: "16px" }}>
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: "13px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        About this event
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: "15px",
          color: text ? "#cccccc" : "#555555",
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
          fontStyle: text ? "normal" : "italic",
        }}
      >
        {text || "No description provided."}
      </p>
    </section>
  );
}

export function EventDetailMyRsvp({
  status,
  sectionTitle = "Your RSVP",
}: {
  status: RsvpStatus | null | undefined;
  sectionTitle?: string;
}) {
  return (
    <section style={{ ...CARD_STYLE, marginBottom: "16px" }}>
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: "13px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {sectionTitle}
      </h2>
      <span
        style={{
          display: "inline-block",
          borderRadius: "20px",
          padding: "5px 12px",
          fontSize: "12px",
          fontWeight: 600,
          ...rsvpStatusStyle(status ?? null),
        }}
      >
        {rsvpStatusLabel(status ?? null)}
      </span>
    </section>
  );
}

export function EventDetailRsvpSummary({
  counts,
  children,
}: {
  counts: EventRsvpCounts;
  children?: ReactNode;
}) {
  const total = counts.going + counts.maybe + counts.not_going;

  return (
    <section style={CARD_STYLE}>
      <h2
        style={{
          margin: "0 0 4px",
          fontSize: "13px",
          fontWeight: 600,
          color: "#777777",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        RSVP summary
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#555555" }}>
        {total === 0
          ? "No responses yet."
          : `${counts.going} going · ${counts.maybe} maybe · ${counts.not_going} not going`}
      </p>
      {children}
    </section>
  );
}

export function EventDetailPrimaryAction({
  label,
  onClick,
  disabled,
  variant = "primary",
  href,
  showCheck,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "going" | "secondary";
  href?: string;
  showCheck?: boolean;
}) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    borderRadius: variant === "going" ? "20px" : "8px",
    padding: "12px 24px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.7 : 1,
    textDecoration: "none",
    border: "none",
    fontFamily: "inherit",
  };

  const styles: CSSProperties =
    variant === "going"
      ? { ...base, background: "#FFC429", color: "#0f0f0f" }
      : variant === "secondary"
        ? {
            ...base,
            background: "transparent",
            color: "#cccccc",
            border: "1px solid #333333",
          }
        : { ...base, background: "#E51937", color: "#ffffff" };

  if (href) {
    return (
      <Link to={href} style={styles}>
        {label}
        {showCheck ? <Check size={16} aria-hidden /> : null}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={styles}>
      {label}
      {showCheck ? <Check size={16} aria-hidden /> : null}
    </button>
  );
}

export function EventDetailPublicLink({ href }: { href: string }) {
  return (
    <Link
      to={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        marginTop: "12px",
        fontSize: "13px",
        color: "#777777",
        textDecoration: "none",
      }}
    >
      View public posting
      <ExternalLink size={14} aria-hidden />
    </Link>
  );
}

export function EventDetailPageShell({
  children,
  maxWidth = "900px",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div style={{ width: "100%", maxWidth, margin: "0 auto" }}>{children}</div>
  );
}

export function EventDetailTwoColumn({
  main,
  sidebar,
  isMobile,
}: {
  main: ReactNode;
  sidebar: ReactNode;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(280px, 340px)",
        gap: "20px",
        alignItems: "start",
      }}
    >
      <div>{main}</div>
      <div
        style={{
          position: isMobile ? "static" : "sticky",
          top: isMobile ? undefined : "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {sidebar}
      </div>
    </div>
  );
}
