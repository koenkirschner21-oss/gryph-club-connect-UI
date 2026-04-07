import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import { useClubContext } from "../context/useClubContext";
import ClubCard from "../components/ui/ClubCard";
import Spinner from "../components/ui/Spinner";

export default function Home() {
  const { clubs, savedClubs, loading } = useClubContext();
  const featuredClubs = clubs.slice(0, 3);
  const savedClubList = clubs.filter((c) => savedClubs.includes(c.id));

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-page-bg">
        <div className="hero-overlay absolute inset-0" aria-hidden="true" />
        <div className="hero-glow absolute inset-0" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-8"
          style={{
            backgroundImage:
              "url(/assets/placeholders/hero-placeholder.jpg)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8">
          <div className="max-w-3xl">
            {/* Brand lockup */}
            <div className="mb-6 flex items-center gap-3">
              <img
                src="/assets/gryphon-logo.svg"
                alt=""
                className="h-14 w-14"
                aria-hidden="true"
              />
              <span className="text-sm font-bold uppercase tracking-[0.15em] text-secondary">
                University of Guelph
              </span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.05]">
              Discover Your{" "}
              <span className="text-secondary">Community</span> at Guelph
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Browse 200+ student clubs, find your passion, and connect with
              like-minded Gryphons. Your university experience starts here.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/explore">
                <Button size="lg">Explore Clubs</Button>
              </Link>
              <Link to="/explore">
                <Button variant="outline" size="lg">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t border-b border-border bg-card shadow-elevated">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: "200+", label: "Active Clubs" },
            { value: "5,000+", label: "Student Members" },
            { value: "50+", label: "Categories" },
            { value: "100+", label: "Events Monthly" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl font-extrabold text-primary">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Clubs */}
      <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-white">Featured Clubs</h2>
          <p className="mt-3 text-muted">
            Check out some of the most popular clubs on campus
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner label="Loading clubs…" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredClubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}
        <div className="mt-10 text-center">
          <Link to="/explore">
            <Button variant="outline">View All Clubs</Button>
          </Link>
        </div>
      </section>

      {/* Saved Clubs */}
      {savedClubList.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-white">Your Saved Clubs</h2>
            <p className="mt-3 text-muted">
              Clubs you&apos;ve bookmarked for later
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedClubList.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">
            Ready to Get Involved?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">
            Whether you&apos;re looking to build skills, make friends, or pursue
            a passion, there&apos;s a club for you at Guelph.
          </p>
          <div className="mt-8">
            <Link to="/explore">
              <Button
                variant="secondary"
                size="lg"
              >
                Find Your Club
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
