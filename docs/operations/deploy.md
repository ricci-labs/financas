---
summary: Production setup on Dokploy — containers, image, env vars, resources, logs rotation, backups, remote access (open), first-deploy checklist.
read_when: Deploying, changing env vars or runtime config, setting up backups, or exposing the app.
updated: 2026-09-25
---

# Deploy

Pipeline: `../engineering/ci-cd.md`. Decision: `../decisions/0010-deploy-ghcr-dokploy.md`.

## Containers (Dokploy project `financas`)
| Service | Image | Notes |
|---|---|---|
| `financas-api` | `ghcr.io/ricci-labs/financas:<sha>` | Node process: HTTP + SPA + WhatsApp + agent + jobs |
| `financas-db` | `postgres:18-alpine` | Own volume. Separate from Dokploy's internal Postgres. Never published on the host network |

## Runtime config (Dokploy environment; validated by `core/config/env.ts`)
| Var | Purpose |
|---|---|
| `DATABASE_URL` | App connection as `financas_app` (RLS applies) |
| `DATABASE_MIGRATION_URL` | Owner connection as `financas_owner`, used only to run migrations |
| `ANTHROPIC_API_KEY` | Agent |
| `PUBLIC_URL` | Base URL of the dashboard, used in email links. Required in production (development: `http://localhost:5173`) |
| `PUBLIC_SIGNUP_ENABLED` | `true` opens public sign-up; default `false` (ADR 0021) |
| `TRUSTED_PROXY_HOPS` | Proxies in front of the app whose `X-Forwarded-For` is trusted. `1` behind Traefik; add one per extra proxy (e.g. a tunnel that forwards to Traefik). `0` (default) uses the socket address. A wrong value either lets clients fake their address or puts everyone behind one address |
| `LOGIN_MAX_FAILURES_PER_EMAIL`, `LOGIN_MAX_FAILURES_PER_IP`, `LOGIN_FAILURE_WINDOW_MINUTES` | Login lockout (defaults 5, 30, 15 minutes). Kept in memory, reset on restart |
| `ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR`, `ACCOUNT_EMAILS_PER_IP_PER_HOUR` | Sign-up, verification and forgot-password emails allowed per hour (defaults 3 per address, 10 per client) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Email provider (ADR 0022). `SMTP_HOST` is required in production. Port `587` = STARTTLS, `465` = implicit TLS; TLS 1.2+ is always required |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP login, as a pair |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Sender address (required in production) and display name (default `Finanças`) |
| `EMAIL_OUTBOX_DIR` | Development only: folder for `.eml` files when `SMTP_HOST` is empty |
| `LOG_LEVEL` | `info` in prod |
| `OTEL_SERVICE_NAME=financas-api`, `OTEL_METRICS_EXPORTER=prometheus`, `OTEL_TRACES_EXPORTER=none` | Observability Level 0 (`observability.md`) |
| `UPTIME_KUMA_PUSH_URL_<JOB>` | Heartbeats (optional) |

## Resources
- Memory limit for `financas-api`: start at 512 MB and adjust from Netdata data.
- Docker log rotation for the app: `max-size=20m`, `max-file=5`. Set it in Dokploy's advanced settings or the daemon config.
- Metrics port `9464`: internal network only, reachable by Netdata, never published through Traefik.

## Backups
- Daily `pg_dump` (custom format) by a small job container or cron, kept 14 days locally, then pinging an Uptime Kuma heartbeat.
- **Open question:** an offsite copy (another disk, a cloud bucket). Local-only backups don't survive a disk failure.
- A restore is tested once after setup and documented in `runbook.md`.

## Remote access (open question)
The couple needs to reach the dashboard from their phones outside home, and GitHub may need to reach the deploy webhook. Options:
- **Tailscale** on the phones: private, nothing exposed publicly. The simplest safe choice for 2 users.
- **Cloudflare Tunnel** with a domain: public HTTPS URL without opening router ports. Needs strong auth in the app.
- Port-forward 443 on the router to Traefik: works, but exposes the home IP. Not recommended.

## First deploy checklist
- [ ] Remote access decided and configured
- [ ] GHCR pull credentials added in Dokploy (a PAT with `read:packages`)
- [ ] `financas-db` created with a volume
- [ ] Roles created once: run `docker/postgres/init/01-roles.sh` with real `OWNER_DB_PASSWORD` / `APP_DB_PASSWORD` (ADR 0018)
- [ ] `DATABASE_URL` (app role) and `DATABASE_MIGRATION_URL` (owner) set
- [ ] Env vars set; the app boots and `/api/health/ready` is 200
- [ ] Migrations applied (on boot, or as a one-off command; decide at scaffold)
- [ ] First user created: `docker exec -it <container> node dist/ops/create-user.mjs` (asks for the email, display name, workspace name and password; the password is typed without echo, never passed as an argument)
- [ ] WhatsApp paired from the bot phone
- [ ] Uptime Kuma monitors and push URLs created
- [ ] Netdata scraping `:9464/metrics`
- [ ] Backup running and restore tested
