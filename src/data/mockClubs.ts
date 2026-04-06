import type { Club } from "../types";

export const mockClubs: Club[] = [
  {
    id: "gryphon-robotics",
    name: "Gryphon Robotics Club",
    description:
      "Build robots, compete in national competitions, and learn about mechanical and electrical engineering. We welcome all skill levels from beginners to advanced builders.",
    category: "Engineering",
    memberCount: 85,
    meetingSchedule: "Wednesdays 6:00 PM",
    location: "Thornbrough Building, Room 1307",
    imageUrl: "/assets/placeholders/placeholder-rect.svg",
    tags: ["Engineering", "Technology", "Competition"],
    contactEmail: "robotics@uoguelph.ca",
    socialLinks: {
      website: "https://example.com",
      instagram: "https://instagram.com",
      discord: "https://discord.gg",
    },
    events: [
      {
        id: "e1",
        title: "Intro to Arduino Workshop",
        date: "2026-04-15",
        time: "6:00 PM",
        location: "Thornbrough 1307",
        description:
          "Hands-on workshop for beginners to learn Arduino microcontroller basics.",
      },
      {
        id: "e2",
        title: "Competition Prep Meeting",
        date: "2026-04-22",
        time: "6:00 PM",
        location: "Thornbrough 1307",
        description:
          "Preparation session for the upcoming national robotics competition.",
      },
    ],
  },
  {
    id: "debate-society",
    name: "University of Guelph Debate Society",
    description:
      "Sharpen your public speaking and critical thinking skills through competitive and casual debate formats including British Parliamentary and Canadian National style.",
    category: "Academic",
    memberCount: 42,
    meetingSchedule: "Tuesdays 7:00 PM",
    location: "MacKinnon Building, Room 029",
    imageUrl: "/assets/placeholders/placeholder-rect.svg",
    tags: ["Academic", "Public Speaking", "Competition"],
    contactEmail: "debate@uoguelph.ca",
    socialLinks: {
      instagram: "https://instagram.com",
    },
    events: [
      {
        id: "e3",
        title: "Novice Debate Night",
        date: "2026-04-17",
        time: "7:00 PM",
        location: "MacKinnon 029",
        description:
          "Friendly debate night for new members to practice and learn formats.",
      },
    ],
  },
  {
    id: "hiking-club",
    name: "Guelph Hiking & Outdoors Club",
    description:
      "Explore the trails around Guelph and beyond. We organize weekly hikes, camping trips, and nature photography outings for all fitness levels.",
    category: "Recreation",
    memberCount: 120,
    meetingSchedule: "Saturdays 9:00 AM",
    location: "Meet at UC Courtyard",
    imageUrl: "/assets/placeholders/placeholder-rect.svg",
    tags: ["Outdoors", "Fitness", "Social"],
    contactEmail: "hiking@uoguelph.ca",
    socialLinks: {
      website: "https://example.com",
      instagram: "https://instagram.com",
    },
    events: [
      {
        id: "e4",
        title: "Elora Gorge Day Hike",
        date: "2026-04-19",
        time: "9:00 AM",
        location: "Elora Gorge Trail",
        description:
          "A scenic day hike through the Elora Gorge Conservation Area.",
      },
      {
        id: "e5",
        title: "Spring Camping Trip",
        date: "2026-05-02",
        time: "All Day",
        location: "Algonquin Provincial Park",
        description:
          "Weekend camping trip with guided trails and campfire activities.",
      },
    ],
  },
  {
    id: "photography-club",
    name: "Gryphon Photography Society",
    description:
      "A community for photography enthusiasts of all levels. We host photo walks, workshops, and exhibitions throughout the academic year.",
    category: "Arts",
    memberCount: 65,
    meetingSchedule: "Thursdays 5:30 PM",
    location: "Zavitz Hall, Room 120",
    imageUrl: "/assets/placeholders/placeholder-rect.svg",
    tags: ["Arts", "Creative", "Social"],
    contactEmail: "photo@uoguelph.ca",
    events: [
      {
        id: "e6",
        title: "Golden Hour Photo Walk",
        date: "2026-04-16",
        time: "5:30 PM",
        location: "Campus Arboretum",
        description:
          "Capture the beauty of campus during golden hour with fellow photographers.",
      },
    ],
  },
  {
    id: "cs-club",
    name: "Computer Science Club",
    description:
      "The CS Club brings together students interested in programming, hackathons, tech talks, and collaborative coding projects.",
    category: "Technology",
    memberCount: 150,
    meetingSchedule: "Mondays 6:00 PM",
    location: "Reynolds Building, Room 219",
    imageUrl: "/assets/placeholders/placeholder-rect.svg",
    tags: ["Technology", "Programming", "Hackathons"],
    contactEmail: "csclub@uoguelph.ca",
    socialLinks: {
      website: "https://example.com",
      discord: "https://discord.gg",
    },
    events: [
      {
        id: "e7",
        title: "Hackathon Kickoff",
        date: "2026-04-25",
        time: "6:00 PM",
        location: "Reynolds 219",
        description: "24-hour hackathon with prizes for the best projects.",
      },
      {
        id: "e8",
        title: "Tech Talk: AI in 2026",
        date: "2026-04-20",
        time: "6:00 PM",
        location: "Reynolds 219",
        description:
          "Guest speaker on the latest developments in artificial intelligence.",
      },
    ],
  },
  {
    id: "dance-team",
    name: "Guelph Dance Team",
    description:
      "Express yourself through dance! We cover styles including hip hop, contemporary, jazz, and K-pop. No experience needed to join.",
    category: "Arts",
    memberCount: 55,
    meetingSchedule: "Mon & Wed 8:00 PM",
    location: "Athletics Centre, Studio 3",
    imageUrl: "/assets/placeholders/placeholder-rect.svg",
    tags: ["Arts", "Fitness", "Performance"],
    contactEmail: "dance@uoguelph.ca",
    socialLinks: {
      instagram: "https://instagram.com",
    },
    events: [
      {
        id: "e9",
        title: "Spring Showcase",
        date: "2026-04-28",
        time: "7:00 PM",
        location: "War Memorial Hall",
        description:
          "Annual dance showcase featuring all styles and special guest performances.",
      },
    ],
  },
];

export const categories = [
  "All",
  "Academic",
  "Arts",
  "Engineering",
  "Recreation",
  "Technology",
];
