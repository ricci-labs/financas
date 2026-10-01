---
name: new-component
description: Create or extend a shared web component (apps/web/src/components/<family>/<component>) with its fixed file set — cva recipe, types, pt-BR messages, examples for every state, browser tests with axe — built only from design tokens. Use when a screen needs a component the design system doesn't have yet, when adding a shadcn primitive, or when the user says "cria o componente X".
---

# Create a design-system component

Read first: `docs/architecture/web-components.md` (layers, file set, props contract, forms),
`docs/architecture/web-design-tokens.md` (the rule, roles), and the component's entry and states in
`docs/product/requirements/design-system-brief.md`, and its look in every state in
`docs/design/design-system/components/<Name>/` (README + `preview.html`). Copy comes from the screen specs
(`docs/product/requirements/`) and `ui-standards.md`.

## Steps
1. **Does it exist?** Look in `apps/web/src/components/` and the Families table. A different look of
   an existing component is a **new variant in its recipe**, not a new component. A component used
   by one feature only stays in that feature until a second one needs it.
2. **Name and family.** Name says what it shows (`Amount`, `StatusBadge`), never where it's used;
   family from the Families table (`actions`, `inputs`, `forms`, `feedback`, `display`, `charts`,
   `navigation`, `layout`, `finance`, `icons`).
3. **Primitive, if one is needed:** `pnpm dlx shadcn@latest add <name>` inside `apps/web` (Base UI).
   Then fix what upstream brings to tokens: arbitrary values (`text-[0.8rem]`, `rounded-[…]`,
   `bg-[color-mix(…)]`), `sm:`, `shadow-md`, `bg-black/50`, `text-white`. `pnpm lint:tokens` lists
   them. Keep the rest of the file as upstream wrote it. Features never import it directly.
4. **Create the folder** `components/<family>/<kebab-name>/` with only the files you need, always
   with these names:
   | File | Holds |
   |---|---|
   | `<name>.variants.ts` | `cva` recipe(s), `defaultVariants` always; token classes only |
   | `<name>.types.ts` | Props: native element props + `VariantProps<typeof nameVariants>` |
   | `<name>.messages.ts` | pt-BR copy as an `as const` object; functions for interpolation |
   | `<name>.tsx` | The component: markup and wiring; `data-slot`; states via attributes |
   | `<name>.examples.tsx` | Every variant × state of the brief, placeholder data only |
   | `<name>.test.tsx` | Behaviour of each state + `expectNoAccessibilityViolations` last |
   | `index.ts` | Component + props type; the only file imported from outside |
5. **Props contract:** `variant` / `size` / `tone` with the shared value names; `className` for
   placement only; `ref` as a prop; `disabled`, `aria-invalid`, `aria-busy`, `data-state` for states,
   styled with `aria-*:` / `data-*:` variants in the recipe; composition through Base UI's `render`.
6. **Copy:** no string literal in the `.tsx`; defaults from `.messages.ts`, overridable by props.
   Icon-only controls get `aria-label` from messages and a tooltip.
7. **Form field?** It renders through `FormField` (label, "*", help, error, `aria-describedby`) and
   passes `field.onBlur` down, so `mode: 'onTouched'` works.
8. **Tests** (Chromium, `*.test.tsx`): keyboard and focus for interactive parts, every state with
   behaviour, the axe check. Prove one test fails by breaking the behaviour, then restore.
9. **Workbench:** check the examples in `/dev/components` in light and dark, at 360 px and desktop,
   against the Claude Design prototype.
10. Run the `pr` skill.

## Checklist
- [ ] No hex, `rgb(`, `oklch(`, arbitrary value or default-palette class (`pnpm lint:tokens`)
- [ ] No user-facing literal in `.tsx` (`pnpm lint:copy`)
- [ ] Only role-named files in the folder; types in `.types.ts` (`pnpm lint:file-roles`)
- [ ] Features import it from its `index.ts` (`pnpm depcruise`)
- [ ] Every state of the brief in `.examples.tsx` and the workbench
- [ ] Browser tests + axe pass; a mutation was caught
- [ ] A new colour need became a token (`web-design-tokens.md` → Adding or changing a token), never a raw value
