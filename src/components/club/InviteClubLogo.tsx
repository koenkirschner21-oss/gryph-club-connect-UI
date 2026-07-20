interface InviteClubLogoProps {
  name: string;
  logoUrl?: string;
  size?: number;
}

/** Circular/rounded club mark shown at the top of invite landing pages. */
export default function InviteClubLogo({
  name,
  logoUrl,
  size = 64,
}: InviteClubLogoProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "12px",
          objectFit: "cover",
          border: "1px solid #333333",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "12px",
        background: "#111111",
        border: "1px solid #333333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.round(size * 0.3)}px`,
        fontWeight: 700,
        color: "#888888",
      }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
