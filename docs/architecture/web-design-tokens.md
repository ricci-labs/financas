---
summary: The web's single source of visual values — token tiers and files, naming, colour roles, type, spacing, radius, elevation, motion, layers, breakpoints, dark mode, tokens in JS, and the checks that keep raw values out.
read_when: Adding or changing a colour, font, size, shadow, animation or theme; styling anything in apps/web; reviewing a web PR.
updated: 2026-10-01
---

# Web design tokens

Decisions: ADR 0027 (tokens in CSS, components in layers) and ADR 0028 (the values and names are
the Twise design system's own). The design system's guide (`docs/design/design-system/`) says
**when** to use each role; this file fixes where tokens live and how code reaches them. Tailwind v4
reference: <https://tailwindcss.com/docs/theme>.

## The rule
**A visual value is written once, as a token in `apps/web/src/styles/tokens/`.** Components use
the utility classes those tokens create (`bg-surface`, `text-ink-muted`, `rounded-md`,
`shadow-float`) and nothing else: no hex, `rgb()` or `oklch()` in TS/TSX, no arbitrary values
(`w-[37px]`, `text-[#555]`), no Tailwind default-palette classes (`bg-slate-100`), no
`style={{ color }}`. `pnpm lint:tokens` fails on each of these (see Enforcement).

## Files
| File | Holds | Who reads it |
|---|---|---|
| `styles/tokens/semantic.css` | The design's **base roles** with raw values (light in `:root`, dark in `.dark`), elevations, durations and layers; then the **alias roles** (`success`, `status-*`, shadcn's names) as `var()` references. The only file with raw colour values | `theme.css`, charts through `var()` |
| `styles/tokens/theme.css` | Resets of Tailwind's defaults, the fixed scales in `@theme` (fonts, type styles, radius, control sizes, breakpoints, easing), `@theme inline` that turns every role into a utility, `@utility` for layers and durations | Tailwind |
| `styles/globals.css` | Imports, in order: `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, the two fonts, the token files; then the `@layer base` rules (page, focus ring, reduced motion) | `main.tsx` |
| `styles/account-colors.ts` | The fixed choices of the account and category colour picker (see Data colours) | The colour picker |

CSS files follow the code rules too: no comments, except tool directives with their reason
(`biome-ignore`).

## Roles and aliases
| Kind | Example | Becomes a class? | Rule |
|---|---|---|---|
| Base role | `--ink: #17191c` in `:root`, `#f2f0ea` in `.dark` | Yes, `@theme inline { --color-ink: var(--ink) }` | Named by role, never by hue. A role whose value is the same in both themes (`mint`, `sketch-paper`) is written once |
| Alias role | `--status-paid: var(--success)`, `--primary: var(--action-primary)` | Yes, same way | Points to a base role or another alias, so it follows the theme. Changing a hue is an edit to the base role only |
| Component token | `--sidebar-*` | Yes, same way | Only when one component needs its own adjustable value; it is an alias by default |

`@theme inline` is required whenever a theme variable points to another variable; without it the
value resolves where it is defined and the theme switch stops working.

## Naming
- The design system's names, unchanged: `bg-page`, `ink-muted`, `mint-soft`, `on-mint`,
  `action-primary-hover`, `status-partial`… Lowercase kebab-case, full words.
- `<role>-soft` is the soft background of badges, alerts and icon circles; text on it uses
  `<role>` itself (the design checks that pair). `on-<role>` is text and icons on a filled role
  (`on-mint`, `on-action-primary`).
- **Utilities drop the `bg-` prefix of background roles:** `--bg-page` → `bg-page`,
  `--bg-surface` → `bg-surface`, `--bg-sunken` → `bg-sunken` (never `bg-bg-page`).
- shadcn's names exist only as aliases (`background → bg-page`, `primary → action-primary`,
  `destructive → danger`, `input → border-control`, `ring → focus-ring`…), so generated components
  work unchanged. Our own components use the design names.

## Colour roles
When to use each one: the design system guide → Colour, and each token's notes.

| Group | Roles |
|---|---|
| Surfaces | `bg-page`, `bg-surface`, `bg-sunken`, `border`, `border-control`, `focus-ring` |
| Text | `ink`, `ink-muted`, `ink-subtle` |
| Brand | `mint`, `mint-soft`, `on-mint`, `mint-ink` |
| Actions | `action-primary`, `action-primary-hover`, `on-action-primary`, `action-secondary`, `action-secondary-hover` |
| Money | `income`, `income-soft`, `expense`, `expense-soft`, `transfer` (always next to a sign or a word, RNF-A11Y-4) |
| Feedback | `success`, `warning`, `danger`, `info`, each with `-soft`; `warning-fill` (budget bar, never text) |
| Status | `status-pending`, `status-overdue`, `status-paid`, `status-partial`, `status-matched`, `status-neutral` (cancelled, skipped), each with `-soft` |
| Illustration | `sketch-ink`, `sketch-paper` (fixed in both themes; illustrations always sit on `sketch-paper` or `mint-soft`) |
| Charts | `chart-1…5` |

## Typography
- **Two families, bundled:** Bricolage Grotesque (`font-display`: greeting, screen titles, the
  "Livre para gastar" figure) and Figtree (`font-sans`: everything else). Imported from Fontsource
  (`@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/figtree`), the same `woff2`
  files the design uses, so Vite ships them with the app (RNF-PRIV-1: no font CDN).
- **Type styles** are the design's, each with size, line height, weight and letter spacing
  (`--text-<style>`, `--text-<style>--line-height`, `--font-weight`, `--letter-spacing`):
  `amount-hero`, `display`, `title-lg`, `title` (display family), `amount-lg`, `amount`,
  `amount-sm`, `title-sm`, `body`, `body-sm`, `label`, `button`, `caption` (sans). Use one class:
  `text-title-sm`. A display style also needs `font-display`.
- `text-xs`, `text-sm` and `text-base` exist only as aliases of `caption`, `body-sm` and `body`, so
  shadcn components work.
- **Amounts** always use `tabular-nums`. It lives inside the `Amount` component, so no screen has
  to remember it (`web-components.md`). Inputs use 16 px (`body`) so iPhones don't zoom.

## Spacing, sizes, radius, elevation
- **Spacing:** `--spacing: 0.25rem`, the design's 4 px base (`space-1` = `p-1` … `space-16` =
  `p-16`). Side margins: `px-4` phone, `px-6` tablet, `px-12` desktop.
- **Control sizes** (`--spacing-*`): `touch` 44 px (`min-h-touch`), `control` 48 px (`h-control`),
  `control-sm` 36 px, `fab` 56 px (`size-fab`).
- **Radius:** the design's fixed scale, `sm` 8 px, `md` 14 px (fields, alerts), `lg` 20 px (cards,
  dialogs), `xl` 28 px (main card, bottom sheet), `full` (buttons, badges, chips).
- **Elevation:** flat by default (cards use `border`). `shadow-float` (floating button, menus,
  toasts) and `shadow-dialog` (dialogs, bottom sheet) only, from the `--elevation-*` values of each
  theme.
- **Borders:** `1px` for cards and fields, `2px` for focus and errors.

## Motion and layers
Tailwind has no duration or z-index namespace, so these are `:root` variables with one `@utility`
each (`@utility duration-fast { transition-duration: var(--duration-fast) }`).

| Token | Use |
|---|---|
| `--duration-fast` / `--duration-normal` / `--duration-slow` | Hover and press / popovers and toasts / sheets and page transitions |
| `--ease-standard`, `--ease-emphasized` | In `@theme` (`--ease-*` is a Tailwind namespace) |
| `--z-sticky` < `--z-overlay` < `--z-modal` < `--z-toast` | The only layers; no numeric `z-10` in components |

`prefers-reduced-motion: reduce` sets every duration to `0ms` in `@layer base` (RNF-A11Y-6).

## Breakpoints
`--breakpoint-*: initial`, then `md` 768 px (`bp-tablet`), `lg` 1024 px (`bp-desktop`: sidebar
instead of the bottom bar) and `xl` 1280 px (`bp-wide`). The base styles are the 360 px layout
(mobile first, RNF-RESP-1), so there is no `sm`. Container queries (`@container`)
are preferred for components that live in both the sidebar and the main column.

## Dark mode
- `@custom-variant dark (&:where(.dark, .dark *))`: the `.dark` class on `<html>`, as shadcn
  expects.
- **No flash, no inline script (RNF-SEC-6):** `public/theme-init.js`, a classic synchronous script
  loaded at the top of `<head>` with `<script src="/theme-init.js">` (allowed by
  `script-src 'self'`). It reads the device choice (`localStorage` key `theme`: `dark`, `system`,
  or `light`/absent; RF-AUTH-16 stores it on the device only), applies `.dark`, and sets
  `color-scheme`. This is the only file in `public/` with logic.
- **The app always opens in the light theme**, even when the system is dark (design decision,
  RNF-RESP-3). Dark applies only when the person picks "Escuro", or "Automático" with a dark
  system. Account screens are always light.
- The `ThemeProvider` (`app/`) writes the choice and follows system changes; nothing else touches
  the class.
- `color-scheme: light` in `:root` and `dark` in `.dark`, so native controls and scrollbars match.
- `theme-color` arrives with the PWA (web foundation 10), taken from the tokens; `index.html` has
  no colour of its own.

## Tokens in JavaScript
- **Charts** pass `var(--color-income)` or `var(--chart-1)` straight to Recharts (`fill`,
  `stroke`), the pattern shadcn's charts use; the theme switch is free.
- **A concrete value** (canvas, a computed shade) is read with `readToken('--color-x')` from
  `lib/tokens.ts` (`getComputedStyle` on `<html>`), re-read when the theme changes. Never copied.
- **Emails** can't use CSS variables. If they need brand colours, a script generates
  `apps/api/src/core/email/brand-colors.gen.ts` from `semantic.css`; the CSS stays the source.

## Data colours
Accounts and categories store a user-chosen colour as `#RRGGBB` (`ledger.schemas.ts`). It is data,
not a token:
- the picker offers only the choices in `styles/account-colors.ts`, picked to read on both themes
  and checked by `check:contrast` as a dot on `bg-page` and `bg-surface`;
- it is drawn only as a swatch, dot or icon tint, never as a background behind text;
- it reaches the DOM only through the `--data-color` custom property set by `ColorSwatch` and
  `CategoryIcon`, the two components allowed a `style` prop.

## Enforcement
| Check | Fails on | Where |
|---|---|---|
| `pnpm lint:tokens` (`scripts/check-tokens.mjs`) | Every string in `apps/web/src` TS/TSX outside `styles/` (class lists included): a raw colour (`#hex`, `rgb(`, `hsl(`, `oklch(`, `color-mix(`…); an arbitrary value (`w-[37px]`, `[color:red]`, `size-(--x)`), while arbitrary **variants** stay allowed (`[&_svg]:size-4`, `has-data-[icon=x]:pr-2`); classes of the scales we reset, which Tailwind would drop **silently** (the default palette `bg-red-500`, `text-white`, `bg-black/50`; `text-lg` and up; `shadow-xs…2xl`; `rounded-2xl…4xl`); numeric `z-<n>` and `duration-<n>`; the `sm:`, `2xl:` and arbitrary breakpoints; a `style` prop outside the two data-colour components | `pnpm check`, pre-commit, CI |
| `pnpm check:contrast` (`scripts/check-contrast.mjs`) | A token pair below WCAG 2.2 AA (4.5:1 text, 1.4.3; 3:1 UI parts, 1.4.11), resolved through every alias: the text roles on the three surfaces, each role on its `-soft`, `on-mint` on `mint`, `on-action-primary` on both primary states, `border-control`, `focus-ring` and the chart series on `bg-surface`, in both themes; plus the account-screen pairs (`ink` and `ink-muted` on `sketch-paper`, `focus-ring` on `mint`) in the light theme only, since those screens are always light | `pnpm check`, pre-commit when a token file changes, CI |

`lint:tokens` also covers `components/ui`: a `shadcn add` that brings `bg-black/50`, `text-white`
or `ring-[3px]` is fixed to tokens in the same PR. The pairs checked live in the script; a new
role that is drawn on a surface gets its pair there in the same PR.

## Adding or changing a token
1. Is there a role for it already? Reuse it. A new hue for one screen is not a token.
2. Add it to the design system first (it is where roles are decided), then port it: the base role
   in `:root` **and** `.dark` (or an alias), and its `@theme inline` line. A role used as a filled
   background gets its `on-` role too.
3. Add its pairs to `scripts/check-contrast.mjs` and run `pnpm check:contrast`.
4. Show it in the workbench (`/dev/components` → Tokens).
5. Same PR: update this file if a group or rule changed.

Biome's `nursery/noTailwindArbitraryValue` is not enabled: `lint:tokens` covers it, and nursery
rules change between releases.
