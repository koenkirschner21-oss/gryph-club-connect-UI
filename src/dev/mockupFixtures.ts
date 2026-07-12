/**
 * Dummy fixtures for the DEV-only website mockup gallery.
 * Obviously fake data only — never seed with real students, clubs, or applicants.
 */

export const MOCKUP_RED = "#E51937";
export const MOCKUP_GOLD = "#FFC429";
export const MOCKUP_BG = "#0B0B0B";
export const MOCKUP_BG_RAISED = "#111111";
export const MOCKUP_CARD = "#1A1A1A";
export const MOCKUP_CARD_ALT = "#131313";
export const MOCKUP_BORDER = "#222222";
export const MOCKUP_BORDER_SOFT = "rgba(255,255,255,0.08)";
export const MOCKUP_TEXT = "#F5F5F5";
export const MOCKUP_MUTED = "#777777";
export const MOCKUP_MUTED_SOFT = "#555555";

export type MockClub = {
  id: string;
  name: string;
  abbreviation: string;
  category: string;
  description: string;
  meeting: string;
  status: "Open" | "Request to Join" | "Following" | "Recruiting";
  memberCount: number;
  role?: "Member" | "Executive" | "President";
};

export type MockStudent = {
  id: string;
  name: string;
  initials: string;
};

export type MockEvent = {
  id: string;
  title: string;
  clubName: string;
  dateLabel: string;
  month: string;
  day: string;
  time: string;
  location: string;
};

export type MockTask = {
  id: string;
  title: string;
  clubName: string;
  dueLabel: string;
  status: "To Do" | "In Progress" | "Due Soon";
  urgency: "none" | "soon" | "overdue";
};

export type MockAnnouncement = {
  id: string;
  title: string;
  clubName: string;
  preview: string;
  timeAgo: string;
};

export type MockPendingRequest = {
  id: string;
  clubName: string;
  abbreviation: string;
  statusLabel: string;
};

export type MockApplication = {
  id: string;
  roleTitle: string;
  clubName: string;
  status: string;
};

export const MOCK_STUDENTS: MockStudent[] = [
  { id: "s1", name: "Alex Chen", initials: "AC" },
  { id: "s2", name: "Jordan Blake", initials: "JB" },
  { id: "s3", name: "Sam Rivera", initials: "SR" },
  { id: "s4", name: "Taylor Ng", initials: "TN" },
  { id: "s5", name: "Maya Patel", initials: "MP" },
];

export const MOCK_CLUBS: MockClub[] = [
  {
    id: "c1",
    name: "Gryphon Debate Society",
    abbreviation: "GDS",
    category: "Academic",
    description: "Weekly debates, tournaments, and public speaking workshops for Gryphons.",
    meeting: "Thursdays · 7:00 PM · UC 441",
    status: "Open",
    memberCount: 48,
    role: "Member",
  },
  {
    id: "c2",
    name: "Agora Design Club",
    abbreviation: "ADC",
    category: "Arts & Culture",
    description: "Product design critiques, Figma nights, and campus portfolio reviews.",
    meeting: "Tuesdays · 6:30 PM · Thornbrough 1200",
    status: "Recruiting",
    memberCount: 32,
    role: "Executive",
  },
  {
    id: "c3",
    name: "Northside Hiking Club",
    abbreviation: "NHC",
    category: "Sports & Recreation",
    description: "Day hikes, gear tips, and weekend trips around Guelph and beyond.",
    meeting: "Sundays · 9:00 AM · UC Courtyard",
    status: "Request to Join",
    memberCount: 61,
  },
  {
    id: "c4",
    name: "Lang Marketing Association",
    abbreviation: "LMA",
    category: "Career & Professional",
    description: "Case comps, guest speakers, and brand strategy projects with peers.",
    meeting: "Wednesdays · 5:30 PM · MACS 121",
    status: "Following",
    memberCount: 74,
  },
  {
    id: "c5",
    name: "Guelph Photography Club",
    abbreviation: "GPC",
    category: "Arts & Culture",
    description: "Photo walks, darkroom sessions, and student exhibition nights.",
    meeting: "Fridays · 4:00 PM · Zavitz Hall",
    status: "Open",
    memberCount: 39,
    role: "Member",
  },
];

export const MOCK_EVENTS: MockEvent[] = [
  {
    id: "e1",
    title: "Fall Kickoff Social",
    clubName: "Gryphon Debate Society",
    dateLabel: "Sep 12",
    month: "SEP",
    day: "12",
    time: "6:00 PM",
    location: "UC Courtyard",
  },
  {
    id: "e2",
    title: "Weekly General Meeting",
    clubName: "Agora Design Club",
    dateLabel: "Sep 16",
    month: "SEP",
    day: "16",
    time: "6:30 PM",
    location: "Thornbrough 1200",
  },
  {
    id: "e3",
    title: "Intro Photo Walk",
    clubName: "Guelph Photography Club",
    dateLabel: "Sep 19",
    month: "SEP",
    day: "19",
    time: "4:00 PM",
    location: "Campus Arboretum",
  },
  {
    id: "e4",
    title: "Exec Strategy Night",
    clubName: "Agora Design Club",
    dateLabel: "Sep 22",
    month: "SEP",
    day: "22",
    time: "7:00 PM",
    location: "Zoom",
  },
  {
    id: "e5",
    title: "Club Fair Prep Session",
    clubName: "Lang Marketing Association",
    dateLabel: "Sep 25",
    month: "SEP",
    day: "25",
    time: "5:00 PM",
    location: "MACS Lobby",
  },
];

export const MOCK_TASKS: MockTask[] = [
  {
    id: "t1",
    title: "Book room for AGM",
    clubName: "Agora Design Club",
    dueLabel: "Due Tomorrow",
    status: "Due Soon",
    urgency: "soon",
  },
  {
    id: "t2",
    title: "Post Instagram graphic",
    clubName: "Guelph Photography Club",
    dueLabel: "Due in 3 days",
    status: "In Progress",
    urgency: "none",
  },
  {
    id: "t3",
    title: "Send sponsor follow-up",
    clubName: "Lang Marketing Association",
    dueLabel: "Due Today",
    status: "Due Soon",
    urgency: "soon",
  },
  {
    id: "t4",
    title: "Review event sign-ups",
    clubName: "Gryphon Debate Society",
    dueLabel: "Due Fri",
    status: "To Do",
    urgency: "none",
  },
  {
    id: "t5",
    title: "Update club profile",
    clubName: "Agora Design Club",
    dueLabel: "No due date",
    status: "To Do",
    urgency: "none",
  },
];

export const MOCK_ANNOUNCEMENTS: MockAnnouncement[] = [
  {
    id: "a1",
    title: "Welcome to Fall semester",
    clubName: "Gryphon Debate Society",
    preview: "Kickoff social this Friday — bring a friend and your best icebreaker.",
    timeAgo: "2 hours ago",
  },
  {
    id: "a2",
    title: "Volunteer call for Orientation",
    clubName: "Agora Design Club",
    preview: "We need 4 volunteers to help run the booth at Clubs Day.",
    timeAgo: "Yesterday",
  },
  {
    id: "a3",
    title: "Photo walk weather update",
    clubName: "Guelph Photography Club",
    preview: "Meet at Zavitz if it rains — indoor still-life session instead.",
    timeAgo: "2 days ago",
  },
];

export const MOCK_PENDING_REQUESTS: MockPendingRequest[] = [
  {
    id: "p1",
    clubName: "Northside Hiking Club",
    abbreviation: "NHC",
    statusLabel: "Request Pending",
  },
];

export const MOCK_APPLICATIONS: MockApplication[] = [
  {
    id: "app1",
    roleTitle: "Events Coordinator",
    clubName: "Agora Design Club",
    status: "Under Review",
  },
  {
    id: "app2",
    roleTitle: "Social Media Coordinator",
    clubName: "Guelph Photography Club",
    status: "Interview Invite",
  },
  {
    id: "app3",
    roleTitle: "First-Year Representative",
    clubName: "Gryphon Debate Society",
    status: "Submitted",
  },
];

export const MOCK_CATEGORIES = [
  "All",
  "Academic",
  "Arts & Culture",
  "Career & Professional",
  "Sports & Recreation",
] as const;

export const MOCK_WORKSPACE_NAV = [
  { label: "Dashboard", active: true },
  { label: "Announcements", active: false, badge: 2 },
  { label: "Tasks", active: false, badge: 4 },
  { label: "Events", active: false },
  { label: "Members", active: false, badge: 3 },
  { label: "Hiring", active: false, badge: 5 },
  { label: "Documents", active: false },
  { label: "Club Settings", active: false },
] as const;

export const MOCK_SETUP_CHECKLIST = [
  { label: "Club description", done: true },
  { label: "Logo & banner", done: true },
  { label: "Membership settings", done: true },
  { label: "First announcement", done: false },
  { label: "Publish on Explore", done: false },
] as const;

export const MOCK_JOIN_QUEUE = [
  { name: "Jordan Blake", initials: "JB", program: "BComm · 2nd year" },
  { name: "Sam Rivera", initials: "SR", program: "BSc · 1st year" },
  { name: "Taylor Ng", initials: "TN", program: "BA · 3rd year" },
] as const;
