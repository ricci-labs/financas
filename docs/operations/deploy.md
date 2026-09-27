---
summary: Production setup on Dokploy — containers, image, env vars, resources, logs rotation, backups (offsite destination later), access through Tailscale with HTTPS on the user's domain, first-deploy checklist.
read_when: Deploying, changing env vars or runtime config, setting up backups, or exposing the app.
updated: 2026-09-27
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
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | Sender address (required in production) and display name (default `Finanças`) |
| `EMAIL_OUTBOX_DIR` | Development only: folder for `.eml` files when `SMTP_HOST` is empty |
| `FILE_STORAGE_DIR` | Where attachments live (default `.private/files`). In production, a mounted Docker volume that is part of the backups |
| `FILE_MAX_BYTES` | Largest upload accepted (default 10 MB) |
| `LOG_LEVEL` | `info` in prod |
| `OTEL_SERVICE_NAME`, `OTEL_METRICS_EXPORTER`, `OTEL_EXPORTER_PROMETHEUS_HOST`, `OTEL_EXPORTER_PROMETHEUS_PORT` | Observability Level 0 (`observability.md`). Production: `OTEL_METRICS_EXPORTER=prometheus`. Defaults: `financas-api`, `none` (no metrics port), `0.0.0.0`, `9464` |
| `UPTIME_KUMA_PUSH_URL_<JOB>` | Heartbeats (optional) |

## Resources
- Memory limit for `financas-api`: start at 512 MB and adjust from Netdata data.
- Docker log rotation for the app: `max-size=20m`, `max-file=5`. Set it in Dokploy's advanced settings or the daemon config.
- Metrics port `9464`: internal network only, reachable by Netdata, never published through Traefik.

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
| `BACKUP_DB_NAME`, `BACKUP_DB_USER` | Default `financas`, `postgres` |
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
**Decided 2026-09-27: Tailscale.** The server and the couple's phones join the same tailnet. The
app's name resolves to the server's **tailnet IP** (100.x.y.z), so it answers only to devices
logged in to that tailnet, at home or outside, and nothing is exposed to the internet. GitHub
can't reach Dokploy either, so CI publishes the image and the redeploy is started from Dokploy.

### HTTPS on the LAN (decided 2026-09-27)
The production session cookie is `__Host-session` with `Secure` (ADR 0021), so the app must be
served over HTTPS even at home. Decision: a subdomain of the user's own domain (registered at
registro.br, DNS at DreamHost), with a **Let's Encrypt certificate obtained by DNS challenge**
through the DreamHost API. Its public `A` record points to the server's tailnet IP, which only
tailnet devices can reach. The certificate is valid on every phone with no setup, and Traefik
renews it through the same DNS challenge.

Alternatives kept on file: Cloudflare Tunnel (a public URL, and the domain's DNS would have to move
to Cloudflare), or forwarding port 443 on the router (exposes the home IP; not recommended).

## First deploy, step by step
Placeholders: `financas.example.com` is the chosen subdomain, `100.x.y.z` the server's tailnet IP.
Real values go only in Dokploy, Tailscale and the DreamHost panel, never in this repo.

0. **Tailscale** (needs sudo on the server):
   `curl -fsSL https://tailscale.com/install.sh | sh`, then `sudo tailscale up` and open the login
   link. `tailscale ip -4` shows the tailnet IP. In the Tailscale admin console, **disable key
   expiry** for the server, or it drops off the tailnet after 180 days. Install the Tailscale app
   on both phones with the same account, and leave it on.

1. **Image public.** GitHub → org `ricci-labs` → Packages → `financas` → Package settings →
   Change visibility → Public. The code is public and the image holds no secrets, so Dokploy needs
   no pull token.
2. **DreamHost API key.** DreamHost panel → API: create a key allowed to `dns-list_records`,
   `dns-add_record` and `dns-remove_record`.
3. **Traefik DNS resolver** (Dokploy → Web Server → Traefik). Traefik restarts, so other services
   behind it blink for a few seconds.
   - Add the environment variable `DREAMHOST_API_KEY=<key>` to Traefik.
   - Add a second resolver next to `letsencrypt` in `traefik.yml`:
     ```yaml
     certificatesResolvers:
       letsencrypt-dns:
         acme:
           email: <an email of yours>
           storage: /etc/dokploy/traefik/dynamic/acme-dns.json
           dnsChallenge:
             provider: dreamhost
             resolvers: ["1.1.1.1:53", "8.8.8.8:53"]
     ```
4. **Name.** DreamHost panel → DNS of the domain: an `A` record `financas` → `100.x.y.z` (the
   tailnet IP). Optional: an AdGuard Home rewrite of the same name to the LAN IP, for a phone at
   home with Tailscale off.
5. **Database.** Dokploy → Create Database → PostgreSQL: image `postgres:18-alpine`, database
   `financas`, a strong superuser password, no external port. Then create the two roles, typing
   their passwords without echo (ADR 0018):
   ```sh
   read -rs OWNER_DB_PASSWORD && read -rs APP_DB_PASSWORD && export OWNER_DB_PASSWORD APP_DB_PASSWORD
   docker exec -i -e OWNER_DB_PASSWORD -e APP_DB_PASSWORD "$(docker ps -q -f name=financas-db)" sh -s < docker/postgres/init/01-roles.sh
   ```
6. **Application.** Dokploy → Create Application → Docker image
   `ghcr.io/ricci-labs/financas:main`.
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
   - Domain: host `financas.example.com`, container port `3100`, HTTPS on, certificate
     **custom** with resolver `letsencrypt-dns`.
   - Deploy. The entrypoint applies the migrations, then the app starts.
7. **Check.** `pnpm ops:health` on the server; `https://financas.example.com/api/health/ready` on a
   phone at home.
8. **First user:** `docker exec -it "$(docker ps -q -f name=financas-api)" node dist/ops/create-user.mjs`.
9. **Postman** (`../api/postman.md`): an environment with `baseUrl` and `appOrigin` set to
   `https://financas.example.com`, then log in and run the collection. It creates its own test
   workspace, which can be left or deleted.
10. **Backups and monitors:** the backup env file and crontab line (Backups above), an Uptime Kuma
    HTTP monitor on `/api/health/ready`, and a push monitor for the backup.

Later deploys: CI publishes `:main` after each merge; press Deploy in Dokploy (the image is pulled
again). To roll back, set the image to a previous `:<sha>` and deploy.

## First deploy checklist
- [x] Remote access decided: Tailscale
- [ ] Tailscale on the server (key expiry off) and on both phones
- [ ] Image made public on GHCR (no pull credentials needed)
- [ ] DreamHost API key in Traefik, `letsencrypt-dns` resolver, `A` record to the tailnet IP, certificate issued
- [ ] `financas-db` created with a volume
- [ ] Roles created once: run `docker/postgres/init/01-roles.sh` with real `OWNER_DB_PASSWORD` / `APP_DB_PASSWORD` (ADR 0018)
- [ ] `DATABASE_URL` (app role) and `DATABASE_MIGRATION_URL` (owner) set
- [ ] Env vars set; the app boots and `/api/health/ready` is 200
- [ ] Migrations applied: on boot by the entrypoint (`DATABASE_MIGRATION_URL` set), or by hand with `node dist/ops/migrate.mjs`
- [ ] Volume mounted at `/data/files` for attachments
- [ ] First user created: `docker exec -it <container> node dist/ops/create-user.mjs` (asks for the email, display name, workspace name and password; the password is typed without echo, never passed as an argument)
- [ ] WhatsApp paired from the bot phone
- [ ] Uptime Kuma monitors and push URLs created
- [ ] Netdata scraping `:9464/metrics`
- [ ] Backup env file + crontab line installed; first run checked; Kuma push monitor created
- [ ] Restore tested once against production data into a scratch database
