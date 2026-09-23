---
summary: Images are built in GitHub Actions, pushed to GHCR tagged by git SHA, and Dokploy only pulls and runs them.
read_when: Changing how the app is built or deployed.
updated: 2026-09-22
---

# 0010. Build in GitHub Actions, publish to GHCR, run on Dokploy

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
Dokploy can build from a git repo on the server itself, but the server is small (4 cores, ~5 GB free RAM) and also runs Postgres, the WhatsApp bot and other homelab services.

## Decision
`deploy.yml` builds the multi-stage image on GitHub runners, pushes `ghcr.io/ricci-labs/financas:<sha>` (plus `:main`), and triggers Dokploy to redeploy that image. The pipeline then checks `/api/health/ready`.

## Alternatives considered
- Dokploy builds on the server: simpler setup, but build spikes compete with the running bot and DB.
- Docker Hub: another account and rate limits. GHCR is integrated with the repo and its permissions.

## Consequences
- The server only pulls and runs images. Rollback = redeploy a previous SHA.
- Dokploy needs GHCR pull credentials.
- **Depends on GitHub reaching the trigger.** Remote access is still open (`../operations/deploy.md`). Fallback: an on-server poller that watches the `:main` digest.
