---
summary: Jobs that serve every workspace list the workspace ids through one narrow SECURITY DEFINER function, then work workspace by workspace as financas_app inside withWorkspace(); no BYPASSRLS role.
read_when: Writing a scheduled job that touches tenant data of all workspaces (occurrence planning, reminders, the notification worker, digests).
updated: 2026-09-26
---

# 0025. Cross-workspace jobs without a bypass role

- **Status:** Accepted
- **Date:** 2026-09-26
- **Refines:** 0012 and 0018, which planned a `financas_jobs` role with `BYPASSRLS` for these jobs.

## Context
- Reminders and the nightly occurrence planning must run for every workspace, with nobody logged in.
- RLS hides tenant rows until `app.workspace_id` is set, which is the point (ADR 0018).
- The plan was a `BYPASSRLS` role for jobs: a second connection string, a second password to
  manage, and a role that sees every tenant at once, so one forgotten filter in a job leaks data.

## Decision
- One narrow function, like ADR 0019: `job_workspace_ids()` returns the ids of the workspaces that
  are neither deleted nor archived, and nothing else. It is `SECURITY DEFINER`, owned by the owner,
  with `EXECUTE` for `financas_app` only.
- Jobs call it through `forEachWorkspace(db, work)` (`jobs/`), then run `work` for each workspace
  with the normal services, which open `withWorkspace()` themselves. RLS applies to every row a job
  reads or writes.
- One workspace failing doesn't stop the others. The failure is logged with the workspace id, and
  the run reports how many workspaces succeeded and how many failed.
- No `financas_jobs` role and no extra env var.

## Alternatives considered
- `BYPASSRLS` jobs role: far broader than a list of ids, plus one more secret to deploy.
- The owner connection in jobs: same breadth, and it's the migration role.

## Consequences
- A job costs one query per workspace. Fine at household and friends scale; batching can come
  later without changing the rule.
- A test proves the function returns only ids, and that `financas_app` still can't read other
  workspaces directly.
