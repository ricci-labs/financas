---
summary: The web's single source of visual values — token tiers and files, naming, colour roles, type, spacing, radius, elevation, motion, layers, breakpoints, dark mode, tokens in JS, and the checks that keep raw values out.
read_when: Adding or changing a colour, font, size, shadow, animation or theme; styling anything in apps/web; reviewing a web PR.
updated: 2026-10-01
---

# Web design tokens

Decision: ADR 0027. Values (the actual colours, fonts and sizes) come from the design system made
in Claude Design (`../product/requirements/design-system-brief.md`); this file fixes where they
live and how code reaches them. Tailwind v4 reference: <https://tailwindcss.com/docs/theme>.

## The rule
**A visual value is written once, as a token in `apps/web/src/styles/tokens/`.** Components use
the utility classes those tokens create (`bg-primary`, `text-expense`, `rounded-md`, `shadow-raised`)
and nothing else: no hex, `rgb()` or `oklch()` in TS/TSX, no arbitrary values (`w-[37px]`,
`text-[#555]`), no Tailwind default-palette classes (`bg-slate-100`), no `style={{ color }}`.
`pnpm lint:tokens` fails on each of these (see Enforcement).

## Files
| File | Holds | Who reads it |
|---|---|---|
| `styles/tokens/palette.css` | Tier 1: raw OKLCH colours as `:root` variables (`--green-600`) | Only `semantic.css` |
| `styles/tokens/semantic.css` | Tier 2: roles with a light value in `:root` and a dark value in `.dark` | `theme.css`, charts through `var()` |
| `styles/tokens/theme.css` | Resets of Tailwind's defaults, `@theme` scales (type, radius, shadow, breakpoints), `@theme inline` that turns roles into utilities, `@utility` for layers and durations | Tailwind |
| `styles/globals.css` | Imports, in order: `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, the font, the three token files; then the `@layer base` rules (body, focus ring, reduced motion) | `main.tsx` |
| `styles/account-colors.ts` | The fixed choices of the account and category colour picker (see Data colours) | The colour picker |

CSS files follow the code rules too: no comments, one role each.

## Tiers
| Tier | Example | Becomes a class? | Rule |
|---|---|---|---|
| 1. Palette | `--green-600: oklch(0.63 0.17 149)` | **No** (plain `:root`, outside `@theme`) | Never referenced outside `semantic.css`, so a palette change can't break a component silently |
| 2. Semantic | `--income: var(--green-600)` in `:root`, `oklch(...)` in `.dark` | Yes, via `@theme inline { --color-income: var(--income) }` | Named by role, never by hue. Every role has a dark value |
| 3. Component | `--sidebar-background` | Yes, same way | Only when one component needs its own adjustable value; it points to a semantic token by default |

`@theme inline` is required whenever a theme variable points to another variable; without it the
value resolves where it is defined and the theme switch stops working.

## Naming
- `--<role>` for the surface or colour, `--<role>-foreground` for text and icons on it,
  `--<role>-muted` for the soft background of badges and alerts. A role that is used as a
  background always has its `-foreground`.
- Lowercase kebab-case, full words (`--status-partially-paid`, not `--st-pp`).
- shadcn's names are kept as they are (`background`, `foreground`, `card`, `popover`, `primary`,
  `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1…5`,
  `sidebar-*`), so generated components work unchanged.

## Colour roles
| Group | Roles | Notes |
|---|---|---|
| Base (shadcn) | `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring` | `primary` is the brand colour (Twise) |
| Money | `income`, `expense`, `transfer` | Always next to a sign or word (RNF-A11Y-4) |
| Feedback | `success`, `warning`, `danger`, `info` | `danger` points to `destructive` |
| Status | `status-pending`, `status-overdue`, `status-paid`, `status-partially-paid`, `status-cancelled`, `status-skipped`, `status-matched` | Each points to a feedback or base role by default (`status-overdue → danger`), so the status palette is one edit away |
| Charts | `chart-1…5`, `chart-grid`, `chart-zero-line` | Series colours; the forecast's zero line is its own role |

Each role in the Money, Feedback and Status groups comes as a set: base, `-foreground`, `-muted`.

## Typography
- **One family, bundled:** Inter Variable from Fontsource (`@fontsource-variable/inter`), imported
  by `globals.css`, so Vite ships the `woff2` with the app (RNF-PRIV-1: no font CDN). Fontsource
  already sets `font-display: swap`.
- `--font-*: initial`, then `--font-sans` only (and `--font-mono` if a screen needs it).
- **Type scale:** `--text-*: initial`, then each step with its pair:
  `--text-<step>`, `--text-<step>--line-height`, and `--letter-spacing` where it differs. Steps:
  `caption`, `sm`, `base`, `lg`, `xl`, `2xl`, `display` (the "livre para gastar" figure).
- **Weights:** `normal`, `medium`, `semibold` only.
- **Amounts** always use `tabular-nums`. It lives inside the `Amount` component, so no screen has
  to remember it (`web-components.md`).

## Spacing, radius, elevation
- **Spacing:** `--spacing: 0.25rem` (4 px base, kept from Tailwind). Use the steps
  `0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16`; a value off this list needs a token.
- **Radius:** one `--radius` in `semantic.css`; `--radius-sm/md/lg/xl` derived from it in
  `@theme inline` (shadcn's pattern). Changing the roundness of the whole app is one value.
- **Elevation:** `--shadow-*: initial`, then `--shadow-raised` (cards), `--shadow-overlay`
  (popovers, menus) and `--shadow-modal` (dialogs, sheets). Dark values may be stronger or replaced
  by a border.
- **Borders:** width `1px` everywhere; colour `border` or `input`.

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
`--breakpoint-*: initial`, then `md` 768 px, `lg` 1024 px, `xl` 1280 px. The base styles are the
360 px layout (mobile first, RNF-RESP-1), so there is no `sm`. Container queries (`@container`)
are preferred for components that live in both the sidebar and the main column.

## Dark mode
- `@custom-variant dark (&:where(.dark, .dark *))`: the `.dark` class on `<html>`, as shadcn
  expects.
- **No flash, no inline script (RNF-SEC-6):** `public/theme-init.js`, a classic synchronous script
  loaded at the top of `<head>` with `<script src="/theme-init.js">` (allowed by
  `script-src 'self'`). It reads the device choice (`localStorage` key `theme`: `light`, `dark` or
  absent = follow the system, RF-AUTH-16 stores it on the device only), applies `.dark`, and sets
  `color-scheme`. This is the only file in `public/` with logic.
- The `ThemeProvider` (`app/`) writes the choice and follows system changes; nothing else touches
  the class.
- `color-scheme: light` in `:root` and `dark` in `.dark`, so native controls and scrollbars match.
- `theme-color` in `index.html` is two `<meta>` tags with `media="(prefers-color-scheme: …)"`,
  using the `background` values; `theme-init.js` updates them on a manual choice.

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
  and checked by `check:contrast` as a dot on `background` and `card`;
- it is drawn only as a swatch, dot or icon tint, never as a background behind text;
- it reaches the DOM only through the `--data-color` custom property set by `ColorSwatch` and
  `CategoryIcon`, the two components allowed a `style` prop.

## Enforcement
| Check | Fails on | Where |
|---|---|---|
| `pnpm lint:tokens` (`scripts/check-tokens.mjs`) | In `apps/web/src` TS/TSX outside `styles/`: hex, `rgb(`, `hsl(`, `oklch(`; arbitrary values `-[…]` and `[prop:value]` (arbitrary variants like `[&_svg]:` are allowed); default-palette classes (`-(slate\|gray\|zinc\|red\|…)-\d{2,3}`, `-black`, `-white`); numeric `z-<n>`; `style=` outside the allowed components | `pnpm check`, pre-commit, CI |
| `pnpm check:contrast` (`scripts/check-contrast.mjs`, culori) | A declared pair below its minimum in light or dark: text on surfaces ≥ 4.5:1, `-foreground` on its role ≥ 4.5:1, `border`/`ring`/chart series on `background` ≥ 3:1; translucent tokens are blended over their surface first | `pnpm check`, CI |
| `lint:tokens` on `components/ui` | Same rules; a `shadcn add` that brings `bg-black/50`, `text-white` or `ring-[3px]` is fixed to tokens in the same PR | as above |

The pairs checked live in the script, next to the reason for each minimum (WCAG 2.2 1.4.3 and
1.4.11).

## Adding or changing a token
1. Is there a role for it already? Reuse it. A new hue for one screen is not a token.
2. Add the palette value (if new), the role in `:root` **and** `.dark`, and its `@theme inline`
   line. A role used as a background gets `-foreground` too.
3. Add its pairs to `check-contrast.mjs` and run `pnpm check:contrast`.
4. Show it in the workbench (`/dev/components` → Tokens).
5. Same PR: update this file if a group or rule changed.

Biome's `nursery/noTailwindArbitraryValue` is not enabled: `lint:tokens` covers it, and nursery
rules change between releases.
