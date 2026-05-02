import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../components/ui/Card";

interface DashboardStats {
  clubs: number;
  users: number;
  openReports: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({ clubs: 0, users: 0, openReports: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("clubs").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]).then(([clubsRes, usersRes, reportsRes]) => {
      if (clubsRes.error || usersRes.error || reportsRes.error) {
        setError(clubsRes.error?.message ?? usersRes.error?.message ?? reportsRes.error?.message ?? "Failed to load admin stats.");
        return;
      }
      setStats({
        clubs: clubsRes.count ?? 0,
        users: usersRes.count ?? 0,
        openReports: reportsRes.count ?? 0,
      });
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-white">Platform Admin Dashboard</h1>
      {error && <p className="mb-4 text-sm text-primary">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4"><p className="text-muted">Total Clubs</p><p className="text-2xl font-bold text-white">{stats.clubs}</p></Card>
        <Card className="p-4"><p className="text-muted">Total Users</p><p className="text-2xl font-bold text-white">{stats.users}</p></Card>
        <Card className="p-4"><p className="text-muted">Open Reports</p><p className="text-2xl font-bold text-white">{stats.openReports}</p></Card>
      </div>
    </div>
  );
}
