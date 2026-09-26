<!-- PR title = squash commit: type(scope): imperative summary  (see docs/engineering/git-workflow.md) -->

## What & why
<!-- What changes and, above all, why. Link issues/ADRs. -->

## How it was tested
<!-- Commands run, tests added, manual checks (web / WhatsApp). -->

## Checklist
- [ ] Docs updated in this PR (and `updated:` bumped), or not needed
- [ ] New decision → ADR added
- [ ] Migration included → reviewed SQL; destructive? ☐ no ☐ yes (explain)
- [ ] Agent prompt/tools/model changed → evals run
- [ ] New logs/metrics follow the event catalog (`docs/operations/observability.md`)
- [ ] New env var → declared in `env.ts`, documented in `.env.example` and `docs/operations/deploy.md`
- [ ] No new dependency/container/process, or it is justified below

## Screenshots
<!-- UI changes only. -->
