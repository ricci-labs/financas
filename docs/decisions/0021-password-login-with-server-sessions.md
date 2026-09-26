---
summary: Web login is email + password (scrypt from node:crypto) with opaque server-side sessions in Postgres, sent as an HttpOnly cookie; public sign-up is a config switch (off by default), with email verification and password reset by email.
read_when: Working on login, logout, sign-up, sessions, the auth middleware, email verification, password reset, or cookies.
updated: 2026-09-25
---

# 0021. Password login with server-side sessions

- **Status:** Accepted
- **Date:** 2026-09-25

## Context
- The web needs a login before any route can be used. The users are the couple, later a few friends.
- The app will send email (ADR 0022), so verification and reset links can go by email. The
  WhatsApp channel doesn't exist yet.
- Today the users are the couple, but the app should be able to open to friends (roadmap phase 3)
  without code changes.
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
- Sign-up and "forgot password" always answer the same "check your email", whether the email
  exists or not. They're rate limited like the login.

**Where users come from**
- **Public sign-up is a switch:** `PUBLIC_SIGNUP_ENABLED` (env, default `false`). When off, the
  sign-up route answers `403 SIGNUP_DISABLED` and the web hides the link (`GET /api/auth/config`
  tells it). It's an instance setting, not a workspace setting, because users are global.
- Sign-up creates the user unverified and emails a verification link. Login is refused
  (`403 EMAIL_NOT_VERIFIED`, only after a correct password) until the link is used. Signing up with an existing email sends that
  address a "you already have an account" email instead, so nothing leaks.
- Invitations work with sign-up on or off: the accept page creates the user when the email doesn't
  exist yet, or asks them to log in first. Accepting an email invitation with that same email
  counts as verifying it.
- The first user can also be created by an ops script (`pnpm ops:create-user`, already verified),
  so an instance with sign-up off can be bootstrapped.

**Email tokens** (verification and password reset)
- One global `auth_tokens` table: `user_id`, `purpose` (`email_verification`, `password_reset`),
  `token_hash` (SHA-256), `expires_at`, `used_at`. Same token pattern as sessions and invitations.
- Verification links last 24 hours, reset links 1 hour. Single use. A new request invalidates the
  earlier unused tokens of the same purpose.
- Resetting the password deletes every session of the user.

## Alternatives considered
- Magic link by email (no password): every login would depend on email delivery. Email is used
  for the rare flows (verification, reset) instead.
- Code over WhatsApp: the channel isn't built yet. It stays a possible second factor.
- Sign-up always on or always off: the couple doesn't need it now, and opening to friends later
  shouldn't need a deploy with new code.
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
- Password reset depends on email delivery: if the SMTP provider is down, the ops script
  (`pnpm ops:reset-password`) is the fallback.
- Follow-up: the `identity` module (sessions, auth tokens, password hashing, sign-up, login, logout,
  verification and reset services), the auth middleware, the ops scripts, and the sign-up,
  reset and invitation pages in the web.
