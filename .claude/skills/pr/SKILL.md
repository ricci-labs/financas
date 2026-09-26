---
name: pr
description: Prepare, open and (when authorized) merge a pull request in this repo — run every check, review the diff against the conventions, prove new rules can fail, write the PR in the template, wait for CI. Use before any "abre o PR", "pode seguir", or at the end of each small batch of work.
---

# Open a PR

Read first: `docs/engineering/git-workflow.md`. One concern per PR, around 400 changed lines
(excluding generated files and lockfiles). Split bigger work into stacked PRs.

## Steps
1. **Branch:** `<type>/<short-kebab>` from an up-to-date `main`.
2. **Run everything locally** (Node lives in `~/.local/share/pnpm/bin`):
   ```bash
   pnpm check                # lint, no-comments, file roles, typecheck, depcruise, unit tests, docs
   pnpm test:integration     # needs pnpm db:up + pnpm db:migrate
   pnpm build                # when the API entry points, the bundle or dependencies changed
   ```
3. **Review your own diff** (`git diff main`) against the conventions, file by file:
   - each file keeps its role: types in `.types.ts`, schemas in `.schemas.ts`, thin routes, policies
     in middleware, no comments, public functions first;
   - names from the glossary; money in cents; dates through the clock; no `console.log`;
   - every workspace route declares a permission; tenant queries run in `withWorkspace()`;
   - new env var → `env.schemas.ts`, `.env.example` with a comment line, `deploy.md`;
   - operator text in English, app-user text in pt-BR;
   - no real household data anywhere.
4. **Prove the tests protect what they claim.** For each DB rule, security check or limit you added,
   remove it (or break the condition), run the test, see it go red, restore it. Say in the PR which
   mutations you ran and what caught them.
5. **Run it for real** when behavior is user-visible: boot the API (`pnpm exec tsx
   --env-file-if-exists=../../.env src/main.ts` in `apps/api`) and exercise the routes with `curl`, or
   run the ops command. Remove any test data you created.
6. **Docs in the same PR** for every behavior, rule or structure change; bump `updated:`.
7. **Commit:** Conventional Commits, subject ≤ 72 characters (commitlint enforces it), a body that says
   why, and the `Co-Authored-By` trailer from the session instructions. Never `--no-verify`.
8. **PR:** title = the squash commit subject; body follows `.github/pull_request_template.md`:
   what and why, how it was tested (commands, counts, mutations, manual runs), the checklist.
9. **Wait for CI:** `gh pr checks <n> --watch`. All six checks must pass.
10. **Merge** only with the user's approval for this PR or series (see memory), with
    `gh pr merge <n> --squash`. Then `git switch main && git pull` and delete the local branch.
11. **Report** to the user in pt-BR: what changed, what was verified, anything found and fixed, and
    the next step.

## Checklist
- [ ] `pnpm check` and `pnpm test:integration` green locally
- [ ] Diff reviewed against the conventions
- [ ] Mutations run for new rules; listed in the PR
- [ ] Docs updated, `updated:` bumped
- [ ] Commit subject ≤ 72 chars, PR body from the template
- [ ] CI green before merging
