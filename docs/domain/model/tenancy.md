---
summary: Identity and multi-tenancy tables — users, WhatsApp identities, workspaces, memberships, invitations — and all settings/preferences tables (financial period, installment view, notifications).
read_when: Working on auth, workspaces, memberships, invitations, settings screens, or anything scoped by tenant.
updated: 2026-09-26
---

# Tenancy, identity and settings

## Concepts
- **User:** a person who logs in. Global, not owned by a workspace.
- **Workspace:** an isolated space with its own accounts, entries and settings (e.g. "Casa", "Pessoal"). Anyone can create several. Workspaces never share data. A grouped view across workspaces is a future feature, built as a read-only aggregation, never as shared rows.
- **Membership:** links a user to a workspace with a role. The role grants module × action permissions (`access-control.md`). There's no per-record privacy inside a workspace.

## Global tables
### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | citext unique | Login identifier |
| `display_name` | text not null | |
| `password_hash` | text null | `scrypt$N$r$p$salt$hash` (ADR 0021). Null until the user sets a password |
| `email_verified_at` | timestamptz null | Login is refused while null (ADR 0021) |
| `disabled_at` | timestamptz null | |

### `channel_identities`: how a user is reached and recognized outside the web
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | FK users | |
| `channel` | enum `notification_channel` (`whatsapp`, `email`) | |
| `address` | text | WhatsApp: E.164 (`+55...`). Unique per channel. |
| `verified_at` | timestamptz null | Only verified identities can talk to the agent |

The WhatsApp agent looks up `channel_identities` → `user` → the workspace (`user_preferences.default_workspace_id`, switchable by message).

### `sessions`
Web sessions (ADR 0021). Global table: no `workspace_id`, no RLS, hard deleted. Implemented in
`modules/identity`; passwords are hashed by `core/security/passwords.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | FK users | Cascade on user delete |
| `token_hash` | text unique | SHA-256 of the cookie token. The raw token exists only in the cookie |
| `expires_at` | timestamptz | 30 days after the last use |
| `last_seen_at` | timestamptz | Refreshed at most once per hour, together with `expires_at` |
| `user_agent` | text null | Shown in a future "active sessions" list (cut to 512 characters) |

**Flow** (`identity` service; rules in `@financas/shared` `identity.schemas.ts`):
- `createUser()` trims and lowercases the email, checks the name and the password (12–128
  characters), hashes it and inserts the user, verified or not. A taken email (any case) is
  `EMAIL_TAKEN`.
- `login()` answers `INVALID_CREDENTIALS` for a wrong password, an unknown email, a disabled user or
  a malformed input, always after the same scrypt work. A correct password on an unverified email is
  `EMAIL_NOT_VERIFIED`. On success it rehashes an outdated password and starts a 30-day session,
  returning the raw token once.
- `resolveSession()` turns a cookie token into the user. It deletes expired sessions and sessions of
  disabled users, and renews `last_seen_at` / `expires_at` when the last renewal is an hour old.
- `logout()` deletes the session. Doing it twice is harmless.
- `signUp()` is refused with `SIGNUP_DISABLED` unless `PUBLIC_SIGNUP_ENABLED`. It checks the input,
  hashes the password, creates an unverified user and emails a verification link. If the email
  already has an account, nothing changes: the owner gets a "you already have an account" email
  with their stored name (never the name typed in the form) and a link to reset the password.
- `requestEmailVerification()` emails a new link to an unverified, active user and retires the
  old one. For anyone else it silently does nothing.
- `verifyEmail()` uses the token in one statement: it marks the token used and the email verified
  only if the token is an unused `email_verification` token that hasn't expired. Anything else is
  `LINK_INVALID`.
- `requestPasswordReset()` emails a 1-hour reset link to an active user (retiring the previous
  one). For anyone else it silently does nothing.
- `resetPassword()` checks the new password first, so a bad one doesn't spend the link, then checks
  the link with a read-only query before hashing, so a fake link costs no scrypt work. Then one
  statement uses the token (unused, unexpired, `password_reset`, active user), stores the new hash,
  marks the email verified (the link proved the user reads it) and deletes every session. The owner
  gets a "your password was changed" email with a link to reset it again. Anything else is
  `LINK_INVALID`.
- Email links carry the token in the URL fragment (`/verify-email#token=...`), which browsers never
  send to a server or put in a `Referer`. The web page reads it and posts it to the API.
- The routes for sign-up, verification requests and forgotten passwords answer `202` without
  waiting for the work, so the response time doesn't reveal which branch ran
  (`POST /api/auth/signup`, `/verify-email/resend`, `/password/forgot`).

### `auth_tokens`
Single-use email links (ADR 0021). Global table, no RLS, hard deleted once expired.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | FK users | Cascade on user delete |
| `purpose` | enum `auth_token_purpose` (`email_verification`, `password_reset`) | |
| `token_hash` | text unique | SHA-256 of the token in the link |
| `expires_at` | timestamptz | 24 hours (verification) or 1 hour (reset) after creation |
| `used_at` | timestamptz null | Set when the link is used. A used or expired token is refused |

## Tenant tables
### `workspaces`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Also the tenant key |
| `name` | text not null | |
| `created_by_user_id` | FK users | |
| `archived_at` | timestamptz null | |

### `memberships` (module `members`)
| Column | Type | Notes |
|---|---|---|
| `workspace_id`, `user_id` | FKs | `unique (workspace_id, user_id)` among non-deleted |
| `role_id` | composite FK to `roles` | Permissions come from the role (`access-control.md`) |
| `deleted_at`, `deleted_by_user_id` | | Removing a member is a soft delete; a removed user can be added again. |

**Owner invariant** (deferred constraint triggers): a workspace can't be created without an owner
membership, the last active owner can't be removed or demoted, and the owner role can't lose its
`owner` key. Erasing the whole workspace is still allowed.

**Creating a workspace** (`createWorkspace()` in `modules/onboarding`): reserve the id with
`uuidv7()`, then in one workspace-scoped transaction insert the workspace and its settings, the system ledger
accounts (`ledger.md`), the four system roles with the default matrix, and the creator's owner
membership.

### `invitations` (module `members`)
| Column | Notes |
|---|---|
| `workspace_id`, `id` | |
| `email` / `phone_e164` | Exactly one (`num_nonnulls = 1`), format-checked (E.164 `+` and 8–15 digits) |
| `role_id` | Composite FK: a role of the same workspace |
| `token_hash` | SHA-256 of a random 32-byte base64url token. Globally unique. The raw token exists only in the invite link |
| `invited_by_user_id` | |
| `expires_at` | 7 days after creation (after `created_at`, CHECK) |
| `accepted_at` + `accepted_by_user_id` | Set together (CHECK) |
| `deleted_at` | Revoking = soft delete |

One pending invitation per contact and workspace (partial unique indexes). RLS isolated.

**Flow** (`members` service):
- `createInvitation()` retires expired pending invitations of the same contact (soft delete, reason
  `expired`), generates the token, stores its hash, and returns the raw token for the link. A second
  pending invitation for the same contact is `409 INVITATION_PENDING`.
- `listPendingInvitations()` returns invitations not accepted, not revoked and not expired.
- `revokeInvitation()` soft deletes a pending invitation (reason `revoked`); an accepted or revoked
  one is a `ConflictError`.
- `acceptInvitation(token, userId)` hashes the token, finds the workspace with the SECURITY DEFINER
  function `invitation_workspace_id()` (ADR 0019; `user_workspace_ids()` is the other such
  lookup, see `access-control.md`), then inside that workspace locks the invitation
  row (`FOR UPDATE`, so concurrent accepts of one token let exactly one user in), refuses revoked,
  accepted or expired invitations and existing members (`ConflictError` codes), adds the member with
  the invited role, and marks the invitation accepted.
- **Who may accept (user decision, 2026-09-26):** an email invitation can only be accepted by a
  user logged in with that same email, so a forwarded or leaked link is useless to anyone else. A
  phone invitation is accepted by whoever holds the link until the WhatsApp channel can verify the
  number. `acceptInvitation()` checks it inside the locked transaction
  (`403 INVITATION_FOR_ANOTHER_EMAIL`; the invitation stays open for the right user).
- `describeInvitation()` reads an open invitation by token without locking it, for the preview.

**Routes** (`onboarding.routes.ts`, under `/api/workspaces/:workspaceId/invitations`):
| Route | Permission | Behavior |
|---|---|---|
| `GET /` | `members:view` | pending invitations |
| `POST /` `{ email \| phoneE164, roleId }` | `members:create` | `onboarding.inviteMember()`: the role must be active in the workspace (`ROLE_NOT_AVAILABLE`), and **only an owner may invite an owner** (`403 OWNER_ONLY`). Answers `201 { invitationId, expiresAt, shareableLink }`. **An email invitation's link goes only to that inbox** (emailed in the background, `workspace_invitation`), so `shareableLink` is `null`: holding the token then proves access to the email, which the sign-up through an invitation relies on. A phone invitation has no channel yet, so its link comes back for the inviter to share |
| `DELETE /:invitationId` | `members:delete` | revoke → `204` |

Answering an invitation (`/api/invitations`, `onboarding.routes.ts`):
| Route | Access | Behavior |
|---|---|---|
| `POST /preview` `{ token }` | public | workspace name, inviter name, role name, invited email (or phone flag), expiry |
| `POST /accept` `{ token }` | session | joins with the invited role; email invitations only for the same email → `{ workspaceId, membershipId }` |
| `POST /sign-up` `{ token, displayName, password, email? }` | public | for someone without an account, with public sign-up on or off. The invitation is checked **before** hashing the password. An email invitation creates the account with the **invited** email (a typed one is ignored), already verified, since only that inbox received the link. A phone invitation needs `email` (`EMAIL_REQUIRED`): the account starts unverified, joins, and gets a verification email; login waits for it. An email that already has an account is `409 EMAIL_TAKEN` (log in and accept instead) → `201 { workspaceId, membershipId, isEmailVerified }` |

An unknown token is `404 INVITATION_NOT_FOUND` and counts against the client's invalid-link limit
(`INVALID_LINKS_PER_IP_PER_HOUR`); over it, `429`.

They live in `onboarding` because they span `members`, `access`, `identity` and email, and because
`members` can't import `access` (which already imports `members`) without a cycle.

## Workspace routes (`workspaces.routes.ts`)
| Route | Access | Behavior |
|---|---|---|
| `POST /api/workspaces` `{ name }` | session | anyone creates workspaces they own (`onboarding.createWorkspace`) → `201 { workspaceId }` |
| `PATCH /api/workspaces/:workspaceId` `{ name }` | `settings:update` | rename → `204` |
| `GET /api/workspaces/:workspaceId/settings` | `settings:view` | every setting below |
| `PATCH /api/workspaces/:workspaceId/settings` | `settings:update` | `workspaceSettingsChangeSchema` (shared): currency, time zone (IANA), locale, financial period (anchor and value together; `calendar_month` clears the value), installment view, budget base, week start → the updated settings. Pix and charge settings come with contacts. A value the DB rules refuse is `400 SETTINGS_INVALID` |

The enum values (`PERIOD_ANCHORS`, `INSTALLMENT_BUDGET_VIEWS`, `BUDGET_BASES`) live in
`@financas/shared` (`workspaces.constants.ts`), so the tables and the web use the same lists.

## Settings (typed 1:1 tables)
### `workspace_settings` (PK = `workspace_id`, module `workspaces`)
Created with defaults by `createWorkspace()`. Every rule below is a CHECK constraint.

| Column | Type | Default | Meaning |
|---|---|---|---|
| `currency` | char(3) | `BRL` | Default currency for new accounts |
| `timezone` | text | `America/Sao_Paulo` | All "today" logic |
| `locale` | text | `pt-BR` | Formatting and agent language |
| `period_anchor` | enum `period_anchor`: `calendar_month`, `day_of_month`, `nth_business_day` | `calendar_month` | How the **financial month** starts |
| `period_anchor_value` | smallint null | null | Day (1–31) or N (1–10), depending on the anchor |
| `installment_budget_view` | enum: `purchase_month`, `per_installment` | `per_installment` | How installment purchases count in budgets (reports only, see `ledger.md`) |
| `budget_base` | enum `budget_base`: `fixed_income`, `all_income` | `fixed_income` | The budget is sized from fixed income only (the household policy) |
| `variable_income_target_account_id` | FK ledger_accounts null | null | Where the "guardar o variável" suggestion moves money (e.g. the reserve). **Added with the ledger PR** (needs `ledger_accounts`) |
| `week_starts_on` | smallint | 0 (Sunday) | |
| `pix_receiving_key` | text null | null | Key put in charge messages (Pix copia-e-cola) |
| `pix_receiver_name`, `pix_receiver_city` | text null | null | Required by the Pix payload format |
| `contact_messages_daily_cap` | smallint | 20 | Anti-ban guard for charges to contacts |
| `charge_reminder_every_days` | smallint null | 3 | Re-send interval for unpaid charges; null = no reminders |

**Financial period examples** (`planning.md` has the algorithm):
| Anchor | Value | Period labeled `2026-10` |
|---|---|---|
| `calendar_month` | — | 2026-10-01 → 2026-10-31 |
| `day_of_month` | 5 | 2026-10-05 → 2026-11-04 |
| `day_of_month` | 31 | 2026-10-31 → 2026-11-29 (a day missing in a month → last day of that month) |
| `nth_business_day` | 5 | 5th business day of October → the day before the 5th business day of November (uses `holidays`) |

### `user_preferences` (PK = `user_id`, module `identity`, global)
`language` (tag like `pt-BR`), `quiet_hours_start` / `quiet_hours_end` (set as a pair; no
notifications in that window). Removed with the user.

**Deferred:** `default_workspace_id` (which workspace the WhatsApp agent uses). It would make
`identity` and `workspaces` depend on each other, so it's decided in the WhatsApp PR (options: a
small table in `members`, or an FK declared only in SQL).

### `membership_preferences` (PK = `workspace_id, user_id`, module `members`)
Created with defaults by `addMember()`. Kept when a member leaves and comes back.

| Column | Default | Meaning |
|---|---|---|
| `notify_bills_days_before` | 3 | Reminder lead time for bills and invoices |
| `notify_channel` | `whatsapp` | |
| `notify_daily_digest` | false | |
| `notify_budget_threshold_pct` | 80 | Alert when a category reaches this % of its budget |
| `notify_variable_income` | true | Suggest moving variable income to savings when it arrives |
