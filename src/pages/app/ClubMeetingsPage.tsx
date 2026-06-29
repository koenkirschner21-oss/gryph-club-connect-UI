import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Calendar, ChevronDown, Plus } from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import Spinner from "../../components/ui/Spinner";
import {
  CompactMeetingRow,
  MeetingsStatCards,
  MeetingsUpcomingLayout,
} from "./meetings/MeetingsListUI";
import {
  MeetingCancelConfirmModal,
  type MeetingCancelOption,
} from "./meetings/MeetingCancelConfirmModal";
import { MeetingCreateFlow, emptyCreateForm } from "./meetings/MeetingCreateFlow";
import { MeetingDetailView } from "./meetings/MeetingDetailView";
import { primaryButtonStyle } from "./meetings/meetingStyles";
import type { ClubMeeting, MeetingActionItem } from "./meetings/meetingTypes";
import {
  createFormFromMeeting,
  isMeetingPast,
  mapActionItemRow,
  mapMeetingRow,
} from "./meetings/meetingUtils";
import { parseMeetingNotes, resolveInviteeUserIds } from "../../lib/meetingMetadata";
import type { MeetingType } from "../../lib/meetingMetadata";
import { meetingNeedsRecap, meetingPrepStatus } from "./meetings/meetingDisplayHelpers";
import { supabase } from "../../lib/supabaseClient";

type PageTab = "upcoming" | "past" | "follow_ups";

export default function ClubMeetingsPage() {
  const { clubId, meetingId } = useParams<{ clubId: string; meetingId?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { members } = useClubMembers(clubId);
  const isMobile = useIsMobile();

  const memberAccess = useClubMemberAccess(clubId);
  const canManageMeetings =
    memberAccess.isPresident || memberAccess.can("manage_meetings");
  const [meetings, setMeetings] = useState<ClubMeeting[]>([]);
  const [clubActionItems, setClubActionItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PageTab>("upcoming");
  const [showPast, setShowPast] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<ClubMeeting | null>(null);
  const [createInitial, setCreateInitial] = useState(emptyCreateForm());
  const [cancelModal, setCancelModal] = useState<{
    meeting: ClubMeeting;
    linkedTaskCount: number;
    selectedOption: MeetingCancelOption;
    applying: boolean;
  } | null>(null);
  const editMeetingId = searchParams.get("edit");

  const isPrivileged = canManageMeetings;
  const isCreateRoute =
    meetingId === "new" ||
    location.pathname.endsWith("/meetings/new") ||
    searchParams.get("create") === "true";
  const presetType = (searchParams.get("type") as MeetingType | null) ?? undefined;

  useEffect(() => {
    if (!editMeetingId || !clubId) return;
    void supabase
      .from("club_meetings")
      .select("*")
      .eq("id", editMeetingId)
      .eq("club_id", clubId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEditingMeeting(mapMeetingRow(data as Record<string, unknown>));
        }
      });
  }, [editMeetingId, clubId]);

  const loadMeetings = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("club_meetings")
      .select("*")
      .eq("club_id", clubId)
      .order("date", { ascending: true });

    if (error) {
      setMeetings([]);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    const meetingIds = rows.map((row) => row.id as string);
    const counts: Record<string, number> = {};
    const openCounts: Record<string, number> = {};

    if (meetingIds.length > 0) {
      const { data: items } = await supabase
        .from("meeting_action_items")
        .select("meeting_id, status")
        .in("meeting_id", meetingIds);

      for (const item of items ?? []) {
        const id = item.meeting_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
        if ((item.status as string) !== "completed") {
          openCounts[id] = (openCounts[id] ?? 0) + 1;
        }
      }
    }

    setMeetings(
      rows.map((row) =>
        mapMeetingRow(
          row as Record<string, unknown>,
          counts[row.id as string] ?? 0,
          openCounts[row.id as string] ?? 0,
        ),
      ),
    );
    setLoading(false);
  }, [clubId]);

  const loadClubActionItems = useCallback(async () => {
    if (!clubId) return;

    const { data: meetingRows } = await supabase
      .from("club_meetings")
      .select("id")
      .eq("club_id", clubId);

    const meetingIds = (meetingRows ?? []).map((row) => row.id as string);
    if (meetingIds.length === 0) {
      setClubActionItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("meeting_action_items")
      .select(
        `id, meeting_id, title, description, priority, assignee_id, due_date, status, linked_task_id, created_at,
         assignee:profiles!meeting_action_items_assignee_profile_fkey ( full_name ),
         meeting:club_meetings!meeting_action_items_meeting_id_fkey ( title, club_id )`,
      )
      .in("meeting_id", meetingIds)
      .order("created_at", { ascending: false });

    if (error) {
      const { data: fallback } = await supabase
        .from("meeting_action_items")
        .select("*")
        .in("meeting_id", meetingIds)
        .order("created_at", { ascending: false });
      setClubActionItems(
        (fallback ?? []).map((row) => mapActionItemRow(row as Record<string, unknown>)),
      );
      return;
    }

    setClubActionItems((data ?? []).map((row) => mapActionItemRow(row as Record<string, unknown>)));
  }, [clubId]);

  useEffect(() => {
    if (!meetingId || meetingId === "new") {
      void loadMeetings();
      void loadClubActionItems();
    }
  }, [loadMeetings, loadClubActionItems, meetingId]);

  useEffect(() => {
    if (isCreateRoute && isPrivileged) {
      setEditingMeeting(null);
      setCreateInitial(emptyCreateForm(presetType));
    }
  }, [isCreateRoute, isPrivileged, presetType]);

  const visibleMeetings = useMemo(() => {
    if (isPrivileged || !user?.id) return meetings;
    return meetings.filter((meeting) => {
      const { metadata } = parseMeetingNotes(meeting.notes);
      return resolveInviteeUserIds(
        metadata.inviteeGroup,
        members,
        metadata.customInviteeIds ?? [],
      ).includes(user.id);
    });
  }, [meetings, members, isPrivileged, user?.id]);

  const upcomingMeetings = useMemo(
    () =>
      visibleMeetings
        .filter((meeting) => !isMeetingPast(meeting))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [visibleMeetings],
  );

  const pastMeetings = useMemo(
    () =>
      visibleMeetings
        .filter((meeting) => isMeetingPast(meeting))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [visibleMeetings],
  );

  const nextMeeting = upcomingMeetings[0] ?? null;
  const additionalUpcomingMeetings = nextMeeting
    ? upcomingMeetings.slice(1)
    : upcomingMeetings;

  const myActionItems = useMemo(() => {
    if (!user?.id) return clubActionItems;
    return clubActionItems.filter((item) => item.assigneeId === user.id);
  }, [clubActionItems, user?.id]);

  const openFollowUps = useMemo(
    () => clubActionItems.filter((item) => item.status !== "completed"),
    [clubActionItems],
  );

  const openFollowUpCount = useMemo(
    () =>
      visibleMeetings
        .filter((meeting) => meeting.status !== "cancelled")
        .reduce((sum, meeting) => sum + meeting.openActionItemCount, 0),
    [visibleMeetings],
  );

  const actionItemsDueSoon = useMemo(() => {
    return myActionItems
      .filter((item) => item.status !== "completed")
      .sort((a, b) => {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })
      .slice(0, 5);
  }, [myActionItems]);

  const dueThisWeekCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return myActionItems.filter((item) => {
      if (item.status === "completed" || !item.dueDate) return false;
      const due = new Date(item.dueDate);
      if (Number.isNaN(due.getTime())) return false;
      due.setHours(0, 0, 0, 0);
      return due.getTime() >= today.getTime() && due.getTime() <= weekEnd.getTime();
    }).length;
  }, [myActionItems]);

  const needsRecapCount = useMemo(
    () => pastMeetings.filter((meeting) => meetingNeedsRecap(meeting)).length,
    [pastMeetings],
  );

  const needsRecapMeetings = useMemo(() => {
    return visibleMeetings
      .filter((meeting) => meetingNeedsRecap(meeting))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [visibleMeetings]);

  const upcomingPrepMeetings = useMemo(() => {
    return upcomingMeetings
      .filter((meeting) => meetingPrepStatus(meeting) === "Needs prep")
      .slice(0, 3);
  }, [upcomingMeetings]);

  const openCreate = (type?: MeetingType) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    navigate(`/app/clubs/${clubId}/meetings/new${params.toString() ? `?${params}` : ""}`);
  };

  const openEdit = (meeting: ClubMeeting) => {
    setEditingMeeting(meeting);
    setCreateInitial(createFormFromMeeting(meeting));
    navigate(`/app/clubs/${clubId}/meetings/new?edit=${meeting.id}`);
  };

  const requestCancelMeeting = async (meeting: ClubMeeting) => {
    const { count, error } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("linked_meeting_id", meeting.id)
      .neq("status", "done");

    if (error) {
      console.error("Failed to check linked tasks for meeting cancellation:", error.message);
      return;
    }

    const linkedTaskCount = count ?? 0;

    if (linkedTaskCount === 0) {
      if (!window.confirm("Cancel this meeting? This cannot be undone.")) return;
      const { error: cancelError } = await supabase
        .from("club_meetings")
        .update({ status: "cancelled" })
        .eq("id", meeting.id);
      if (cancelError) {
        console.error("Failed to cancel meeting:", cancelError.message);
        return;
      }
      void loadMeetings();
      return;
    }

    setCancelModal({
      meeting,
      linkedTaskCount,
      selectedOption: "meeting_only",
      applying: false,
    });
  };

  const closeCancelModal = () => {
    setCancelModal(null);
  };

  const confirmCancelMeeting = async () => {
    if (!cancelModal || cancelModal.selectedOption === "keep") {
      closeCancelModal();
      return;
    }

    setCancelModal((prev) => (prev ? { ...prev, applying: true } : prev));

    const { meeting, selectedOption } = cancelModal;
    const { error: meetingError } = await supabase
      .from("club_meetings")
      .update({ status: "cancelled" })
      .eq("id", meeting.id);

    if (meetingError) {
      console.error("Failed to cancel meeting:", meetingError.message);
      setCancelModal((prev) => (prev ? { ...prev, applying: false } : prev));
      return;
    }

    if (selectedOption === "meeting_and_tasks") {
      const { error: tasksError } = await supabase
        .from("tasks")
        .update({ status: "cancelled" })
        .eq("linked_meeting_id", meeting.id)
        .neq("status", "done");

      if (tasksError) {
        console.error("Failed to cancel linked tasks:", tasksError.message);
      }
    }

    closeCancelModal();
    void loadMeetings();
  };

  if (!clubId) return null;

  if (isCreateRoute && isPrivileged && user?.id) {
    const editId = editMeetingId ?? editingMeeting?.id ?? null;
    const initial =
      editId && editingMeeting
        ? createFormFromMeeting(editingMeeting)
        : createInitial;
    return (
      <MeetingCreateFlow
        clubId={clubId}
        userId={user.id}
        editingId={editId}
        initial={initial}
        onSaved={() => {
          setEditingMeeting(null);
          void loadMeetings();
        }}
      />
    );
  }

  if (meetingId && meetingId !== "new") {
    return (
      <MeetingDetailView
        clubId={clubId}
        meetingId={meetingId}
        isPrivileged={isPrivileged}
        userId={user?.id}
        onEdit={openEdit}
      />
    );
  }

  const hasAnyMeetings = meetings.length > 0;

  return (
    <div style={{ padding: isMobile ? "16px" : "24px", width: "100%" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
            Meetings
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
            Plan agendas, invite the right people, and track follow-ups.
          </p>
        </div>
        {isPrivileged ? (
          <button type="button" style={primaryButtonStyle} onClick={() => openCreate()}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Plus size={16} aria-hidden /> New Meeting
            </span>
          </button>
        ) : null}
      </div>

      {!loading ? (
        <MeetingsStatCards
          upcomingCount={upcomingMeetings.length}
          nextMeeting={nextMeeting}
          openFollowUpCount={openFollowUpCount}
          dueThisWeekCount={dueThisWeekCount}
          needsRecapCount={needsRecapCount}
          isMobile={isMobile}
        />
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
        <TabButton active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")}>
          Upcoming
        </TabButton>
        <TabButton
          active={activeTab === "past"}
          onClick={() => {
            setActiveTab("past");
            setShowPast(false);
          }}
        >
          Past
        </TabButton>
        <TabButton active={activeTab === "follow_ups"} onClick={() => setActiveTab("follow_ups")}>
          Follow-Ups
        </TabButton>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner label="Loading meetings…" />
        </div>
      ) : activeTab === "follow_ups" ? (
        <FollowUpsSection clubId={clubId} items={openFollowUps} />
      ) : activeTab === "past" ? (
        <section>
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              padding: 0,
              marginBottom: showPast ? "16px" : 0,
            }}
          >
            {showPast ? "Hide past meetings" : "Show past meetings"}
            <ChevronDown
              size={16}
              style={{
                transform: showPast ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
          {showPast ? (
            pastMeetings.length === 0 ? (
              <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
                No past meetings yet.
              </p>
            ) : (
              <div>
                {pastMeetings.map((meeting) => (
                  <CompactMeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    clubId={clubId}
                    isPrivileged={isPrivileged}
                    isPast
                    onEdit={openEdit}
                    onCancel={requestCancelMeeting}
                  />
                ))}
              </div>
            )
          ) : (
            <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
              Past meetings are collapsed. Tap above to expand.
            </p>
          )}
        </section>
      ) : !hasAnyMeetings ? (
        <EmptyMeetingsState isPrivileged={isPrivileged} onCreate={openCreate} />
      ) : upcomingMeetings.length === 0 ? (
        <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>No upcoming meetings scheduled.</p>
      ) : (
        <MeetingsUpcomingLayout
          nextMeeting={nextMeeting}
          listMeetings={additionalUpcomingMeetings}
          clubId={clubId}
          isPrivileged={isPrivileged}
          isMobile={isMobile}
          actionItemsDueSoon={actionItemsDueSoon}
          needsRecapMeetings={needsRecapMeetings}
          upcomingPrepMeetings={upcomingPrepMeetings}
          onEdit={openEdit}
          onCancel={requestCancelMeeting}
          onViewAllActions={() => setActiveTab("follow_ups")}
          onViewAllRecap={() => {
            setActiveTab("past");
            setShowPast(true);
          }}
          onViewAllPrep={() => setActiveTab("upcoming")}
        />
      )}

      {cancelModal ? (
        <MeetingCancelConfirmModal
          meeting={cancelModal.meeting}
          linkedTaskCount={cancelModal.linkedTaskCount}
          selectedOption={cancelModal.selectedOption}
          applying={cancelModal.applying}
          onSelectOption={(option) =>
            setCancelModal((prev) => (prev ? { ...prev, selectedOption: option } : prev))
          }
          onConfirm={() => void confirmCancelMeeting()}
          onGoBack={closeCancelModal}
        />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "#E51937" : "transparent",
        color: active ? "#ffffff" : "#999999",
        border: active ? "1px solid #E51937" : "1px solid #333333",
        borderRadius: "20px",
        padding: "6px 14px",
        fontSize: "12px",
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function EmptyMeetingsState({
  isPrivileged,
  onCreate,
}: {
  isPrivileged: boolean;
  onCreate: (type?: MeetingType) => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <Calendar
        size={40}
        color="#333333"
        style={{ margin: "0 auto 12px", display: "block" }}
        aria-hidden
      />
      <p style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff", margin: "0 0 8px" }}>
        Run better club meetings
      </p>
      <p
        style={{
          fontSize: "14px",
          color: "#777777",
          margin: "0 auto 24px",
          maxWidth: "420px",
          lineHeight: 1.5,
        }}
      >
        Plan agendas, invite the right people, track notes, assign action items, and convert
        follow-ups into tasks.
      </p>
      {isPrivileged ? (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }}>
          <button type="button" style={primaryButtonStyle} onClick={() => onCreate("executive")}>
            Schedule executive meeting
          </button>
          <button type="button" style={primaryButtonStyle} onClick={() => onCreate("general")}>
            Schedule general member meeting
          </button>
          <button type="button" style={primaryButtonStyle} onClick={() => onCreate("executive")}>
            Create meeting from template
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FollowUpsSection({
  clubId,
  items,
}: {
  clubId: string;
  items: MeetingActionItem[];
}) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "14px", color: "#777777" }}>
        No open follow-ups from club meetings.
      </p>
    );
  }

  const priorityColor = (priority: MeetingActionItem["priority"]) => {
    if (priority === "high") return "#E51937";
    if (priority === "low") return "#777777";
    return "#FFC429";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>
              {item.title}
            </p>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: priorityColor(item.priority),
                textTransform: "uppercase",
              }}
            >
              {item.priority}
            </span>
          </div>
          {item.description ? (
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#999999", lineHeight: 1.45 }}>
              {item.description}
            </p>
          ) : null}
          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#777777" }}>
            {item.assigneeName ?? "Unassigned"}
            {item.dueDate ? ` · Due ${item.dueDate}` : ""}
            {item.linkedTaskId ? " · Linked task" : ""}
          </p>
          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#666666" }}>
            Source: {item.meetingTitle ?? "Meeting"}
          </p>
          <Link
            to={`/app/clubs/${clubId}/meetings/${item.meetingId}`}
            style={{ fontSize: "12px", color: "#E51937", textDecoration: "none" }}
          >
            Open meeting
          </Link>
        </div>
      ))}
    </div>
  );
}
