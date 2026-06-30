import type { CSSProperties } from "react";
import { getProfileInitials } from "../../lib/profileInitials";

function avatarFallbackBackground(name: string): string {
  const palette = ["#1a0505", "#1a1200", "#1a1a1a", "#1a0a14"];
  const code = name.trim().charCodeAt(0) || 65;
  return palette[code % palette.length];
}

export default function ProfileAvatarCircle({
  name,
  avatarUrl,
  email,
  size = 40,
  borderWidth = 2,
  borderColor = "#2a2a2a",
}: {
  name: string;
  avatarUrl?: string | null;
  email?: string | null;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
}) {
  const style: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    border: `${borderWidth}px solid ${borderColor}`,
    flexShrink: 0,
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 object-cover"
        style={style}
      />
    );
  }

  const fontSize = size <= 36 ? "12px" : size <= 44 ? "13px" : "14px";

  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold"
      style={{
        ...style,
        backgroundColor: avatarFallbackBackground(name),
        color: "#ffffff",
        fontSize,
        fontWeight: 700,
      }}
      aria-hidden
    >
      {getProfileInitials(name, email)}
    </div>
  );
}
