---
name: new-module
description: Create a new API module (apps/api/src/modules/<name>) with the fixed file set, types and schemas in their own files, routes behind session and permission checks, and the docs that go with it. Use when adding a domain area such as contacts, planning, attachments or notifications, or when the user says "cria o módulo X".
---

# Create an API module

Read first: `docs/architecture/structure.md` → Module anatomy, `docs/architecture/dependency-rules.md`,
`docs/architecture/conventions.md` → File organization. Check `docs/domain/glossary.md` for the name.

## Steps
1. **Name.** One English noun from the glossary, kebab-case (`contacts`, `planning`). If it overlaps an
   existing module, stop and ask: two concepts in one module become two modules.
2. **Create only the files you need now**, always with these names, nothing else in the folder:
   | File | Holds |
   |---|---|
   | `<m>.table.ts` | Tables, enums, RLS policies (`tenantIsolation`), helpers from `core/db/columns.ts` |
   | `<m>.types.ts` | **Every** type of the module, exported or not (row types, inputs, deps) |
   | `<m>.repository.ts` | Drizzle queries only. Imported only by the service |
   | `<m>.service.ts` | Use cases. Past ~300 lines: `use-cases/<concept>.ts` + service as re-exports |
   | `<m>.routes.ts` | Thin Hono handlers: validate, call the service, answer |
   | `<m>.middleware.ts` | Guards, limits, request policies the routes use |
   | `<m>.emails.ts` | Email templates returning `EmailMessage` |
   | `index.ts` | Public surface: services, middleware and types other modules need. **Never routes** (`app.ts` imports `<m>.routes.ts` directly) |
3. **Schemas** for request bodies go in `packages/shared/src/<m>/<m>.schemas.ts` and are exported from
   the shared `index.ts`. Pure rules shared with the web go in `packages/shared/src/<m>/` too.
4. **Tables:** tenant tables get `workspace_id`, composite FKs on `(workspace_id, id)`, RLS, soft delete
   and the `updated_at` trigger (conventions → Migrations): `pnpm db:generate --name=...`,
   read the SQL, a custom migration for triggers, then `pnpm db:migrate`.
5. **Routes:**
   - `app.ts` imports the routes from `<m>.routes.ts`; workspace-scoped routes mount inside `workspaceScopedRoutes`, and every route declares
     `authorize(module, action)` or `authorizeAnyMember()` from `@api/modules/access`;
   - public routes are exported as `PUBLIC_<M>_ROUTES` and added to `PUBLIC_ROUTES` in `app.ts`
     (rare: say why in the PR);
   - read the user with `currentSession(c)` and the workspace with `currentWorkspace(c)`, never from
     the body.
6. **Dependencies:** import other modules only through their `index.ts`. A new module-to-module call
   gets a row in `dependency-rules.md` → Allowed cross-module calls, and a mention to the user.
7. **Tests:** `<m>.integration.test.ts` (or `<m>.<area>.integration.test.ts`) with one `describe` per
   table or use case. Seed through `createFixtures()`. Test-only shapes go in
   `src/testing/testing.types.ts`. For every DB rule and security check, prove the test fails without it.
8. **Docs:** the model doc for the area (`docs/domain/model/*.md`), `structure.md` if the module's role
   is new, `access-control.md` if it adds an `app_module`, the roadmap. Bump `updated:`.
9. Run the `pr` skill.

## Checklist
- [ ] Only role-named files in the module folder (`pnpm lint:file-roles` passes)
- [ ] No `type`/`interface` outside `.types.ts`; no Zod schema outside `.schemas.ts`
- [ ] Every workspace route has a permission check (`app.routes.test.ts` passes)
- [ ] Tenant tables have RLS, composite FKs, soft delete, `updated_at` trigger
- [ ] Cross-module calls listed in `dependency-rules.md`
- [ ] Docs updated
