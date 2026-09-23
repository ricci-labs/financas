---
summary: Index of all project docs, with when to read each one, plus the rules for writing docs.
read_when: Start of any task. Pick only the files the task needs.
updated: 2026-09-22
---

# Docs index

## Routing table

| File | Read when |
|---|---|
| `product/vision.md` | You need the problem, the users, the goals or what is out of scope |
| `product/household-finances.md` | Touching incomes, commissions, budgets or anything about how the couple manages money |
| `product/roadmap.md` | Choosing what to build next, checking MVP scope, or looking up open questions |
| `domain/glossary.md` | Naming anything, or turning a Portuguese term from the user into code |
| `domain/model/README.md` | Creating or changing tables: conventions, map, enums vs config tables |
| `domain/model/tenancy.md` | Users, workspaces, memberships, settings/preferences |
| `domain/model/ledger.md` | Recording money: accounts, entries, postings, cards, invoices (with examples) |
| `domain/model/planning.md` | Forecasts, recurring bills, financial period, budgets, goals |
| `domain/model/third-parties.md` | Contacts, shared purchases, charges, settlements |
| `domain/model/support.md` | Tags, attachments, notifications, audit, agent tables |
| `domain/billing-and-installments.md` | Anything with card invoices, installments, competence month or cash month |
| `architecture/overview.md` | You need the big picture: stack, runtime topology, request flows |
| `architecture/structure.md` | Creating files or folders, or deciding where code goes |
| `architecture/dependency-rules.md` | Adding an import across modules or layers |
| `architecture/conventions.md` | Writing code: naming, money, dates, errors, tests, migrations |
| `integrations/whatsapp.md` | Working on the Baileys connection, message intake or sending |
| `integrations/ai-agent.md` | Working on the Claude agent: tools, prompts, confirmation, cost |
| `engineering/git-workflow.md` | Committing, branching, opening or merging a PR |
| `engineering/ci-cd.md` | Editing workflows, the Dockerfile or deploy; CI failing |
| `engineering/claude-workflow.md` | Starting a dev task; creating or editing project skills or hooks |
| `operations/observability.md` | Adding logs, metrics or spans; alerts; observability upgrades |
| `operations/runbook.md` | **Investigating any bug, error ref, alert or "not working"** |
| `operations/deploy.md` | Deploying, env vars, backups, remote access |
| `decisions/README.md` | Checking why something was chosen, or recording a new decision |

## Rules for writing docs

These docs are written mainly for Claude, so they are built to be cheap to route and read:

- **Frontmatter on every file:** `summary` (one line), `read_when` (the trigger), `updated` (YYYY-MM-DD). You can scan all of it with `head -5 docs/**/*.md`.
- **One topic per file, under ~300 lines.** Split a file before it grows past that.
- **Stable `##` headings** so a section can be found with grep and read on its own.
- **Put rules in lists or tables.** Keep prose for the "why".
- **Use concrete numeric examples** for domain rules. They double as test cases.
- **Mark uncertainty** with **Open question:** or **Assumption:**. Never state a guess as fact.
- **Don't duplicate code.** Link the path (`apps/api/src/...`) and describe intent.
- **Public repo: no real data.** Use placeholders (Member A/B, Card X, round amounts). Real household facts go to the production DB or `.private/` (gitignored).
- **Glossary terms are canonical.** Use the English code name and add the Portuguese term the first time it appears if that helps.
