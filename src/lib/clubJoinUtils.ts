import type { CSSProperties } from "react";
import type { ClubJoinType, JoinQuestion } from "../types";

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

export function normalizeJoinType(value: unknown): ClubJoinType {
  if (value === "application" || value === "vote") return value;
  return "open";
}

export function joinTypeBadgeStyle(joinType: ClubJoinType): CSSProperties | null {
  if (joinType === "application") {
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
  if (joinType === "vote") {
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
  return null;
}

export function joinTypeBadgeLabel(joinType: ClubJoinType): string | null {
  if (joinType === "application") return "Application Required";
  if (joinType === "vote") return "Voted Admission";
  return null;
}
