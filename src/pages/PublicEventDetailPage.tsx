import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useWindowWidth";
import Spinner from "../components/ui/Spinner";
import PublicDetailBackButton from "../components/public/PublicDetailBackButton";

interface EventDetail {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  clubId: string;
  clubName: string;
  clubSlug: string;
  clubLogoUrl: string | null;
}

function formatEventDateTime(date: string, time: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const datePart = Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  const timePart = time && time !== "TBD" ? time : null;
  return timePart ? `${datePart} at ${timePart}` : datePart;
}

export default function PublicEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [hasRsvp, setHasRsvp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      const { data: row, error } = await supabase
        .from("events")
        .select(`
          id,
          club_id,
          title,
          description,
          date,
          time,
          location,
          visibility,
          clubs:club_id (
            name,
            logo_url,
            slug
          )
        `)
        .eq("id", eventId)
        .in("visibility", ["public"])
        .maybeSingle();

      if (cancelled) return;

      if (error || !row) {
        setNotFound(true);
        setEvent(null);
        setLoading(false);
        return;
      }

      const clubRaw = row.clubs as unknown;
      const club = (
        Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
      ) as Record<string, unknown>;

      setEvent({
        id: row.id as string,
        title: (row.title as string) ?? "",
        description: (row.description as string) ?? "",
        date: (row.date as string) ?? "",
        time: (row.time as string) ?? "",
        location: (row.location as string) ?? "",
        clubId: row.club_id as string,
        clubName: (club.name as string) ?? "Club",
        clubSlug: (club.slug as string) ?? "",
        clubLogoUrl: (club.logo_url as string) ?? null,
      });

      const { data: questions } = await supabase
        .from("event_form_questions")
        .select("id")
        .eq("event_id", eventId)
        .limit(1);

      if (!cancelled) {
        setHasRsvp((questions?.length ?? 0) > 0);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function handleRsvp() {
    if (!eventId) return;
    const target = `/events/${eventId}/rsvp`;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }
    navigate(target);
  }

  const pad = isMobile ? "16px" : "48px";

  if (loading) {
    return (
      <div
        style={{
          background: "#0f0f0f",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner label="Loading event…" />
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div style={{ background: "#0f0f0f", minHeight: "100vh", padding: pad }}>
        <PublicDetailBackButton />
        <h1
          style={{
            color: "#ffffff",
            fontSize: "24px",
            fontWeight: 700,
            marginTop: "32px",
          }}
        >
          Event not found
        </h1>
        <p style={{ color: "#555555", fontSize: "15px" }}>
          This event may be private or no longer available.
        </p>
      </div>
    );
  }

  const location = event.location?.trim();
  const locationLabel =
    location && location !== "TBD" ? location : "Location TBD";

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ padding: `${isMobile ? 24 : 40}px ${pad} 0` }}>
        <PublicDetailBackButton />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "28px",
          }}
        >
          {event.clubLogoUrl ? (
            <img
              src={event.clubLogoUrl}
              alt=""
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#242424",
                color: "#777",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {event.clubName.charAt(0)}
            </div>
          )}
          {event.clubSlug ? (
            <Link
              to={`/clubs/${event.clubSlug}`}
              style={{
                fontSize: "14px",
                color: "#E51937",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              {event.clubName}
            </Link>
          ) : (
            <span style={{ fontSize: "14px", color: "#777777" }}>
              {event.clubName}
            </span>
          )}
        </div>

        <h1
          style={{
            fontSize: isMobile ? "28px" : "36px",
            fontWeight: 800,
            color: "#ffffff",
            margin: "16px 0 12px",
            lineHeight: 1.2,
          }}
        >
          {event.title}
        </h1>

        <p style={{ fontSize: "15px", color: "#555555", margin: "0 0 8px" }}>
          {formatEventDateTime(event.date, event.time)}
        </p>
        <p style={{ fontSize: "15px", color: "#555555", margin: 0 }}>
          {locationLabel}
        </p>

        {event.description?.trim() ? (
          <div
            style={{
              marginTop: "32px",
              padding: "24px",
              background: "#1a1a1a",
              border: "1px solid #242424",
              borderRadius: "12px",
            }}
          >
            <h2
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#777777",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 12px",
              }}
            >
              About this event
            </h2>
            <p
              style={{
                fontSize: "15px",
                color: "#cccccc",
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {event.description}
            </p>
          </div>
        ) : null}

        {hasRsvp ? (
          <button
            type="button"
            onClick={handleRsvp}
            style={{
              marginTop: "32px",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "12px 28px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            RSVP for this Event
          </button>
        ) : null}
      </div>
    </div>
  );
}
