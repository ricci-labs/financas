---
summary: The web's token values and names are the Twise design system's own — base roles with a value per theme plus alias roles — ported once into apps/web, which is their only source; this replaces ADR 0027's separate palette tier.
read_when: Adding or changing a token, porting a new design-system export, or wondering why there is no palette file.
updated: 2026-10-01
---

# 0028. Tokens follow the Twise design system

- **Status:** Accepted
- **Date:** 2026-10-01

## Context
ADR 0027 planned three token tiers in code: a raw palette, semantic roles pointing to it, and
component tokens. The design system then arrived from Claude Design (the design package in `docs/design/`) with
its own structure: 36 base roles (`ink`, `bg-page`, `mint`, `income`, `danger`…), each with a
light and a dark value, and 40 alias roles that point to them (`success → income`,
`status-paid → success`, shadcn's `primary → action-primary`). Its notes give each role its
contrast grounds. The user asked for the design system to be brought into the code as it is
("pegue o design system e transfira para nosso código, simples assim"), with the code as the
single source.

## Decision
- `apps/web/src/styles/tokens/semantic.css` holds the design's **base roles** with their raw
  values (light in `:root`, dark in `.dark`) and its **alias roles** as `var()` references, with
  the design's names. There is no separate palette file: the design system is where hues are
  chosen, and each raw value still appears once in code.
- `theme.css` turns every role into a utility through `@theme inline` and holds the fixed scales
  from the design (type styles, radius, control sizes, breakpoints, fonts) in `@theme`.
- The export (`tokens.json`, `tokens.css`) is not kept in the repo. A new design export is ported
  by hand into these files, in one PR.
- Everything else in ADR 0027 stands: no raw values in components, Tailwind's defaults reset,
  `cva` recipes, the component layers and the checks.

## Alternatives considered
- **Keep the palette tier** (name every hex by hue, roles point to it): adds a set of names the
  design doesn't have, so every new export needs a mapping step and the names drift from the
  design's.
- **Generate the CSS from `tokens.json`** with a script and a CI sync check: no hand porting, but
  the user chose the code as the source, and it adds a build step for a file that changes rarely.

## Consequences
- The names in code, in the design docs and in the screens are the same (`text-ink-muted`,
  `bg-mint-soft`); utilities drop the `bg-` prefix of background roles (`bg-page`, not
  `bg-bg-page`).
- A hue change is an edit to the base role; aliases follow.
- ADR 0027's status notes this amendment.
