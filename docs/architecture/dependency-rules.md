---
summary: Allowed and forbidden import directions across packages, layers and modules; enforced by dependency-cruiser.
read_when: Adding an import that crosses a module, layer or package boundary.
updated: 2026-09-22
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
| 2 | Code outside a module imports only its `index.ts` | Each module keeps a small public surface |
| 3 | Only the module's own service imports its `*.repository.ts` | Every DB access goes through business rules |
| 4 | `agent/`, `channels/`, `jobs/` call services, never repositories or `core/db` | One path to the data for every entry point |
| 5 | Routes contain no business logic: validate, call a service, map the result | Logic can't drift between web and WhatsApp |
| 6 | Services never import Hono, Baileys or the Anthropic SDK | Services stay testable and don't depend on the channel |
| 7 | No circular dependencies between modules | If A needs B and B needs A, extract the shared part or merge them |
| 8 | `packages/shared/src/domain` never reads the clock or env | Pure and deterministic: "now" is passed in as a parameter |

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
| `transactions` | `cards` | Resolve/create the invoice for each installment |
| `transactions` | `categories` | Validate the category |
| `budgets` | `reports` | Spent-vs-limit aggregates |

Adding a row here is a design decision. Mention it to the user.
