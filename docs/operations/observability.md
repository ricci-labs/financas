---
summary: Observability design — OpenTelemetry-ready instrumentation, structured logs, metrics, health checks, agent run records, alerts, and the staged upgrade path; built so Claude can investigate bugs quickly.
read_when: Adding logs/metrics/spans, touching core/observability, wiring alerts, or planning an observability upgrade. For investigating a bug, go to runbook.md.
updated: 2026-09-22
---

# Observability

Decision: `../decisions/0011-observability-otel-ready.md`.

## Principles
1. **Start small, keep the contract stable.** The code depends on stable interfaces: the OpenTelemetry API, pino, a fixed event-name catalog and one correlation ID. Backends are chosen by env vars and containers, so upgrading (Level 1→4 below) needs **no application code change**.
2. **One ID connects everything.** Every unit of work (HTTP request, WhatsApp message, job run) gets an OTel trace. Its `trace_id` appears in every log line, the `agent_run` row, and any error shown to the user.
3. **Built for Claude to debug.** Logs are machine-filterable JSON with stable field and event names. The `ops:*` scripts give a fixed query interface whatever the backend.
4. **Cheap by default.** No new containers in Level 0. Existing Netdata and Uptime Kuma do metrics, uptime and alerting.

## Code layout (`apps/api/src/core/observability/`)
| File | Role |
|---|---|
| `register.ts` | Starts the OTel NodeSDK. Loaded with `node --import` **before** any app code so instrumentation can patch modules. Configured only through standard `OTEL_*` env vars. |
| `logger.ts` | pino root logger: redaction, error serializer, base fields. `logger.child({ module })` per module. |
| `metrics.ts` | **The single registry of all metric instruments.** Nothing creates metrics elsewhere. |
| `tracing.ts` | `withSpan(name, attrs, fn)` helper and `startRootSpan()` for non-HTTP entry points (WhatsApp messages, jobs). |
| `errors.ts` | Error fingerprinting, `app_errors_total` recording, and the `ref` shown to users (first 8 chars of `trace_id`). |
| `process.ts` | `unhandledRejection`/`uncaughtException` → log `fatal`, flush, exit(1). Docker restarts the process. |

Instrumentations are chosen one by one (not the heavy auto-instrumentations bundle): `http` (Hono via node-server), `undici` (Anthropic SDK and outbound fetch), `pg`, `pino` (injects `trace_id`/`span_id` into logs).

## Logs
Output: one JSON object per line to stdout. Docker keeps it (with rotation, see `deploy.md`). In dev, `pino-pretty` prints human-readable output.

### Standard fields
| Field | Example | Notes |
|---|---|---|
| `time`, `level`, `msg` | | pino defaults (`level` numeric: 30 info, 40 warn, 50 error, 60 fatal) |
| `service`, `version`, `env` | `financas-api`, `3f9c2a1`, `production` | `version` = git SHA baked into the image |
| `trace_id`, `span_id` | | Injected automatically |
| `event` | `entry.created` | **Stable name from the catalog below.** Filter on it, not on `msg`. |
| `module` | `ledger` | From the child logger |
| `channel` | `web` \| `whatsapp` \| `job` | Entry point of the unit of work |
| `workspaceId`, `userId` | UUID | Never a phone number or JID |
| `err` | `{ type, code, message, stack, cause }` | Serialized with the full `cause` chain |
| `durationMs` | | On completion events |

### Levels
- `error`: something failed and needs a look (unexpected exception, failed job, agent run error).
- `warn`: degraded but handled (retry, reconnect, validation rejected from an external source).
- `info`: business and lifecycle events from the catalog.
- `debug`: detail for investigations, off in production (`LOG_LEVEL=debug` + restart to enable).

### Event catalog (extend as code is added; names are `area.entity.past_verb`)
| Event | Level |
|---|---|
| `app.started`, `app.stopping` | info |
| `http.request.failed` | error/warn |
| `whatsapp.connection.opened` / `.closed` / `.logged_out` | info / warn / error |
| `whatsapp.message.received` / `.ignored` / `.sent` / `.send_failed` | info / debug / info / error |
| `agent.run.started` / `.completed` / `.failed` | info / info / error |
| `agent.tool.called` / `.failed` | info / warn |
| `agent.pending_action.created` / `.confirmed` / `.cancelled` / `.expired` | info |
| `entry.created` / `.reversed` | info |
| `charge.created` / `.sent` / `.paid` | info |
| `notification.sent` / `.failed` | info / warn |
| `job.run.started` / `.completed` / `.failed` | info / info / error |

### Redaction and privacy
- Always redacted: `authorization`, cookies, API keys, tokens, Baileys credentials, phone numbers and JIDs.
- Message **text** is not logged. Log `messageId` and length instead. The full agent transcript lives in `agent_run` (below), in the household's own database.

## Errors
- Services throw `AppError` subclasses with a stable `code` (`CARD_NOT_FOUND`, `INVOICE_CLOSED`...), defined in `core/http/errors.ts`.
- Unexpected errors are logged once at the boundary (HTTP middleware, agent runner, job runner) with the fingerprint `type:code:top-frame`, never at every layer.
- **Users see a reference, never a stack:** "Algo deu errado (ref: `4f3a9c1b`)" in the web or WhatsApp. The ref is a `trace_id` prefix. When the user pastes it, run `pnpm ops:trace 4f3a9c1b`.

## Metrics
Exported with the OTel Prometheus exporter on a **separate internal port** (`:9464/metrics`), never through Traefik. Netdata scrapes it (Prometheus collector) and stores, graphs and alerts on it.

| Metric | Type | Labels |
|---|---|---|
| `http.server.request.duration` | histogram | route, method, status (OTel semantic conventions) |
| `financas_whatsapp_connection_state` | gauge (0 closed, 1 connecting, 2 open, -1 logged out) | |
| `financas_whatsapp_messages_total` | counter | direction, type |
| `financas_agent_runs_total` | counter | outcome (`ok`, `error`, `refusal`, `max_tokens`) |
| `financas_agent_run_duration_seconds` | histogram | |
| `financas_agent_tokens_total` | counter | kind (`input`, `output`, `cache_read`, `cache_write`) |
| `financas_agent_cost_usd_total` | counter | |
| `financas_agent_tool_calls_total` | counter | tool, outcome |
| `financas_job_runs_total` | counter | job, outcome |
| `financas_job_last_success_timestamp_seconds` | gauge | job |
| `financas_app_errors_total` | counter | code, module |

Label rule: never put IDs, names or free text in labels (cardinality). Those go in logs.

Netdata already monitors the host, Docker containers, and (once configured) the app's Postgres through its built-in collector.

## Health checks
| Endpoint | Meaning | Monitored by |
|---|---|---|
| `GET /api/health/live` | Process is up (no dependencies checked) | Docker healthcheck |
| `GET /api/health/ready` | DB reachable (`select 1`, 2s timeout). Returns `{status, db, whatsapp, version, uptimeS}`; 503 if the DB is down | Uptime Kuma (HTTP) |
| `GET /api/health/whatsapp` | 200 only when the socket is open | Uptime Kuma (HTTP) |

**Heartbeats:** each job and the DB backup call an Uptime Kuma **push URL** on success (`UPTIME_KUMA_PUSH_URL_<JOB>`; skipped if unset). If a run is missed, Kuma alerts.

## Agent run records (`agent_run` table)
The main tool for "the AI recorded it wrong". One row per agent turn:
`id, trace_id, workspace_id, user_id, inbound_message_id, model, stop_reason, latency_ms, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, tool_calls (jsonb: name, input, outcome, error, duration_ms), reply_text, error`.
Retention: 180 days (a job prunes older rows). Read with `pnpm ops:agent-run <id|last|--user X>`.

## Alerts (channel not chosen yet)
Alerting lives in **Uptime Kuma and Netdata notification settings**. Both support ntfy, Telegram, email and more, so choosing a channel later is a configuration change only. The app has no alert code. **Rule: the channel can't be WhatsApp**, because the bot is one of the things being monitored.

| Alert | Source | Condition |
|---|---|---|
| App down | Kuma | `/api/health/ready` failing for 2 min |
| WhatsApp disconnected | Kuma | `/api/health/whatsapp` failing for 10 min |
| WhatsApp logged out | Netdata | `connection_state == -1` |
| Job or backup missed | Kuma | Push heartbeat missing |
| Error burst | Netdata | `app_errors_total` +5 in 10 min |
| Agent cost | Netdata | `agent_cost_usd_total` daily increase above threshold |
| Disk | Netdata | > 85% |

## Upgrade path
Each level is additive: env vars plus containers, **no app code change**. The `ops:*` scripts get a backend switch (`OPS_LOGS_BACKEND`...) so the debugging interface stays the same.

| Level | Adds | How |
|---|---|---|
| **0: MVP (now)** | JSON logs in Docker, metrics in Netdata, health and heartbeats in Kuma, `agent_run` table, `ops:*` scripts | Built into the app |
| **1: Log retention and search** | Logs kept for weeks and searchable | VictoriaLogs (single binary, low RAM) or Loki + Grafana; ship with the OTel logs exporter or a Docker log driver |
| **2: Distributed traces** | Span waterfall per request or message | `OTEL_TRACES_EXPORTER=otlp` + `OTEL_EXPORTER_OTLP_ENDPOINT` → Jaeger / Tempo / SigNoz |
| **3: Error tracking** | Grouped errors, releases, regressions | Sentry (cloud) or GlitchTip (self-hosted), integrated through OTel |
| **4: Long-term metrics and dashboards** | Custom dashboards, SLOs | VictoriaMetrics/Prometheus + Grafana, or OTLP metrics to any backend |

Trigger for moving up a level: a real investigation that failed or took too long because the data wasn't there. Record it in an ADR.
