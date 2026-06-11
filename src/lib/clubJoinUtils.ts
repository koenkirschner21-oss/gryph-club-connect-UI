import type { CSSProperties } from "react";
import type { ClubJoinType, JoinAnswer, JoinQuestion, JoinQuestionType, MembershipType } from "../types";

function normalizeQuestionType(value: unknown): JoinQuestionType {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "long" || raw === "long_answer" || raw === "long answer") {
    return "long";
  }
  if (
    raw === "multiple_choice" ||
    raw === "multiple choice" ||
    raw === "choice"
  ) {
    return "multiple_choice";
  }
  return "short";
}

export function defaultJoinQuestions(): JoinQuestion[] {
  return [
    {
      id: crypto.randomUUID(),
      question: "Why are you interested in joining this club?",
      question_type: "long",
      required: true,
      order_index: 0,
    },
  ];
}

export function parseJoinQuestions(raw: unknown): JoinQuestion[] {
  if (!Array.isArray(raw)) return [];
  const parsed: JoinQuestion[] = [];
  raw.forEach((item, index) => {
    const row = item as Record<string, unknown>;
    const question = (row.question as string) ?? "";
    if (!question.trim()) return;
    const questionType = normalizeQuestionType(row.type ?? row.question_type);
    const options = Array.isArray(row.options)
      ? (row.options as unknown[])
          .map((option) => String(option).trim())
          .filter(Boolean)
      : undefined;
    parsed.push({
      id: (row.id as string) ?? `q-${index}`,
      question,
      question_type: questionType,
      required: Boolean(row.required),
      order_index: (row.order_index as number) ?? index,
      options: questionType === "multiple_choice" ? options ?? [] : options,
    });
  });
  return parsed.sort((a, b) => a.order_index - b.order_index);
}

export function serializeJoinQuestions(questions: JoinQuestion[]) {
  return questions
    .filter((q) => q.question.trim())
    .map((q, index) => ({
      id: q.id,
      question: q.question.trim(),
      type: q.question_type,
      question_type: q.question_type,
      required: q.required ?? false,
      order_index: index,
      ...(q.question_type === "multiple_choice" && q.options?.length
        ? { options: q.options.map((option) => option.trim()).filter(Boolean) }
        : {}),
    }));
}

export function effectiveJoinQuestions(questions: JoinQuestion[]): JoinQuestion[] {
  const parsed = parseJoinQuestions(questions);
  return parsed.length > 0 ? parsed : defaultJoinQuestions();
}

export function parseJoinAnswers(raw: unknown): JoinAnswer[] {
  if (!Array.isArray(raw)) return [];
  const parsed: JoinAnswer[] = [];
  raw.forEach((item, index) => {
    const row = item as Record<string, unknown>;
    const answer = String(row.answer ?? "").trim();
    if (!answer) return;
    parsed.push({
      id: (row.id as string) ?? `a-${index}`,
      question: String(row.question ?? "").trim(),
      answer,
    });
  });
  return parsed;
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
