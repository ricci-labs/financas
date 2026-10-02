---
summary: Production setup on Dokploy — containers, image, env vars, resources, logs rotation, backups (offsite destination later), access through Cloudflare Tunnel + Access on the user's domain, first-deploy steps and checklist.
read_when: Deploying, changing env vars or runtime config, setting up backups, or exposing the app.
updated: 2026-10-01
---

# Deploy

Pipeline: `../engineering/ci-cd.md`. Decision: `../decisions/0010-deploy-ghcr-dokploy.md`.

## Image (`docker/Dockerfile`)
- Built on GitHub runners (ADR 0010): the API bundle plus its production dependencies
  (`pnpm deploy --prod`) and `drizzle/`, on `node:24-alpine`, running as `node`. `APP_VERSION` is
  the git SHA (build arg). The SPA joins the image with the web foundation.
- **Migrations run on boot, before the app** (`docker/entrypoint.sh`): when
  `DATABASE_MIGRATION_URL` is set, `dist/ops/migrate.mjs` applies `drizzle/` as `financas_owner`,
  then the app starts with that variable removed from its environment, so the running process
  only holds the `financas_app` credentials (ADR 0018). A failed migration stops the container
  before the app serves anything.
- Attachments live in the volume `/data/files` (`FILE_STORAGE_DIR` points there).
- Docker healthcheck: `GET /api/health/live`. Ports: `3100` (HTTP), `9464` (metrics, internal).
- The home link is slow (about 100 KB/s at times), so the first pull of the base layers takes
  minutes. Later deploys only pull the changed app layers.

## Containers (Dokploy project `financas`)
| Service | Image | Notes |
|---|---|---|
| `financas-api` | `ghcr.io/ricci-labs/financas:<sha>` | Node process: HTTP + SPA + WhatsApp + agent + jobs |
| `financas-db` | `postgres:18-alpine` | Own volume. Separate from Dokploy's internal Postgres. Never published on the host network |
| `cloudflared` | `cloudflare/cloudflared` | The tunnel that publishes the app (Remote access below). Chosen by the user, 2026-09-27 |

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
| `INVALID_LINKS_PER_IP_PER_HOUR` | Invalid verification or reset links a client may try per hour (default 20) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Email provider (ADR 0022). `SMTP_HOST` is required in production. Port `587` = STARTTLS, `465` = implicit TLS; TLS 1.2+ is always required. This instance uses DreamHost's SMTP server with a mailbox of the sender domain |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP login, as a pair |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Sender address (required in production) and display name (default `Twise`) |
| `EMAIL_OUTBOX_DIR` | Development only: folder for `.eml` files when `SMTP_HOST` is empty |
| `FILE_STORAGE_DIR` | Where attachments live (default `.private/files`). In production, a mounted Docker volume that is part of the backups |
| `FILE_MAX_BYTES` | Largest upload accepted (default 10 MB) |
| `WEB_DIST_DIR` | The web build the API serves (`/` and every app page, `/assets/*` cached for a year, `/email/*` images). Set by the image to `/app/web`; leave it alone. Unset in development (Vite serves the web) |
| `LOG_LEVEL` | `info` in prod |
| `OTEL_SERVICE_NAME`, `OTEL_METRICS_EXPORTER`, `OTEL_EXPORTER_PROMETHEUS_HOST`, `OTEL_EXPORTER_PROMETHEUS_PORT` | Observability Level 0 (`observability.md`). Production: `OTEL_METRICS_EXPORTER=prometheus`. Defaults: `financas-api`, `none` (no metrics port), `0.0.0.0`, `9464` |
| `UPTIME_KUMA_PUSH_URL_<JOB>` | Heartbeats (optional) |

## Resources
- Memory limit for `financas-api`: start at 512 MB and adjust from Netdata data.
- Docker log rotation for the app: `max-size=20m`, `max-file=5`. Set it in Dokploy's advanced settings or the daemon config.
- Metrics port `9464`: published by Dokploy in **host** mode (Advanced → Ports, `9464:9464`), so
  Netdata, which runs on the host network, scrapes `http://127.0.0.1:9464/metrics`. It is visible on
  the home LAN but never on the internet: the tunnel only carries port 3100, and the router forwards
  nothing. Metrics hold counts only, never data or secrets.
- Netdata job: `/etc/netdata/go.d/prometheus.conf` in its config volume, job `financas`, every 10 s;
  charts are named `prometheus_financas.*`. Restart Netdata after editing it.

## Backups
Decided 2026-09-27: the structure is built now, and the offsite destination is chosen later.
`docker/backup/backup.sh` runs daily from the host's crontab (the user's, who is in the `docker`
group):
1. `pg_dump --format=custom` inside the database container (as `postgres`, so RLS hides nothing),
   checked by reading it back with `pg_restore --list`;
2. a `tar.gz` of `/data/files` from inside the app container;
3. files older than 14 days are deleted;
4. an optional offsite copy (below);
5. an Uptime Kuma push: `up` with the stamp, or `down` with the reason, so a failure alerts at once
   and a missed run alerts by timeout.

Files are named `financas-db-<UTC stamp>.dump` and `financas-files-<UTC stamp>.tar.gz`, are
written as `.partial` then renamed, and are created mode 600 (`umask 077`). They hold real
household data, so the backup folder stays outside the repo.

| Var | Purpose |
|---|---|
| `BACKUP_DIR` | Local folder for the backups (required), e.g. `~/backups/financas` |
| `BACKUP_DB_CONTAINER` | Database container name or prefix (required; Dokploy adds suffixes), e.g. `financas-db` |
| `BACKUP_APP_CONTAINER` | App container name or prefix; without it, the attachments are not archived |
| `BACKUP_DB_NAME`, `BACKUP_DB_USER` | Default `financas`, `postgres`. With a Dokploy database, `BACKUP_DB_USER` is the superuser chosen when creating it |
| `BACKUP_FILES_PATH` | Attachments path inside the app container, default `/data/files` |
| `BACKUP_KEEP_DAYS` | Local retention, default 14 |
| `BACKUP_KUMA_PUSH_URL` | Uptime Kuma push monitor URL (optional) |
| `BACKUP_RCLONE_REMOTE` | Offsite destination such as `offsite:financas` (optional, off by default) |
| `BACKUP_REMOTE_KEEP_DAYS` | Offsite retention, default 30 |

Crontab (vars in a mode-600 file outside the repo):
```sh
30 3 * * * . "$HOME/.config/financas/backup.env" && "$HOME/projetos/financas/docker/backup/backup.sh" >>"$HOME/backups/financas/backup.log" 2>&1
```

**Offsite copy, off until configured:** when `BACKUP_RCLONE_REMOTE` is set, the new files are
copied there with `rclone copy`, and remote files older than `BACKUP_REMOTE_KEEP_DAYS` are deleted.
rclone speaks S3-compatible buckets and OneDrive alike, so choosing the destination is a config
change: install rclone, `rclone config` a remote, and set the var. Wrap the remote in an rclone
`crypt` remote, so the provider only stores ciphertext. Local-only backups don't survive a disk
failure, so this is the next step after the first deploy.

Restoring: `runbook.md` → Restore from a backup. The procedure was tested on the dev database
(2026-09-27): the restored schema is identical to the source (`pg_dump --schema-only` diff), with the
owner, RLS policies, triggers, default privileges and migrations, and the attachments are back.

## Remote access
**Decided 2026-09-27: Cloudflare Tunnel with Cloudflare Access.** The couple opens the app from
any browser, at home or outside, with no app to install and no router port open.
- **Tunnel:** a `cloudflared` container on the server keeps an outbound connection to Cloudflare.
  Cloudflare answers `https://financas.example.com` and sends each request through the tunnel to
  the app container (`http://<app name>:3100` on `dokploy-network`), without passing through
  Traefik.
- **HTTPS:** Cloudflare's edge serves the certificate, and the tunnel carries the request
  encrypted. The browser sees HTTPS, so the `__Host-session` cookie (`Secure`, ADR 0021) works.
- **Access:** before reaching the app, Cloudflare asks for a one-time code sent by email, and only
  the listed emails get one. The app's own login comes after, so there are two locks.
  - Someone invited to the workspace must be added to the Access policy first, or they can't open
    the invitation link.
  - Scripts (Postman) pass with an Access **service token** (`../api/postman.md`).
- **Client IP:** Cloudflare appends the visitor's IP to `X-Forwarded-For`, so
  `TRUSTED_PROXY_HOPS=1` gives the real IP for the login limits.
- **DNS:** the domain (registered at registro.br) uses Cloudflare's nameservers. The tunnel creates
  the app's DNS record itself.
- GitHub still can't reach Dokploy, so CI publishes the image and the redeploy is started from
  Dokploy.
- **The tunnel is shared by the homelab** (2026-09-28). Besides the app, it publishes the admin
  panels: Dokploy, Netdata and Uptime Kuma, each on its own subdomain. **Every admin panel has its
  own Access application with a policy that allows only the owner's email**, created before its
  route, because Dokploy controls the whole server and Netdata has no login at all. Routes point to
  the LAN IP for services on the host network (Dokploy `:3000`, Netdata `:19999`) and to container
  names on `dokploy-network` for the rest. The `cloudflared` service can live in a Dokploy project
  of its own; moving it keeps working as long as the token and command stay the same.

Alternatives kept on file: Tailscale (private, but needs its app on every device) and forwarding
port 443 on the router (exposes the home IP, and CGNAT often prevents it).

## First deploy, step by step
Placeholders: `financas.example.com` is the chosen hostname, `<app name>` the application's name in
Dokploy (its service name on `dokploy-network`). Real values go only in Dokploy and Cloudflare,
never in this repo.

1. **Image public.** GitHub → org `ricci-labs` → Packages → `financas` → Package settings →
   Change visibility → Public. The code is public and the image holds no secrets, so Dokploy needs
   no pull token.
2. **Database.** Dokploy → Create Database → PostgreSQL: image `postgres:18-alpine`, database
   `financas`, a strong superuser password, no external port. Generate two passwords with
   `openssl rand -hex 24` (letters and digits only, so the connection URLs need no escaping), then
   create the two roles from the repo on the server. The script asks for both passwords without
   echo (ADR 0018):
   ```sh
   sh docker/postgres/create-roles.sh <db app name>
   ```
   To change one later: `sh docker/postgres/change-password.sh <db app name> financas_app` (or
   `financas_owner`), then update the matching URL in Dokploy and redeploy.
   Passwords and tokens go straight into Dokploy, never into chats, issues or the repo.
3. **Application.** Dokploy → Create Application → Docker image
   `ghcr.io/ricci-labs/financas:main`, no domain in Dokploy (the tunnel reaches it).
   - Environment (the table above has the full list):
     ```
     DATABASE_URL=postgres://financas_app:<app password>@<db app name>:5432/financas
     DATABASE_MIGRATION_URL=postgres://financas_owner:<owner password>@<db app name>:5432/financas
     PUBLIC_URL=https://financas.example.com
     TRUSTED_PROXY_HOPS=1
     SMTP_HOST=smtp.dreamhost.com
     SMTP_PORT=465
     SMTP_SECURE=true
     SMTP_USER=<mailbox of the sender domain>
     SMTP_PASSWORD=<its password>
     EMAIL_FROM=<the same mailbox>
     OTEL_METRICS_EXPORTER=prometheus
     LOG_LEVEL=info
     ```
   - Volume: a named volume mounted at `/data/files`.
   - `EMAIL_FROM` must be a real address format (the mailbox may come later). Without the SMTP
     mailbox yet, leave `SMTP_USER`/`SMTP_PASSWORD` out: the app boots and emails fail until they
     are set.
   - Deploy. The entrypoint applies the migrations, then the app starts. Dokploy's log view keeps
     the output of earlier failed attempts, so check the newest lines or `pnpm ops:health`.
4. **Tunnel.**
   - **DNS on Cloudflare first:** add the domain to Cloudflare (Free plan), then replace the
     nameservers at the registrar (registro.br) with the two Cloudflare gives, and wait until
     Cloudflare shows the domain as Active. A public hostname can only use a domain whose DNS is on
     Cloudflare. Mail records (MX, SPF, DKIM for the DreamHost mailbox) are then kept in Cloudflare
     too. Nothing is created at DreamHost or in Dokploy for the app's name.
   - Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel (Cloudflared), and copy its
     token.
   - In Dokploy, create an application from the Docker image `cloudflare/cloudflared:latest` with
     the environment `TUNNEL_TOKEN=<token>` and the command
     `cloudflared tunnel --no-autoupdate run`. Dokploy's command replaces the image's entrypoint,
     so it must start with `cloudflared`; with only `tunnel ...` the container fails with
     `exec: "tunnel": executable file not found`. Its log shows `Registered tunnel connection` when
     it is up (a warning about the UDP receive buffer size is harmless).
   - Once the tunnel shows Healthy, add a **public hostname**: `financas.example.com` → type HTTP,
     URL `<app name>:3100`. Cloudflare creates the DNS record.
5. **Access.** Zero Trust → Access → Applications → Add a self-hosted application for
   `financas.example.com`:
   - a policy **Allow** with the two emails, login method One-time PIN;
   - optionally, a service token (Access → Service Auth) and a second policy **Service Auth** that
     includes it, for Postman.
6. **Check.** `pnpm ops:health` on the server; `https://financas.example.com/api/health/ready` on a
   phone (after the Access code).
7. **First user:** `docker exec -it "$(docker ps -q -f name=financas-api)" node dist/ops/create-user.mjs`.
8. **Postman** (`../api/postman.md`): an environment with `baseUrl` and `appOrigin` set to
   `https://financas.example.com`, plus the service token variables; then log in and run the
   collection. It creates its own test workspace, which can be left or deleted.
9. **Backups and monitors:** the backup env file and crontab line (Backups above); an Uptime Kuma
   HTTP monitor on `/api/health/ready` (on the internal address, or through the tunnel with the
   service token headers), and a push monitor for the backup.

Later deploys: CI publishes `:main` after each merge; press Deploy in Dokploy (the image is pulled
again). To roll back, set the image to a previous `:<sha>` and deploy.

## First deploy checklist
Status of the first deploy (2026-09-28). Open items are left for later on purpose.
- [x] Remote access decided: Cloudflare Tunnel + Access
- [x] Domain's DNS moved to Cloudflare, mail records (MX, SPF, DKIM) for the DreamHost mailbox kept
- [x] Tunnel connected, published application route to the app, HTTPS answering
- [ ] **Cloudflare Access** application with the two emails (one-time PIN). Until then the app is
      reachable by anyone on the internet, protected only by its own login, so do this before
      creating real accounts
- [ ] Access service token for Postman (`cfAccessClientId` / `cfAccessClientSecret`)
- [x] Image made public on GHCR (no pull credentials needed)
- [x] Database created in Dokploy with a volume
- [x] Roles created once with `docker/postgres/create-roles.sh` (ADR 0018)
- [x] `DATABASE_URL` (app role) and `DATABASE_MIGRATION_URL` (owner) set
- [x] Env vars set; the app boots and `/api/health/ready` is 200
- [x] Migrations applied on boot by the entrypoint
- [x] Volume mounted at `/data/files` for attachments
- [ ] SMTP mailbox credentials (`SMTP_USER`, `SMTP_PASSWORD`) set, then redeploy
- [ ] First user created: `docker exec -it <container> node dist/ops/create-user.mjs` (asks for the email, display name, workspace name and password; the password is typed without echo, never passed as an argument)
- [ ] WhatsApp paired from the bot phone (with the agent)
- [x] Uptime Kuma monitors: HTTP on the internal address `http://<app name>:3100/api/health/ready` (every 60 s, 2 retries), and a push monitor for the backup (every 90000 s; its URL, through Kuma's Traefik hostname, in the backup env file as `BACKUP_KUMA_PUSH_URL`)
- [ ] Alert channel for Kuma chosen (not WhatsApp)
- [x] Netdata scraping `:9464/metrics` (port published in host mode)
- [x] Backup env file + crontab line installed; first run checked
- [x] Restore tested once against production data into a scratch database (schemas identical)
