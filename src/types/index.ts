// ---------------------------------------------------------------------------
// Public-facing Club (used for discovery / explore)
// ---------------------------------------------------------------------------
import type { ClubPermissions } from "../lib/clubPermissions";

export type { ClubPermissions };
export type ClubJoinType = "open" | "application" | "vote";

export type MembershipType =
  | "open"
  | "approval_required"
  | "invite_only"
  | "no_membership";

export type ClaimStatus = "unclaimed" | "claim_pending" | "claimed" | "active";

export type ClaimRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "more_info";

export type JoinQuestionType = "short" | "long" | "multiple_choice";

export interface JoinQuestion {
  id: string;
  question: string;
  question_type: JoinQuestionType;
  required?: boolean;
  order_index: number;
  options?: string[];
}

export interface JoinAnswer {
  id?: string;
  question: string;
  answer: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  longDescription?: string;
  category: string;
  memberCount: number;
  meetingSchedule: string;
  meetingLocation?: string;
  location: string;
  imageUrl: string;
  logoUrl?: string;
  bannerUrl?: string;
  brandColor?: string;
  tags: string[];
  contactEmail: string;
  isPublic: boolean;
  isFeatured?: boolean;
  isVerified?: boolean;
  abbreviation?: string;
  joinCode?: string;
  socialLinks?: {
    website?: string;
    instagram?: string;
    discord?: string;
  };
  events: ClubEvent[];
  requiresApproval?: boolean;
  joinType?: ClubJoinType;
  membershipType?: MembershipType;
  descriptionConfirmed?: boolean;
  logoConfirmed?: boolean;
  bannerConfirmed?: boolean;
  membershipConfirmed?: boolean;
  contactEmailConfirmed?: boolean;
  socialLinksConfirmed?: boolean;
  meetingScheduleConfirmed?: boolean;
  claimStatus?: ClaimStatus;
  setupCompleted?: boolean;
  isPublished?: boolean;
  joinQuestions?: JoinQuestion[];
  allowJoinFileUpload?: boolean;
  createdBy?: string;
  createdAt?: string;
  customPermissions?: ClubPermissions;
}

// ---------------------------------------------------------------------------
// Content visibility
// ---------------------------------------------------------------------------
export type Visibility = "public" | "members_only" | "executives_only";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export interface ClubEvent {
  id: string;
  clubId?: string;
  title: string;
  description: string;
  date: string;
  time: string;
  startAt?: string;
  endAt?: string;
  location: string;
  visibility?: Visibility;
  /** Event author (auth user id). */
  createdBy?: string;
  createdAt?: string;
  creatorName?: string;
  creatorAvatar?: string;
}

export type RsvpStatus = "going" | "maybe" | "not_going";

export interface EventRsvp {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpStatus;
  createdAt?: string;
  fullName?: string;
  avatarUrl?: string;
  program?: string;
}

export interface RsvpCounts {
  going: number;
  maybe: number;
  not_going: number;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------
export type MemberRole = "owner" | "executive" | "member";
export type MemberStatus = "active" | "pending";
export type AccessLevel =
  | "president"
  | "managerial_executive"
  | "executive"
  | "member";

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: MemberRole;
  accessLevel?: AccessLevel;
  status: MemberStatus;
  joinedAt: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  program?: string;
  yearOfStudy?: string;
  roleTitle?: string;
  joinAnswers?: JoinAnswer[];
  joinMessage?: string;
}

// ---------------------------------------------------------------------------
// Messages (workspace chat)
// ---------------------------------------------------------------------------
export interface Message {
  id: string;
  clubId: string;
  authorId: string;
  channelId?: string;
  channel: string;
  content: string;
  createdAt: string;
  authorName?: string;
  authorAvatar?: string;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "general" | "event" | "hiring" | "setup" | "meeting";

export interface Task {
  id: string;
  clubId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskType: TaskType;
  linkedEventId?: string;
  linkedMeetingId?: string;
  linkedHiringListingId?: string;
  linkedEventTitle?: string;
  linkedMeetingTitle?: string;
  linkedMeetingStatus?: "upcoming" | "completed" | "cancelled";
  linkedHiringTitle?: string;
  assignedTo?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  creatorName?: string;
  creatorAvatar?: string;
  dueDate?: string;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------
export interface Profile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  university?: string;
  program?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Legacy compat – user_clubs row
// ---------------------------------------------------------------------------
/** Row shape returned by `supabase.from("user_clubs")`. */
export interface UserClubRow {
  id: string;
  user_id: string;
  club_id: string;
  type: "joined" | "saved";
  created_at: string;
}

// ---------------------------------------------------------------------------
// Posts / Announcements
// ---------------------------------------------------------------------------
export interface Post {
  id: string;
  clubId: string;
  authorId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  authorName?: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  linkUrl?: string | null;
  visibility?: Visibility;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export interface ClubDocument {
  id: string;
  clubId: string;
  uploadedBy?: string | null;
  name: string;
  description?: string | null;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  category: string;
  createdAt: string;
  visibility?: Visibility;
  uploaderName?: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationType =
  | "new_event"
  | "club_update"
  | "announcement"
  | "task_assigned"
  | "join_approved"
  | "join_request_submitted"
  | "new_join_request"
  | "join_rejected"
  | "new_claim_request"
  | "claim_submitted"
  | "claim_approved"
  | "claim_rejected"
  | "claim_more_info";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  clubId?: string;
  referenceId?: string;
  link?: string;
  clubName?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// User interests (onboarding)
// ---------------------------------------------------------------------------
export interface UserInterest {
  id: string;
  userId: string;
  category: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Club claim requests
// ---------------------------------------------------------------------------
export interface ClubClaimRequest {
  id: string;
  clubId: string;
  submittedBy: string;
  roleInClub: string;
  message?: string;
  proofUrl?: string;
  contactEmail?: string;
  status: ClaimRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}
