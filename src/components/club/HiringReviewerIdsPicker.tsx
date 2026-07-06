import type { CSSProperties } from "react";
import type { ClubMember } from "../../types";
import { accessLevelBadgeLabel, accessLevelFromMember } from "../../lib/memberRoleTitle";
import { activeMembersForSelectedVisibility } from "../../lib/selectedVisibility";

const sectionStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "14px",
};

const optionStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  color: "#cccccc",
  fontSize: "13px",
  cursor: "pointer",
};

function toggleReviewerId(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function HiringReviewerIdsPicker({
  members,
  reviewerIds,
  onChange,
  disabled = false,
}: {
  members: ClubMember[];
  reviewerIds: string[];
  onChange: (reviewerIds: string[]) => void;
  disabled?: boolean;
}) {
  const activeMembers = activeMembersForSelectedVisibility(members);

  return (
    <div style={sectionStyle}>
      <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#cccccc" }}>
        Assigned reviewers
      </p>
      <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#777777", lineHeight: 1.5 }}>
        Optional. Selected members can review applications for this listing without
        full hiring management access.
      </p>

      {activeMembers.length === 0 ? (
        <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
          No active members available.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
          {activeMembers.map((member) => {
            const name = member.fullName ?? member.email ?? "Member";
            const accessLevel = accessLevelFromMember(member);
            return (
              <label key={member.userId} style={optionStyle}>
                <input
                  type="checkbox"
                  checked={reviewerIds.includes(member.userId)}
                  disabled={disabled}
                  onChange={() =>
                    onChange(toggleReviewerId(reviewerIds, member.userId))
                  }
                  style={{ marginTop: "2px" }}
                />
                <span>
                  {name}
                  <span style={{ display: "block", color: "#666666", fontSize: "11px" }}>
                    {accessLevelBadgeLabel(accessLevel)}
                    {member.email ? ` · ${member.email}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
