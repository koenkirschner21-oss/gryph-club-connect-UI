import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUserInterests } from "../../hooks/useUserInterests";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import ClubCard from "../../components/ui/ClubCard";
import { useActivityFeed, type ActivityItem } from "../../hooks/useActivityFeed";

export default function DashboardPage() {
  const { user } = useAuthContext();
  const { clubs, joinedClubs, loading } = useClubContext();
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  // Check whether the user's profile is missing program or avatar_url
  useEffect(() => {
    if (!user) return;

    async function checkProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("program, avatar_url")
        .eq("id", user!.id)
        .single();

      if (!data || !data.program?.trim() || !data.avatar_url?.trim()) {
        setProfileIncomplete(true);
      }
    }

    checkProfile();
  }, [user]);

  const myClubs = clubs.filter((c) => joinedClubs.includes(c.id));
  const { items: activityItems, loading: activityLoading } =
    useActivityFeed(joinedClubs);
  const { interests } = useUserInterests();

  // Recommend clubs matching user interests that they haven't joined
  const recommendedClubs = useMemo(() => {
    if (interests.length === 0) return [];
    return clubs
      .filter(
        (c) =>
          interests.includes(c.category) && !joinedClubs.includes(c.id),
      )
      .slice(0, 6);
  }, [clubs, interests, joinedClubs]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading dashboard…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="mt-1 text-muted">
          Manage your clubs and stay connected with your communities.
        </p>
      </div>

      {/* Gentle prompt to complete profile */}
      {profileIncomplete && (
        <div className="mb-8 rounded-xl border border-secondary/30 bg-secondary/5 px-5 py-4">
          <p className="text-sm text-secondary">
            👋 Your profile is almost ready! Add your program and a profile
            picture to help others find and connect with you.
          </p>
          <Link
            to="/app/profile"
            className="mt-2 inline-block text-sm font-medium text-secondary hover:text-secondary-dark"
          >
            Complete your profile →
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-10 flex flex-wrap gap-4">
        <Link to="/app/create-club">
          <Button>Create a Club</Button>
        </Link>
        <Link to="/app/join-club">
          <Button variant="outline">Join with Code</Button>
        </Link>
        <Link to="/explore">
          <Button variant="ghost">Explore Clubs</Button>
        </Link>
        <Link to="/app/profile">
          <Button variant="ghost">Edit Profile</Button>
        </Link>
      </div>

      {/* My Clubs */}
      <h2 className="mb-4 text-xl font-bold text-white">My Clubs</h2>

      {myClubs.length === 0 ? (
        <Card className="p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <p className="mt-4 text-lg font-medium text-white">
            You haven&apos;t joined any clubs yet
          </p>
          <p className="mt-2 text-sm text-muted">
            Create a new club, join one with a code, or browse available clubs.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link to="/app/create-club">
              <Button size="sm">Create Club</Button>
            </Link>
            <Link to="/explore">
              <Button size="sm" variant="outline">
                Explore
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myClubs.map((club) => (
            <Link key={club.id} to={`/app/clubs/${club.id}`}>
              <Card className="p-5 transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <img
                    src={club.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-lg bg-surface-alt object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-white">
                      {club.name}
                    </h3>
                    <p className="text-xs text-muted">{club.category}</p>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted">
                  {club.description}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  <span>{club.memberCount} members</span>
                  <span>·</span>
                  <span>{club.meetingSchedule}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Recommended Clubs */}
      {recommendedClubs.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-white">
            Recommended for You
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedClubs.map((club) => (
              <ClubCard key={club.id} club={club} variant="compact" />
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {joinedClubs.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-white">
            Recent Activity
          </h2>

          {activityLoading ? (
            <div className="flex justify-center py-8">
              <Spinner label="Loading activity…" />
            </div>
          ) : activityItems.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted">
                No recent activity from your clubs yet.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activityItems.map((item) => (
                <ActivityRow key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Row
// ---------------------------------------------------------------------------

const ACTIVITY_ICONS: Record<string, string> = {
  post: "📢",
  event: "📅",
};

const ACTIVITY_LABELS: Record<string, string> = {
  post: "Announcement",
  event: "Event",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <Link to={`/app/clubs/${item.clubId}`}>
      <Card className="flex items-start gap-3 p-4 transition-shadow hover:shadow-md">
        <span className="mt-0.5 text-lg leading-none">
          {ACTIVITY_ICONS[item.type] ?? "🔔"}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-white">{item.clubName}</span>
            <span>·</span>
            <span>{ACTIVITY_LABELS[item.type] ?? item.type}</span>
            <span>·</span>
            <span>{timeAgo(item.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-white">{item.title}</p>
          {item.preview && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted">
              {item.preview}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}