---
summary: Stack, runtime topology, and the main request flows (web, WhatsApp→agent, jobs).
read_when: You need the big picture before a cross-cutting change, or you're new to the codebase.
updated: 2026-09-22
---

# Architecture overview

## Stack
| Concern | Choice | ADR |
|---|---|---|
| Repo | pnpm workspaces monorepo (`apps/api`, `apps/web`, `packages/shared`) | 0001 |
| Runtime | Node.js LTS + TypeScript (strict) | — |
| HTTP | Hono (with `@hono/node-server`), RPC client `hc` for the web | 0002 |
| WhatsApp | Baileys (WhiskeySockets), used directly, version pinned | 0003 |
| AI | `@anthropic-ai/sdk` with the Tool Runner; no agent framework | 0004 |
| DB | PostgreSQL + Drizzle ORM + drizzle-kit migrations | — |
| Validation | Zod, shared across API, web forms and agent tools | — |
| Web | Vite + React 19 SPA, Tailwind CSS v4, shadcn/ui, TanStack Router/Query/Table, Recharts, PWA | 0005 |
| Architecture | Modular monolith with light clean architecture | 0006 |
| Money | Integer cents | 0007 |
| Lint/format | Biome; dependency-cruiser for architecture rules | — |
| Tests | Vitest | — |
| Jobs | croner, running in the API process | — |
| Git/PRs | Conventional Commits, squash merge, lefthook + commitlint | 0009 |
| CI/CD | GitHub Actions → GHCR → Dokploy | 0010 |
| Observability | OpenTelemetry API + pino; Netdata + Uptime Kuma at Level 0 | 0011 |

## Runtime topology

```
┌─────────────── container "financas" (Dokploy, behind Traefik) ───────────────┐
│ Node process                                                                  │
│   Hono HTTP ── /api/*  → module routes                                        │
│             └─ /*      → static SPA build (apps/web/dist)                     │
│   Baileys socket (WhatsApp) → agent → tools → services                        │
│   croner jobs → services                                                      │
└──────────────────────────────────┬────────────────────────────────────────────┘
                                   │
                     container "financas-db" (Postgres)
```

- **One Node process on purpose.** The server is small (4 cores, ~5 GB free RAM). The SPA is static files, so there's no separate frontend server.
- The Postgres instance is separate from Dokploy's own Postgres.
- Outbound calls: Anthropic API and WhatsApp servers. Nothing else.

## Main flows

### Web
`React → hc client (typed) → Hono route (zValidator) → service → repository → Postgres`

### WhatsApp → agent
1. `channels/whatsapp/inbound.ts` receives a message and drops anything not from a known `member.whatsappJid` (groups and status are dropped too).
2. `agent/run-agent.ts` loads recent memory and any `pendingAction`, then runs the Tool Runner with Claude.
3. A read tool (e.g. `query-budget`) calls a service and returns data. Claude writes the reply.
4. A write tool (e.g. `register-expense`) **doesn't write**. It validates, computes a preview (invoice, installments) and stores a `pendingAction`. Claude asks for confirmation.
5. The member replies "sim" and the pending action runs through the same service the web uses.
6. `channels/whatsapp/outbound.ts` sends the reply through a rate-limited queue.

### Jobs
`croner schedule → job file → service`. Examples: close invoices on their closing date, create recurring bills, the daily digest.

## Key principle
The HTTP routes, the WhatsApp agent tools and the jobs are **three entry points into the same
services**. There is no separate "AI path" to the database, so a rule is written once and holds
everywhere.
