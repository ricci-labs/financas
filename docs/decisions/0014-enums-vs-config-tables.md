---
summary: Postgres enums for values the code branches on; tables for anything users create or customize; settings as typed 1:1 tables, not key-value.
read_when: Adding a status/type/kind column, or a new user-configurable option.
updated: 2026-09-22
---

# 0014. Enums vs configuration tables; typed settings

- **Status:** Accepted
- **Date:** 2026-09-22

## Context
The user wants a strong configuration area (financial month, reminders, personalization) and a strongly structured database.

## Decision
- **Postgres enum** when code behavior depends on the value and users can't add values (roles, account kinds, statuses, frequencies). Adding a value means a migration plus code, which is correct because the code must handle it.
- **Table** when users create, rename, order or configure items (categories as ledger accounts, tags, contacts, institutions, holidays, recurrence rules, budgets, goals).
- **Settings are typed columns** in 1:1 tables (`workspace_settings`, `user_preferences`, `membership_preferences`), each with a type, default and CHECK constraints, never key-value rows.

## Alternatives considered
- Lookup tables for everything: flexible, but the code would branch on data that users could change.
- Key-value settings (`key text, value jsonb`): easy to add, but no types, no constraints, and typos fail silently.
- Plain text + CHECK instead of enums: similar integrity, but enums are clearer in the schema and in Drizzle types.

## Consequences
- A new setting = a migration adding a column with a default. That's cheap and explicit.
- Enum values can be added but not removed or renamed easily. Pick names carefully.
