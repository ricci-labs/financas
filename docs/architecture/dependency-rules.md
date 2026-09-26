---
summary: Allowed and forbidden import directions across packages, layers and modules; enforced by dependency-cruiser.
read_when: Adding an import that crosses a module, layer or package boundary.
updated: 2026-09-26
---

# Dependency rules

Enforced by `.dependency-cruiser.cjs` in CI and in the `check` script. A violation fails the build.

## Packages
| From | May import | Must not import |
|---|---|---|
| `packages/shared` | `zod`, pure utilities | anything from `apps/*`, DB, HTTP, Node I/O |
| `apps/api` | `packages/shared` | `apps/web` |
| `apps/web` | `packages/shared`, **type-only** `AppType` from `apps/api` | any runtime code from `apps/api` |

## API layers
```
routes / agent tools / jobs / channels
              │
              ▼
     module service (index.ts)
              │
              ▼
   module repository ──► core/db
              
   everything may use: packages/shared, core/{config,logger,clock,http/errors}
```

| # | Rule | Why |
|---|---|---|
| 1 | `core/` imports nothing from `modules/`, `agent/`, `channels/`, `jobs/` | Infrastructure stays reusable and free of cycles |
| 2 | Code outside a module, and other modules, import a module only through its `index.ts` | Each module keeps a small public surface |
| 2a | Exception: a `*.table.ts` may import another module's `*.table.ts` (foreign keys). Nothing else may import another module's table | The schema is one graph; data access still goes through services |
| 2b | Test code (`*.test.ts`, `src/testing/`) may import tables and internals directly to seed data | Fixtures shouldn't need services; production code keeps every rule |
| 2c | `app.ts` mounts routes straight from `<module>.routes.ts`; a module `index.ts` never exports routes | Routes may then import any module's `index.ts` (e.g. `access` for `authorize`) without a cycle, even when that module depends on theirs |
| 3 | Only the module's own service imports its `*.repository.ts` | Every DB access goes through business rules |
| 4 | `agent/`, `channels/`, `jobs/` call services, never repositories or `core/db` (only the `Database` type from `db.types.ts`, to hand the connection to services) | One path to the data for every entry point |
| 5 | Routes contain no business logic: validate, call a service, map the result | Logic can't drift between web and WhatsApp |
| 6 | Services never import Hono, Baileys or the Anthropic SDK | Services stay testable and don't depend on the channel |
| 7 | No circular dependencies between modules | If A needs B and B needs A, extract the shared part or merge them |
| 8 | `packages/shared` never reads the clock or env | Pure and deterministic: "now" is passed in as a parameter |
| 9 | Every DB access runs through `core/db/tx.ts` with a workspace set, except global tables (`users`...) and the `BYPASSRLS` job role | Tenant isolation (ADR 0012) |

## Web
| # | Rule |
|---|---|
| 1 | Flow is `shared (components, hooks, lib) → features → routes`. Never the reverse. |
| 2 | A feature never imports another feature. Routes compose features. |
| 3 | Only `features/*/api/` calls the backend (through `lib/api-client.ts`). |
| 4 | `components/ui` (shadcn) never imports from features. |

## Allowed cross-module calls (keep this list current)
| Caller | Callee | Reason |
|---|---|---|
| `ledger` | `workspaces` | Settings (currency, timezone) |
| `planning` | `ledger` | Check the accounts of a recurrence (`loadUsableAccounts`); read the entry a member matches to a planned occurrence (`findActiveEntry`) |
| `planning` | `workspaces` | The workspace time zone, for "today" (`currentWorkspaceDefaults`) |
| `reports` | `ledger`, `planning`, `workspaces` | Load the period facts for the metrics and insights (ADR 0024) |
| `contacts` | `ledger` | Open receivable items for charges; record settlements |
| `contacts` | `notifications` | Send charges and charge reminders |
| `planning` | `notifications` | Bill and invoice reminders |
| `reports` | `ledger`, `planning`, `contacts` | Read-only aggregates |
| every module | `workspaces` | Current workspace settings |
| `onboarding` | `workspaces`, `ledger`, `access`, `members` | Creating a workspace: the workspace and its settings, the system accounts, the system roles, the creator as owner |
| `onboarding` | `identity` | Registering an owner: the user, then their first workspace |
| `access` | `members` | Loading the caller's active membership to authorize a request; managing members (role changes, removals) with the owner rules |
| `access` | `identity` | Member names and emails in the member list |
| every module's routes | `access` | `authorize()`, `currentWorkspace()` on workspace routes |
| `workspaces` routes | `onboarding` | `POST /api/workspaces` creates a workspace through `createWorkspace` |

`onboarding` only orchestrates flows that span modules (creating a workspace) and nothing depends on it, so every module can depend on `workspaces` without a cycle.

Cards and invoices live in `ledger`: postings reference invoices and invoices reference card accounts, so a separate `cards` module would be a cycle (rule 7).

Contact validity on postings is enforced by the composite FK, so `ledger` never calls `contacts` (that would create a cycle with `contacts → ledger`).

Adding a row here is a design decision. Mention it to the user.
