import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { useClubContext } from "../context/useClubContext";
import { supabase } from "../lib/supabaseClient";
import { useIsMobile } from "../hooks/useWindowWidth";
import Spinner from "../components/ui/Spinner";
import PublicDetailBackButton from "../components/public/PublicDetailBackButton";
import {
  EventDetailBadges,
  EventDetailClubHeader,
  EventDetailDescription,
  EventDetailMeta,
  EventDetailMyRsvp,
  EventDetailPageShell,
  EventDetailPrimaryAction,
  EventDetailRsvpSummary,
  EventDetailTitle,
  EventDetailTwoColumn,
  type EventRsvpCounts,
} from "../components/events/EventDetailLayout";
import { normalizeVisibility } from "../lib/contentVisibility";
import { eventCategoryLabel } from "../lib/eventCategories";
import { eventRequiresRsvpQuestionnaire } from "../lib/eventRsvpActions";
import { getEventRsvpPath, getWorkspaceEventDetailPath } from "../lib/eventNavigation";
import type { RsvpStatus, Visibility } from "../types";

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
  clubAbbreviation?: string;
  visibility: Visibility;
  category: string;
}

const EMPTY_COUNTS: EventRsvpCounts = { going: 0, maybe: 0, not_going: 0 };

export default function PublicEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuthContext();
  const { isJoined } = useClubContext();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [myRsvpStatus, setMyRsvpStatus] = useState<RsvpStatus | null>(null);
  const [rsvpCounts, setRsvpCounts] = useState<EventRsvpCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);

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
          category,
          clubs:club_id (
            name,
            logo_url,
            slug,
            abbreviation
          )
        `)
        .eq("id", eventId)
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
      const clubId = row.club_id as string;
      const visibility = normalizeVisibility(row.visibility as string | null, "public");
      const isClubMember = isJoined(clubId);

      if (visibility !== "public" && !isClubMember) {
        setNotFound(true);
        setEvent(null);
        setLoading(false);
        return;
      }

      if (eventId && isClubMember) {
        navigate(getWorkspaceEventDetailPath(clubId, eventId), { replace: true });
        return;
      }

      const { data: rsvpRows } = await supabase
        .from("event_rsvps")
        .select("status")
        .eq("event_id", eventId);

      if (cancelled) return;

      const counts = { ...EMPTY_COUNTS };
      for (const rsvpRow of rsvpRows ?? []) {
        const status = rsvpRow.status as keyof EventRsvpCounts;
        if (status in counts) {
          counts[status] += 1;
        }
      }
      setRsvpCounts(counts);

      setEvent({
        id: row.id as string,
        title: (row.title as string) ?? "",
        description: (row.description as string) ?? "",
        date: (row.date as string) ?? "",
        time: (row.time as string) ?? "",
        location: (row.location as string) ?? "",
        clubId,
        clubName: (club.name as string) ?? "Club",
        clubSlug: (club.slug as string) ?? "",
        clubLogoUrl: (club.logo_url as string) ?? null,
        clubAbbreviation: (club.abbreviation as string) ?? undefined,
        visibility,
        category: (row.category as string) ?? "general",
      });

      if (user?.id) {
        const { data: rsvpRow } = await supabase
          .from("event_rsvps")
          .select("status")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!cancelled) {
          setMyRsvpStatus((rsvpRow?.status as RsvpStatus | undefined) ?? null);
        }
      } else if (!cancelled) {
        setMyRsvpStatus(null);
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, isJoined, navigate, user?.id]);

  async function handleRsvp() {
    if (!eventId) return;

    const target = getEventRsvpPath(eventId);
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }

    if (myRsvpStatus) {
      navigate(target);
      return;
    }

    setRsvpBusy(true);
    try {
      const needsQuestionnaire = await eventRequiresRsvpQuestionnaire(eventId, true);
      if (needsQuestionnaire) {
        navigate(target);
        return;
      }

      const { error } = await supabase.from("event_rsvps").upsert(
        { event_id: eventId, user_id: user.id, status: "going" },
        { onConflict: "event_id,user_id" },
      );

      if (error) {
        console.error("Failed to record RSVP:", error.message);
        return;
      }

      setMyRsvpStatus("going");
      setRsvpCounts((prev) => ({ ...prev, going: prev.going + 1 }));
    } finally {
      setRsvpBusy(false);
    }
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

  const primaryLabel =
    myRsvpStatus === "going"
      ? "Going"
      : myRsvpStatus === "maybe"
        ? "Maybe"
        : myRsvpStatus === "not_going"
          ? "Not Going"
          : "RSVP for this Event";

  const primaryVariant =
    myRsvpStatus === "going"
      ? "going"
      : myRsvpStatus
        ? "secondary"
        : "primary";

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ padding: `${isMobile ? 24 : 40}px ${pad} 48px` }}>
        <PublicDetailBackButton />

        <div style={{ marginTop: "28px" }}>
          <EventDetailPageShell maxWidth="960px">
            <EventDetailClubHeader
              clubName={event.clubName}
              logoUrl={event.clubLogoUrl ?? undefined}
              abbreviation={event.clubAbbreviation}
              clubSlug={event.clubSlug}
            />

            <EventDetailBadges
              visibility={event.visibility}
              categoryLabel={eventCategoryLabel(event.category)}
            />

            <EventDetailTitle title={event.title} />

            <EventDetailMeta
              date={event.date}
              time={event.time}
              location={event.location}
            />

            <EventDetailTwoColumn
              isMobile={isMobile}
              main={<EventDetailDescription description={event.description} />}
              sidebar={
                <>
                  <EventDetailMyRsvp status={myRsvpStatus} />
                  <EventDetailRsvpSummary counts={rsvpCounts} />
                  <EventDetailPrimaryAction
                    label={primaryLabel}
                    variant={primaryVariant}
                    showCheck={myRsvpStatus === "going"}
                    disabled={rsvpBusy}
                    onClick={() => void handleRsvp()}
                  />
                </>
              }
            />
          </EventDetailPageShell>
        </div>
      </div>
    </div>
  );
}
