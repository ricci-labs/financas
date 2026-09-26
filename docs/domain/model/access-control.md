---
summary: Access control inside a workspace — roles (system templates + custom), a module × action permission matrix (view/create/update/delete), owner rules, and where permissions are enforced (routes, agent tools, UI).
read_when: Adding a route, agent tool or screen; working on roles, members or invitations; any "who can do what" question.
updated: 2026-09-26
---

# Access control

Decision: `../../decisions/0015-module-permissions.md`.

Status: tables implemented in the `access` module (`module_actions`, `roles`, `role_permissions`). The matrix lives in
`packages/shared/src/access` (single source for API, web and the DB seed). Memberships and
the owner invariant are implemented in `members`. Route enforcement is implemented
(`access.middleware.ts`); agent tool gating comes with the agent.

## Model
- **Tenant isolation** (which workspace you can see at all) is handled by membership + RLS (`tenancy.md`).
- **Inside a workspace**, access is **module × action**. A membership has one **role**, and a role is a set of `(module, action)` permissions.
- Actions: `view` (access the module and read), `create`, `update`, `delete` (soft delete and restore, see `README.md` → Deletion).
- Roles come from **system templates** (Owner, Admin, Member, Viewer) and admins can create **custom roles** by ticking a matrix.

## Enums
- `app_module`: `entries`, `accounts`, `cards`, `contacts`, `planning`, `budgets`, `reports`, `attachments`, `settings`, `members`, `audit`
- `permission_action`: `view`, `create`, `update`, `delete`

| Module | Covers |
|---|---|
| `entries` | Journal entries (lançamentos): expenses, incomes, transfers, settlements |
| `accounts` | Accounts, cash, categories, opening balances |
| `cards` | Card setup, invoices, invoice payments |
| `contacts` | Contacts, charges, sending charges |
| `planning` | Recurrence rules, planned occurrences, reminders |
| `budgets` | Budget lines, goals |
| `reports` | Dashboard, overview, reports (view only) |
| `attachments` | Files on entries and charges |
| `settings` | Workspace settings |
| `members` | Members, invitations, roles |
| `audit` | Audit log, trash (view only) |

## Tables
### `module_actions` (global, seeded by migration)
The 36 valid `(module, action)` pairs, e.g. `reports` only has `view`. PK `(module, action)`.
`role_permissions` has an FK to it, so the DB rejects meaningless permissions. Seeded from
`MODULE_ACTIONS` in `@financas/shared`; an integration test fails if the two drift. **Read-only for
the app role** (writes revoked).

### `roles`
| Column | Notes |
|---|---|
| `workspace_id`, `id` | |
| `name` | Unique per workspace (among non-deleted) |
| `system_key` | `owner`, `admin`, `member`, `viewer` or null for custom roles |
| `description` | |
| `deleted_at`, `deleted_by_user_id` | Custom roles only. Can't be deleted while an active member or a pending invitation uses it, and a deleted role can't be given to a member or an invitation (triggers, `check_violation`). |

System roles are created with each workspace. `owner` can't be edited. The other system roles can be edited per workspace.

### `role_permissions`
`workspace_id`, `role_id`, `module`, `action`. PK `(role_id, module, action)`. FK `(module, action)` → `module_actions`.
Rule: any action other than `view` on a module requires `view` on that module. Enforced by a
**deferred constraint trigger** (checked at commit, so a full matrix can be written in any order).
The role must belong to the same workspace (composite FK). Keeping the `owner` role unchanged is
enforced by the service (next PR), not the DB, because the owner permissions are written when the
workspace is created.

### `memberships` (module `members`, see `tenancy.md`)
`role_id` (composite FK to `roles`) replaces the old role enum. The workspace creator gets the
`owner` role. At least one active owner per workspace, enforced by triggers.

## Default matrix (system templates)
`V` view · `C` create · `U` update · `D` delete

| Module | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| entries | VCUD | VCUD | VCUD | V |
| accounts | VCUD | VCUD | V | V |
| cards | VCUD | VCUD | VCU | V |
| contacts | VCUD | VCUD | VCU | V |
| planning | VCUD | VCUD | VCU | V |
| budgets | VCUD | VCUD | V | V |
| reports | V | V | V | V |
| attachments | VCUD | VCUD | VCU | V |
| settings | VU | VU | V | — |
| members | VCUD | VCU | V | — |
| audit | V | V | — | — |

Owner-only, outside the matrix: delete the workspace, transfer ownership, manage other owners.

## Enforcement
| Where | How |
|---|---|
| HTTP routes | First, a session on every `/api` route except the declared public ones (`requireSession`, a test walks every route). Then `authorize(module, action)` on every workspace route (from `modules/access`). A route without it fails a test that lists all routes. |
| Agent tools | Each tool declares its `(module, action)`. Only tools the user is allowed to use are offered to Claude in that turn, and the tool re-checks on execution. |
| Services | Receive an `actor` (user + workspace + permission set) and check again for operations reachable from several entry points (defense in depth). |
| Web | Menus and buttons are hidden without permission. The API remains the authority. |
| Database | RLS isolates tenants. Module permissions are **not** in RLS (kept simple, tested at the API layer). |

The permission set is loaded once per request/turn and cached on the context. Role changes apply on the next request.

### HTTP, in order
1. `requireSession` (every `/api` route that isn't public): `401 SESSION_REQUIRED`.
2. `workspaceAccess` (everything under `/api/workspaces/:workspaceId`): loads the workspace (not
   deleted), the user's active membership and its active role with its permissions in one
   workspace transaction (`loadWorkspaceAccess`). Not a member, a deleted workspace or membership,
   an unknown id or one that isn't a UUID all give the same `404 WORKSPACE_NOT_FOUND`, so a stranger
   can't learn that a workspace exists.
   The request also carries the caller's `roleKey` (`owner`, `admin`, `member`, `viewer` or null for
   a custom role) for the owner-only rules outside the matrix.
3. `authorize(module, action)` on the route: `403 PERMISSION_DENIED`, logged as `authz.denied` with
   module, action, workspace and user. Routes every member may use declare `authorizeAnyMember()`.
4. A test (`app.routes.test.ts`) walks every route under `/api/workspaces/` and fails if one has no
   permission check. Another proves a forgotten one is caught.

`GET /api/workspaces/:workspaceId` returns the workspace, the caller's membership, role and
permissions, so the web can hide what the user can't do.

`GET /api/workspaces` lists the caller's workspaces (name, archived flag, role), sorted by name. RLS
hides other tenants' memberships, so the ids come from the SECURITY DEFINER function
`user_workspace_ids(user_id)` (ADR 0019): active memberships of workspaces that aren't deleted,
workspace ids only. Each workspace is then read inside its own `withWorkspace()`.

## Examples
- A friend added as **Viewer** sees the dashboard and entries but can't record anything. The agent offers them only read tools.
- A custom role **"Lançador"** with `entries: VC` and `attachments: VC` records expenses and receipts but can't edit or delete.
- A **Member** deletes a wrong entry: it goes to the trash (soft delete). An Admin can restore it.
