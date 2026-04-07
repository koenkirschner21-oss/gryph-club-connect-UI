import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClubContext } from "../../context/useClubContext";
import { useUserInterests } from "../../hooks/useUserInterests";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { categories, loading: clubsLoading } = useClubContext();
  const { saveInterests, loading: interestsLoading } = useUserInterests();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Filter out "All" from categories
  const availableCategories = categories.filter((c) => c !== "All");

  function toggleCategory(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function handleFinish() {
    setSaving(true);
    await saveInterests(selected);
    setSaving(false);
    navigate("/app");
  }

  function handleSkip() {
    navigate("/app");
  }

  if (clubsLoading || interestsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <span className="text-3xl">🎓</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">
          Welcome to ClubConnect!
        </h1>
        <p className="mt-3 text-muted">
          Select your interests so we can recommend clubs for you.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          What are you interested in?
        </h2>
        <p className="mb-5 text-sm text-muted">
          Choose one or more categories. You can change these later.
        </p>

        {availableCategories.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            No categories available yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableCategories.map((cat) => {
              const isSelected = selected.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : "border border-border bg-surface text-muted hover:bg-surface-alt hover:text-white"
                  }`}
                >
                  {isSelected && "✓ "}
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="cursor-pointer text-sm font-medium text-muted transition-colors hover:text-white"
          >
            Skip for now
          </button>
          <Button
            onClick={handleFinish}
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : selected.length > 0
                ? `Continue (${selected.length} selected)`
                : "Continue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
