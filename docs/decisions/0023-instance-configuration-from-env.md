---
summary: Everything that changes between installations (URLs, credentials, providers, feature switches) comes from Zod-validated env vars with safe defaults, so anyone can run their own instance without code changes; user-editable settings stay in the database.
read_when: Adding a URL, credential, provider, limit or feature switch; deciding between an env var and a database setting; writing .env.example or deploy docs.
updated: 2026-09-25
---

# 0023. Instance configuration from the environment

- **Status:** Accepted
- **Date:** 2026-09-25

## Context
- The app is built first for one couple on one homelab, but the user wants it to grow to other
  people: friends in a shared instance, or someone running their own copy (the repo is public).
- Each installation has its own domain, email provider, API keys and choices such as open
  sign-up. If any of these lives in code, running a second instance needs a fork.
- `core/config/env.ts` already validates env with Zod and fails at boot (scaffold).

## Decision
- **Env is the place for instance configuration:** URLs, credentials, providers (SMTP, Anthropic,
  later storage), limits and feature switches (`PUBLIC_SIGNUP_ENABLED`). No household's or
  operator's value is hard-coded.
- **One schema:** every var is declared in `core/config/env.ts`, with a safe default when one
  exists. Boot fails with a message that names every invalid or missing var.
- **Development works with defaults:** a var needed only in production (e.g. `SMTP_HOST`) is
  optional in the schema and required by a production rule.
- **Documented in the same PR:** `.env.example` lists every var with a comment line, and
  `../operations/deploy.md` has the table for production.
- **Read in one place:** `main.ts` loads the `Env` and passes what each part needs. Nothing else
  reads `process.env`.
- **Env vs database:** what a user changes from the app (financial period, currency, quiet hours)
  is a database setting (ADR 0014). What the operator of the instance decides is env.

## Alternatives considered
- Config files (`config.yaml`): one more format and file to mount in Dokploy. Env is what Dokploy,
  Docker and most hosts already manage.
- Instance settings in the database with an admin screen: needs an instance-admin role that doesn't
  exist yet. It can come later for the switches that should change without a restart.
- Constants in code for "our" values: the fastest now, but every new instance would need a fork.

## Consequences
- A new installation is: set the env vars, run the migrations, create the first user.
- Changing a switch needs a restart (a Dokploy redeploy). Fine at this scale.
- Every PR that adds a var touches `env.ts`, `.env.example` and `../operations/deploy.md` together. The review
  checklist covers it.
