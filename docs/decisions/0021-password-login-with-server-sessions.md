---
summary: Web login is email + password (scrypt from node:crypto) with opaque server-side sessions in Postgres, sent as an HttpOnly cookie; no public sign-up, users come from an ops script or an invitation.
read_when: Working on login, logout, sessions, the auth middleware, user creation, password reset, or cookies.
updated: 2026-09-25
---

# 0021. Password login with server-side sessions

- **Status:** Accepted
- **Date:** 2026-09-25

## Context
- The web needs a login before any route can be used. The users are the couple, later a few friends.
- The app talks only to Anthropic and WhatsApp. There's no email sending, and the WhatsApp channel
  doesn't exist yet.
- The server is small (4 cores, ~5 GB free RAM), one Node process, no Redis.
- The dashboard may be reached through a public URL (Cloudflare Tunnel, `../operations/deploy.md`),
  so the login must hold up on the open internet.

## Decision
**Passwords**
- Hashed with `scrypt` from `node:crypto`, OWASP parameters: `N = 2^17`, `r = 8`, `p = 1`,
  16-byte random salt, 64-byte key. Stored in `users.password_hash` as
  `scrypt$<N>$<r>$<p>$<salt>$<hash>`, so the parameters can grow without a migration.
- Compared with `timingSafeEqual`. A login for an unknown email still runs one scrypt against a
  fixed dummy hash, so the timing doesn't reveal which emails exist.
- 12 to 128 characters, no composition rules (NIST 800-63B). The rule lives in `@financas/shared`
  so the web form checks it too.

**Sessions**
- Opaque random token (`generateToken()`, 32 bytes). The `sessions` table stores only its SHA-256
  (`hashToken()`), the same pattern as invitations.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` outside local development, named
  `__Host-session` in production and `session` in development.
- Expires 30 days after the last use. `last_seen_at` and `expires_at` are refreshed at most once per
  hour, so reads don't turn into a write per request.
- Logout deletes the session row. Changing the password deletes every other session of the user.
- `sessions` is a global table (no `workspace_id`, no RLS), like `users`. Rows are hard deleted:
  they're technical records, not user data (ADR 0016 covers user-facing tables).

**Abuse**
- CSRF: `SameSite=Lax` plus Hono's `csrf()` middleware (Origin check) on every non-GET request.
- Brute force: an in-memory limiter per email and per IP address on the login route. It resets on
  restart, which is fine for a single process.
- Every failure answers the same `401 INVALID_CREDENTIALS`.

**Where users come from**
- No public sign-up.
- The first user is created by an ops script (`pnpm ops:create-user`), which also creates their
  first workspace.
- Everyone else joins through an invitation link: the accept page creates the user with a password
  when the email doesn't exist yet, or asks them to log in first.
- Password reset: an ops script for now. A code sent over WhatsApp comes when the channel exists.

## Alternatives considered
- Magic link by email: needs an email provider, a new outbound dependency and a new secret.
- Code over WhatsApp: the channel isn't built yet. It stays the planned second factor and the reset path.
- argon2id: better against GPUs, but it needs a native dependency. scrypt at OWASP parameters is
  also memory-hard and ships with Node.
- Signed stateless cookies or JWT: they can't be revoked one by one, and they need a
  `SESSION_SECRET` to manage. A row lookup per request is cheap at this scale.
- A library such as better-auth or lucia: it brings its own tables and flows that clash with the
  model (global users, workspaces, invitations). The part we need is small.

## Consequences
- No auth secret to manage: `SESSION_SECRET` leaves the env list.
- One indexed lookup on `sessions` per request.
- A login costs about 128 MB of memory for a moment (scrypt). Fine for a few users. The rate
  limiter caps the worst case.
- The rate limit and the dummy hash make logins slow to brute force. A second factor is future
  work (WhatsApp code).
- Follow-up: the `identity` module (sessions table, password hashing, login and logout services),
  the auth middleware, the ops scripts, and the invitation accept page in the web.
