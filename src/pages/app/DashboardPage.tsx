import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

export default function DashboardPage() {
  const { user } = useAuthContext();
  const { clubs, joinedClubs, loading } = useClubContext();

  const myClubs = clubs.filter((c) => joinedClubs.includes(c.id));

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
    </div>
  );
}
