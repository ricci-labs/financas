---
summary: How Claude works in this repo — project skills, Claude Code hooks, and the standard loop for a change.
read_when: Starting any development task, creating or editing a skill or hook, or when unsure which procedure to follow.
updated: 2026-09-25
---

# Claude workflow

## Standard loop for a change
1. Read `docs/README.md` and open only the docs the task needs.
2. Create a branch (`git-workflow.md`).
3. If a matching project skill exists, follow it (table below).
4. Domain rules go example-first: doc example → failing test → implementation (`domain-rule` skill).
5. Update the docs in the same change and bump `updated:`.
6. Follow the `pr` skill: checks, self-review, mutations, docs, PR, CI.

## Project skills (`.claude/skills/<name>/SKILL.md`)
Skills encode repeatable procedures so they come out the same way every time.

| Skill | Status | What it does |
|---|---|---|
| `adr` | ✅ available | Writes a new ADR from the template and updates the index |
| `new-module` | ✅ available | Creates an API module with the fixed file set, schemas in shared, routes behind session and permission checks, dependency rules and docs |
| `new-agent-tool` | planned (needs scaffold) | Zod schema in shared → tool file → registration → eval cases → table in `../integrations/ai-agent.md` |
| `db-migration` | planned (needs scaffold) | Edit table → `drizzle-kit generate` → SQL review checklist → stop and ask on destructive changes |
| `domain-rule` | planned (needs scaffold) | Example in the domain doc → failing test → implementation → docs |
| `pr` | ✅ available | Runs every check, reviews the diff against the conventions, proves new rules can fail, writes the PR from the template, waits for CI, merges when authorized |
| `investigate` | planned (needs observability code) | The bug-investigation playbook from `../operations/runbook.md`, using the `ops:*` scripts |

Rules for skills:
- Keep `SKILL.md` short and procedural: numbered steps, exact commands, and a checklist at the end.
- The `description` frontmatter says **when** to use the skill; that's what triggers it.
- A skill links to docs for background instead of copying them.
- A skill that's outdated is worse than none, so update it in the same PR that changes the procedure.

## Claude Code hooks (`.claude/settings.json`, scripts in `.claude/hooks/`)
The conventions are checked while Claude works, not only at commit or in CI, so a broken pattern
is fixed in the same step that introduced it.

| Event | Hook | What it does |
|---|---|---|
| `PostToolUse` (Edit/Write/MultiEdit) | `check-edited-file.mjs` | For a `.ts`/`.tsx` file under `apps/` or `packages/`: formats it with Biome, then runs the no-comments and file-roles checks on it. A problem blocks with exit 2, and Claude gets the report to fix now. |
| `Stop` | `check-changed-files.mjs` | Runs the same checks on every `.ts`/`.tsx` file changed since `origin/main`, including files written through Bash, which the edit hook can't see. A problem stops Claude from finishing the turn until it's fixed (one retry, then it reports). |
| `PreToolUse` (Edit/Write/MultiEdit) | `guard.mjs` | Denies edits to `.env` files (`.env.example` is fine) and to committed migrations in `apps/api/drizzle/`. |
| `PreToolUse` (Bash) | `guard.mjs` | Denies `--no-verify` and `git commit -n` (hooks can't be skipped), and a force push to `main`. |

Hooks load when a session starts. After changing them, open `/hooks` once or restart Claude Code.

## What Claude may do without asking
- Read anything in the repo, run tests, lint, typecheck and build locally.
- Read logs and metrics (`../operations/observability.md`).

## What Claude does on its own
- Merge Dependabot patch/minor PRs once all checks are green (`ci-cd.md` → Dependabot).

## What Claude asks first
- Commits, pushes, opening or merging PRs.
- Destructive migrations, anything touching production data.
- New dependencies, containers or processes (server resources are limited).
- Changing an accepted ADR.
