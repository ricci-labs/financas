---
summary: Commit message format, branch naming, PR rules, squash-merge policy and the git hooks that enforce them.
read_when: Committing, branching, opening or merging a PR, or configuring git hooks.
updated: 2026-09-23
---

# Git workflow

Decision: `../decisions/0009-trunk-based-squash-merge.md`.

## Branches
- `main` is always deployable. Every merge to `main` deploys (`ci-cd.md`).
- Branches are short-lived (hours to a few days): `<type>/<short-kebab-description>`, e.g. `feat/card-invoices`, `fix/whatsapp-reconnect`, `docs/observability`.
- Nobody commits directly to `main`, and the ruleset makes it impossible.

## Commit messages (Conventional Commits)
```
<type>(<scope>): <imperative summary, lowercase, no period, ≤ 72 chars>

<body: WHY the change was made, context, trade-offs. Wrap at 100.>

<footers: BREAKING CHANGE: ..., Refs: #12, Co-Authored-By: ...>
```

| Type | Use for |
|---|---|
| `feat` | New user-visible behavior |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `perf` | Performance improvement |
| `test` | Tests only |
| `docs` | Docs only |
| `build` | Build system, Dockerfile, dependencies config |
| `ci` | GitHub Actions |
| `chore` | Maintenance that fits nothing else |

**Scopes** (enforced by commitlint; extend the list in `commitlint.config.ts` when a module is added):
`api`, `web`, `shared`, `db`, `agent`, `whatsapp`, `jobs`, `obs`, `identity`, `workspaces`, `access`, `members`, `ledger`, `cards`,
`contacts`, `planning`, `attachments`, `notifications`, `reports`, `docs`, `adr`, `ci`, `deps`, `claude`.

Examples:
- `feat(cards): assign purchases to invoice by closing day`
- `fix(whatsapp): stop reconnect loop after logged-out event`
- `docs(adr): record ghcr-based deploy`

Rules:
- One logical change per commit. Split unrelated changes.
- Commits written by Claude end with the `Co-Authored-By` trailer from the session instructions.
- Claude commits only when the user asks.

## Pull requests
- Every change reaches `main` through a PR, even when working solo. The PR is the CI gate and the review point (`/code-review`).
- **PR title = the squash commit message**, so it follows the commit format above.
- The PR body follows `.github/pull_request_template.md`.
- **Squash merge only.** `main` gets one commit per PR, a linear history, and a readable changelog. Delete the branch after merge.
- Merge requires green CI, enforced by the **"Protect main" ruleset** (Settings → Rules):
  - changes reach `main` only through a PR (direct pushes are rejected, admins included);
  - required checks: 🧹 Code quality, 🧪 Tests, 📦 Build, 🔐 Secret scan, 📝 PR title;
  - squash is the only merge method; linear history; no force pushes; `main` can't be deleted;
  - review threads must be resolved; 0 approvals required (solo project).
- Dependabot titles ("build(deps): Bump …") are exempt from the subject-case rule in `commitlint.config.ts`.
- Keep PRs small, around 400 changed lines excluding generated files and lockfiles. Split bigger work into stacked PRs.

## Git hooks (lefthook)
Configured in `lefthook.yml`, installed by `pnpm install` (`prepare` script).

| Hook | Runs | Why |
|---|---|---|
| `pre-commit` | `biome check --write` on staged files; no-comments check; `gitleaks` | Formatting, comments and secret leaks never reach history |
| `commit-msg` | `commitlint --edit` | Keeps the commit format |
| `pre-push` | `pnpm typecheck` | Catches type errors before CI does |

Don't bypass hooks with `--no-verify`. If a hook is wrong, fix the hook.
