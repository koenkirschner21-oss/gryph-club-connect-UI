// ---------------------------------------------------------------------------
// Public-facing Club (used for discovery / explore)
// ---------------------------------------------------------------------------
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
  createdBy?: string;
  createdAt?: string;
}

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
  createdBy?: string;
  createdAt?: string;
}

export interface EventRsvp {
  id: string;
  eventId: string;
  userId: string;
  status: "going" | "maybe" | "not_going";
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------
export type MemberRole = "admin" | "exec" | "member";
export type MemberStatus = "active" | "pending";

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Channels & Messages (workspace chat)
// ---------------------------------------------------------------------------
export type ChannelType = "general" | "announcements" | "team";

export interface Channel {
  id: string;
  clubId: string;
  name: string;
  type: ChannelType;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  authorName?: string;
  authorAvatar?: string;
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  clubId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  assigneeName?: string;
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
// Club claim requests
// ---------------------------------------------------------------------------
export type ClaimStatus = "pending" | "approved" | "rejected";

export interface ClubClaimRequest {
  id: string;
  clubId: string;
  userId: string;
  message: string;
  status: ClaimStatus;
  createdAt: string;
}
