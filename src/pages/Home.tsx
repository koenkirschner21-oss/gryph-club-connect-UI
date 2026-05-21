import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import { useClubContext } from "../context/useClubContext";
import ClubCard from "../components/ui/ClubCard";
import HeroMockup from "../components/ui/HeroMockup";
import BrandLogo from "../components/ui/BrandLogo";
import UpcomingEventsSection from "../components/ui/UpcomingEventsSection";
import Spinner from "../components/ui/Spinner";

export default function Home() {
  const { clubs, savedClubs, loading } = useClubContext();
  const featuredClubs = clubs.slice(0, 3);
  const savedClubList = clubs.filter((c) => savedClubs.includes(c.id));

  return (
    <>
      {/* Hero Section */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1a0505 0%, #2d0808 60%, #1a0505 100%)",
        }}
      >
        <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8">
          <div className="flex items-center gap-12 lg:gap-16">
            {/* Left: text content */}
            <div className="max-w-3xl flex-1">
              {/* Brand lockup */}
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <BrandLogo variant="hero" />
                <span
                  style={{
                    color: "#E51937",
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  University of Guelph
                </span>
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.05]">
                <span className="text-white/60">Discover Your</span>{" "}
                <span className="text-secondary">Community</span>{" "}
                <span className="text-white/60">at Guelph</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
                Browse 200+ student clubs, find your passion, and connect with
                like-minded Gryphons. Your university experience starts here.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/explore"
                  style={{
                    display: "inline-block",
                    backgroundColor: "#E51937",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "12px 28px",
                    fontWeight: 600,
                    fontSize: "15px",
                    textDecoration: "none",
                  }}
                >
                  Explore Clubs
                </Link>
              </div>
            </div>

            <div className="hidden w-[520px] max-w-[42vw] shrink-0 lg:block">
              <HeroMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{ backgroundColor: "#0f0f0f" }}>
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: "200+", label: "Active Clubs" },
            { value: "5,000+", label: "Student Members" },
            { value: "50+", label: "Categories" },
            { value: "100+", label: "Events Monthly" },
          ].map((stat, index) => (
            <div key={stat.label} className="text-center">
              <p
                className="text-4xl font-extrabold"
                style={{ color: index % 2 === 0 ? "#E51937" : "#FFC429" }}
              >
                {stat.value}
              </p>
              <p
                className="mt-2 text-sm font-medium"
                style={{ color: "#747676" }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Clubs */}
      <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-white">Featured Clubs</h2>
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

      <div
        style={{
          paddingTop: 60,
          paddingBottom: 60,
          maxWidth: 1100,
          margin: "0 auto",
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        <UpcomingEventsSection />
      </div>

      {/* Saved Clubs */}
      {savedClubList.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold text-white">Your Saved Clubs</h2>
            <p className="mt-3 text-muted">
              Clubs you&apos;ve bookmarked for later
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedClubList.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
          {savedClubList.length < 3 && (
            <p className="text-center" style={{ marginTop: 16 }}>
              <Link
                to="/explore"
                style={{
                  color: "#E51937",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Explore 200+ clubs →
              </Link>
            </p>
          )}
        </section>
      )}

      {/* CTA Section */}
      <section
        style={{
          background:
            "linear-gradient(135deg, #1a0505 0%, #2d0808 60%, #1a0505 100%)",
          borderTop: "1px solid #3a1010",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2
            style={{
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "30px",
              margin: 0,
            }}
          >
            Ready to Get Involved?
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl"
            style={{ color: "#cccccc", lineHeight: 1.6 }}
          >
            Whether you&apos;re looking to build skills, make friends, or pursue
            a passion, there&apos;s a club for you at Guelph.
          </p>
          <div className="mt-8">
            <Link
              to="/explore"
              className="inline-block rounded-md bg-secondary px-8 py-3.5 text-[15px] font-semibold text-page-bg no-underline transition-colors hover:bg-secondary-dark"
            >
              Find Your Club
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
