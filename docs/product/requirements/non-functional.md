---
summary: Non-functional requirements of the web app (RNF-*) — security, privacy, performance, accessibility, responsiveness and PWA, locale and formatting, reliability, compatibility and quality.
read_when: Designing the design system, building the web shell, choosing a library, or reviewing a screen before merge.
updated: 2026-09-29
---

# Non-functional requirements

Stack (ADR 0005): Vite + React SPA, Tailwind v4, shadcn/ui, TanStack Router/Query/Table,
React Hook Form + Zod (the schemas from `@financas/shared`), Recharts, PWA. The build is served by
the API on the same origin.

## Security (RNF-SEC)
1. The session lives only in the `HttpOnly` cookie set by the API (ADR 0021). The web never
   stores tokens, passwords or personal data in `localStorage`, `sessionStorage` or IndexedDB.
2. The web and the API share one origin. Every write sends the browser's `Origin`, which the API
   checks (`CROSS_SITE_REQUEST`); the web never calls the API from another origin.
3. A `401 SESSION_REQUIRED` anywhere sends the user to `AUTH-01` with the current route as the
   return path, and clears the cached data of the previous session (TanStack Query cache).
4. Logging out, and changing the password on another device (which ends this session), both clear
   the cache and return to `AUTH-01`.
5. Tokens that arrive in links (email verification, reset, invitation) are read from the URL
   fragment (`#token=`), sent once to the API, and removed from the address bar
   (`history.replaceState`) before anything else renders.
6. No inline scripts or `eval`, so a strict Content-Security-Policy can be set.
7. Permissions shape the UI (RNF-SEC-8), but every rule is enforced by the API; the UI never relies
   on hiding a button for security.
8. The UI reads the member's permissions from `GET /api/workspaces/:workspaceId` and hides what the
   role can't do (`ui-standards.md` → Permissions).
9. Passwords: at least 12 and at most 128 characters, no composition rules; a "show password"
   toggle; the browser's password manager must work (`autocomplete="current-password"`,
   `"new-password"`, `"email"`).

## Privacy (RNF-PRIV)
1. No third-party analytics, trackers, fonts or scripts loaded from other domains. Fonts and icons
   are bundled.
2. Mock data in prototypes, tests and screenshots uses placeholders only ("Member A", "Conta X",
   round amounts), never real household data (the repo is public).
3. **Later:** a "modo discreto" toggle that blurs amounts on screen, for use in public.
4. Receipts (attachments) are only fetched from the API for the session's user; the web never
   builds public links to them.

## Performance (RNF-PERF)
1. First load on a mid-range phone over 4G: usable in under 3 s. The initial JS bundle stays under
   250 KB gzipped; each route loads its own code.
2. Every tap gets visual feedback in under 100 ms (pressed state, spinner, skeleton).
3. Lists use the API's cursor paging (`limit` default 100, max 500) with "load more" or infinite
   scroll; the UI never loads a whole table at once.
4. Server data is cached with TanStack Query and invalidated by the mutations that change it (e.g.
   a new entry refreshes entries, balances, the overview and the invoice it lands on).
5. Charts render from data already on the page; no chart blocks the first paint of its screen.

## Accessibility (RNF-A11Y)
Target: WCAG 2.2 level AA.
1. Text contrast at least 4.5:1 (3:1 for large text and UI parts), in light and dark themes.
2. Every control is reachable and usable by keyboard, in a logical order, with a visible focus ring.
3. Every field has a visible label (not only a placeholder), linked to its error and help text
   (`aria-describedby`); errors are announced (`aria-live`).
4. Meaning never depends on colour alone: income, expense and status also use a sign, an icon or a
   word.
5. Touch targets at least 44 × 44 px; spacing prevents mis-taps between destructive and safe
   actions.
6. Respects `prefers-reduced-motion` and the system text size (layouts survive 200% zoom).
7. Charts have a text alternative (the numbers in a table or a sentence).
8. Dialogs trap focus, close with Esc, and return focus to where they opened.

## Responsiveness and PWA (RNF-RESP)
1. Designed first at 360 px wide; breakpoints for tablet (≥ 768 px) and desktop (≥ 1024 px).
   Nothing scrolls sideways except tables that say so.
2. Installable PWA (manifest, icons, standalone display), respecting the phone's safe areas.
3. Light and dark themes, following the system by default, with a manual choice in `ME-01`.
4. Forms show the right mobile keyboard (`inputmode="decimal"` for money, `"email"`, `"tel"`).

## Locale and formatting (RNF-I18N)
1. The UI is in pt-BR only (ADR 0008). Every message comes from a single place per module, so
   another language can be added later without touching components.
2. Money is shown as `R$ 1.234,56` (the shared `formatBrl`), always from integer cents; typed
   amounts accept `1234,56`, `1.234,56` or `1234` and are parsed to cents (the shared `parseBrl`).
   The UI never does money math with floating point.
3. Dates show as `dd/mm/aaaa`, or "hoje", "ontem", "amanhã" when close; months as "outubro de
   2026" or "out/26" when short. The day boundary is the workspace time zone
   (`America/Sao_Paulo` by default), not the device's.
4. The financial period follows the workspace settings (calendar month, day N, or N-th business
   day), and every period label says its date range.
5. Plurals are correct ("1 parcela", "3 parcelas").

## Reliability (RNF-REL)
1. A button that sends a request is disabled while it runs, so nothing is sent twice
   (`ui-standards.md` → Button contract).
2. A network failure shows "Sem conexão. Verifique a internet e tente de novo." with a retry; typed
   data is kept.
3. No offline writes in the MVP: when offline, a banner says so and write actions are disabled.
4. Optimistic updates only where the API can't refuse for a business rule (e.g. marking a charge as
   sent is not one of them); otherwise the UI waits for the answer.
5. An unexpected error (5xx) shows the error `ref` ("Algo deu errado. Código: 4f3a9c1b"), which
   support can trace (`../../operations/runbook.md`).

## Compatibility (RNF-COMPAT)
The two latest versions of Chrome, Edge, Firefox and Safari; iOS Safari 17+; Android Chrome.

## Quality (RNF-QUAL)
1. TypeScript strict; forms validate with the same Zod schemas the API uses, with pt-BR messages.
2. Every screen spec's acceptance criteria are covered: component tests for forms and states, and
   Playwright end-to-end tests for the key journeys in `experience.md` (J1–J11).
3. The prototype from Claude Design is checked against the screen spec (fields, states, errors,
   copy) before it is built.
4. The code follows `../../architecture/conventions.md` (file roles, no comments, named constants).
