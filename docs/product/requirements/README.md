---
summary: Index of the web requirements (functional per module, non-functional, UI standards, error messages, design-system brief), the ID scheme, and the order to design screens with Claude Design.
read_when: Designing or building any web screen, writing a prompt for Claude Design, or checking what the UI must do for a module.
updated: 2026-09-29
---

# Web requirements

These documents describe what the web app must do and how it must behave, screen by screen. They
are written from the API as it exists (routes, Zod schemas in `@financas/shared`, error codes), so
every field, limit and error named here is real. The UI never invents a rule the API doesn't have,
and never skips one it does.

They are also the input for the visual prototype, made in **Claude Design** step by step: first
the design system, then one screen to validate the format, then module after module. Each module
file is self-contained, so it can be handed over alone.

## Documents
| File | Holds |
|---|---|
| `experience.md` | The idea of the product in the UI: principles, people, key journeys, navigation and the screen inventory with IDs |
| `non-functional.md` | Security, privacy, performance, accessibility, responsiveness, locale, reliability, quality (`RNF-*`) |
| `ui-standards.md` | The rules every screen follows: forms and validation, the button contract, feedback, states, formatting, permissions, destructive actions |
| `error-messages.md` | Every API error code with its status, when it happens, and the pt-BR message the user sees |
| `design-system-brief.md` | What the design system must contain before the first screen: tokens, components, patterns |
| `api-gaps.md` | Defects and missing reads found while writing these requirements, with the proposed fix and when |
| `modules/*.md` | Functional requirements per module (`RF-*`), with screens, fields, actions, states and errors |

Modules:
| File | Covers |
|---|---|
| `modules/auth-and-account.md` | Log in, sign-up, email verification, password reset, my account, preferences |
| `modules/workspace-and-members.md` | Workspaces, settings, Pix receiving, members, roles, invitations |
| `modules/accounts-and-cards.md` | Accounts, categories, balances, cards, invoices |
| `modules/entries.md` | Recording and managing entries of every type, trash |
| `modules/contacts-and-charges.md` | Contacts, shares, balances, charges, payments |
| `modules/planning.md` | Recurring bills and incomes, planned occurrences, budgets, goals, commission split, holidays |
| `modules/dashboard.md` | Period overview, metrics, insights, balance forecast, "posso comprar?" |
| `modules/attachments-and-audit.md` | Receipts on entries and charges, the audit history, notifications |

## IDs
- `RF-<MODULE>-<n>`: a functional requirement, e.g. `RF-ENT-3`.
- `RNF-<AREA>-<n>`: a non-functional requirement, e.g. `RNF-A11Y-2`.
- `<SCREEN>-<n>`: a screen, e.g. `ENT-02` (listed in `experience.md` → Screen inventory).
- Priority: **MVP** (needed for the couple to use the web daily) or **Later**.

Code, docs and IDs are in English. Everything the user reads (labels, messages, empty states) is
given in pt-BR, in quotes, and is the copy to use.

## Designing with Claude Design
The goal is richness of detail, so never ask for everything at once.

1. **Design system first.** Give it `design-system-brief.md`, `ui-standards.md` and the
   accessibility and responsiveness parts of `non-functional.md`. Ask only for tokens and
   components, shown in all their states.
2. **One screen to validate the format:** `AUTH-01` (log in). It is small but exercises fields,
   validation, the button contract, error messages and the loading state.
3. **The main screen:** `HOME-01` (period overview), with `modules/dashboard.md`. It validates
   cards, numbers, charts and insights.
4. **The richest form:** `ENT-02` (new entry), with `modules/entries.md`. It validates the whole
   validation standard.
5. **Before building (not before designing),** close the API gaps marked "Before the web" in
   `api-gaps.md`.
6. **Then module by module,** in this order: accounts and cards → entries (the rest) → planning →
   contacts and charges → workspace and members → attachments and audit → auth (the rest).

Prompt shape for each step:
> Using our design system, design screen `<ID>` described in `<file>` → `<section>`. Show the
> states listed there (default, loading, empty, error, no permission) and every field error. Mobile
> first (360 px), then desktop. Use only the pt-BR copy given.

Each screen spec lists its fields, actions, states and errors, so the prototype can be checked
item by item against it.

## Keeping it true
- A change to a route, schema or error code changes the matching module file and
  `error-messages.md` in the same PR (`CLAUDE.md` → Keeping docs current).
- The Postman collection (`../../api/postman.md`) and these files describe the same API.
