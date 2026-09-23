---
summary: How Claude works in this repo — project skills, Claude Code hooks, and the standard loop for a change.
read_when: Starting any development task, creating or editing a skill or hook, or when unsure which procedure to follow.
updated: 2026-09-22
---

# Claude workflow

## Standard loop for a change
1. Read `docs/README.md` and open only the docs the task needs.
2. Create a branch (`git-workflow.md`).
3. If a matching project skill exists, follow it (table below).
4. Domain rules go example-first: doc example → failing test → implementation (`domain-rule` skill).
5. Update the docs in the same change and bump `updated:`.
6. Run the local checks (`pnpm check`), then open the PR (`pr` skill) when the user asks.

## Project skills (`.claude/skills/<name>/SKILL.md`)
Skills encode repeatable procedures so they come out the same way every time.

| Skill | Status | What it does |
|---|---|---|
| `adr` | ✅ available | Writes a new ADR from the template and updates the index |
| `new-module` | planned (needs scaffold) | Creates an API module with the standard anatomy, mounts its routes, updates dependency rules and docs |
| `new-agent-tool` | planned (needs scaffold) | Zod schema in shared → tool file → registration → eval cases → table in `../integrations/ai-agent.md` |
| `db-migration` | planned (needs scaffold) | Edit table → `drizzle-kit generate` → SQL review checklist → stop and ask on destructive changes |
| `domain-rule` | planned (needs scaffold) | Example in the domain doc → failing test → implementation → docs |
| `pr` | planned (needs scaffold) | Runs checks, writes a conventional title, fills the template, verifies docs were updated |
| `investigate` | planned (needs observability code) | The bug-investigation playbook from `../operations/runbook.md`, using the `ops:*` scripts |

Rules for skills:
- Keep `SKILL.md` short and procedural: numbered steps, exact commands, and a checklist at the end.
- The `description` frontmatter says **when** to use the skill; that's what triggers it.
- A skill links to docs for background instead of copying them.
- A skill that's outdated is worse than none, so update it in the same PR that changes the procedure.

## Claude Code hooks (`.claude/settings.json`), planned for scaffold
| Event | Hook | Why |
|---|---|---|
| `PostToolUse` (Edit/Write on `*.ts, *.tsx, *.json`) | `biome check --write <file>` | Code stays formatted without a separate step |
| `PreToolUse` (Edit/Write) | Block `.env*` and applied files in `apps/api/drizzle/` | Secrets and applied migrations are never touched |
| `PreToolUse` (Bash) | Block `git push --force` to `main` and `--no-verify` | Protects history and hooks |

## What Claude may do without asking
- Read anything in the repo, run tests, lint, typecheck and build locally.
- Read logs and metrics (`../operations/observability.md`).

## What Claude asks first
- Commits, pushes, opening or merging PRs.
- Destructive migrations, anything touching production data.
- New dependencies, containers or processes (server resources are limited).
- Changing an accepted ADR.
