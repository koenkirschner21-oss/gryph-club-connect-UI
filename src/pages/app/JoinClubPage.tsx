import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";
import { showToast } from "../../components/ui/Toast";

export default function JoinClubPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { joinClub, isJoined, isPending } = useClubContext();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
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
      // Look up the club directly in Supabase by join_code (server-side,
      // works even if the club hasn't been loaded into the local context yet).
      const { data: clubRow, error: lookupErr } = await supabase
        .from("clubs")
        .select("id, name, requires_approval")
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
      const requiresApproval = (clubRow.requires_approval as boolean) ?? false;

      // Check if already a member
      if (isJoined(clubId)) {
        showToast("You are already a member of this club.", "error");
        setLoading(false);
        return;
      }

      // Check if already pending
      if (isPending(clubId)) {
        showToast("You already have a pending request for this club.", "error");
        setLoading(false);
        return;
      }

      const joined = await joinClub(clubId);

      if (!joined) {
        showToast("Failed to join club. Please try again.", "error");
        return;
      }

      if (requiresApproval) {
        showToast(
          `Request sent to join "${clubName}". An admin will review your request.`,
          "success",
        );
      } else {
        showToast(`You have joined "${clubName}"!`, "success");
        // Navigate to the club workspace after a short delay
        setTimeout(() => navigate(`/app/clubs/${clubId}`), 1500);
      }
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Join a Club
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          Enter the join code shared by your club&apos;s admin to access their
          workspace.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            {loading ? "Joining…" : "Join Club"}
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
      </div>
    </div>
  );
}
