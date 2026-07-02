# Notifications, Inbox & Badge Audit

**Gryph Club Connect — report-only audit**  
**Date:** May 29, 2026  
**Scope:** Schema, trigger inventory, UI badge indicators, known-bug cross-check, email infrastructure  
**Status:** Read-only investigation; no code or data was modified for this audit.

---

## Executive summary

The app uses **three parallel attention systems**:

1. **`notifications`** — bell / alerts dropdown (global navbar + dashboard stat card)
2. **`inbox_messages`** — action-oriented messages (dashboard Inbox tab)
3. **`direct_messages.read_by`** — chat unread (club workspace sidebar + per-conversation pills)

Additional client-only tracking uses **`localStorage` visit timestamps** for Tasks and Announcements sidebar badges in the club workspace.

**Key gaps for a notification strategy:**

- Duplicate bell rows when DB triggers and client `notifyUsers()` both fire (announcements, events, tasks)
- Inbox DB CHECK constraint missing types the app tries to insert (`join_request_submitted`, `club_request_approved`, `club_request_rejected`)
- Many lifecycle events have no notification at all (event cancel, meetings, documents, hiring role posted, member removed, role changes, reports, ordinary chat messages)
- `notification_preferences` on profiles is saved in UI but **not enforced** on send paths
- No transactional email integration exists
- Main dashboard has **no Chat sidebar**; Inbox is a top tab, not a sidebar item

---

## 1. Schema audit

### 1.1 `notifications` table

Source migrations: `20260406_create_base_tables.sql`, `20260407_enhance_notifications_and_interests.sql`

| Column | Type | Nullability | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | NOT NULL | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL | FK → `auth.users`, ON DELETE CASCADE |
| `type` | `text` | NOT NULL | Default `'club_update'`; **no DB CHECK constraint** |
| `message` | `text` | NOT NULL | Default `''` |
| `read` | `boolean` | NOT NULL | Default `false` |
| `club_id` | `uuid` | NULLABLE | FK → `clubs`, ON DELETE CASCADE |
| `reference_id` | `uuid` | NULLABLE | Added in enhance migration |
| `created_at` | `timestamptz` | NOT NULL | Default `now()` |

**Indexes:** `idx_notifications_user_id`, partial `idx_notifications_unread` on `(user_id) WHERE read = false`.

**Frontend mismatch:** The TypeScript `Notification` type includes optional `link`, but no `link` column exists in migrations. `NotificationsDropdown` reads `row.link` if present; it will always be undefined from the DB.

---

### 1.2 `inbox_messages` table

Source migrations: `20260610000007_inbox_messages.sql`, `20260612000004_claim_inbox_message_types.sql`

| Column | Type | Nullability | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | NOT NULL | PK |
| `recipient_id` | `uuid` | NULLABLE | FK → `auth.users` |
| `sender_id` | `uuid` | NULLABLE | FK → `auth.users` |
| `type` | `text` | NOT NULL | CHECK constraint (see below) |
| `title` | `text` | NOT NULL | |
| `message` | `text` | NOT NULL | |
| `action_required` | `boolean` | NULLABLE | Default `false` |
| `action_completed` | `boolean` | NULLABLE | Default `false` |
| `action_type` | `text` | NULLABLE | |
| `action_data` | `jsonb` | NULLABLE | Default `'{}'` |
| `club_id` | `uuid` | NULLABLE | FK → `clubs` |
| `reference_id` | `uuid` | NULLABLE | |
| `reference_type` | `text` | NULLABLE | |
| `read` | `boolean` | NULLABLE | Default `false` |
| `created_at` | `timestamptz` | NULLABLE | Default `now()` |

**Allowed `type` values (DB CHECK):**

`interview_invite`, `interview_confirmed`, `role_offer`, `club_invite`, `executive_invite`, `ownership_transfer`, `join_approved`, `join_rejected`, `club_claim_approved`, `club_claim_rejected`, `application_update`, `offer_accepted`, `offer_declined`, `admin_message`, `candidate_selected_time`, `invite_accepted`, `invite_declined`, `role_updated`, `system_message`

**Schema/code mismatch — types used in app but NOT in CHECK:**

| Type | Used in |
|------|---------|
| `join_request_submitted` | `notifyJoinRequestSubmitted()` in `src/lib/notifications.ts` |
| `club_request_approved` | `notifyClubRequestApproved()` |
| `club_request_rejected` | `notifyClubRequestRejected()` |

These inserts will fail at the DB unless the constraint was altered outside migrations.

---

### 1.3 Other unread / attention-tracking storage

| Mechanism | Location | Purpose |
|-----------|----------|---------|
| `direct_messages.read_by` | `uuid[]` (default `'{}'`) | Per-message read receipts; primary chat unread source |
| `notifications.read` | `boolean` | Bell notification read state |
| `inbox_messages.read` | `boolean` | Inbox read state |
| `inbox_messages.action_completed` | `boolean` | Action-required inbox completion |
| `conversation_members.joined_at` | `timestamptz` | Message **visibility** cutoff (migration C3), not unread |
| `localStorage` keys | `WorkspaceLayout` (`tasksVisitedKey`, `announcementsVisitedKey`) | Client-only “last visited” for Tasks/Announcements sidebar badges |
| `profiles.notification_preferences` | JSONB (used in UI) | User toggles for `chat_messages`, `chat_mentions`, etc. — **referenced in frontend but no migration found in repo** |
| `message_reactions` | separate table | Reactions only; not unread tracking |
| Post reactions / views | `20260526000001` | Engagement metrics, not nav badges |

**Not present:** `last_read_at` on `conversation_members`, dedicated seen/view tables beyond `read_by`.

---

### 1.4 Triggers, RPCs, and edge functions

#### DB triggers → `notifications` (via `create_notification()` SECURITY DEFINER)

Source: `20260521000001_fix_notification_triggers_and_rls.sql`

| Trigger | Table / event | Recipients | Type |
|---------|---------------|------------|------|
| `on_new_announcement` | `posts` INSERT | Active members except author | `announcement` |
| `on_new_event` | `events` INSERT | Active members except creator | `new_event` |
| `on_task_assigned` | `tasks` INSERT | Assignee | `task_assigned` |
| `on_task_assigned_update` | `tasks` UPDATE OF `assigned_to` | New assignee (when changed) | `task_assigned` |
| `on_member_joined` | `club_members` INSERT | Active owners/admins/exec (not joiner) | `join_approved` (message: “{name} joined your club”) |

#### RPCs

| RPC | Inserts into | Called by |
|-----|--------------|-----------|
| `send_app_notifications(p_notifications jsonb)` | `notifications` | `notifyUsers()` → most client-side bell notifications |
| `send_inbox_messages(p_messages jsonb)` | `inbox_messages` | `createInboxMessage()` in `src/lib/inboxUtils.ts` |
| `create_notification(...)` | `notifications` | DB triggers only (GRANT: `service_role`) |

Source: `20260614000001_fix_notification_bell.sql`, `20260622000001_claim_notification_trail.sql`

#### Edge function

| Function | Inserts into | Notes |
|----------|--------------|-------|
| `supabase/functions/send-notification/index.ts` | `notifications` | Fallback when RPC fails; **no email sending** — DB insert only |

#### Direct client inserts (bypass RPC)

| Path | Table | Notes |
|------|-------|-------|
| `EventRSVPPage.tsx` | `notifications` | Self RSVP confirmation (`club_update`); direct insert, RLS `user_id = auth.uid()` |
| `createInboxMessage()` fallback | `inbox_messages` | Direct insert if RPC fails |

**No DB triggers insert into `inbox_messages`.**

---

## 2. Trigger inventory by category

Legend: **Bell** = `notifications` row; **Inbox** = `inbox_messages` row.

| Category | Bell | Inbox | Code path |
|----------|------|-------|-----------|
| Announcement posted | Yes (duplicate) | No | DB trigger `on_new_announcement` + client `useClubPosts.createPost` → `notifyUsers` (`announcement`) |
| New event created | Yes (duplicate) | No | DB trigger `on_new_event` + client `useClubEvents.createEvent` → `notifyUsers` (`new_event`) |
| Event sign-up / RSVP | Yes (self only) | No | `EventRSVPPage` direct insert — confirmation to registrant only; no notify to club/event organizers |
| Event cancelled | No | No | `ClubEventsPage` deletes events; no notification code |
| Meeting invite / updated / cancelled | No | No | `MeetingCreateFlow` / `MeetingDetailView` — CRUD only |
| Task assigned | Yes (duplicate) | No | DB trigger `on_task_assigned` (+ update trigger) + client `ClubTasksPage` on create + comment flows reuse `task_assigned` |
| Task due soon | No | No | Dashboard shows overdue/due-soon banners only; no notification rows |
| Task overdue | No | No | UI banners on `DashboardPage`, not notifications |
| Task completed | No | No | Status updates in `ClubTasksPage`; no notify |
| Hiring: new role posted | No | No | `ClubRecruitingPage` inserts `hiring_listings`; no notify |
| Hiring: application submitted | Yes | Yes | `notifyHiringApplicationSubmitted` — applicant bell + `application_update` inbox; reviewers bell + `admin_message` inbox |
| Hiring: application status changed | Partial | Partial | Interview invite, send update, reject, offer → inbox via `CandidateReviewPanel`; reviewer bells via `notifyReviewers` (`club_update`) |
| Hiring: interview scheduled | Reviewer bell only | Yes (`interview_invite`) | `CandidateReviewPanel` schedule interview flow |
| Hiring: offer sent | Reviewer bell only | Yes (`role_offer`) | `CandidateReviewPanel` accept flow |
| Join request submitted | Yes | Yes* | `notifyJoinRequestSubmitted` — student + executives; inbox type `join_request_submitted` **may fail CHECK** |
| Join request approved | Yes | Yes | `notifyJoinRequestApproved` + inbox `join_approved` |
| Join request rejected | Yes | No | `notifyJoinRequestRejected` — bell only; inbox type `join_rejected` exists but unused |
| User added to club | Yes (leaders) | No | DB trigger `on_member_joined` on active INSERT — uses type `join_approved` with “joined your club” message |
| User removed from club | No | No | `useClubMembers.removeMember` — no notify |
| Role/permission changed | No | No | `updateRole` in `useClubMembers`; inbox type `role_updated` exists in schema but never inserted |
| Club claim submitted | Yes | Yes | `notifyClaimRequestSubmitted` |
| Club claim approved / rejected / more info | Yes | Yes | `notifyClaimRequestApproved` / `Rejected` / `MoreInfo` |
| Club request submitted | Yes | Yes* | `notifyClubRequestSubmitted` |
| Club request approved / rejected / more info | Yes | Yes* | Admin flows in `AdminPage`; `club_request_*` inbox types **may fail CHECK** |
| New document uploaded | No | No | `ClubDocumentsPage` insert only |
| New direct message | No | No | Chat uses `read_by` only; UI handles `direct_message` bell type but nothing creates it |
| New group message | No | No | Same — unread via `read_by` |
| @mention in chat | Yes | No | `useConversations.sendMessage` → `notifyUsers` with type `mention` |
| Reports / safety flags | No | No | `ReportClubModal` inserts `club_reports`; admins view in `AdminPage` — no notify |

\* Inbox insert may fail due to CHECK constraint mismatch.

### Additional flows

| Flow | Bell | Inbox |
|------|------|-------|
| Executive invite | Yes (`club_update`) | Yes (`executive_invite`) |
| Executive invite accepted / declined | Yes (inviter) | Yes (`invite_accepted` / `invite_declined`) |
| Ownership transfer | Yes (`club_update`) | Yes (`ownership_transfer`) |
| Club join-code invite link | No | No — `ClubInviteModal` creates `club_invites` + link only |
| Executive invite request (member asks owner) | Yes (`club_update` to owners) | No |

### Duplicate-notification note

Announcements, events, and task assignment currently fire from **both** DB triggers and client `notifyUsers`, so recipients can receive **two** bell rows per action when created through the app hooks.

---

## 3. Badge / indicator inventory

### 3.1 Main Dashboard (`/app`)

| Location | Shows indicator? | Data source | Clears on view? |
|----------|------------------|-------------|-----------------|
| Navbar bell (`NotificationsDropdown`) | Yes — red count (9+ cap) | `notifications` where `user_id = current` and `read = false` | Click item → mark read; “Mark all read”; syncs dashboard via `notifyUnreadCountRefresh()` |
| “UNREAD ALERTS” stat card | Yes — numeric value | Same `notifications` unread count | Navigates to Overview tab; does not auto-mark read |
| Overview tab | Yes — badge on tab | `unreadNotificationCount` | No auto-clear |
| Inbox tab | Yes — badge on tab | `useInbox` → `inbox_messages` where `read = false` | Detail modal auto-marks read; “Mark all read”; card actions |
| Main Dashboard sidebar Chat | **N/A** | No global dashboard sidebar; chat is `/app/clubs/:clubId/chat` | — |
| Main Dashboard sidebar Inbox | **N/A** | Inbox is a top tab, not a sidebar item | — |
| Overdue / due-soon banners | Yes — attention strips | `tasks` query (`due_date` vs today) | Navigate to Tasks tab only |

### 3.2 Club workspace sidebar (`WorkspaceLayout`)

| Nav item | Badge? | Data source | Clears on view? |
|----------|--------|-------------|-----------------|
| Dashboard | No | — | — |
| Announcements | Yes | `posts` count where `created_at > localStorage` visit timestamp | Visiting `/announcements` or nav click writes timestamp |
| Chat | Yes | `direct_messages` in club convos where sender ≠ user and user ∉ `read_by` | Open conversation → `mark_conversation_read` RPC + `CLUB_CHAT_READ_EVENT` reload; also reload on `/chat` route |
| Tasks | Yes | Open assigned `tasks` where `created_at > localStorage` visit timestamp | Visiting `/tasks` or nav click writes timestamp |
| Events | No | — | — |
| Meetings | No | — | — |
| Documents | No | — | — |
| Members | Yes (approvers only) | `pendingJoinRequestCount` when `canApproveMembers` | Action queue — clears when pending list empty (realtime on `club_members`) |
| Hiring | No | — | — |
| Analytics | No | — | — |
| Club Settings | No | — | — |

Realtime refresh for workspace badges: `direct_messages`, `conversations` UPDATE, `tasks`, `posts` INSERT.

### 3.3 Other indicators

| Location | Type | Source |
|----------|------|--------|
| Club chat conversation list | Per-conversation unread pill | `useConversations` / `read_by` |
| Club Command Center | Pending join + hiring counts | `pendingMembers`, hiring snapshot — not sidebar badges |
| Dashboard task rows | Due-date urgency pills | `taskDueBadgeConfig` |
| Explore / club cards | Status chips | Not unread |
| Admin reports tab | Status badge styling | Not unread count |
| `NotificationBell` component | Unread badge | **Unused** in nav; `Navbar` uses `NotificationsDropdown` |
| `NotificationsProvider` | Global realtime | Powers `NotificationBell` if mounted; separate from dropdown fetch |

### 3.4 Notification preferences (stored, not enforced)

`profiles.notification_preferences` toggles (`chat_messages`, `chat_mentions`, etc.) are saved from `PersonalSettingsPage` and `MyMembershipPanel` but **no send path checks them** before creating mentions or chat-related notifications.

---

## 4. Known-bug cross-check

### 4.1 Members sidebar pending-join-request indicator

**Status: Shipped and implemented.**

- `useClubWorkspaceNav` exposes `pendingJoinRequestCount` (approver-only via `canApproveMembers`)
- `WorkspaceLayout` maps `badgeKey: "members"` to that count
- `useClubMembers` subscribes to realtime `club_members` changes

This is an **action queue** count, not a read/unread indicator.

### 4.2 Chat unread badge clearing on conversation open

**Status: Shipped (Batch C4); present in current code.**

Flow when a conversation is opened:

1. `useConversations` calls `mark_conversation_read` RPC (respects `joined_at` visibility cutoff)
2. Local `unreadCount` zeroed for that conversation
3. `notifyClubChatRead(clubId)` dispatches `CLUB_CHAT_READ_EVENT`
4. `WorkspaceLayout` listener calls `loadBadgeCounts()` to refresh sidebar Chat badge
5. `ClubChatPage` marks any legacy `notifications` type `direct_message` for that club as read

**Residual nuances:**

- Sidebar badge may still show unread until a specific thread is opened (visiting `/chat` alone reloads counts but does not mark all read)
- No bell notifications are created for ordinary messages — bell and chat unread are decoupled

---

## 5. Email infrastructure

**No transactional email integration is implemented for app notifications.**

| Checked | Result |
|---------|--------|
| Resend / SendGrid / Nodemailer / SMTP send code | Not found (only UI “Resend” buttons for invites/transfers) |
| `supabase/functions/send-notification` | Inserts into `notifications` only — no email |
| `supabase/config.toml` | SMTP block commented out (example SendGrid config) |
| Supabase Auth email | Standard auth config only; not wired to club notifications |

All notification delivery today is **in-app only** (bell + inbox + chat `read_by` badges).

---

## 6. Recommended next steps (for strategy doc)

1. **Pick one write path per event** — remove duplicate DB trigger vs client `notifyUsers` for announcements, events, tasks.
2. **Fix inbox CHECK constraint** — add `join_request_submitted`, `club_request_approved`, `club_request_rejected`; add migration for `profiles.notification_preferences` if missing in prod.
3. **Define channel matrix** — which events go to bell vs inbox vs chat badge vs email (future).
4. **Enforce `notification_preferences`** on mention and future chat bell paths.
5. **Fill lifecycle gaps** — join rejected inbox, event cancel, meetings, documents, hiring role posted, member removed, role changes, reports.
6. **Clarify dashboard IA** — no global Chat nav; document that Inbox is tab-based.

---

## Appendix: Key source files

| Area | Files |
|------|-------|
| Bell send | `src/lib/notifyUsers.ts`, `src/lib/notifications.ts` |
| Inbox send | `src/lib/inboxUtils.ts` |
| Bell UI | `src/components/ui/NotificationsDropdown.tsx`, `src/hooks/useNotifications.ts` |
| Inbox UI | `src/hooks/useInbox.ts`, `src/pages/dashboard/InboxTab.tsx` |
| Workspace badges | `src/components/workspace/WorkspaceLayout.tsx`, `src/hooks/useClubWorkspaceNav.ts` |
| Chat read | `src/hooks/useConversations.ts`, `src/lib/clubChatEvents.ts` |
| DB triggers | `supabase/migrations/20260521000001_fix_notification_triggers_and_rls.sql` |
| RPCs | `supabase/migrations/20260622000001_claim_notification_trail.sql` |
| Edge function | `supabase/functions/send-notification/index.ts` |
