---
summary: Bug-investigation playbook for Claude (ops scripts, order of checks) and procedures for known incidents.
read_when: A bug report, an error ref from the user, an alert, or anything "not working" in production or dev.
updated: 2026-09-22
---

# Runbook

Status: the `ops:*` scripts are planned for the scaffold (`apps/api/scripts/ops/`). Until they
exist, use the raw commands shown.

## Access
- The app runs on the same server as Claude Code, which can read container logs with `docker`.
- Container names come from Dokploy. Find them with `docker ps --filter name=financas`.
- Metrics: `curl -s <api-container>:9464/metrics` from inside the container network. Netdata also exposes a local API.

## Ops scripts (stable interface)
| Script | Does | Raw equivalent |
|---|---|---|
| `pnpm ops:health` | Ready + WhatsApp status + version | `curl -s <app>/api/health/ready` |
| `pnpm ops:logs [--since 1h] [--level error] [--event x] [--module y]` | Filtered JSON logs | `docker logs <c> --since 1h 2>&1 \| jq -c 'select(.level>=50)'` |
| `pnpm ops:trace <trace_id or 8-char ref>` | Every log line for that unit of work plus its `agent_run` | `docker logs <c> 2>&1 \| grep <ref>` |
| `pnpm ops:agent-run <id\|last> [--member X]` | One agent turn: input, tool calls with inputs and results, reply, tokens, cost | SQL on `agent_run` |
| `pnpm ops:errors [--since 24h]` | Errors grouped by fingerprint with counts | jq group_by on error logs |
| `pnpm ops:metrics [prefix]` | Current metric values | `curl ... \| grep ^financas_` |

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

### Job did not run (Kuma heartbeat missing)
`ops:logs --event job.run.failed`. Jobs are idempotent, so after the fix, run it by hand: `pnpm ops:job <name> --date YYYY-MM-DD`.
