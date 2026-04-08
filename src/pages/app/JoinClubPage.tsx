import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

export default function JoinClubPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { clubs, joinClub, isJoined, isPending } = useClubContext();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!code.trim()) {
      setError("Please enter a join code");
      return;
    }

    if (!user) {
      setError("You must be logged in to join a club.");
      return;
    }

    setLoading(true);

    try {
      // Find club by join code (case-insensitive match)
      const club = clubs.find(
        (c) => c.joinCode?.toUpperCase() === code.trim().toUpperCase(),
      );

      if (!club) {
        setError(
          "Club not found with that code. Please check and try again.",
        );
        setLoading(false);
        return;
      }

      // Check if already a member
      if (isJoined(club.id)) {
        setError("You are already a member of this club.");
        setLoading(false);
        return;
      }

      // Check if already pending
      if (isPending(club.id)) {
        setError("You already have a pending request for this club.");
        setLoading(false);
        return;
      }

      await joinClub(club.id);

      if (club.requiresApproval) {
        setSuccess(
          `Request sent to join "${club.name}". An admin will review your request.`,
        );
      } else {
        setSuccess(`You have joined "${club.name}"!`);
        // Navigate to the club workspace after a short delay
        setTimeout(() => navigate(`/app/clubs/${club.id}`), 1500);
      }
    } catch {
      setError("Something went wrong. Please try again.");
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

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400"
          >
            {success}
          </div>
        )}

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
