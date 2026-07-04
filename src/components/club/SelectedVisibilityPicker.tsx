import type { CSSProperties } from "react";
import type { ClubMember } from "../../types";
import { ACCESS_LEVEL_OPTIONS, accessLevelBadgeLabel } from "../../lib/memberRoleTitle";
import {
  activeMembersForSelectedVisibility,
  selectedVisibilityMemberAccessLevel,
  type SelectedVisibilityTargets,
} from "../../lib/selectedVisibility";

const sectionStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "14px",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#cccccc",
  margin: "0 0 8px",
};

const optionStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  color: "#cccccc",
  fontSize: "13px",
  cursor: "pointer",
};

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function SelectedVisibilityPicker({
  members,
  targets,
  onChange,
  disabled = false,
}: {
  members: ClubMember[];
  targets: SelectedVisibilityTargets;
  onChange: (targets: SelectedVisibilityTargets) => void;
  disabled?: boolean;
}) {
  const activeMembers = activeMembersForSelectedVisibility(members);

  return (
    <div style={sectionStyle}>
      <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#777777", lineHeight: 1.5 }}>
        Pick at least one role tier or individual member. Only those selected audiences
        will be able to fetch this content.
      </p>

      <div style={{ display: "grid", gap: "14px" }}>
        <div>
          <p style={labelStyle}>Selected roles</p>
          <div style={{ display: "grid", gap: "8px" }}>
            {ACCESS_LEVEL_OPTIONS.map((option) => (
              <label key={option.value} style={optionStyle}>
                <input
                  type="checkbox"
                  checked={targets.visibilityRoles.includes(option.value)}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...targets,
                      visibilityRoles: toggleValue(
                        targets.visibilityRoles,
                        option.value,
                      ),
                    })
                  }
                  style={{ marginTop: "2px" }}
                />
                <span>
                  {option.label}
                  <span style={{ display: "block", color: "#666666", fontSize: "11px" }}>
                    Includes active members with {option.workspaceLabel} access.
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p style={labelStyle}>Selected members</p>
          {activeMembers.length === 0 ? (
            <p style={{ margin: 0, color: "#666666", fontSize: "12px" }}>
              No active members available.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
              {activeMembers.map((member) => {
                const accessLevel = selectedVisibilityMemberAccessLevel(member);
                const name = member.fullName ?? member.email ?? "Member";
                return (
                  <label key={member.userId} style={optionStyle}>
                    <input
                      type="checkbox"
                      checked={targets.visibilityUserIds.includes(member.userId)}
                      disabled={disabled}
                      onChange={() =>
                        onChange({
                          ...targets,
                          visibilityUserIds: toggleValue(
                            targets.visibilityUserIds,
                            member.userId,
                          ),
                        })
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
      </div>
    </div>
  );
}
