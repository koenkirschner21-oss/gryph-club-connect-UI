import { Globe, Lock, Users } from "lucide-react";
import type { CSSProperties } from "react";
import type { Visibility } from "../../types";
import { normalizeVisibility } from "../../lib/contentVisibility";

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
};

export default function VisibilityBadge({
  visibility,
}: {
  visibility?: Visibility | string | null;
}) {
  const level = normalizeVisibility(visibility);

  if (level === "executives_only") {
    return (
      <span style={badgeStyle} title="Executives only">
        <Lock size={12} color="#E51937" aria-label="Executives only" />
      </span>
    );
  }

  if (level === "members_only") {
    return (
      <span style={badgeStyle} title="Members only">
        <Users size={12} color="#555555" aria-label="Members only" />
      </span>
    );
  }

  return (
    <span style={badgeStyle} title="Public">
      <Globe size={12} color="#555555" aria-label="Public" />
    </span>
  );
}
