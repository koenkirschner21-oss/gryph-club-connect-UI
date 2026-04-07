import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import FormInput from "../../components/ui/FormInput";

export default function JoinClubPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Please enter a join code");
      return;
    }

    setLoading(true);

    try {
      // When Supabase is wired, this will query clubs by join_code and
      // insert into club_members. For now, show a placeholder flow.
      setError(
        "Club not found with that code. Please check and try again.",
      );
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
