import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../components/ui/Card";

interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id,email,full_name")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(loadError.message);
          return;
        }
        setUsers((data ?? []) as AdminUserRow[]);
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-white">Admin Users</h1>
      {error && <p className="mb-4 text-sm text-primary">{error}</p>}
      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="p-4">
            <p className="font-semibold text-white">{user.full_name ?? "Unnamed user"}</p>
            <p className="text-xs text-muted">{user.email ?? "No email found"}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
