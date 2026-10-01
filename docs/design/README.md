---
summary: Index of the visual design (Twise design system, account screens, owl illustrations and motion) and how to use it when building the web app.
read_when: Building or changing any web screen or component, picking colors/type/spacing, or using the owl illustrations.
updated: 2026-10-01
---

# Design

The UX/UI was designed visually (no production code) and exported here so it can be built straight into `apps/web` with the stack in ADR 0005 (Vite, React 19, Tailwind v4, shadcn/ui, TanStack Router/Query, React Hook Form + Zod).

## Routing table

| File | Read when |
|---|---|
| `design-system/README.md` | Any visual decision: principles, voice, colour, type, spacing, motion, brand |
| `../architecture/web-design-tokens.md` | The tokens themselves: they live in code, in `apps/web/src/styles/tokens/`, the single source |
| `design-system/components/<Name>/README.md` | Building that component: anatomy, states, which shadcn piece to use |
| `design-system/components/<Name>/preview.html` | Exact look of each state (classes in `components/bundle.css`, prefix `fn-`) |
| `account/README.md` | Starting the account area (AUTH-01..05, INV-01, SHELL-01): flow map, build order |
| `account/screens.md` | Building one account screen: every state with HTML, PNG and notes |
| `account/components.md` | Which components to build first and how they map to shadcn and to the repo |
| `account/motion.md` | Animating the owl scenes and screen transitions |
| `account/emails.md` | Changing the account emails sent by the API |
| `account/decisions.md` | **Before building:** design decisions that change `product/requirements/*` |
| `assets/` | SVGs: owl scenes, layered owl kits, logo, category illustrations, fonts |

## How to use it

1. Read `account/decisions.md` first: where the design and the requirement docs disagree, the design wins and the requirement doc must be updated in the same PR.
2. Build components before screens (`account/components.md`). Screens are compositions; no screen should need one-off CSS.
3. For a screen, open its PNG to see it and its HTML for exact copy, spacing and states. The HTML is a reference, not code to copy: its inline CSS (`tw-…` classes) predates the design system classes (`fn-…`). Use tokens and components.
4. Copy (pt-BR) in the screens and notes is final. Error copy comes from `product/requirements/error-messages.md`.
5. The app always opens in the **light theme**; dark only when the person chooses it. Account screens are always light.

## Sources

Exported on 2026-10-01 from the Claude design canvas "Twise Telas" and the design system artifact "Twise", then brought into the repo: the docs were translated to English (UI copy stays in pt-BR), and the token values moved into code (`apps/web/src/styles/tokens/`), which is now their only source. The HTML, PNG and animation files are references and are not edited by hand; a new export of a screen replaces its files.
