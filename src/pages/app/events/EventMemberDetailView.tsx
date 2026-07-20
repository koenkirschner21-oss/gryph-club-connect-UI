import type { CSSProperties } from "react";
import {
  EventDetailClubHeader,
  EventDetailDescription,
  EventDetailMeta,
  EventDetailMyRsvp,
  EventDetailPageShell,
  EventDetailPrimaryAction,
  EventDetailPublicLink,
  EventDetailRsvpSummary,
  EventDetailTitle,
  EventDetailTwoColumn,
} from "../../../components/events/EventDetailLayout";
import PublicDetailBackButton from "../../../components/public/PublicDetailBackButton";
import type { ClubEvent, RsvpStatus } from "../../../types";

type RsvpAccess = {
  showRsvpButton: boolean;
  blockedMessage?: string | null;
};

type Props = {
  event: ClubEvent;
  clubName: string;
  clubLogoUrl?: string;
  clubAbbreviation?: string;
  clubSlug?: string | null;
  isMobile: boolean;
  counts: { going: number; maybe: number; not_going: number };
  myRsvpStatus?: RsvpStatus;
  rsvpAccess: RsvpAccess;
  publicEventPath?: string | null;
  publicNotes?: string | null;
  isPast: boolean;
  onBack: () => void;
  onRsvp?: (eventId: string, status: RsvpStatus) => void;
};

const sectionCardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  padding: "16px",
};

export function EventMemberDetailView({
  event,
  clubName,
  clubLogoUrl,
  clubAbbreviation,
  clubSlug,
  isMobile,
  counts,
  myRsvpStatus,
  rsvpAccess,
  publicEventPath,
  publicNotes,
  isPast,
  onBack,
  onRsvp,
}: Props) {
  const notes = publicNotes?.trim() ?? "";
  const showNotes = isPast && notes.length > 0;

  const primaryAction = (() => {
    if (!rsvpAccess.showRsvpButton || !onRsvp) return null;
    if (myRsvpStatus === "going") {
      return (
        <EventDetailPrimaryAction
          label="Going"
          variant="going"
          showCheck
          onClick={() => onRsvp(event.id, "going")}
        />
      );
    }
    if (myRsvpStatus === "maybe") {
      return (
        <EventDetailPrimaryAction
          label="Maybe"
          variant="secondary"
          onClick={() => onRsvp(event.id, "maybe")}
        />
      );
    }
    if (myRsvpStatus === "not_going") {
      return (
        <EventDetailPrimaryAction
          label="Not Going"
          variant="secondary"
          onClick={() => onRsvp(event.id, "not_going")}
        />
      );
    }
    return (
      <EventDetailPrimaryAction
        label="RSVP"
        onClick={() => onRsvp(event.id, "going")}
      />
    );
  })();

  return (
    <EventDetailPageShell maxWidth="860px">
      <PublicDetailBackButton
        label="Back to Events"
        onBack={onBack}
        style={{ marginBottom: "12px" }}
      />

      <EventDetailClubHeader
        clubName={clubName}
        logoUrl={clubLogoUrl}
        abbreviation={clubAbbreviation}
          clubSlug={clubSlug ?? undefined}
      />

      <EventDetailTitle title={event.title} size="medium" />

      <div style={{ marginTop: "4px", marginBottom: "8px" }}>
        <EventDetailMeta
          date={event.date}
          time={event.time}
          location={event.location}
        />
      </div>

      <EventDetailTwoColumn
        isMobile={isMobile}
        main={
          <>
            <EventDetailDescription description={event.description ?? ""} />
            {showNotes ? (
              <section style={{ ...sectionCardStyle, marginTop: "12px" }}>
                <h2
                  style={{
                    margin: "0 0 8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#ffffff",
                  }}
                >
                  Recap
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#cccccc",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.55,
                  }}
                >
                  {notes}
                </p>
              </section>
            ) : null}
          </>
        }
        sidebar={
          <>
            <EventDetailMyRsvp status={myRsvpStatus} />
            <EventDetailRsvpSummary counts={counts} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                width: "100%",
              }}
            >
              {primaryAction}
              {rsvpAccess.blockedMessage ? (
                <p style={{ margin: 0, fontSize: "13px", color: "#999999" }}>
                  {rsvpAccess.blockedMessage}
                </p>
              ) : null}
              {publicEventPath ? (
                <div style={{ width: "100%" }}>
                  <EventDetailPublicLink href={publicEventPath} />
                </div>
              ) : null}
            </div>
          </>
        }
      />
    </EventDetailPageShell>
  );
}
