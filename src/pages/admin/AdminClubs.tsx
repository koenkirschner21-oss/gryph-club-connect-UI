import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

interface AdminClubRow {
  id: string;
  name: string;
  is_public: boolean;
}

export default function AdminClubs() {
  const [clubs, setClubs] = useState<AdminClubRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("clubs")
      .select("id,name,is_public")
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(loadError.message);
          return;
        }
        setClubs((data ?? []) as AdminClubRow[]);
      });
  }, []);

  async function togglePublic(clubId: string, isPublic: boolean) {
    const { error: updateError } = await supabase
      .from("clubs")
      .update({ is_public: !isPublic })
      .eq("id", clubId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setClubs((prev) => prev.map((c) => (c.id === clubId ? { ...c, is_public: !isPublic } : c)));
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-white">Admin Clubs</h1>
      {error && <p className="mb-4 text-sm text-primary">{error}</p>}
      <div className="space-y-3">
        {clubs.map((club) => (
          <Card key={club.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-white">{club.name}</p>
              <p className="text-xs text-muted">{club.is_public ? "Public" : "Hidden"}</p>
            </div>
            <Button onClick={() => togglePublic(club.id, club.is_public)}>
              {club.is_public ? "Suspend Visibility" : "Reactivate"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
