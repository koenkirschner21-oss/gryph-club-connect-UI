import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  membershipRequiresApproval,
  normalizeMembershipType,
  parseJoinQuestions,
} from "../../lib/clubJoinUtils";
import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import { showToast } from "../../components/ui/Toast";
import JoinRequestForm from "../../components/club/JoinRequestForm";
import type { JoinQuestion, MembershipType } from "../../types";

type LookupClub = {
  id: string;
  name: string;
  membershipType: MembershipType;
  joinQuestions: JoinQuestion[];
  allowJoinFileUpload: boolean;
};

export default function JoinClubPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { joinClub, isJoined, isPending } = useClubContext();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupClub, setLookupClub] = useState<LookupClub | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      showToast("Please enter a join code", "error");
      return;
    }

    if (!user) {
      showToast("You must be logged in to join a club.", "error");
      return;
    }

    setLoading(true);

    try {
      const { data: clubRow, error: lookupErr } = await supabase
        .from("clubs")
        .select("*")
        .eq("join_code", code.trim().toUpperCase())
        .maybeSingle();

      if (lookupErr) {
        showToast("Something went wrong looking up the code. Please try again.", "error");
        setLoading(false);
        return;
      }

      if (!clubRow) {
        showToast(
          "Club not found with that code. Please check and try again.",
          "error",
        );
        setLoading(false);
        return;
      }

      const clubId = clubRow.id as string;
      const clubName = clubRow.name as string;
      const membershipType = normalizeMembershipType(clubRow.membership_type);

      if (membershipType === "no_membership") {
        showToast("This club does not accept general members.", "error");
        setLoading(false);
        return;
      }

      if (isJoined(clubId)) {
        showToast("You are already a member of this club.", "error");
        setLoading(false);
        return;
      }

      if (isPending(clubId)) {
        setLookupClub({
          id: clubId,
          name: clubName,
          membershipType,
          joinQuestions: parseJoinQuestions(clubRow.join_questions),
          allowJoinFileUpload: Boolean(clubRow.allow_join_file_upload),
        });
        setLoading(false);
        return;
      }

      if (membershipRequiresApproval(membershipType)) {
        setLookupClub({
          id: clubId,
          name: clubName,
          membershipType,
          joinQuestions: parseJoinQuestions(clubRow.join_questions),
          allowJoinFileUpload: Boolean(clubRow.allow_join_file_upload),
        });
        setLoading(false);
        return;
      }

      const joined = await joinClub(clubId, { viaJoinCode: true });

      if (!joined) {
        showToast("Failed to join club. Please try again.", "error");
        return;
      }

      showToast(`You have joined "${clubName}"!`, "success");
      setTimeout(() => navigate(`/app/clubs/${clubId}`), 1500);
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitJoinRequest(payload: {
    answers: { id?: string; question: string; answer: string }[];
    message: string;
    attachmentUrl?: string | null;
  }) {
    if (!lookupClub) return;

    setSubmittingRequest(true);

    try {
      const answers = [...payload.answers];
      if (payload.attachmentUrl) {
        answers.push({
          question: "Attachment",
          answer: payload.attachmentUrl,
        });
      }

      const joined = await joinClub(lookupClub.id, {
        viaJoinCode: true,
        joinAnswers: answers,
        joinMessage: payload.message || null,
      });

      if (!joined) {
        showToast("Failed to submit request. Please try again.", "error");
        return;
      }

      showToast(
        `Request sent to join "${lookupClub.name}". An admin will review your request.`,
        "success",
      );
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setSubmittingRequest(false);
    }
  }

  const requestPending = lookupClub ? isPending(lookupClub.id) : false;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        {lookupClub ? (
          <>
            <h1 className="mb-2 text-center text-2xl font-bold text-white">
              Request to Join
            </h1>
            <p className="mb-6 text-center text-sm text-muted">
              Complete the form below to request membership in{" "}
              <span className="font-medium text-white">{lookupClub.name}</span>.
            </p>

            <JoinRequestForm
              questions={lookupClub.joinQuestions}
              allowFileUpload={lookupClub.allowJoinFileUpload}
              submitting={submittingRequest}
              pending={requestPending}
              onSubmit={(payload) => void handleSubmitJoinRequest(payload)}
            />

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLookupClub(null)}
                className="text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer"
              >
                Use a different join code
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-center text-2xl font-bold text-white">
              Join a Club
            </h1>
            <p className="mb-6 text-center text-sm text-muted">
              Enter the join code shared by your club&apos;s admin to access their
              workspace.
            </p>

            <form onSubmit={handleCodeSubmit} className="space-y-4" noValidate>
              <FormInput
                id="joinCode"
                label="Join Code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                autoComplete="off"
              />

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Looking up…" : "Continue"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate("/explore")}
                className="text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer"
              >
                Or browse clubs to discover
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
