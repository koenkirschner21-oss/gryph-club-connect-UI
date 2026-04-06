export interface Club {
  id: string;
  name: string;
  description: string;
  category: string;
  memberCount: number;
  meetingSchedule: string;
  location: string;
  imageUrl: string;
  tags: string[];
  contactEmail: string;
  socialLinks?: {
    website?: string;
    instagram?: string;
    discord?: string;
  };
  events: ClubEvent[];
}

export interface ClubEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
}

/** Row shape returned by `supabase.from("user_clubs")`. */
export interface UserClubRow {
  id: string;
  user_id: string;
  club_id: string;
  type: "joined" | "saved";
  created_at: string;
}
