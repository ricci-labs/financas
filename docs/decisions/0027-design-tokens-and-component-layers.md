---
summary: The web's look comes from one token source (CSS variables in three tiers, Tailwind's default palette removed) and every shared component has one folder that owns its variants, copy, types and examples; features compose design-system components, never raw values.
read_when: Adding a colour, font, size or other visual value; creating or changing a shared component; considering Storybook, a token pipeline or another variant library.
updated: 2026-10-01
---

# 0027. Design tokens in CSS, components in layers

- **Status:** Accepted
- **Date:** 2026-10-01

## Context
The backend is fast to extend because every concern has one place and the rules are checked by
tools (file roles, depcruise, no comments). The user wants the web built the same way: heavy use of
shared components, strongly modular, and **one source of truth** for everything a shared component
is made of (colours, fonts, spacing, variants, copy). ADR 0005 chose Tailwind v4 and shadcn/ui but
said nothing about how values and components are organised, and Tailwind on its own lets any file
write `bg-red-500` or `w-[37px]`.

## Decision
- **Tokens live in CSS, in three tiers** (`../architecture/web-design-tokens.md`):
  1. **palette:** raw OKLCH colours as plain `:root` variables; no utility class reaches them;
  2. **semantic:** roles (`background`, `primary`, `income`, `expense`, `status-overdue`...) with a
     light and a dark value, exposed as utilities through `@theme inline`;
  3. **component:** only when a component needs its own adjustable value (shadcn's `--sidebar-*`).
  Tailwind's default palette, fonts, type scale, shadows and breakpoints are reset (`--color-*:
  initial`...), so only our tokens exist as classes.
- **CSS is the source, not JSON.** Charts use `var(--color-…)` directly; anything that needs a
  concrete value (emails) gets a generated file from the CSS, never a copy.
- **Components come in four layers** (`../architecture/web-components.md`): `components/ui`
  (shadcn, close to upstream) → `components/<family>/` design-system components → `features/*` →
  `routes/*`. Features and routes never import `components/ui` directly.
- **One folder per shared component** with a fixed file set: the component, its `cva` variants
  (`.variants.ts`), its types, its pt-BR copy (`.messages.ts`), its tests and its examples. The
  variant recipe is the single source for every size, tone and state.
- **Variants with `cva`,** the library shadcn's own components use, plus shadcn's `cn` helper.
- **Primitives on Base UI** (shadcn's default since July 2026), chosen once at `shadcn init`;
  Radix is not mixed in.
- **Workbench:** a development-only `/dev/components` route renders every component's examples;
  Storybook only if the library outgrows it.
- **Component tests run in a real browser** (Vitest browser mode with Playwright's Chromium) with
  an axe check in each test file; journeys run in Playwright end to end.
- **React Compiler on** from the first component; no manual memoisation.
- **Enforced by tools,** like the backend: a `lint:tokens` check (no raw colours, no arbitrary
  values, no default-palette classes outside `styles/`), a contrast check over the declared token
  pairs, file roles and depcruise rules for the web.

## Alternatives considered
- **Tokens in DTCG JSON + Style Dictionary or Terrazzo:** pays off with Figma sync or several
  platforms; here it adds a build step for one app, and the tools still trail the 2025.10 spec.
- **Keep Tailwind's palette and rely on review:** fast to start, but nothing stops a raw colour,
  and dark mode and contrast stop being checkable.
- **tailwind-variants:** slots are handy for multi-part components, but shadcn generates `cva`;
  two variant styles in one codebase is the opposite of the goal.
- **Storybook 10 from day one:** strong tooling, but a large dependency tree and a browser CI job
  for a two-person team with no components yet.
- **Wrapping every shadcn primitive:** simple primitives are re-exported, not wrapped; a wrapper
  exists only when it adds meaning (copy, a smaller API, domain rules).
- **Radix under shadcn:** familiar `asChild` API and more examples online, but Base UI is the
  path shadcn's new work follows.
- **jsdom for component tests:** faster and no browser in CI, but popovers, focus and layout
  behave differently from a real browser.

## Consequences
- A visual change (brand colour, radius, dark theme) is one edit in `styles/tokens/`.
- `shadcn add` output may use classes we removed (`bg-black/50`, `text-white`); each addition is
  checked by `lint:tokens` and fixed to tokens in the same PR.
- New file roles for the web (`.variants.ts`, `.messages.ts`, `.queries.ts`, `.examples.tsx`) join
  `lint:file-roles`.
- CI installs Playwright's Chromium for the web tests (CI and development only; nothing runs on the
  server).
- The token values themselves come from the design system made in Claude Design
  (`../product/requirements/design-system-brief.md`); this ADR fixes the structure, not the colours.
