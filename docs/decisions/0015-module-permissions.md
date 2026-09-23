---
summary: Inside a workspace, access is a module × action matrix (view/create/update/delete) attached to roles — system templates plus custom roles — enforced at routes, agent tools and services.
read_when: Changing roles, permissions, or how access is checked.
updated: 2026-09-22
---

# 0015. Module × action permissions with custom roles

- **Status:** Accepted
- **Date:** 2026-09-22
- **Replaces:** the fixed `membership_role` enum from `../domain/model/tenancy.md` (first draft).

## Context
The user wants a simple but configurable access system: per module, the ability to view, create, update and delete. Workspaces may be shared with friends who should only see, or only record.

## Decision
- Enums `app_module` and `permission_action` (`view`, `create`, `update`, `delete`).
- `roles` per workspace (system templates Owner/Admin/Member/Viewer plus custom roles) and `role_permissions (role, module, action)`. The valid pairs live in a seeded `module_actions` table referenced by FK.
- A membership has exactly one role. Owner-only powers (delete the workspace, transfer ownership) stay outside the matrix.
- Enforced at every entry point: route middleware, agent tool gating (Claude only sees allowed tools), and service-level checks. RLS keeps doing tenant isolation only.
- Details: `../domain/model/access-control.md`.

## Alternatives considered
- Fixed roles only (enum): simple, but no "can record, can't delete" type of role.
- Per-record ACLs or attribute-based rules: powerful, and far beyond what's needed.
- Permissions inside RLS policies: another layer of SQL complexity that's harder to test than the API layer.

## Consequences
- Every route and tool must declare its permission. A test fails if one doesn't.
- The permission matrix UI is a grid of checkboxes per role.
- Adding a module means a migration (enum value + `module_actions` rows + template defaults).
