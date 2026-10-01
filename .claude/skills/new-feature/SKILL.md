---
name: new-feature
description: Build a web feature or screen from its spec (docs/product/requirements/modules) — feature folder, Query options and mutation hooks over the hc client, pt-BR messages, a thin route with guard and loader, every state of the spec, and tests. Use when implementing a screen ID such as AUTH-01, HOME-01 or ENT-02, or when the user says "faz a tela X".
---

# Build a web feature

Read first: the screen's section in `docs/product/requirements/modules/<module>.md`,
`docs/product/requirements/ui-standards.md`, `docs/architecture/web-application.md` and
`docs/architecture/web-components.md`. Check the API gaps (`docs/product/requirements/api-gaps.md`)
for the screen.

## Steps
1. **Inventory the spec:** fields (with limits from the shared schemas), actions with their
   permission and button contract, states (loading, empty, error, no permission, partial), errors
   (codes from `error-messages.md`), copy. Every item becomes code or a test; nothing is invented.
2. **Components first.** Anything the screen needs that the design system lacks goes through the
   `new-component` skill in its own PR, before the screen.
3. **Feature folder** `apps/web/src/features/<feature>/`:
   | Path | Holds |
   |---|---|
   | `api/<feature>.queries.ts` | `queryOptions` factories; keys from `lib/query-keys.ts` (`['w', workspaceId, …]`) |
   | `api/use-<verb>-<noun>.ts` | One `useMutation` per use case; invalidates `['w', workspaceId]` |
   | `components/` | The page and its parts; params and search arrive as props |
   | `<feature>.messages.ts` | All pt-BR copy of the feature, as the spec gives it |
   | `<feature>.schemas.ts` | Search params and UI-only schemas (request bodies come from `@financas/shared`) |
   | `<feature>.types.ts` | Every type of the feature |
   | `index.ts` | What routes import |
4. **API calls** only in `api/`, through `apiClient` + `unwrap` (errors become `ApiError`). No
   `fetch`, no `hono/client` elsewhere.
5. **Forms:** `useForm({ resolver: zodResolver(<shared schema>), mode: 'onTouched' })`, `FormField`
   for every field, `SubmitButton` with the "Preencha … para continuar." hint, server errors through
   `applyApiError`, "Descartar as alterações?" on leaving with changes.
6. **Route:** `routes/_app/w/$workspaceId/<area>/…tsx` with `validateSearch`, `loaderDeps`, a loader
   that `ensureQueryData`s the feature's options, the permission guard, and a component that renders
   the feature page with params and search. Nothing else in the file.
7. **States:** skeletons shaped like the content, empty sentence + action, error with `ref` and
   "Tentar de novo", no-permission message, one failing section never takes the page down.
8. **Tests:** component tests in Chromium for each state and each form rule (blur, change,
   cross-field, server error under the field), with the axe check; the journey in Playwright when
   the spec's journey is complete (`experience.md` J1–J11). Mock the network with
   `vi.spyOn(globalThis, 'fetch')`.
9. **Check against the prototype** at 360 px and desktop, light and dark.
10. Run the `pr` skill. The PR lists each spec item (fields, actions, states, errors) as covered.

## Checklist
- [ ] Every field, action, state and error of the spec is implemented and tested
- [ ] Copy matches the spec word for word, from `<feature>.messages.ts`
- [ ] Only `api/` talks to the backend; no feature imports another feature
- [ ] Every action declares its permission and is hidden without it (`useCan`)
- [ ] Route file only wires; no markup, hooks or copy beyond that
- [ ] `pnpm check` green, including `lint:tokens`, `lint:copy`, file roles, depcruise and the browser tests
