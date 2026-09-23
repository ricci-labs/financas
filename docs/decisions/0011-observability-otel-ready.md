---
summary: Instrument with OpenTelemetry API + pino from day one, run Level 0 on existing Netdata/Uptime Kuma, and upgrade backends by config only.
read_when: Changing observability tooling or considering a new observability backend.
updated: 2026-09-22
---

# 0011. OpenTelemetry-ready observability on existing tools

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
The user wants to start simple but be ready to scale, and bugs must be easy for Claude to investigate. The server already runs Netdata and Uptime Kuma and has little spare RAM.

## Decision
- Code depends only on stable contracts: the OpenTelemetry API (spans, metrics), pino JSON logs with `trace_id`, a fixed event-name catalog, and the `ops:*` scripts as Claude's query interface.
- Level 0 backends: Docker logs, the Prometheus endpoint scraped by Netdata, Uptime Kuma for health and heartbeats, and the `agent_run` table.
- Moving to later levels (log store, traces, error tracking, dashboards) changes only env vars and containers. See `../operations/observability.md`.
- The alert channel is left open, configured in Kuma/Netdata, and must not be WhatsApp.

## Alternatives considered
- Full Grafana stack now (Prometheus, Loki, Tempo, Grafana): hundreds of MB of RAM for two users.
- Logs only, no instrumentation: cheapest now, but every upgrade later would mean touching code all over.
- Vendor SDKs (e.g. Sentry-first): ties the code to one vendor. OTel keeps backends swappable.

## Consequences
- The OTel SDK adds some memory and startup cost. It's accepted, and kept small by picking instrumentations one by one.
- Every entry point must start a root span, so `trace_id` exists for WhatsApp messages and jobs too.
- Users see an error `ref` (trace ID prefix), which gives a direct path from a complaint to the logs.
