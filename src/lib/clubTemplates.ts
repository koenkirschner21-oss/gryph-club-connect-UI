export type TemplatePickerType = "announcement" | "event" | "hiring" | "task";

export interface AnnouncementTemplate {
  id: string;
  label: string;
  title: string;
  content: string;
}

export interface EventTemplate {
  id: string;
  label: string;
  title: string;
  description: string;
}

export interface HiringTemplate {
  id: string;
  label: string;
  title: string;
  description: string;
}

export interface TaskTemplate {
  id: string;
  label: string;
  title: string;
  description: string;
}

export type ContentTemplate =
  | AnnouncementTemplate
  | EventTemplate
  | HiringTemplate
  | TaskTemplate;

export interface AppliedAnnouncementTemplate {
  title: string;
  content: string;
}

export interface AppliedDescriptionTemplate {
  title: string;
  description: string;
}

export const announcementTemplates: AnnouncementTemplate[] = [
  {
    id: "welcome",
    label: "Welcome Announcement",
    title: "Welcome to [Club Name]!",
    content:
      "We are excited to welcome you to [Club Name]! We are a community of students passionate about [category]. Stay tuned for upcoming events, announcements, and ways to get involved.",
  },
  {
    id: "recruitment",
    label: "Recruitment Announcement",
    title: "We are Recruiting!",
    content:
      "[Club Name] is looking for passionate students to join our executive team. If you are interested in [category], we want to hear from you. Check out our open positions and apply today.",
  },
];

export const eventTemplates: EventTemplate[] = [
  {
    id: "general_meeting",
    label: "First General Meeting",
    title: "First General Meeting",
    description:
      "Join us for our first general meeting of the year! We will be introducing the executive team, sharing our plans for the semester, and answering any questions you may have.",
  },
  {
    id: "info_night",
    label: "Info Night",
    title: "Info Night",
    description:
      "Come learn about [Club Name]! This is a casual event where you can meet the team, learn about what we do, and find out how to get involved.",
  },
  {
    id: "meet_execs",
    label: "Meet the Execs",
    title: "Meet the Executives",
    description:
      "Come meet the [Club Name] executive team! This is a great opportunity to learn about each exec role and connect with the people running the club.",
  },
  {
    id: "social",
    label: "Social Event",
    title: "[Club Name] Social",
    description:
      "Join us for a casual social event! This is a great opportunity to meet other members, have fun, and build community.",
  },
  {
    id: "weekly_meeting",
    label: "Weekly Meeting",
    title: "Weekly Team Meeting",
    description:
      "Weekly team meeting to discuss progress, priorities, and upcoming tasks.",
  },
];

export const hiringTemplates: HiringTemplate[] = [
  {
    id: "events_coord",
    label: "Events Coordinator",
    title: "Events Coordinator",
    description:
      "We are looking for an organized and creative Events Coordinator to help plan and execute club events throughout the year.",
  },
  {
    id: "marketing_coord",
    label: "Marketing Coordinator",
    title: "Marketing Coordinator",
    description:
      "We are looking for a Marketing Coordinator to manage our social media presence and help promote club events and initiatives.",
  },
  {
    id: "treasurer",
    label: "Treasurer",
    title: "Treasurer",
    description:
      "We are looking for a detail-oriented Treasurer to manage club finances, track expenses, and help with budgeting.",
  },
  {
    id: "first_year_rep",
    label: "First-Year Representative",
    title: "First-Year Representative",
    description:
      "We are looking for an enthusiastic first-year student to represent the interests of new members and help with outreach.",
  },
  {
    id: "general_exec",
    label: "General Executive",
    title: "General Executive",
    description:
      "We are looking for motivated students to join our executive team and contribute to the growth and success of [Club Name].",
  },
];

export const taskTemplates: TaskTemplate[] = [
  {
    id: "setup_profile",
    label: "Complete Club Profile",
    title: "Complete Club Profile",
    description:
      "Fill out all club profile details including description, logo, banner, and contact information.",
  },
  {
    id: "invite_execs",
    label: "Invite Executive Team",
    title: "Invite Executive Team Members",
    description:
      "Send invites to all executive team members so they can access the club workspace.",
  },
  {
    id: "first_event",
    label: "Plan First Event",
    title: "Plan and Create First Club Event",
    description:
      "Create the first club event of the semester and promote it to members.",
  },
  {
    id: "social_media",
    label: "Set Up Social Media",
    title: "Set Up Club Social Media",
    description:
      "Create or update club Instagram, LinkedIn, and other social media accounts and add links to the club profile.",
  },
];

export function getTemplatesForType(type: TemplatePickerType): ContentTemplate[] {
  switch (type) {
    case "announcement":
      return announcementTemplates;
    case "event":
      return eventTemplates;
    case "hiring":
      return hiringTemplates;
    case "task":
      return taskTemplates;
  }
}

export function applyTemplateText(
  text: string,
  clubName: string,
  category: string,
): string {
  const categoryLabel = category.trim() || "your field";
  return text
    .replace(/\[Club Name\]/g, clubName)
    .replace(/\[category\]/g, categoryLabel);
}

export function applyAnnouncementTemplate(
  template: AnnouncementTemplate,
  clubName: string,
  category: string,
): AppliedAnnouncementTemplate {
  return {
    title: applyTemplateText(template.title, clubName, category),
    content: applyTemplateText(template.content, clubName, category),
  };
}

export function applyDescriptionTemplate(
  template: EventTemplate | HiringTemplate | TaskTemplate,
  clubName: string,
  category: string,
): AppliedDescriptionTemplate {
  return {
    title: applyTemplateText(template.title, clubName, category),
    description: applyTemplateText(template.description, clubName, category),
  };
}

export function templatePreviewText(template: ContentTemplate): string {
  if ("content" in template) return template.content;
  return template.description;
}

export function templateTypeLabel(type: TemplatePickerType): string {
  switch (type) {
    case "announcement":
      return "Announcement";
    case "event":
      return "Event";
    case "hiring":
      return "Hiring Role";
    case "task":
      return "Task";
  }
}
