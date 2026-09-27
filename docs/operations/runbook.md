---
summary: Bug-investigation playbook for Claude (ops scripts, order of checks) and procedures for known incidents.
read_when: A bug report, an error ref from the user, an alert, or anything "not working" in production or dev.
updated: 2026-09-27
---

# Runbook

The `ops:*` scripts live in `scripts/ops/` (plain Node, run from the repo root on the server). They
find containers by name prefix: `OPS_APP_CONTAINER` (default `financas-api`) and
`OPS_DB_CONTAINER` (default `financas-db`). Dokploy names services `<project>-<name>-<suffix>`, so
export both with the real prefixes (seen in `docker ps`) before running them. Logs come from `docker logs`, or from a file of JSON
lines with `OPS_LOGS_FILE` (e.g. a dev run saved with `node dist/main.mjs > app.log`). The raw
commands still work when a script can't be used.

## Access
- The app runs on the same server as Claude Code, which can read container logs with `docker`.
- Container names come from Dokploy. Find them with `docker ps --filter name=financas`.
- Metrics: `curl -s <api-container>:9464/metrics` from inside the container network. Netdata also exposes a local API.

## Ops scripts (stable interface)
| Script | Does | Raw equivalent |
|---|---|---|
| `pnpm ops:health` | App and DB container state (since, health, restarts, image) + `/api/health/ready` (version) | `docker ps` + `docker exec <app> wget -qO- 127.0.0.1:3100/api/health/ready` |
| `pnpm ops:logs [--since 1h] [--level debug] [--event prefix] [--module y]` | Filtered JSON logs (`--event job.` matches every job event) | `docker logs <c> --since 1h 2>&1 \| jq -c 'select(.level>=50)'` |
| `pnpm ops:trace <trace_id or 8-char ref> [--since 7d] [--no-audit]` | Every log line for that unit of work, plus its `audit_log` rows (later its `agent_run`) | `docker logs <c> 2>&1 \| grep <ref>` |
| `pnpm ops:agent-run <id\|last> [--member X]` | One agent turn: input, tool calls with inputs and results, reply, tokens, cost. **Comes with the agent** | SQL on `agent_run` |
| `pnpm ops:errors [--since 24h] [--module y]` | Errors grouped by fingerprint: count, last seen, last trace id, message | jq group_by on error logs |
| `pnpm ops:metrics [prefix]` | Current metric values (default prefix `financas_`) | `docker exec <app> wget -qO- 127.0.0.1:9464/metrics \| grep ^financas_` |
| `pnpm ops:job <name> [--at ISO time]` | Run a scheduled job now, inside the app container (`dist/ops/run-job.mjs`); `--at` fixes its clock. Exit 1 if it failed | `docker exec <app> node dist/ops/run-job.mjs <name>` |

## Investigation playbook
1. **Get an anchor.** A `ref` from the user → `ops:trace <ref>`. A time ("ontem à noite") → `ops:logs --since`. An alert → its metric or endpoint.
2. **Check health.** `ops:health`. Is the DB up? Is WhatsApp open? Is the running version the expected SHA?
3. **Read the unit of work.** `ops:trace`. Follow `event`s in order and find the first `warn`/`error`.
4. **If the agent was involved:** `ops:agent-run`. Did Claude choose the wrong tool or wrong arguments (prompt or tool description problem), or did the service reject or miscompute (code problem)?
5. **Check the data.** Query the rows involved (read-only). Compare with the rules in `../domain/`.
6. **Reproduce in a test** before fixing: a failing test in the module or domain function.
7. **Fix, and record gaps.** If the investigation lacked data, add the log field, event or metric in the same PR.

Never change production data by hand without the user's explicit OK. Write the SQL, show it, and wait.

## Known incidents
### WhatsApp logged out (`whatsapp.connection.logged_out`)
The session was revoked (phone unlinked, or a ban). The app keeps running and the web works.
1. Check `docker logs` for a new pairing QR/code.
2. Ask the user to pair from the bot phone (WhatsApp → Linked devices).
3. If pairing fails repeatedly, the number may be banned. Stop retrying and tell the user.

### App container restarting
`docker ps` shows restarts → `ops:logs --level fatal`. Most likely: a missing or invalid env var (the boot validation message names it) or the DB is unreachable.

### Agent replies failing
`ops:errors --module agent`. Check for Anthropic API errors (rate limit, auth, overload): they're retried by the SDK and logged after the retries are exhausted. Check the `ANTHROPIC_API_KEY` in Dokploy.

### Restore from a backup
Backups live in `BACKUP_DIR` (`deploy.md` → Backups). `docker/backup/restore.sh` **drops and
recreates** the database (`dropdb --force`, then `createdb` owned by `financas_owner`) and restores
the dump in one transaction. Given an archive, it also untars the attachments into the app
container.
1. Pick the files: `ls -t "$BACKUP_DIR"`. Use the db dump and the files archive with the same stamp.
2. Try it on a scratch database first:
   `RESTORE_DB_NAME=financas_check RESTORE_CONFIRM=financas_check BACKUP_DB_CONTAINER=financas-db docker/backup/restore.sh <dump>`.
   Then compare counts (`module_actions`, `pg_policies`, `drizzle.__drizzle_migrations`), and drop it.
3. For the real one, stop the app in Dokploy (the drop needs no connections), then run with
   `RESTORE_CONFIRM=financas`, plus `BACKUP_APP_CONTAINER` and the archive once the app is back up.
   Without `RESTORE_CONFIRM` equal to the database name, the script refuses.
4. Start the app and check `ops:health`. On boot the entrypoint applies any migrations newer than
   the dump.

### Job did not run (Kuma heartbeat missing)
`ops:logs --event job.run.failed`. Jobs are idempotent, so after the fix, run it by hand: `pnpm ops:job <name>` (or `--at <ISO time>` to run it as of another moment).
