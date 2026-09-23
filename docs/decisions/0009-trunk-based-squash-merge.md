---
summary: Trunk-based development with short branches, PRs for every change (even solo), squash merge, Conventional Commits enforced by hooks.
read_when: Questioning the git/PR process or merge strategy.
updated: 2026-09-22
---

# 0009. Trunk-based development with PRs and squash merge

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
One human developer working with Claude. Every merge to `main` deploys. We want a readable history, a CI gate and a review point.

## Decision
Short-lived branches → PR → green CI → squash merge. PR titles and commits follow Conventional Commits, enforced by commitlint through lefthook. Details: `../engineering/git-workflow.md`.

## Alternatives considered
- Pushing straight to `main`: no CI gate, no review, and a broken `main` means a broken deploy.
- Merge commits or rebase-merge: they keep noisy work-in-progress commits in `main`.
- Git Flow (develop/release branches): ceremony for a continuously deployed personal app.

## Consequences
- `main` history has one commit per PR, easy to read and revert.
- Work-in-progress commits inside a branch can be informal. The PR title is what matters.
