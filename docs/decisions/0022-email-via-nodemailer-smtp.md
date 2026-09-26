---
summary: The API sends email with Nodemailer over SMTP (any provider, set by SMTP_* env vars), behind a small Mailer interface; auth emails are sent right away, and local development writes messages to .private/outbox instead of sending.
read_when: Sending any email (verification, password reset, invitations, reminders), configuring SMTP, or testing code that sends email.
updated: 2026-09-25
---

# 0022. Email via Nodemailer over SMTP

- **Status:** Accepted
- **Date:** 2026-09-25

## Context
- Password login (ADR 0021) needs email for verification and password reset. Invitations and
  reminders can use it too (`notification_channel` already has `email`).
- The user asked for a well-known library instead of hand-written SMTP.
- The server is small, and every new dependency or process needs a reason (CLAUDE.md).
- The provider isn't chosen yet, and it may change (free tiers, deliverability).

## Decision
- **Library:** `nodemailer`. It's the standard Node email library: no runtime dependencies, pure
  JavaScript, MIT-0, no extra process.
- **Transport:** SMTP only, configured entirely by env vars (ADR 0023), so whoever runs an
  instance plugs in their own provider without touching code:

  | Var | Example | Default |
  |---|---|---|
  | `SMTP_HOST` | `smtp.example.com` | none |
  | `SMTP_PORT` | `587` | `587` |
  | `SMTP_SECURE` | `true` for implicit TLS (port 465), `false` for STARTTLS | `true` when the port is 465 |
  | `SMTP_USER` | `no-reply@example.com` | none (no auth) |
  | `SMTP_PASSWORD` | provider password or app password | none |
  | `EMAIL_FROM` | `no-reply@example.com` | none |
  | `EMAIL_FROM_NAME` | `Finanças` | `Finanças` |

  `SMTP_USER` and `SMTP_PASSWORD` come as a pair. The env schema checks all of it at boot.
- **Boundary:** `core/email` exposes a `Mailer` (`send({ to, subject, text, html })`). Only
  `core/email` imports `nodemailer`. Services receive the `Mailer` as a dependency, like the
  `Clock`, so tests pass a fake that records messages.
- **Templates:** plain functions that return pt-BR text plus simple inline-styled HTML. Every
  email has a plain-text part. Links are built from `PUBLIC_URL`.
- **Delivery:** auth emails (verification, reset, "you already have an account") are sent right
  away, because the user is waiting for them. A failure is logged (`email.send_failed`) and the user
  can ask again. Scheduled emails (reminders) go through `notification_outbox` later, and its
  worker uses the same `Mailer`.
- **Local development:** without `SMTP_HOST`, messages are written as `.eml` files to
  `.private/outbox/` (gitignored) so links can be opened by hand. Production refuses to boot
  without `SMTP_HOST` and `EMAIL_FROM`, with a message naming the missing vars.
- **Privacy:** email bodies and links are never logged. Logs carry the template name and the
  message id.

## Alternatives considered
- A provider's HTTP SDK (Resend, SES, Postmark): ties the code to one provider and adds its SDK.
  All of them also accept SMTP.
- One `SMTP_URL` (`smtps://user:password@host:465`): shorter, but the password has to be
  URL-encoded, which is an easy mistake for someone setting up their own instance.
- Hand-written SMTP over `node:net`: TLS, auth, MIME and encoding are easy to get wrong.
- React Email or MJML for templates: heavy for three short transactional emails.
- Mailpit or MailHog in `compose.dev.yml`: one more container. The `.eml` files are enough for now.

## Consequences
- A new outbound connection: the SMTP provider, next to Anthropic and WhatsApp.
- New env vars: the `SMTP_*` and `EMAIL_FROM*` above, plus `PUBLIC_URL` (already listed) and
  `PUBLIC_SIGNUP_ENABLED` (ADR 0021). All documented in `.env.example` and
  `../operations/deploy.md`.
- Deliverability depends on the provider and on SPF/DKIM for the sender domain. **Open question:**
  which provider and which sender domain (roadmap).
- Tests never send email: unit and integration tests use the fake `Mailer`.
