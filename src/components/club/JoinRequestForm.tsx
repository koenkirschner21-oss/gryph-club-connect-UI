import { useMemo, useState, type CSSProperties } from "react";
import type { JoinAnswer, JoinQuestion } from "../../types";
import { effectiveJoinQuestions } from "../../lib/clubJoinUtils";

const inputStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 12px",
  color: "#ffffff",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#cccccc",
  marginBottom: "6px",
};

export interface JoinRequestFormProps {
  questions: JoinQuestion[];
  allowFileUpload?: boolean;
  submitting?: boolean;
  pending?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  onSubmit: (payload: {
    answers: JoinAnswer[];
    message: string;
    attachmentUrl?: string | null;
  }) => void | Promise<void>;
}

export default function JoinRequestForm({
  questions,
  allowFileUpload = false,
  submitting = false,
  pending = false,
  submitLabel = "Submit Request",
  pendingLabel = "Request Pending",
  onSubmit,
}: JoinRequestFormProps) {
  const effectiveQuestions = useMemo(
    () => effectiveJoinQuestions(questions),
    [questions],
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const question of effectiveQuestions) {
      if (question.required && !(answers[question.id] ?? "").trim()) {
        next[question.id] = "This field is required.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (pending || submitting) return;
    if (!validate()) return;

    const payload: JoinAnswer[] = effectiveQuestions
      .map((question) => ({
        id: question.id,
        question: question.question,
        answer: (answers[question.id] ?? "").trim(),
      }))
      .filter((row) => row.answer);

    await onSubmit({
      answers: payload,
      message: message.trim(),
      attachmentUrl: attachmentName,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {effectiveQuestions.map((question) => (
        <div key={question.id}>
          <label htmlFor={`join-q-${question.id}`} style={labelStyle}>
            {question.question}
            {question.required ? " *" : ""}
          </label>

          {question.question_type === "multiple_choice" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(question.options ?? []).map((option) => (
                <label
                  key={option}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: "#cccccc",
                    cursor: pending ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name={`join-q-${question.id}`}
                    value={option}
                    checked={answers[question.id] === option}
                    disabled={pending || submitting}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [question.id]: option }))
                    }
                  />
                  {option}
                </label>
              ))}
            </div>
          ) : question.question_type === "long" ? (
            <textarea
              id={`join-q-${question.id}`}
              rows={4}
              value={answers[question.id] ?? ""}
              disabled={pending || submitting}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
              }
              style={{ ...inputStyle, resize: "vertical" }}
            />
          ) : (
            <input
              id={`join-q-${question.id}`}
              type="text"
              value={answers[question.id] ?? ""}
              disabled={pending || submitting}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
              }
              style={inputStyle}
            />
          )}

          {errors[question.id] ? (
            <p style={{ fontSize: "12px", color: "#E51937", margin: "4px 0 0" }}>
              {errors[question.id]}
            </p>
          ) : null}
        </div>
      ))}

      <div>
        <label htmlFor="join-message" style={labelStyle}>
          Anything else you&apos;d like to add?
        </label>
        <textarea
          id="join-message"
          rows={3}
          value={message}
          disabled={pending || submitting}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional message for the club execs"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {allowFileUpload ? (
        <div>
          <label htmlFor="join-attachment" style={labelStyle}>
            Attach a file (optional)
          </label>
          <input
            id="join-attachment"
            type="file"
            disabled={pending || submitting}
            onChange={(e) =>
              setAttachmentName(e.target.files?.[0]?.name ?? null)
            }
            style={{ ...inputStyle, padding: "8px 12px" }}
          />
          {attachmentName ? (
            <p style={{ fontSize: "12px", color: "#777777", margin: "6px 0 0" }}>
              Selected: {attachmentName}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        disabled={pending || submitting}
        onClick={() => void handleSubmit()}
        style={{
          width: "100%",
          background: pending ? "transparent" : "#E51937",
          color: pending ? "#FFC429" : "#ffffff",
          border: pending ? "1px solid #FFC429" : "none",
          borderRadius: "8px",
          padding: "10px 16px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: pending || submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {pending ? pendingLabel : submitting ? "Submitting…" : submitLabel}
      </button>
    </div>
  );
}
