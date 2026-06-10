import type { CSSProperties } from "react";
import type { ClubJoinType, JoinQuestion, MembershipType } from "../types";

export function parseJoinQuestions(raw: unknown): JoinQuestion[] {
  if (!Array.isArray(raw)) return [];
  const parsed: JoinQuestion[] = [];
  raw.forEach((item, index) => {
    const row = item as Record<string, unknown>;
    const question = (row.question as string) ?? "";
    if (!question.trim()) return;
    parsed.push({
      id: (row.id as string) ?? `q-${index}`,
      question,
      question_type:
        row.question_type === "long"
          ? ("long" as const)
          : ("short" as const),
      required: Boolean(row.required),
      order_index: (row.order_index as number) ?? index,
    });
  });
  return parsed.sort((a, b) => a.order_index - b.order_index);
}

export function normalizeMembershipType(value: unknown): MembershipType {
  if (
    value === "approval_required" ||
    value === "invite_only" ||
    value === "no_membership"
  ) {
    return value;
  }
  return "open";
}

/** @deprecated Prefer membershipType — maps legacy join_type values. */
export function normalizeJoinType(value: unknown): ClubJoinType {
  if (value === "application" || value === "vote") return value;
  return "open";
}

export function membershipRequiresApproval(
  membershipType: MembershipType,
): boolean {
  return membershipType === "approval_required";
}

export function membershipAllowsPublicJoin(
  membershipType: MembershipType,
): boolean {
  return membershipType === "open" || membershipType === "approval_required";
}

export function membershipAllowsJoinCode(membershipType: MembershipType): boolean {
  return membershipType !== "no_membership";
}

export function membershipUsesApplicationQueue(
  membershipType: MembershipType,
): boolean {
  return membershipType === "approval_required";
}

export function membershipBadgeStyle(
  membershipType: MembershipType,
): CSSProperties | null {
  if (membershipType === "approval_required") {
    return {
      background: "#1a1500",
      border: "1px solid #3a2f00",
      color: "#FFC429",
      borderRadius: "4px",
      padding: "2px 8px",
      fontSize: "10px",
      display: "inline-block",
    };
  }
  if (membershipType === "invite_only") {
    return {
      background: "#0a0a1a",
      border: "1px solid #1a1a3a",
      color: "#6b7cff",
      borderRadius: "4px",
      padding: "2px 8px",
      fontSize: "10px",
      display: "inline-block",
    };
  }
  if (membershipType === "no_membership") {
    return {
      background: "#1a1a1a",
      border: "1px solid #333333",
      color: "#777777",
      borderRadius: "4px",
      padding: "2px 8px",
      fontSize: "10px",
      display: "inline-block",
    };
  }
  return null;
}

export function membershipBadgeLabel(
  membershipType: MembershipType,
): string | null {
  if (membershipType === "approval_required") return "Approval Required";
  if (membershipType === "invite_only") return "Invite Only";
  if (membershipType === "no_membership") return "No General Membership";
  return null;
}

/** @deprecated Prefer membershipBadgeStyle */
export function joinTypeBadgeStyle(joinType: ClubJoinType): CSSProperties | null {
  if (joinType === "application") {
    return membershipBadgeStyle("approval_required");
  }
  if (joinType === "vote") {
    return membershipBadgeStyle("invite_only");
  }
  return null;
}

/** @deprecated Prefer membershipBadgeLabel */
export function joinTypeBadgeLabel(joinType: ClubJoinType): string | null {
  if (joinType === "application") return "Application Required";
  if (joinType === "vote") return "Voted Admission";
  return null;
}
