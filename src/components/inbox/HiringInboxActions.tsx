import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  fetchHiringInterviewTimeOptions,
  selectHiringInterviewTime,
} from "../../lib/hiringInterviewUtils";
import {
  OUTLINED_BUTTON_STYLE,
  SOLID_RED_BUTTON_STYLE,
} from "./inboxMessageUi";

const SUCCESS_TEXT_STYLE = {
  margin: "12px 0 0",
  fontSize: "13px",
  color: "#4ade80",
  lineHeight: 1.5,
} as const;

const ERROR_TEXT_STYLE = {
  margin: "12px 0 0",
  fontSize: "13px",
  color: "#E51937",
  lineHeight: 1.5,
} as const;

const COMING_SOON_STYLE = {
  margin: "12px 0 0",
  padding: "12px 14px",
  borderRadius: "8px",
  border: "1px solid #333333",
  background: "#141414",
  fontSize: "13px",
  color: "#888888",
  lineHeight: 1.5,
} as const;

export function InterviewTimeInboxActions({
  applicationId,
  inboxMessageId,
  recipientUserId,
  inviteMode,
  inviteInterviewTimes,
  onRefresh,
}: {
  applicationId: string;
  inboxMessageId: string;
  recipientUserId: string;
  inviteMode?: string;
  inviteInterviewTimes?: unknown;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [interviewTimes, setInterviewTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [mode, setMode] = useState<"ask_availability" | "specific_times" | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setLoading(true);
      const options = await fetchHiringInterviewTimeOptions(
        supabase,
        applicationId,
        {
          mode: inviteMode,
          interviewTimes: inviteInterviewTimes,
        },
      );
      if (cancelled) return;

      const resolvedMode =
        inviteMode === "ask_availability" || inviteMode === "specific_times"
          ? inviteMode
          : options.mode;

      setMode(resolvedMode);
      setInterviewTimes(options.interviewTimes);
      setSelectedTime(options.interviewTimes[0] ?? "");
      setLoading(false);

      if (options.subStatus && options.subStatus !== "interview_invite_sent") {
        onRefresh();
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [applicationId, inviteMode, inviteInterviewTimes, onRefresh]);

  async function handleConfirmTime() {
    if (!selectedTime.trim()) {
      setError("Select one of the proposed interview times.");
      return;
    }

    setActing(true);
    setError(null);
    setSuccess(null);

    const result = await selectHiringInterviewTime(supabase, {
      applicationId,
      selectedTime: selectedTime.trim(),
      recipientUserId,
      inboxMessageId,
    });

    setActing(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save your interview time.");
      return;
    }

    setSuccess(`Interview time confirmed: ${selectedTime.trim()}`);
    onRefresh();
  }

  if (success) {
    return <p style={SUCCESS_TEXT_STYLE}>{success}</p>;
  }

  if (loading) {
    return <p style={{ margin: "12px 0 0", fontSize: "13px", color: "#777777" }}>Loading interview options…</p>;
  }

  if (mode === "ask_availability" || interviewTimes.length === 0) {
    return (
      <div style={COMING_SOON_STYLE} title="In-app availability sharing is not available yet.">
        <strong style={{ color: "#cccccc", display: "block", marginBottom: "4px" }}>
          Coming soon
        </strong>
        The club asked for your availability. Replying with your open times in-app is not
        available yet — check the message above for how to follow up with the club.
      </div>
    );
  }

  return (
    <div style={{ marginTop: "14px" }}>
      <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#888888" }}>
        Choose one of the proposed interview times:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {interviewTimes.map((time) => {
          const selected = selectedTime === time;
          return (
            <label
              key={time}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: `1px solid ${selected ? "#E51937" : "#2a2a2a"}`,
                background: selected ? "#1a1010" : "#141414",
                cursor: "pointer",
                fontSize: "13px",
                color: "#dddddd",
              }}
            >
              <input
                type="radio"
                name={`interview-time-${applicationId}`}
                checked={selected}
                onChange={() => setSelectedTime(time)}
              />
              <span>{time}</span>
            </label>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "12px",
        }}
      >
        <button
          type="button"
          disabled={acting}
          style={SOLID_RED_BUTTON_STYLE}
          onClick={() => void handleConfirmTime()}
        >
          {acting ? "Saving…" : "Confirm Time"}
        </button>
      </div>
      {error ? <p style={ERROR_TEXT_STYLE}>{error}</p> : null}
    </div>
  );
}

export function OfferResponseInboxActions({
  acting,
  actionError,
  actionSuccess,
  onAccept,
  onDecline,
}: {
  acting: boolean;
  actionError: string | null;
  actionSuccess: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (actionSuccess) {
    return <p style={SUCCESS_TEXT_STYLE}>{actionSuccess}</p>;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "14px",
        }}
      >
        <button
          type="button"
          disabled={acting}
          style={SOLID_RED_BUTTON_STYLE}
          onClick={onAccept}
        >
          {acting ? "Working…" : "Accept Offer"}
        </button>
        <button
          type="button"
          disabled={acting}
          style={OUTLINED_BUTTON_STYLE}
          onClick={onDecline}
        >
          Decline Offer
        </button>
      </div>
      {actionError ? <p style={ERROR_TEXT_STYLE}>{actionError}</p> : null}
    </>
  );
}
