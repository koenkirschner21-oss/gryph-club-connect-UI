# 🦁 GryphClubConnect — Project Context for Cursor

> This is a **context document**, not a task list. Read this to understand what we're building, why it matters, where we actually are, and what "done well" looks like for this project. Use this as the lens for every decision.

---

## 🎯 The Vision — What This Becomes

**GryphClubConnect** is the operating system for university student clubs. It is a centralized, private communication and management platform built specifically for University of Guelph clubs — and eventually every university in Canada.

The core problem it solves: clubs currently operate across scattered group chats, Instagram DMs, emails, and word of mouth. Members miss updates. Tasks fall through the cracks. Events are disorganized. Club leaders are burned out managing logistics across five different apps. GryphClubConnect puts everything — communication, tasks, events, members — in one structured, purpose-built home.

**The north star:** By September 2026, 10+ active clubs and 200+ users are running their clubs through this app. By 2027, it's expanding to McMaster, Waterloo, and Western. By 2028, it's the standard platform for university clubs across Canada.

**The founder:** Koen Kirschner — a University of Guelph student who lives this problem daily. This is built by students, for students.

---

## 🧩 What the App Is

Each club gets its own **private, secure workspace** inside the app. Think Discord servers — but stripped of gaming culture and rebuilt for organizational management.

Inside every club workspace:

- **Channels** — group chat organized by team (whole club, marketing, events, executives, etc.)
- **Tasks** — assign work to members, track deadlines, mark complete
- **Event Calendar** — create events, send invites, collect RSVPs
- **Member Directory** — everyone's profile, role, and contact info in one place

A user can belong to **multiple clubs simultaneously**. Each appears as a separate space in a sidebar. Switching clubs feels like switching Discord servers — instant, clean, separate.

**What this is NOT:** not a social network, not a public directory, not a replacement for university systems, not a general-purpose messaging app. This is a private club operations tool. The club-joining mechanism is an **access code**, not open discovery.

---

## 🛠 Actual Tech Stack (What's Running Now)

The stack has evolved from the original plan. Here is what is actually in the codebase:

| Layer | Technology |
|-------|------------|
| **Frontend** | React + TypeScript, Vite build |
| **Styling** | Tailwind CSS |
| **Backend / DB** | Supabase (PostgreSQL + Auth + Realtime) — *not* a custom Node/Express server |
| **Real-time** | Supabase Realtime (not Socket.io) |
| **Auth** | Supabase Auth (JWT-based, email verification) |
| **Hosting** | Vercel (frontend, SPA rewrites configured in vercel.json) |
| **Migrations** | Supabase CLI (`supabase db push`), CI via GitHub Actions |

**Important:** The original plan described Node.js + Express + Socket.io + Redis. The actual implementation uses **Supabase as the full backend**. Supabase handles auth, the database, real-time subscriptions, and Row Level Security policies. There is no separate API server. Keep this in mind — suggestions should work within the Supabase architecture, not assume a custom backend.

---

## 🗄 Data Architecture

The database is PostgreSQL managed through Supabase. Key tables:

```
users / profiles    → identity, name, profile picture, email
clubs               → club_id, name, logo, access_code, slug, created_by
club_members        → user_id, club_id, role (owner | admin | member), joined_at
channels            → channel_id, club_id, name, type (general | team | announcements)
messages            → message_id, channel_id, user_id, content, created_at
tasks               → task_id, club_id, title, assigned_to, created_by, deadline, status
events              → event_id, club_id, title, date, location, description, created_by
event_rsvps         → rsvp_id, event_id, user_id, status (going | maybe | not_going)
notifications       → user_id, club_id, type, content, read, created_at
```

**Club membership join model:** `clubs.membership_type` (`open`, `approval_required`, `invite_only`, `no_membership`) is the sole active join source of truth. Legacy `clubs.join_type` and `club_join_votes` are deprecated — see [`docs/LEGACY_JOIN_MODEL.md`](./LEGACY_JOIN_MODEL.md).

**Security model:** Row Level Security (RLS) is the enforcement layer. Policies control who can read and write what — a member of Club A cannot touch Club B's data. This is intentional. Trust the database, not just the frontend.

**Tenant isolation:** Every club is a tenant. RLS policies are the boundary. The most recent migration work unified these policies under a single coherent system (`unified_tenant_rls_and_single_creator_trigger`). This is the current authoritative security checkpoint.

---

## 📍 Where We Actually Are Right Now

The app has moved well past prototype. Here is an honest read of current state:

**What's real and working:**

- Full route map across ~24 page-level components
- Supabase-integrated reads and writes across most surfaces
- Auth context, Club context, Notifications context — layered properly
- 12 custom hooks encapsulating Supabase data access (`useClubMessages`, `useNotifications`, `useClubChannels`, dashboard aggregations, etc.)
- Realtime notifications — singleton provider at app root, channel lifecycle stabilized
- RLS security across club data — membership-first loading, tenant boundaries enforced
- Migration CI — GitHub Actions workflow pushes migrations to Supabase on merge to main
- Production build passing (`tsc -b && vite build`, single JS chunk ~584kB)

**What's on the feature branch right now (not yet on main):**

The branch `cursor/fix-notifications-realtime-lifecycle` is 6 commits ahead of `main`, covering:

- Unified tenant RLS and single creator trigger
- Migration versioning fixes (unique timestamps, no collisions)
- Channel migrations split into clean layers (schema / data / RLS / cleanup)
- Realtime notification subscription lifecycle hardening
- Singleton notification provider

This branch is a clean linear extension of main — merging is a fast-forward with no conflict surface.

**What's genuinely not mature yet:**

- **No automated tests** — zero test files in the repo. Regression safety is manual. This is the biggest quality gap.
- **Docs lag the code** — the README describes an older version of the app (references `src/data/` which doesn't exist, route names that have changed). New contributors would follow a wrong mental model.
- **No `.env.example`** — onboarding a new dev requires figuring out environment variables from somewhere else
- **No route guards for admin UI** — `/app/admin/*` is behind login but not behind a role check in React. Enforcement is RLS, which is correct, but the UI doesn't cleanly redirect non-admins
- **Bundle size** — single JS chunk >500kB, no code splitting. No perf budget in CI
- **Migration history complexity** — there's a manual repair document for environments that ran old migration versions. Long-lived databases need careful `db push` management

---

## 🏁 What "Done" Looks Like for This Project

Not just "it builds." Done means:

**For a feature:**

- Supabase data operations work correctly with RLS in place (not just as a logged-in admin)
- Realtime subscriptions clean up properly — no memory leaks, no duplicate listeners
- Mobile-responsive — works on a phone, not just a desktop
- The feature serves a club member's actual workflow, not a developer's mental model

**For the codebase overall:**

- `npm run build` passes with no TypeScript errors
- Feature branch merged to main, migration pushed to Supabase via CI
- New contributors can get running from the README without asking questions
- Critical flows have at least smoke-test coverage (the current zero-test state is a gap we want to close)

**For the product:**

- A club president can create a club, invite their exec team, set up channels, post an announcement, assign tasks, and create an event — without hitting a bug or a confusing UI moment
- A new member can sign up, enter an access code, and be participating in their club's workspace within 2 minutes
- A student belonging to 3 clubs can switch between them instantly and never see one club's data bleed into another

---

## 🎓 The User We're Building For

**Primary user:** A University of Guelph student who is on 2-3 clubs. They're used to Discord and Instagram. They do not read documentation. They expect things to just work. They are time-poor and easily disengaged if the app slows them down.

**Secondary user:** A club president or exec who is managing a team of volunteers. They need to delegate tasks, keep members informed, and coordinate events — without spending their entire week on logistics. They are the power user who will decide if the club adopts GryphClubConnect or sticks to WhatsApp.

**Tertiary (future):** University of Guelph Student Life department — potential institutional licensing partner. They care about aggregate engagement data and platform reliability.

---

## 🔭 The Bigger Picture — Why This Matters

University of Guelph has ~30,000 students and 200-300 active clubs. Every one of those clubs has the same problem. If GryphClubConnect works at Guelph, the exact same model applies to McMaster, Waterloo, Western, and every other Canadian university.

The multi-tenancy architecture being built right now — one platform, each club fully isolated — is also the foundation for one platform, each university fully isolated. The RLS work happening today is not just security hygiene; it's the infrastructure for national expansion.

Revenue model: freemium. Free tier covers everything clubs need to run. Premium adds analytics, file storage, custom branding. Institutional licensing to universities is the long-term monetization path. We do not monetize at the cost of adoption — keep the core free and working.

---

## ⚠️ Things to Keep in Mind

- **Supabase is the backend.** There is no Node/Express server. Auth, data, realtime, and security all run through Supabase. Suggestions that assume a custom API server don't fit the architecture.
- **RLS is the security layer.** Do not work around it in the frontend. If a user shouldn't see data, the database policy should prevent it — not a frontend conditional.
- **Migration order matters.** The migration history has been carefully sequenced. New migrations should use `IF NOT EXISTS` guards. Do not assume a fresh database — long-lived environments need safe, idempotent SQL.
- **Realtime subscriptions leak if mishandled.** The recent stabilization work fixed a crash in strict mode. New realtime features should follow the singleton/provider pattern established in the notifications system.
- **The bundle is already big.** Avoid importing heavy libraries without considering code splitting. No new large dependencies without a reason.
- **This is a club management tool.** Every feature decision should pass the test: "does this help a club run better?" If it doesn't, it's out of scope.
