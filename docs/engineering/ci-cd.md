---
summary: GitHub Actions pipelines (PR checks, main build and deploy), image registry, Dokploy trigger, Dependabot policy.
read_when: Editing .github/workflows, changing the Dockerfile or deploy, or when CI fails.
updated: 2026-09-22
---

# CI/CD

Decision: `../decisions/0010-deploy-ghcr-dokploy.md`.

## Pipelines

### `ci.yml`: on every PR and on push to `main`
Jobs run in parallel where possible, with the pnpm store cached (`actions/setup-node` + `pnpm/action-setup`).

| Step | Command | Fails on |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | Lockfile out of sync |
| Lint/format | `pnpm biome ci` | Any lint or format issue |
| Types | `pnpm typecheck` (`tsc -b` across the workspace) | Type errors |
| Architecture | `pnpm depcruise` | A violation of `../architecture/dependency-rules.md` |
| Tests | `pnpm test` with a `postgres:16` service container | Failing tests |
| Build | `pnpm build` (web + api) | Build errors |
| Docs | `pnpm docs:check` | Missing frontmatter (`summary`, `read_when`, `updated`) or broken relative links |
| Secrets | `gitleaks` | Committed secrets |

### `deploy.yml`: on push to `main`, after `ci.yml` passes
1. Build the Docker image (`docker/Dockerfile`, multi-stage) with Buildx and layer cache (`type=gha`).
2. Push to GHCR: `ghcr.io/viniciussricci/financas:<git-sha>` and `:main`.
3. Trigger Dokploy to redeploy the application with the new image (webhook or API call; secret in `DOKPLOY_DEPLOY_WEBHOOK`).
4. Wait and check `GET /api/health/ready` on the deployed app. If it fails, the workflow fails.

Image tags are immutable git SHAs, so rolling back means redeploying the previous SHA in Dokploy.

**Open question (blocks the deploy step):** can GitHub reach the Dokploy panel from the internet? The server is on a home network. If it can't, the options are:
- (a) expose only the deploy webhook through a tunnel (Cloudflare Tunnel or Tailscale Funnel);
- (b) a tiny poller on the server that redeploys when `:main` changes digest.

This is tied to how the couple reaches the dashboard outside home (`../operations/deploy.md`).

## Why build in Actions instead of on the server
The server has 4 cores and ~5 GB free RAM, shared with Postgres, the bot and other services. A
`pnpm install` + Vite build can take seconds of full CPU and 1–2 GB RAM. Building on GitHub's
runners keeps the server doing only what it must: pulling an image and running it. The free plan
includes 2,000 Action minutes a month for private repos, far more than needed.

## Dependabot
- `npm` ecosystem weekly, updates **grouped** (one PR for minor/patch dev deps, one for minor/patch prod deps). Majors come as separate PRs.
- **`baileys` is ignored** (pinned; upgraded by hand, see `../integrations/whatsapp.md`).
- `github-actions` ecosystem monthly.
- Docker base image weekly.

## Secrets (GitHub → Settings → Secrets)
| Secret | Used by |
|---|---|
| `GITHUB_TOKEN` (automatic) | Push to GHCR |
| `DOKPLOY_DEPLOY_WEBHOOK` | Trigger redeploy |
| `PUBLIC_HEALTH_URL` | Post-deploy health check |

Runtime secrets (`ANTHROPIC_API_KEY`, `DATABASE_URL`...) live **only in Dokploy** environment settings, never in GitHub.
