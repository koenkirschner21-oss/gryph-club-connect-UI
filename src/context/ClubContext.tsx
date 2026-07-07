import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import {
  removeRealtimeChannel,
  uniqueRealtimeTopic,
} from "../lib/realtimeChannels";
import { normalizeTags } from "../lib/normalizeTags";
import {
  membershipRequiresApproval,
  normalizeMembershipType,
  parseJoinQuestions,
} from "../lib/clubJoinUtils";
import { normalizeClaimStatus } from "../lib/clubClaimUtils";
import { parseClubPermissions } from "../lib/clubPermissions";
import { parseSetupSkippedItems } from "../lib/clubProfileCompletion";
import {
  extractEmbeddedRequestMetadata,
  readClubContactEmailFromRow,
  readClubLongDescriptionFromRow,
  readClubMeetingLocationFromRow,
  readClubMeetingScheduleFromRow,
  sanitizeLongDescriptionForSave,
} from "../lib/clubRowMapping";
import {
  applySocialLinksToClubPayload,
  readSocialLinksFromClubRow,
} from "../lib/clubSocialLinks";
import { useAuthContext } from "./useAuthContext";
import { ClubContext, type ClubContextValue } from "./clubContextValue";
import type { Club, MemberRole, JoinAnswer } from "../types";

const ACTIVE_CLUB_STORAGE_KEY = "activeClubId";

function readStoredActiveClubId(): string | null {
  try {
    const fromLocal = localStorage.getItem(ACTIVE_CLUB_STORAGE_KEY);
    if (fromLocal) return fromLocal;
    const fromSession = sessionStorage.getItem(ACTIVE_CLUB_STORAGE_KEY);
    if (fromSession) {
      localStorage.setItem(ACTIVE_CLUB_STORAGE_KEY, fromSession);
      sessionStorage.removeItem(ACTIVE_CLUB_STORAGE_KEY);
      return fromSession;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** Map a Supabase clubs row to our Club type. */
function mapRow(row: Record<string, unknown>): Club {
  const embeddedMeta = extractEmbeddedRequestMetadata(row);

  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    slug: (row.slug as string) ?? (row.id as string),
    description: (row.description as string) ?? "",
    shortDescription: (row.short_description as string) ?? undefined,
    longDescription: readClubLongDescriptionFromRow(row),
    category: (row.category as string) ?? "",
    memberCount: (row.member_count as number) ?? 0,
    meetingSchedule: readClubMeetingScheduleFromRow(row, embeddedMeta),
    meetingLocation: readClubMeetingLocationFromRow(row, embeddedMeta),
    location: (row.location as string) ?? "",
    imageUrl:
      (row.image_url as string) ??
      (row.logo_url as string) ??
      "/assets/placeholders/placeholder-rect.svg",
    logoUrl: (row.logo_url as string) ?? undefined,
    bannerUrl: (row.banner_url as string) ?? undefined,
    brandColor: (row.brand_color as string) ?? undefined,
    tags: normalizeTags(row.tags as string | string[] | null | undefined),
    contactEmail: readClubContactEmailFromRow(row, embeddedMeta),
    isPublic: (row.is_public as boolean) ?? true,
    isFeatured: (row.is_featured as boolean) ?? false,
    isVerified: (row.is_verified as boolean) ?? false,
    abbreviation: (row.abbreviation as string) ?? undefined,
    joinCode: (row.join_code as string) ?? undefined,
    socialLinks: readSocialLinksFromClubRow(row),
    events: (row.events as Club["events"]) ?? [],
    requiresApproval: (row.requires_approval as boolean) ?? false,
    joinType: ((row.join_type as string) ?? "open") as Club["joinType"], // legacy column; unused — see docs/LEGACY_JOIN_MODEL.md
    membershipType: normalizeMembershipType(row.membership_type),
    descriptionConfirmed: (row.description_confirmed as boolean) ?? false,
    logoConfirmed: (row.logo_confirmed as boolean) ?? false,
    bannerConfirmed: (row.banner_confirmed as boolean) ?? false,
    membershipConfirmed: (row.membership_confirmed as boolean) ?? false,
    contactEmailConfirmed: (row.contact_email_confirmed as boolean) ?? false,
    socialLinksConfirmed: (row.social_links_confirmed as boolean) ?? false,
    meetingScheduleConfirmed: (row.meeting_schedule_confirmed as boolean) ?? false,
    categoryConfirmed: (row.category_confirmed as boolean) ?? false,
    meetingLocationConfirmed: (row.meeting_location_confirmed as boolean) ?? false,
    contentVisibilityDefaultsConfirmed:
      (row.content_visibility_defaults_confirmed as boolean) ?? false,
    setupSkippedItems: parseSetupSkippedItems(row.setup_skipped_items),
    claimStatus: normalizeClaimStatus(row.claim_status),
    setupCompleted: (row.setup_completed as boolean) ?? false,
    isPublished: (row.is_published as boolean) ?? false,
    joinQuestions: parseJoinQuestions(row.join_questions),
    allowJoinFileUpload: (row.allow_join_file_upload as boolean) ?? false,
    createdBy: (row.created_by as string) ?? undefined,
    createdAt: (row.created_at as string) ?? undefined,
    customPermissions: parseClubPermissions(row.custom_permissions),
  };
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthContext();
  const userId = user?.id;

  // ---- Clubs data ----
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsError, setClubsError] = useState<string | null>(null);

  // Derive categories from current clubs list
  const categories = useMemo(() => {
    const cats = new Set(clubs.map((c) => c.category).filter(Boolean));
    return ["All", ...Array.from(cats).sort()];
  }, [clubs]);

  const getClubById = useCallback(
    (clubId: string): Club | undefined => clubs.find((c) => c.id === clubId),
    [clubs],
  );

  const getClubBySlug = useCallback(
    (slug: string): Club | undefined => clubs.find((c) => c.slug === slug),
    [clubs],
  );

  // ---- User club state (join/save) ----
  const [joinedClubs, setJoinedClubs] = useState<string[]>([]);
  const [pendingClubs, setPendingClubs] = useState<string[]>([]);
  const [savedClubs, setSavedClubs] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, MemberRole>>({});
  const [activeClubId, setActiveClubIdState] = useState<string | null>(
    () => readStoredActiveClubId(),
  );

  const switchClub = useCallback((clubId: string | null) => {
    setActiveClubIdState(clubId);
    try {
      if (clubId) {
        localStorage.setItem(ACTIVE_CLUB_STORAGE_KEY, clubId);
      } else {
        localStorage.removeItem(ACTIVE_CLUB_STORAGE_KEY);
      }
      sessionStorage.removeItem(ACTIVE_CLUB_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Monotonic token so overlapping sync runs (initial load, realtime refresh,
  // rapid remounts) never clobber each other with stale results.
  const syncRunIdRef = useRef(0);

  /**
   * Auth → memberships → club rows RLS-visible to this session (deterministic ordering).
   * Pass `{ silent: true }` for background refreshes (e.g. realtime membership
   * changes) so the dashboard doesn't flash its loading spinner. Identity is
   * stable across refreshes (only depends on `userId`), so it never re-triggers
   * the realtime subscription effect.
   */
  const syncClubs = useCallback(
    async (options?: { silent?: boolean }): Promise<void> => {
      const runId = ++syncRunIdRef.current;
      const isStale = () => runId !== syncRunIdRef.current;

      if (!options?.silent) setClubsLoading(true);
      setClubsError(null);

      if (!userId) {
        setJoinedClubs([]);
        setPendingClubs([]);
        setSavedClubs([]);
        setUserRoles({});
        setClubs([]);
        if (!isStale()) setClubsLoading(false);
        return;
      }

      const [{ data: memberRows, error: membersErr }, { data: savedRows, error: savedErr }] =
        await Promise.all([
          supabase
            .from("club_members")
            .select("club_id, role, status")
            .eq("user_id", userId),
          supabase
            .from("user_clubs")
            .select("club_id")
            .eq("user_id", userId)
            .eq("type", "saved"),
        ]);

      if (isStale()) return;

      if (membersErr) {
        console.error("Failed to load club memberships:", membersErr.message);
        setClubsError(membersErr.message);
        setJoinedClubs([]);
        setPendingClubs([]);
        setUserRoles({});
      } else {
        const activeIds: string[] = [];
        const pendingIds: string[] = [];
        const roles: Record<string, MemberRole> = {};
        for (const row of memberRows ?? []) {
          if (row.status === "active") {
            activeIds.push(row.club_id);
            const rawRole = (row.role as string) ?? "member";
            if (rawRole === "owner" || rawRole === "admin") {
              roles[row.club_id] = "owner";
            } else if (rawRole === "executive" || rawRole === "exec") {
              roles[row.club_id] = "executive";
            } else {
              roles[row.club_id] = "member";
            }
          } else if (row.status === "pending") {
            pendingIds.push(row.club_id);
          }
        }
        setJoinedClubs(activeIds);
        setPendingClubs(pendingIds);
        setUserRoles(roles);
      }

      if (savedErr) {
        console.error("Failed to load saved clubs:", savedErr.message);
        setSavedClubs([]);
      } else {
        setSavedClubs((savedRows ?? []).map((row) => row.club_id));
      }

      const memberClubIds = Array.from(
        new Set((memberRows ?? []).map((r) => r.club_id)),
      );

      let memberClubData: Record<string, unknown>[] = [];
      let memberClubErr = null as { message: string } | null;
      if (memberClubIds.length > 0) {
        const mRes = await supabase.from("clubs").select("*").in("id", memberClubIds);
        memberClubData = (mRes.data ?? []) as Record<string, unknown>[];
        memberClubErr = mRes.error;
      }

      const publicClubsRes = await supabase
        .from("clubs")
        .select("*")
        .eq("is_public", true)
        .order("name");

      if (isStale()) return;

      const err = memberClubErr ?? publicClubsRes.error;
      if (err) {
        console.error("Failed to load clubs:", err.message);
        setClubsError(err.message);
        setClubs([]);
      } else {
        const merged = new Map<string, Club>();
        for (const row of [...memberClubData, ...(publicClubsRes.data ?? [])]) {
          const c = mapRow(row as Record<string, unknown>);
          merged.set(c.id, c);
        }
        setClubs(Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name)));
      }

      if (!isStale()) setClubsLoading(false);
    },
    [userId],
  );

  // Initial load + re-sync whenever auth resolves or the signed-in user changes.
  useEffect(() => {
    if (authLoading) {
      return;
    }
    void syncClubs();
  }, [authLoading, syncClubs]);

  // Realtime: refresh membership/role state when this user's club_members rows
  // change (approve/remove/promote/demote), so the dashboard reflects them
  // without a full reload. `.on(...)` is registered before `.subscribe()` to
  // avoid the postgres_changes-after-subscribe crash seen previously.
  useEffect(() => {
    if (authLoading || !userId) {
      return;
    }

    const channel = supabase.channel(
      uniqueRealtimeTopic(`club-members:${userId}`),
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "club_members",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void syncClubs({ silent: true });
      },
    );

    channel.subscribe();

    return () => {
      removeRealtimeChannel(supabase, channel);
    };
  }, [authLoading, userId, syncClubs]);

  useEffect(() => {
    if (!userId) {
      switchClub(null);
      return;
    }

    const activeMemberships = joinedClubs;
    if (activeMemberships.length === 0) {
      switchClub(null);
      return;
    }

    if (activeClubId && activeMemberships.includes(activeClubId)) {
      return;
    }

    switchClub(activeMemberships[0]);
  }, [activeClubId, joinedClubs, switchClub, userId]);

  const joinClub = useCallback(
    async (
      clubId: string,
      options?: {
        viaJoinCode?: boolean;
        joinAnswers?: JoinAnswer[];
        joinMessage?: string | null;
      },
    ): Promise<boolean> => {
      if (!user) return false;

      const { data: clubRow, error: clubError } = await supabase
        .from("clubs")
        .select("membership_type")
        .eq("id", clubId)
        .maybeSingle();

      if (clubError || !clubRow) {
        console.error("Failed to load club for join:", clubError?.message);
        return false;
      }

      const membershipType = normalizeMembershipType(clubRow.membership_type);

      if (membershipType === "no_membership") {
        return false;
      }

      if (membershipType === "invite_only" && !options?.viaJoinCode) {
        return false;
      }

      const status = membershipRequiresApproval(membershipType)
        ? "pending"
        : "active";

      const { error } = await supabase
        .from("club_members")
        .upsert(
          {
            club_id: clubId,
            user_id: user.id,
            role: "member",
            access_level: "member",
            status,
            join_answers: options?.joinAnswers ?? [],
            join_message: options?.joinMessage?.trim() || null,
          },
          { onConflict: "club_id,user_id" },
        );

      if (error) {
        console.error("Failed to join club:", error.message);
        return false;
      }

      if (membershipRequiresApproval(membershipType)) {
        setPendingClubs((prev) =>
          prev.includes(clubId) ? prev : [...prev, clubId],
        );
      } else {
        setJoinedClubs((prev) =>
          prev.includes(clubId) ? prev : [...prev, clubId],
        );
      }

      return true;
    },
    [user],
  );

  const leaveClub = useCallback(
    (clubId: string) => {
      if (!user) return;
      const wasPending = pendingClubs.includes(clubId);
      setJoinedClubs((prev) => prev.filter((id) => id !== clubId));
      setPendingClubs((prev) => prev.filter((id) => id !== clubId));
      supabase
        .from("club_members")
        .delete()
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to leave club:", error.message);
            // Rollback optimistic update to correct state
            if (wasPending) {
              setPendingClubs((prev) =>
                prev.includes(clubId) ? prev : [...prev, clubId],
              );
            } else {
              setJoinedClubs((prev) =>
                prev.includes(clubId) ? prev : [...prev, clubId],
              );
            }
          }
        });
    },
    [user, pendingClubs],
  );

  const toggleSaveClub = useCallback(
    (clubId: string) => {
      if (!user) return;

      setSavedClubs((prev) => {
        const alreadySaved = prev.includes(clubId);
        if (alreadySaved) {
          supabase
            .from("user_clubs")
            .delete()
            .eq("user_id", user.id)
            .eq("club_id", clubId)
            .eq("type", "saved")
            .then(({ error }) => {
              if (error) {
                console.error("Failed to unsave club:", error.message);
                setSavedClubs((p) =>
                  p.includes(clubId) ? p : [...p, clubId],
                );
              }
            });
          return prev.filter((id) => id !== clubId);
        } else {
          supabase
            .from("user_clubs")
            .upsert(
              { user_id: user.id, club_id: clubId, type: "saved" },
              { onConflict: "user_id,club_id,type" },
            )
            .then(({ error }) => {
              if (error) {
                console.error("Failed to save club:", error.message);
                setSavedClubs((p) => p.filter((id) => id !== clubId));
              }
            });
          return [...prev, clubId];
        }
      });
    },
    [user],
  );

  const isJoined = useCallback(
    (clubId: string) => joinedClubs.includes(clubId),
    [joinedClubs],
  );

  const isPending = useCallback(
    (clubId: string) => pendingClubs.includes(clubId),
    [pendingClubs],
  );

  const isSaved = useCallback(
    (clubId: string) => savedClubs.includes(clubId),
    [savedClubs],
  );

  const getUserRole = useCallback(
    (clubId: string): MemberRole | null => userRoles[clubId] ?? null,
    [userRoles],
  );

  /** Create a club; DB trigger inserts creator as owner in club_members. */
  const createClub = useCallback(
    async (fields: Partial<Club>): Promise<string | null> => {
      if (!user) return null;

      // Build the DB row from camelCase fields
      const row: Record<string, unknown> = {
        name: fields.name,
        slug: fields.slug,
        description: fields.description,
        category: fields.category,
        contact_email: fields.contactEmail,
        meeting_schedule: fields.meetingSchedule,
        meeting_location: fields.meetingLocation,
        created_by: user.id,
        is_public: true,
      };
      applySocialLinksToClubPayload(row, fields.socialLinks);

      const { data, error } = await supabase
        .from("clubs")
        .insert(row)
        .select("*")
        .single();

      if (error || !data) {
        console.error("Failed to create club:", error?.message);
        return null;
      }

      // Update local state
      const newClub = mapRow(data);
      setClubs((prev) => [...prev, newClub]);
      setJoinedClubs((prev) => [...prev, newClub.id]);
      setUserRoles((prev) => ({ ...prev, [newClub.id]: "owner" }));

      return newClub.id;
    },
    [user],
  );

  /** Update an existing club in Supabase and refresh local state. */
  const updateClub = useCallback(
    async (clubId: string, fields: Partial<Club>): Promise<boolean> => {
      // Build the DB update payload from camelCase fields
      const row: Record<string, unknown> = {};
      if (fields.name !== undefined) row.name = fields.name;
      if (fields.shortDescription !== undefined)
        row.short_description = fields.shortDescription;
      if (fields.longDescription !== undefined)
        row.long_description =
          sanitizeLongDescriptionForSave(fields.longDescription) ?? null;
      if (fields.category !== undefined) row.category = fields.category;
      if (fields.abbreviation !== undefined)
        row.abbreviation = fields.abbreviation;
      if (fields.brandColor !== undefined) row.brand_color = fields.brandColor;
      if (fields.logoUrl !== undefined) row.logo_url = fields.logoUrl;
      if (fields.bannerUrl !== undefined) row.banner_url = fields.bannerUrl;
      if (fields.requiresApproval !== undefined)
        row.requires_approval = fields.requiresApproval;
      if (fields.membershipType !== undefined)
        row.membership_type = fields.membershipType;
      if (fields.descriptionConfirmed !== undefined)
        row.description_confirmed = fields.descriptionConfirmed;
      if (fields.logoConfirmed !== undefined) row.logo_confirmed = fields.logoConfirmed;
      if (fields.bannerConfirmed !== undefined)
        row.banner_confirmed = fields.bannerConfirmed;
      if (fields.membershipConfirmed !== undefined)
        row.membership_confirmed = fields.membershipConfirmed;
      if (fields.contactEmailConfirmed !== undefined)
        row.contact_email_confirmed = fields.contactEmailConfirmed;
      if (fields.socialLinksConfirmed !== undefined)
        row.social_links_confirmed = fields.socialLinksConfirmed;
      if (fields.meetingScheduleConfirmed !== undefined)
        row.meeting_schedule_confirmed = fields.meetingScheduleConfirmed;
      if (fields.categoryConfirmed !== undefined)
        row.category_confirmed = fields.categoryConfirmed;
      if (fields.meetingLocationConfirmed !== undefined)
        row.meeting_location_confirmed = fields.meetingLocationConfirmed;
      if (fields.contentVisibilityDefaultsConfirmed !== undefined) {
        row.content_visibility_defaults_confirmed =
          fields.contentVisibilityDefaultsConfirmed;
      }
      if (fields.setupSkippedItems !== undefined) {
        row.setup_skipped_items = fields.setupSkippedItems;
      }
      if (fields.meetingLocation !== undefined)
        row.meeting_location = fields.meetingLocation;
      if (fields.joinCode !== undefined) row.join_code = fields.joinCode;
      if (fields.contactEmail !== undefined) row.contact_email = fields.contactEmail;
      if (fields.meetingSchedule !== undefined)
        row.meeting_schedule = fields.meetingSchedule;
      if (fields.socialLinks !== undefined) {
        applySocialLinksToClubPayload(row, fields.socialLinks);
      }
      if (fields.claimStatus !== undefined) row.claim_status = fields.claimStatus;
      if (fields.setupCompleted !== undefined)
        row.setup_completed = fields.setupCompleted;
      if (fields.isPublished !== undefined) row.is_published = fields.isPublished;
      if (fields.customPermissions !== undefined)
        row.custom_permissions = fields.customPermissions;

      const { data, error } = await supabase
        .from("clubs")
        .update(row)
        .eq("id", clubId)
        .select("*")
        .single();

      if (error || !data) {
        console.error("Failed to update club:", error?.message);
        return false;
      }

      // Update local state
      const updated = mapRow(data);
      setClubs((prev) => prev.map((c) => (c.id === clubId ? updated : c)));
      return true;
    },
    [],
  );

  const loading = authLoading || clubsLoading;

  const value = useMemo<ClubContextValue>(
    () => ({
      clubs,
      loading,
      error: clubsError,
      categories,
      getClubById,
      getClubBySlug,
      joinedClubs,
      pendingClubs,
      savedClubs,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isPending,
      isSaved,
      createClub,
      getUserRole,
      userRoles,
      updateClub,
      activeClubId,
      switchClub,
      setActiveClubId: switchClub,
      userClubs: joinedClubs,
    }),
    [
      clubs,
      loading,
      clubsError,
      categories,
      getClubById,
      getClubBySlug,
      joinedClubs,
      pendingClubs,
      savedClubs,
      joinClub,
      leaveClub,
      toggleSaveClub,
      isJoined,
      isPending,
      isSaved,
      createClub,
      getUserRole,
      userRoles,
      updateClub,
      activeClubId,
      switchClub,
      joinedClubs,
    ],
  );

  return <ClubContext value={value}>{children}</ClubContext>;
}
