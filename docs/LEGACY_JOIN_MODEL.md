# Legacy join model (`join_type` / `club_join_votes`)

**Status (2026-07): deprecated — do not use for new features.**

The active source of truth for how students join a club is **`clubs.membership_type`**:

| `membership_type`     | Public join behavior (current app)                          |
|-----------------------|-------------------------------------------------------------|
| `open`                | Instant join from public profile / join code                |
| `approval_required`   | Application queue (`club_members.status = pending`)         |
| `invite_only`         | Join code / executive invite only                           |
| `no_membership`       | No general membership; hiring/events may still be public    |

Implemented in `src/lib/clubJoinUtils.ts` (`normalizeMembershipType`, `membershipRequiresApproval`, etc.) and enforced in `ClubContext.joinClub`, RLS (`20260723000001_lock_down_club_members_self_rls.sql`), public profile UI, and club settings.

---

## Deprecated schema (retained, not dropped)

### `clubs.join_type`

- **Values:** `open`, `application`, `vote` (added in `20260530000002_club_join_structures.sql`).
- **Superseded by:** `membership_type` (`20260610000001_membership_types.sql` backfilled from `join_type` + `requires_approval`).
- **Constraint removed:** `clubs_join_type_check` was dropped in the membership-types migration; column may still exist on long-lived DBs.
- **App usage:** None for join **behavior**. The frontend still **maps** `join_type` onto `Club.joinType` in `ClubContext` and `Explore.tsx`, but **no component reads `club.joinType`** for UI or join logic (verified 2026-07 audit).

### `clubs.requires_approval`

- Legacy boolean paired with early `join_type`; superseded by `membership_type = 'approval_required'`.
- Still mapped on `Club.requiresApproval` but join flows use `membershipType` exclusively.

### `club_join_votes`

- Table from `20260530000002_club_join_structures.sql` for executive voting on applicants when `join_type = 'vote'`.
- **App usage:** None. No frontend or RPC reads/writes this table. Only referenced in migrations and test-account reset SQL.
- **Replacement:** `approval_required` uses pending `club_members` + exec approval in the members UI, not a separate vote table.

### Deprecated TypeScript helpers

In `src/lib/clubJoinUtils.ts` (marked `@deprecated`):

- `normalizeJoinType`, `joinTypeBadgeStyle`, `joinTypeBadgeLabel`
- `ClubJoinType` / `Club.joinType` on `src/types/index.ts`

Prefer `membershipType`, `membershipBadgeStyle`, `membershipBadgeLabel`.

---

## Active join paths (all `membership_type`)

| Area | File(s) |
|------|---------|
| Join from context | `src/context/ClubContext.tsx` (`joinClub`) |
| Public profile join / apply | `src/pages/ClubPublicProfilePage.tsx` |
| Join with code | `src/pages/app/JoinClubPage.tsx` |
| Club settings | `src/pages/app/ClubSettingsPage.tsx` (writes `membership_type`) |
| Member access hook | `src/hooks/useClubMembers.ts` |
| RLS self-join | `supabase/migrations/20260723000001_lock_down_club_members_self_rls.sql` |

---

## Future cleanup (out of scope until explicitly scheduled)

- Drop `clubs.join_type`, `clubs.requires_approval` (if still present), and `club_join_votes` via migration after confirming no external consumers.
- Remove dead `Club.joinType` mapping and deprecated helpers from the frontend bundle.

Do **not** reintroduce vote-based admission without a product decision; `invite_only` + exec invites cover controlled membership today.
