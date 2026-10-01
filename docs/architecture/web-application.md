---
summary: The web's application layer — routes and guards (TanStack Router), server data (TanStack Query over the hc client), errors, permissions, dates and money, PWA, how the API serves the SPA, and the bundle budget.
read_when: Adding a route or page, fetching or changing server data, handling an API error, touching the PWA, the SPA serving or the build.
updated: 2026-10-01
---

# Web application layer

Stack: ADR 0005. Folders: `structure.md` → apps/web. Import rules: `dependency-rules.md` → Web.
Requirements this layer serves: `../product/requirements/non-functional.md` (RNF-*).

## Flow
`route (params, search, guard, loader) → feature page → feature hooks (features/*/api) →
lib/api-client.ts (hc) → /api`

Routes decide **what** is on a page; features decide **how** it looks and talks to the API.

## Routes
TanStack Router, file-based, `autoCodeSplitting: true` (no `.lazy.tsx` files; components split on
their own, loaders stay in the main chunk as the docs advise).

| Path (file) | Is |
|---|---|
| `__root.tsx` | `createRootRouteWithContext<RouterContext>()`; `RouterContext = { queryClient }` |
| `_auth.tsx` + `_auth/login.tsx`, `signup`, `forgot-password`, `reset-password` | No session needed; the pathless `_auth` layout keeps the owl block mounted between them (`AuthLayout`) |
| `verify-email.tsx`, `invite.tsx` | No session needed; moments (`MomentScreen`) |
| `_app.tsx` | Pathless layout: session guard + `AppShell` |
| `_app/index.tsx` | Picks the workspace (last used, or the switcher, or `WS-01`) |
| `_app/w/$workspaceId/route.tsx` | Loads the workspace and the member's permissions; 404 → switcher |
| `_app/w/$workspaceId/entries/index.tsx`... | One folder per area: `entries`, `cards`, `planning`, `contacts`, `accounts`, `members`, `settings`, `history`, `trash` |
| `_app/account.tsx` | My account and preferences (`ME-01`) |
| `dev/components.tsx` | Workbench, development only (`web-components.md`) |

- URLs are English, like the API; the screen IDs map to them in the route's feature.
- **A route file only wires:** `validateSearch` (a schema from the feature's `.schemas.ts`),
  `loaderDeps`, a `loader` that calls `ensureQueryData` with the feature's query options, and a
  `component` that renders the feature's page with params and search as props. No markup beyond
  that one element, no hooks other than `Route.useParams`/`useSearch`, no copy.
- Features never call `getRouteApi` or `useParams`; they get params as props, so a feature isn't
  tied to a route ID.
- **Guards** run in `beforeLoad` through `context.queryClient.ensureQueryData`:
  - `_app`: `meQueryOptions()`; no session → `redirect({ to: '/login', search: { next } })`;
  - `w/$workspaceId`: the workspace (permissions); `WORKSPACE_NOT_FOUND` → the switcher;
  - each area: `requirePermission(context, 'entries', 'view')` (`lib/permissions.ts`); without it
    the route shows the no-permission state (`../product/requirements/ui-standards.md` → States).
- Router defaults: `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 0` (Query owns the cache),
  and the shared pending, error and not-found components from `components/feedback/`.
- Search params are the state of a list (period, filters, sort), so a link reproduces the view.

## Server data
- **Only `features/<feature>/api/` calls the backend**, through `apiClient` (`lib/api-client.ts`).
- **Reads:** `<feature>.queries.ts` exports `queryOptions` factories
  (`entriesQueryOptions(workspaceId, filters)`), used by loaders and components alike.
- **Writes:** one hook per use case, `api/use-<verb>-<noun>.ts` (`use-record-entry.ts`), wrapping
  `useMutation`.
- **Keys** always start from `lib/query-keys.ts`: `['me']`, `['workspaces']`, or
  `['w', workspaceId, '<area>', ...]`. Data of two workspaces can't mix, and switching shows no stale
  numbers.
- **Invalidation:** a write invalidates its workspace prefix (`['w', workspaceId]`). Only queries
  on screen refetch, and one write may change balances, the overview and an invoice at once
  (RNF-PERF-4). Narrower keys only when a measured case needs it.
- **Defaults** (`lib/query-client.ts`): `staleTime` 30 s; queries retry twice only on network
  errors and 5xx, never on 4xx; mutations never retry.
- `useSuspenseQuery` where the loader already fetched; `useQuery` for sections that load on their
  own (each with its skeleton, so one failing section doesn't take down the page).
- No optimistic updates unless the API can't refuse for a business rule (RNF-REL-4).

## API client and errors
- `apiClient = hc<AppType>('/')` with the API's type only (`dependency-rules.md`). If type-checking
  slows down, the API exports a pre-compiled client type (`hcWithType`), per the Hono RPC guide.
- `unwrap(response)` (`lib/api/unwrap.ts`) returns the typed body or throws an `ApiError`
  (`status`, `code`, `ref`, `retryAfterSeconds`), parsed from `{ error: { code, message, ref } }`.
  A response that isn't that shape becomes `UNKNOWN`; a failed fetch becomes `NetworkError`.
- **Global handling** (`QueryCache` and `MutationCache` `onError`):
  | Error | Does |
  |---|---|
  | 401 `SESSION_REQUIRED` | `queryClient.clear()`, go to `/login?next=<here>` with "Sua sessão terminou. Entre de novo." (RNF-SEC-3) |
  | 403 `PERMISSION_DENIED` | Toast with its message; refetch the workspace's permissions |
  | `NetworkError` | The offline banner; writes disabled (RNF-REL-3) |
  | 5xx | The page or form shows "Algo deu errado…" with the `ref` |
- **Everything else** is shown where it happened, with the message from
  `lib/errors/error-messages.ts` for its code (`web-components.md` → Copy), field errors through
  `applyApiError`.
- Error boundaries: each route's `errorComponent`, plus one per independent section. "Tentar de
  novo" calls `router.invalidate()` and resets the query error boundary.

## Session and links
- No auth state outside Query: the session is the `HttpOnly` cookie; "who am I" is `['me']`.
- Log out: call the API, then `queryClient.clear()` and go to `/login` (RNF-SEC-4).
- Link tokens (`#token=`) are read by `readFragmentToken()` (`lib/link-token.ts`) and removed with
  `history.replaceState` before the page renders (RNF-SEC-5).
- Nothing personal is stored in the browser; the only `localStorage` key is `theme`
  (`web-design-tokens.md` → Dark mode).

## Permissions in the UI
`useCan(module, action)` (`lib/permissions.ts`) reads the workspace query. Buttons and navigation
items are hidden with it (`../product/requirements/ui-standards.md` → Permissions); the API still enforces everything
(RNF-SEC-7).

## Dates and money
- **Dates use `@financas/shared`'s calendar** (`IsoDate`, `todayIn`, `addDays`, `periodOf`) with the
  workspace time zone from its settings, never the device's. No date library.
- Calendar dates travel and live as `YYYY-MM-DD` strings; never `new Date('YYYY-MM-DD')` (it parses
  as UTC midnight and shows the day before in São Paulo).
- Display through `lib/format/` (`Intl.DateTimeFormat('pt-BR', { timeZone })`): "hoje", "ontem",
  `dd/mm/aaaa`, "out/26" (RNF-I18N-3).
- Money: `parseBrl` and `formatBrl` from shared, only inside `MoneyInput` and `Amount`.
- **Later:** Temporal, once Safari ships it.

## PWA
`vite-plugin-pwa` with `registerType: 'prompt'`:
- precache the app shell only (`js`, `css`, `html`, `woff2`, icons); `navigateFallback:
  'index.html'` with `navigateFallbackDenylist: [/^\/api\//]`; **no runtime caching of `/api`**:
  authenticated data never sits in the service worker;
- a new version shows a toast "Nova versão disponível" with "Atualizar" (`useRegisterSW`);
- the worker is registered from code, never with an inline script;
- manifest: name "Twise", `lang: 'pt-BR'`, `display: 'standalone'`, 192/512 and maskable icons,
  colours from the `background` and `primary` tokens.

## Served by the API
The SPA build is copied into the API image and served by the same process (ADR 0005), after the
`/api` routes:

| Path | Cache-Control |
|---|---|
| `/assets/*` (hashed names) | `public, max-age=31536000, immutable` |
| `index.html`, `sw.js`, `manifest.webmanifest`, `theme-init.js` | `no-cache` |
| Any other path that isn't `/api/*` | `index.html` (SPA fallback), `no-cache` |
| Unknown `/api/*` | The API's own `ROUTE_NOT_FOUND`, never `index.html` |

The Content-Security-Policy (Hono `secureHeaders`): `default-src 'self'`, `script-src 'self'`,
`connect-src 'self'`, `img-src 'self' data: blob:`, `worker-src 'self'`, `object-src 'none'`,
`base-uri 'self'`, `frame-ancestors 'none'`. **Assumption:** `style-src 'self'` works (React sets
styles through the CSSOM); checked with Recharts when the first chart lands.

## Bundle budget
- `pnpm check:bundle` (`scripts/check-bundle.mjs`) reads Vite's `build.manifest`, walks the entry's
  **static** imports, gzips each file and fails above **250 KB** (RNF-PERF-1). Runs in CI after the
  build.
- Recharts and other heavy libraries are reached only from route components, which are split, so
  they never land in the initial chunk.
