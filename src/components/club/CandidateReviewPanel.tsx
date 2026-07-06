import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { supabase } from "../../lib/supabaseClient";
import { createInboxMessage } from "../../lib/inboxUtils";
import { notifyHiringManagerBells } from "../../lib/hiringNotificationRecipients";
import {
  ACCESS_LEVEL_OPTIONS,
  POSITION_HANDLING_OPTIONS,
  REJECT_TEMPLATES,
  SEND_UPDATE_TEMPLATES,
  type ApplicationNoteRow,
  type InterviewType,
  type PositionHandling,
} from "../../lib/hiringPipelineUtils";
import { darkInputStyle, modalOverlayStyle } from "../../pages/app/HiringBoardPage";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import {
  downloadHiringApplicationFile,
  hiringFileQuestionLabel,
  isHiringFileQuestionId,
} from "../../lib/hiringUploadFields";

export interface CandidateReviewApplication {
  id: string;
  listingId: string;
  applicantId: string;
  status: string;
  subStatus: string;
  createdAt: string;
  answers: {
    question_id: string;
    answer: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
  }[];
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  interviewTimes: string[];
  interviewType?: string;
  meetingLocation?: string;
  meetingLink?: string;
  offeredAccessLevel?: string;
  offeredRoleTitle?: string;
  positionHandling?: string;
}

export type CandidateReviewPatch = Partial<
  Pick<
    CandidateReviewApplication,
    | "status"
    | "subStatus"
    | "interviewTimes"
    | "interviewType"
    | "meetingLocation"
    | "meetingLink"
    | "offeredAccessLevel"
    | "offeredRoleTitle"
    | "positionHandling"
  >
>;

export type CandidateReviewModal = "schedule" | "send_update" | "accept" | "reject";

export type CandidateReviewPendingAction =
  | { type: "mark_reviewed" }
  | { type: "modal"; modal: CandidateReviewModal };

interface CandidateReviewPanelProps {
  application: CandidateReviewApplication;
  positionTitle: string;
  positionId: string;
  clubId: string;
  clubName: string;
  userId: string;
  answerLabel: (questionId: string) => string;
  onApplicationUpdated: (patch: CandidateReviewPatch) => void;
  onStatusChanged: () => void;
  showActionBar?: boolean;
  pendingAction?: CandidateReviewPendingAction | null;
  onPendingActionHandled?: () => void;
}

type ActiveModal = CandidateReviewModal | null;

const actionButtonStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  color: "#cccccc",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  padding: "8px 10px",
};

const primaryActionStyle: CSSProperties = {
  ...actionButtonStyle,
  background: "#E51937",
  border: "1px solid #E51937",
  color: "#ffffff",
};

const sectionHeadingStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "11px",
  fontWeight: 700,
  color: "#777777",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const secondaryActionStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid #333333",
  borderRadius: "6px",
  color: "#999999",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  padding: "8px 10px",
};

const acceptDecisionStyle: CSSProperties = {
  ...primaryActionStyle,
  fontSize: "13px",
  fontWeight: 700,
  padding: "10px 18px",
};

const rejectDecisionStyle: CSSProperties = {
  ...actionButtonStyle,
  fontSize: "13px",
  fontWeight: 700,
  padding: "10px 18px",
  color: "#E51937",
  background: "#1a0a0a",
  border: "2px solid #E51937",
};

export default function CandidateReviewPanel({
  application,
  positionTitle,
  positionId,
  clubId,
  clubName,
  userId,
  answerLabel,
  onApplicationUpdated,
  onStatusChanged,
  showActionBar = true,
  pendingAction = null,
  onPendingActionHandled,
}: CandidateReviewPanelProps) {
  const [notes, setNotes] = useState<ApplicationNoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [inlineNote, setInlineNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [submitting, setSubmitting] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  const applicantName = application.profile?.full_name ?? "Applicant";

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);

    const { data, error } = await supabase
      .from("application_notes")
      .select("id, application_id, author_id, note, created_at")
      .eq("application_id", application.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load application notes:", error.message);
      setNotes([]);
      setNotesLoading(false);
      return;
    }

    const rows = data ?? [];
    const authorIds = Array.from(
      new Set(rows.map((row) => row.author_id as string).filter(Boolean)),
    );

    let profileMap: Record<string, string> = {};
    let titleMap: Record<string, string | undefined> = {};

    if (authorIds.length > 0) {
      const [{ data: profiles }, { data: members }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds),
        supabase
          .from("club_members")
          .select("user_id, title")
          .eq("club_id", clubId)
          .in("user_id", authorIds),
      ]);

      profileMap = Object.fromEntries(
        (profiles ?? []).map((profile) => [
          profile.id as string,
          (profile.full_name as string | null) ?? "Member",
        ]),
      );

      titleMap = Object.fromEntries(
        (members ?? []).map((member) => [
          member.user_id as string,
          (member.title as string | null) ?? undefined,
        ]),
      );
    }

    setNotes(
      rows.map((row) => ({
        id: row.id as string,
        applicationId: row.application_id as string,
        authorId: row.author_id as string,
        authorName: profileMap[row.author_id as string] ?? "Member",
        authorRoleTitle: titleMap[row.author_id as string],
        note: row.note as string,
        createdAt: row.created_at as string,
      })),
    );
    setNotesLoading(false);
  }, [application.id, clubId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (application.subStatus !== "submitted") return;

    let cancelled = false;

    async function markViewed() {
      const { error } = await supabase
        .from("hiring_applications")
        .update({ sub_status: "viewed" })
        .eq("id", application.id)
        .eq("sub_status", "submitted");

      if (!cancelled && !error) {
        onApplicationUpdated({ subStatus: "viewed" });
      }
    }

    void markViewed();
    return () => {
      cancelled = true;
    };
  }, [application.id, application.subStatus, onApplicationUpdated]);

  async function markReviewed() {
    const { error } = await supabase
      .from("hiring_applications")
      .update({ sub_status: "reviewed", status: "reviewed" })
      .eq("id", application.id);

    if (error) {
      console.error("Failed to mark application reviewed:", error.message);
      return;
    }

    onApplicationUpdated({ subStatus: "reviewed", status: "reviewed" });
    onStatusChanged();
  }

  async function handleAddNote(noteText: string) {
    const trimmed = noteText.trim();
    if (!trimmed || addingNote) return;

    setAddingNote(true);

    const { error: insertError } = await supabase.from("application_notes").insert({
      application_id: application.id,
      author_id: userId,
      note: trimmed,
    });

    if (insertError) {
      console.error("Failed to add application note:", insertError.message);
      setAddingNote(false);
      return;
    }

    const shouldAdvanceSubStatus = ![
      "interview_invite_sent",
      "interview_scheduled",
      "interview_completed",
      "offer_sent",
      "offer_accepted",
      "offer_declined",
      "rejected",
      "withdrawn",
    ].includes(application.subStatus);

    if (shouldAdvanceSubStatus) {
      const { error: updateError } = await supabase
        .from("hiring_applications")
        .update({ sub_status: "notes_added" })
        .eq("id", application.id);

      if (!updateError) {
        onApplicationUpdated({ subStatus: "notes_added" });
      }
    }

    setInlineNote("");
    await loadNotes();
    setAddingNote(false);
  }

  useEffect(() => {
    if (!pendingAction) return;

    if (pendingAction.type === "mark_reviewed") {
      void markReviewed().finally(() => onPendingActionHandled?.());
      return;
    }

    setActiveModal(pendingAction.modal);
    onPendingActionHandled?.();
  }, [pendingAction, onPendingActionHandled]);

  return (
    <>
      <section style={{ marginBottom: "28px" }}>
        <h3 style={sectionHeadingStyle}>Application Responses</h3>

        {application.answers.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#cccccc", margin: 0 }}>—</p>
        ) : (
          <div
            style={{
              border: "1px solid #2a2a2a",
              borderRadius: "10px",
              overflow: "hidden",
              background: "#111111",
            }}
          >
            {application.answers.map((ans, index) => (
              <div
                key={ans.question_id}
                style={{
                  padding: "14px 16px",
                  borderBottom:
                    index < application.answers.length - 1
                      ? "1px solid #222222"
                      : "none",
                }}
              >
                <p
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#888888",
                    margin: "0 0 6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {isHiringFileQuestionId(ans.question_id)
                    ? hiringFileQuestionLabel(ans.question_id)
                    : answerLabel(ans.question_id)}
                </p>
                {isHiringFileQuestionId(ans.question_id) ? (
                  <button
                    type="button"
                    onClick={() =>
                      void downloadHiringApplicationFile(
                        supabase,
                        ans.answer,
                        ans.file_name ?? hiringFileQuestionLabel(ans.question_id),
                      )
                    }
                    style={{
                      background: "#141414",
                      border: "1px solid #2a2a2a",
                      borderRadius: "6px",
                      color: "#E51937",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      padding: "8px 12px",
                    }}
                  >
                    Download {ans.file_name ?? "file"}
                  </button>
                ) : (
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#dddddd",
                      margin: 0,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {ans.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <InternalNotesSection
        notes={notes}
        loading={notesLoading}
        inlineNote={inlineNote}
        noteInputRef={noteInputRef}
        onInlineNoteChange={setInlineNote}
        onAddNote={() => void handleAddNote(inlineNote)}
        addingNote={addingNote}
      />

      {showActionBar ? (
        <div style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button
              type="button"
              style={secondaryActionStyle}
              onClick={() => void markReviewed()}
            >
              Mark Reviewed
            </button>
            <button
              type="button"
              style={secondaryActionStyle}
              onClick={() => noteInputRef.current?.focus()}
            >
              Add Internal Note
            </button>
            <button
              type="button"
              style={secondaryActionStyle}
              onClick={() => setActiveModal("schedule")}
            >
              Schedule Interview
            </button>
            <button
              type="button"
              style={secondaryActionStyle}
              onClick={() => setActiveModal("send_update")}
            >
              Send Update
            </button>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #2a2a2a",
            }}
          >
            <button
              type="button"
              style={acceptDecisionStyle}
              onClick={() => setActiveModal("accept")}
            >
              Send Offer
            </button>
            <button
              type="button"
              style={rejectDecisionStyle}
              onClick={() => setActiveModal("reject")}
            >
              Reject Candidate
            </button>
          </div>
        </div>
      ) : null}

      {activeModal === "schedule" ? (
        <ScheduleInterviewModal
          applicantName={applicantName}
          submitting={submitting}
          onClose={() => setActiveModal(null)}
          onSubmit={async (payload) => {
            setSubmitting(true);

            const { error } = await supabase
              .from("hiring_applications")
              .update({
                sub_status: "interview_invite_sent",
                interview_type: payload.interviewType,
                interview_times: payload.interviewTimes,
                meeting_location: payload.meetingLocation || null,
                meeting_link: payload.meetingLink || null,
              })
              .eq("id", application.id);

            if (error) {
              console.error("Failed to schedule interview:", error.message);
              setSubmitting(false);
              return;
            }

            const timesText =
              payload.mode === "ask_availability"
                ? "Please share your availability for an interview."
                : payload.interviewTimes.length > 0
                  ? `Proposed times: ${payload.interviewTimes.join(", ")}`
                  : "Interview times will be shared soon.";

            const inboxMessage = [
              payload.message?.trim(),
              timesText,
              payload.meetingLocation ? `Location: ${payload.meetingLocation}` : null,
              payload.meetingLink ? `Link: ${payload.meetingLink}` : null,
            ]
              .filter(Boolean)
              .join("\n\n");

            await createInboxMessage(supabase, {
              recipientId: application.applicantId,
              senderId: userId,
              type: "interview_invite",
              title: `Interview invite — ${positionTitle}`,
              message: inboxMessage || `You have been invited to interview for ${positionTitle} at ${clubName}.`,
              actionRequired: true,
              actionType: "select_interview_time",
              actionData: {
                applicationId: application.id,
                listingId: application.listingId,
                mode: payload.mode,
                interviewTimes: payload.interviewTimes,
                path: `/app/clubs/${clubId}/recruiting`,
              },
              clubId,
              referenceId: application.id,
              referenceType: "hiring_application",
            });

            await notifyHiringManagerBells(supabase, {
              clubId,
              listingId: positionId,
              referenceId: application.id,
              message: `Interview invite sent to ${applicantName} for ${positionTitle}.`,
              excludeUserIds: [userId],
            });

            onApplicationUpdated({
              subStatus: "interview_invite_sent",
              interviewType: payload.interviewType,
              interviewTimes: payload.interviewTimes,
              meetingLocation: payload.meetingLocation,
              meetingLink: payload.meetingLink,
            });
            onStatusChanged();
            setSubmitting(false);
            setActiveModal(null);
          }}
        />
      ) : null}

      {activeModal === "send_update" ? (
        <SendUpdateModal
          applicantName={applicantName}
          positionTitle={positionTitle}
          submitting={submitting}
          onClose={() => setActiveModal(null)}
          onSubmit={async (message) => {
            setSubmitting(true);

            await createInboxMessage(supabase, {
              recipientId: application.applicantId,
              senderId: userId,
              type: "application_update",
              title: `Application update — ${positionTitle}`,
              message,
              clubId,
              referenceId: application.id,
              referenceType: "hiring_application",
              actionData: { path: `/app/clubs/${clubId}/recruiting` },
            });

            setSubmitting(false);
            setActiveModal(null);
          }}
        />
      ) : null}

      {activeModal === "accept" ? (
        <SendOfferModal
          positionTitle={positionTitle}
          submitting={submitting}
          onClose={() => setActiveModal(null)}
          onSubmit={async (payload) => {
            setSubmitting(true);

            const { error } = await supabase
              .from("hiring_applications")
              .update({
                sub_status: "offer_sent",
                offered_access_level: payload.accessLevel,
                offered_role_title: payload.roleTitle,
                position_handling: payload.positionHandling,
              })
              .eq("id", application.id);

            if (error) {
              console.error("Failed to send offer:", error.message);
              setSubmitting(false);
              return;
            }

            if (payload.positionHandling === "close_now") {
              await supabase
                .from("hiring_listings")
                .update({ is_open: false })
                .eq("id", positionId);
            }

            const offerMessage = [
              payload.message?.trim() ||
                `Congratulations! ${clubName} would like to offer you the ${payload.roleTitle} role.`,
              `Access level: ${ACCESS_LEVEL_OPTIONS.find((o) => o.value === payload.accessLevel)?.label ?? payload.accessLevel}`,
            ].join("\n\n");

            await createInboxMessage(supabase, {
              recipientId: application.applicantId,
              senderId: userId,
              type: "role_offer",
              title: `Role offer — ${payload.roleTitle}`,
              message: offerMessage,
              actionRequired: true,
              actionType: "offer_response",
              actionData: {
                applicationId: application.id,
                accessLevel: payload.accessLevel,
                roleTitle: payload.roleTitle,
                path: `/app/clubs/${clubId}/recruiting`,
              },
              clubId,
              referenceId: application.id,
              referenceType: "hiring_application",
            });

            await notifyHiringManagerBells(supabase, {
              clubId,
              listingId: positionId,
              referenceId: application.id,
              message: `Role offer sent to ${applicantName} for ${payload.roleTitle}.`,
              excludeUserIds: [userId],
            });

            onApplicationUpdated({
              subStatus: "offer_sent",
              offeredAccessLevel: payload.accessLevel,
              offeredRoleTitle: payload.roleTitle,
              positionHandling: payload.positionHandling,
            });
            onStatusChanged();
            setSubmitting(false);
            setActiveModal(null);
          }}
        />
      ) : null}

      {activeModal === "reject" ? (
        <RejectCandidateModal
          submitting={submitting}
          onClose={() => setActiveModal(null)}
          onSubmit={async (message) => {
            setSubmitting(true);

            const { error } = await supabase
              .from("hiring_applications")
              .update({ sub_status: "rejected", status: "rejected" })
              .eq("id", application.id);

            if (error) {
              console.error("Failed to reject application:", error.message);
              setSubmitting(false);
              return;
            }

            await createInboxMessage(supabase, {
              recipientId: application.applicantId,
              senderId: userId,
              type: "application_update",
              title: `Application update — ${positionTitle}`,
              message,
              clubId,
              referenceId: application.id,
              referenceType: "hiring_application",
              actionData: { path: `/explore` },
            });

            await notifyHiringManagerBells(supabase, {
              clubId,
              listingId: positionId,
              referenceId: application.id,
              message: `${applicantName}'s application for ${positionTitle} was rejected.`,
              excludeUserIds: [userId, application.applicantId],
            });

            onApplicationUpdated({ subStatus: "rejected", status: "rejected" });
            onStatusChanged();
            setSubmitting(false);
            setActiveModal(null);
          }}
        />
      ) : null}
    </>
  );
}

function InternalNotesSection({
  notes,
  loading,
  inlineNote,
  noteInputRef,
  onInlineNoteChange,
  onAddNote,
  addingNote,
}: {
  notes: ApplicationNoteRow[];
  loading: boolean;
  inlineNote: string;
  noteInputRef: RefObject<HTMLTextAreaElement | null>;
  onInlineNoteChange: (value: string) => void;
  onAddNote: () => void;
  addingNote: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px",
        background: "#111111",
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
      }}
    >
      <p
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 10px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Internal Notes — visible to executives only.
      </p>

      {loading ? (
        <p style={{ fontSize: "12px", color: "#555555", margin: 0 }}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 12px" }}>
          No internal notes yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
          {notes.map((note) => (
            <div
              key={note.id}
              style={{
                background: "#111111",
                border: "1px solid #242424",
                borderRadius: "8px",
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#ffffff", fontWeight: 600 }}>
                  {note.authorName}
                  {note.authorRoleTitle ? (
                    <span style={{ color: "#777777", fontWeight: 500 }}>
                      {" "}
                      · {note.authorRoleTitle}
                    </span>
                  ) : null}
                </p>
                <span style={{ fontSize: "11px", color: "#555555", flexShrink: 0 }}>
                  {formatRelativeTime(note.createdAt)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#999999", lineHeight: 1.5 }}>
                {note.note}
              </p>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={noteInputRef}
        value={inlineNote}
        onChange={(e) => onInlineNoteChange(e.target.value)}
        placeholder="Add an internal note visible only to executives…"
        rows={3}
        style={{
          ...darkInputStyle,
          width: "100%",
          resize: "vertical",
          marginBottom: "8px",
        }}
      />
      <button
        type="button"
        onClick={onAddNote}
        disabled={addingNote || !inlineNote.trim()}
        style={{
          ...actionButtonStyle,
          opacity: addingNote || !inlineNote.trim() ? 0.6 : 1,
        }}
      >
        {addingNote ? "Saving…" : "Add Note"}
      </button>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div role="dialog" aria-modal="true" style={modalOverlayStyle} onClick={onClose}>
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function ScheduleInterviewModal({
  applicantName,
  submitting,
  onClose,
  onSubmit,
}: {
  applicantName: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    mode: "ask_availability" | "specific_times";
    interviewType: InterviewType;
    interviewTimes: string[];
    message: string;
    meetingLocation: string;
    meetingLink: string;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"ask_availability" | "specific_times">("specific_times");
  const [interviewType, setInterviewType] = useState<InterviewType>("online");
  const [timeSlots, setTimeSlots] = useState(["", "", ""]);
  const [message, setMessage] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  return (
    <ModalShell title={`Schedule Interview — ${applicantName}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "8px" }}>
        Interview type
      </label>
      <select
        value={interviewType}
        onChange={(e) => setInterviewType(e.target.value as InterviewType)}
        style={{ ...darkInputStyle, width: "100%" }}
      >
        <option value="online">Online</option>
        <option value="in_person">In Person</option>
      </select>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={() => setMode("ask_availability")}
          style={{
            ...actionButtonStyle,
            flex: 1,
            background: mode === "ask_availability" ? "#E51937" : "#111111",
            borderColor: mode === "ask_availability" ? "#E51937" : "#2a2a2a",
            color: mode === "ask_availability" ? "#ffffff" : "#cccccc",
          }}
        >
          Ask for availability
        </button>
        <button
          type="button"
          onClick={() => setMode("specific_times")}
          style={{
            ...actionButtonStyle,
            flex: 1,
            background: mode === "specific_times" ? "#E51937" : "#111111",
            borderColor: mode === "specific_times" ? "#E51937" : "#2a2a2a",
            color: mode === "specific_times" ? "#ffffff" : "#cccccc",
          }}
        >
          Send specific times
        </button>
      </div>

      {mode === "specific_times" ? (
        <div>
          {[0, 1, 2].map((index) => (
            <input
              key={index}
              type="text"
              value={timeSlots[index]}
              onChange={(e) => {
                const next = [...timeSlots];
                next[index] = e.target.value;
                setTimeSlots(next);
              }}
              placeholder={`Option ${index + 1}: Date and time`}
              style={{
                ...darkInputStyle,
                width: "100%",
                marginBottom: index < 2 ? "8px" : 0,
              }}
            />
          ))}
        </div>
      ) : null}

      <div>
      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "8px" }}>
        Optional message
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        style={{ ...darkInputStyle, width: "100%", resize: "vertical" }}
      />
      </div>

      {interviewType === "in_person" ? (
        <div>
          <label
            style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "8px" }}
          >
            Location
          </label>
          <input
            type="text"
            value={meetingLocation}
            onChange={(e) => setMeetingLocation(e.target.value)}
            placeholder="University Centre Room 103"
            style={{ ...darkInputStyle, width: "100%" }}
          />
        </div>
      ) : null}

      {interviewType === "online" ? (
        <div>
          <label
            style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "8px" }}
          >
            Meeting Link
          </label>
          <input
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="Paste Teams, Zoom, Google Meet, or other meeting link"
            style={{ ...darkInputStyle, width: "100%" }}
          />
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
        <button type="button" style={actionButtonStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          style={primaryActionStyle}
          onClick={() =>
            void onSubmit({
              mode,
              interviewType,
              interviewTimes: timeSlots.map((slot) => slot.trim()).filter(Boolean),
              message,
              meetingLocation: meetingLocation.trim(),
              meetingLink: meetingLink.trim(),
            })
          }
        >
          {submitting ? "Sending…" : "Send Interview Invite"}
        </button>
      </div>
      </div>
    </ModalShell>
  );
}

function SendUpdateModal({
  applicantName,
  positionTitle,
  submitting,
  onClose,
  onSubmit,
}: {
  applicantName: string;
  positionTitle: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    SEND_UPDATE_TEMPLATES[0].id,
  );
  const [message, setMessage] = useState<string>(SEND_UPDATE_TEMPLATES[0].message);

  return (
    <ModalShell title={`Send Update — ${applicantName}`} onClose={onClose}>
      <p style={{ fontSize: "12px", color: "#777777", margin: "0 0 12px" }}>
        {positionTitle}
      </p>

      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Template
      </label>
      <select
        value={selectedTemplate}
        onChange={(e) => {
          const template = SEND_UPDATE_TEMPLATES.find((item) => item.id === e.target.value);
          if (template) {
            setSelectedTemplate(template.id);
            setMessage(template.message);
          }
        }}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "14px" }}
      >
        {SEND_UPDATE_TEMPLATES.map((template) => (
          <option key={template.id} value={template.id}>
            {template.label}
          </option>
        ))}
      </select>

      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Message
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "16px", resize: "vertical" }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <button type="button" style={actionButtonStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting || !message.trim()}
          style={primaryActionStyle}
          onClick={() => void onSubmit(message.trim())}
        >
          {submitting ? "Sending…" : "Send Update"}
        </button>
      </div>
    </ModalShell>
  );
}

function SendOfferModal({
  positionTitle,
  submitting,
  onClose,
  onSubmit,
}: {
  positionTitle: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    accessLevel: string;
    roleTitle: string;
    positionHandling: PositionHandling;
    message: string;
  }) => Promise<void>;
}) {
  const [accessLevel, setAccessLevel] = useState("executive");
  const [roleTitle, setRoleTitle] = useState(positionTitle);
  const [positionHandling, setPositionHandling] =
    useState<PositionHandling>("keep_open");
  const [message, setMessage] = useState("");

  return (
    <ModalShell title="Send Offer" onClose={onClose}>
      <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#888888", lineHeight: 1.5 }}>
        The candidate will receive a role offer they can accept or decline. Membership is
        not added until they accept.
      </p>
      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Access level
      </label>
      <select
        value={accessLevel}
        onChange={(e) => setAccessLevel(e.target.value)}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "14px" }}
      >
        {ACCESS_LEVEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Role title
      </label>
      <input
        type="text"
        value={roleTitle}
        onChange={(e) => setRoleTitle(e.target.value)}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "14px" }}
      />

      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Position handling
      </label>
      <select
        value={positionHandling}
        onChange={(e) => setPositionHandling(e.target.value as PositionHandling)}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "14px" }}
      >
        {POSITION_HANDLING_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Optional offer message
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "16px", resize: "vertical" }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <button type="button" style={actionButtonStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting || !roleTitle.trim()}
          style={primaryActionStyle}
          onClick={() =>
            void onSubmit({
              accessLevel,
              roleTitle: roleTitle.trim(),
              positionHandling,
              message: message.trim(),
            })
          }
        >
          {submitting ? "Sending…" : "Send Offer"}
        </button>
      </div>
    </ModalShell>
  );
}

function RejectCandidateModal({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    REJECT_TEMPLATES[0].id,
  );
  const [message, setMessage] = useState<string>(REJECT_TEMPLATES[0].message);

  return (
    <ModalShell title="Reject Candidate" onClose={onClose}>
      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Template
      </label>
      <select
        value={selectedTemplate}
        onChange={(e) => {
          const template = REJECT_TEMPLATES.find((item) => item.id === e.target.value);
          if (template) {
            setSelectedTemplate(template.id);
            setMessage(template.message);
          }
        }}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "14px" }}
      >
        {REJECT_TEMPLATES.map((template) => (
          <option key={template.id} value={template.id}>
            {template.label}
          </option>
        ))}
      </select>

      <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
        Rejection message
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        style={{ ...darkInputStyle, width: "100%", marginBottom: "16px", resize: "vertical" }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <button type="button" style={actionButtonStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting || !message.trim()}
          style={{ ...actionButtonStyle, color: "#E51937", borderColor: "#E51937" }}
          onClick={() => void onSubmit(message.trim())}
        >
          {submitting ? "Rejecting…" : "Reject Candidate"}
        </button>
      </div>
    </ModalShell>
  );
}
