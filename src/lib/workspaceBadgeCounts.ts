import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseMeetingNotes,
  resolveInviteeUserIds,
} from "./meetingMetadata";
import { canViewContent, normalizeVisibility } from "./contentVisibility";
import {
  fetchWorkspaceSectionViews,
  type WorkspaceSection,
  type WorkspaceSectionViews,
} from "./workspaceSectionViews";
import { isMeetingPast } from "../pages/app/meetings/meetingUtils";
import { meetingNeedsRecap } from "../pages/app/meetings/meetingDisplayHelpers";
import type { ClubMember } from "../types";

export interface WorkspaceBadgeCounts {
  chat: number;
  announcements: number;
  tasks: number;
  events: number;
  meetings: number;
  members: number;
}

export interface WorkspaceBadgeContext {
  clubId: string;
  userId: string;
  canManageMeetings: boolean;
  isPrivilegedMember: boolean;
  pendingJoinRequestCount: number;
  members: ClubMember[];
}

function cutoffIso(
  sectionViews: WorkspaceSectionViews,
  section: WorkspaceSection,
): string | null {
  return sectionViews[section] ?? null;
}

function applyCreatedAfterCutoff<T extends { gt: (col: string, val: string) => T }>(
  query: T,
  cutoff: string | null,
  column = "created_at",
): T {
  if (!cutoff) return query;
  return query.gt(column, cutoff);
}

export async function loadWorkspaceBadgeCounts(
  client: SupabaseClient,
  context: WorkspaceBadgeContext,
): Promise<WorkspaceBadgeCounts> {
  const { clubId, userId, canManageMeetings, isPrivilegedMember, pendingJoinRequestCount, members } =
    context;

  const sectionViews = await fetchWorkspaceSectionViews(client, clubId, userId);

  const [chat, announcements, tasks, events, meetings] = await Promise.all([
    loadChatBadgeCount(client, clubId, userId),
    loadAnnouncementsBadgeCount(client, clubId, cutoffIso(sectionViews, "announcements")),
    loadTasksBadgeCount(client, clubId, userId, cutoffIso(sectionViews, "tasks")),
    loadEventsBadgeCount(
      client,
      clubId,
      userId,
      isPrivilegedMember,
      cutoffIso(sectionViews, "events"),
    ),
    loadMeetingsBadgeCount(
      client,
      clubId,
      userId,
      canManageMeetings,
      members,
      cutoffIso(sectionViews, "meetings"),
    ),
  ]);

  return {
    chat,
    announcements,
    tasks,
    events,
    meetings,
    members: pendingJoinRequestCount,
  };
}

async function loadChatBadgeCount(
  client: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<number> {
  const { data: memberships, error: membershipsError } = await client
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (membershipsError) {
    console.error("Failed to load chat memberships for badges:", membershipsError.message);
    return 0;
  }

  const membershipIds = (memberships ?? []).map((row) => row.conversation_id as string);
  if (membershipIds.length === 0) return 0;

  const { data: clubConvos, error: convosError } = await client
    .from("conversations")
    .select("id")
    .eq("club_id", clubId)
    .in("id", membershipIds);

  if (convosError) {
    console.error("Failed to load club conversations for badges:", convosError.message);
    return 0;
  }

  const clubConversationIds = (clubConvos ?? []).map((row) => row.id as string);
  if (clubConversationIds.length === 0) return 0;

  const { data: unreadMessages, error: messagesError } = await client
    .from("direct_messages")
    .select("id, read_by, sender_id")
    .in("conversation_id", clubConversationIds)
    .neq("sender_id", userId);

  if (messagesError) {
    console.error("Failed to load chat unread for badges:", messagesError.message);
    return 0;
  }

  return (unreadMessages ?? []).filter(
    (row) => !(row.read_by ?? []).includes(userId),
  ).length;
}

async function loadAnnouncementsBadgeCount(
  client: SupabaseClient,
  clubId: string,
  lastViewedAt: string | null,
): Promise<number> {
  let query = client
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);

  query = applyCreatedAfterCutoff(query, lastViewedAt);

  const { count, error } = await query;
  if (error) {
    console.error("Failed to load announcements badge count:", error.message);
    return 0;
  }
  return count ?? 0;
}

async function loadTasksBadgeCount(
  client: SupabaseClient,
  clubId: string,
  userId: string,
  lastViewedAt: string | null,
): Promise<number> {
  let query = client
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("assigned_to", userId)
    .neq("status", "done");

  query = applyCreatedAfterCutoff(query, lastViewedAt);

  const { count, error } = await query;
  if (error) {
    console.error("Failed to load task badge count:", error.message);
    return 0;
  }
  return count ?? 0;
}

async function loadEventsBadgeCount(
  client: SupabaseClient,
  clubId: string,
  userId: string,
  isPrivilegedMember: boolean,
  lastViewedAt: string | null,
): Promise<number> {
  let eventsQuery = client
    .from("events")
    .select("id, visibility, created_at")
    .eq("club_id", clubId);

  eventsQuery = applyCreatedAfterCutoff(eventsQuery, lastViewedAt);

  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) {
    console.error("Failed to load events for badge count:", eventsError.message);
    return 0;
  }

  const visibleEvents = (events ?? []).filter((row) =>
    canViewContent(normalizeVisibility(row.visibility as string | null), {
      isMember: true,
      isPrivileged: isPrivilegedMember,
    }),
  );
  if (visibleEvents.length === 0) return 0;

  const eventIds = visibleEvents.map((row) => row.id as string);
  const { data: rsvps, error: rsvpsError } = await client
    .from("event_rsvps")
    .select("event_id, status")
    .eq("user_id", userId)
    .in("event_id", eventIds);

  if (rsvpsError) {
    console.error("Failed to load RSVPs for events badge count:", rsvpsError.message);
    return 0;
  }

  const rsvpByEvent = new Map(
    (rsvps ?? []).map((row) => [row.event_id as string, row.status as string]),
  );

  return visibleEvents.filter((event) => {
    const status = rsvpByEvent.get(event.id as string);
    if (!status) return true;
    return status === "maybe";
  }).length;
}

async function loadMeetingsBadgeCount(
  client: SupabaseClient,
  clubId: string,
  userId: string,
  canManageMeetings: boolean,
  members: ClubMember[],
  lastViewedAt: string | null,
): Promise<number> {
  const { data: meetingRows, error } = await client
    .from("club_meetings")
    .select(
      "id, club_id, title, meeting_type, date, location, meeting_link, agenda, notes, is_recurring, recurrence_pattern, status, created_by, created_at",
    )
    .eq("club_id", clubId);

  if (error) {
    console.error("Failed to load meetings for badge count:", error.message);
    return 0;
  }

  const cutoffMs = lastViewedAt ? new Date(lastViewedAt).getTime() : 0;
  const activeMembers = members.filter((member) => member.status === "active");
  let count = 0;

  for (const row of meetingRows ?? []) {
    if ((row.status as string) === "cancelled") continue;

    const meeting = {
      id: row.id as string,
      clubId: row.club_id as string,
      title: (row.title as string) ?? "",
      meetingType: (row.meeting_type as import("./meetingMetadata").MeetingType) ?? "general",
      date: row.date as string,
      location: (row.location as string | null) ?? null,
      meetingLink: (row.meeting_link as string | null) ?? null,
      agenda: (row.agenda as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      isRecurring: Boolean(row.is_recurring),
      recurrencePattern:
        (row.recurrence_pattern as "weekly" | "biweekly" | "monthly" | null) ?? null,
      status: (row.status as "upcoming" | "completed" | "cancelled") ?? "upcoming",
      createdBy: (row.created_by as string | null) ?? null,
      createdAt: (row.created_at as string) ?? "",
      actionItemCount: 0,
      openActionItemCount: 0,
    };

    const { metadata } = parseMeetingNotes(meeting.notes);
    const invited =
      canManageMeetings ||
      resolveInviteeUserIds(
        metadata.inviteeGroup,
        activeMembers,
        metadata.customInviteeIds ?? [],
      ).includes(userId);

    if (!invited) continue;

    const createdAtMs = new Date(meeting.createdAt).getTime();
    const meetingDateMs = new Date(meeting.date).getTime();
    const createdSinceVisit = createdAtMs > cutoffMs;
    const meetingSinceVisit = meetingDateMs > cutoffMs;

    if (!isMeetingPast(meeting) && createdSinceVisit) {
      count += 1;
      continue;
    }

    if (
      canManageMeetings &&
      isMeetingPast(meeting) &&
      meetingNeedsRecap(meeting) &&
      meetingSinceVisit
    ) {
      count += 1;
    }
  }

  return count;
}
