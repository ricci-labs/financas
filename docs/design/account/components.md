---
summary: The components the account area needs, in build order, with their shadcn base, props, where they live in apps/web and which design-system README describes them.
read_when: Creating or changing a UI component used by account screens (or reused elsewhere).
updated: 2026-10-01
---

# Components for the account area

Build these first; screens only compose them. Paths follow ADR 0027's layers (`../../architecture/web-components.md`): shadcn primitives stay in `components/ui`, our components live in `components/<family>/<component>/` with their file set. The visual reference for every state is `../design-system/components/<Name>/preview.html` (classes `fn-…` in `../design-system/components/bundle.css`); the rules are in its `README.md` (pt-BR).

## Build order

| # | Component (code name) | Design system | shadcn base | Lives in | Key props / states |
|---|---|---|---|---|---|
| 1 | `Button` | `Button` | `Button` (`rounded-full`) | `components/actions/button/` (over `ui/button`) | variants `default`, `secondary`, `outline` (white + ink border, for mint/cream backgrounds), `link`, `destructive`; `loading` (spinner + gerund label, `aria-busy`), `waitUntil` (countdown "Reenviar em 52 s" / "Tente de novo em 39:48", releases itself); disabled = `aria-disabled`, no hint text |
| 2 | `TextField` | `TextField` | `Field` + `FieldLabel` + `FieldDescription` + `Input` + `FieldError` | `components/forms/form-field/` + `components/inputs/text-input/` | help **before** the input; error on blur with icon; `readOnly` while submitting and for locked values (invitation email) |
| 3 | `PasswordInput` | `TextField` → Senha | `Input` + toggle button | `components/inputs/password-input/` | "Mostrar"/"Ocultar" with eye icon, `aria-pressed`, keeps focus; `autoComplete` current/new |
| 4 | `Alert` (form + arrival) | `Alert` | `Alert` + `AlertDescription` | `components/feedback/alert/` (over `ui/alert`) | variants `info`, `success`, `warning`, `danger`; `action` slot (small outline button or inline link); form errors above the main button (`role="alert"`), arrival messages under the title (`role="status"`) |
| 5 | `Tip` | `Dica` | — | `components/feedback/tip/` | one line with `Info` icon, inherits color |
| 6 | `StepTrack` | `TrilhoDePassos` | — | `components/display/step-track/` | 3 steps, `done`/`now`/`next`, spinner on `now` while loading, `<ol>` + `aria-current="step"` |
| 7 | `OwlScene` | `CenaCoruja` | — | `components/brand/owl-scene/` | `scene`, `state`, `play`; inline layered SVG from `../assets/corujas-em-camadas` (Vite `?raw`), CSS animations by `id` (`motion.md`) |
| 8 | `AuthLayout` | `TelaConta` | — | `components/layout/auth-layout/` + route `/_auth` | flexible owl block 160–320 px; desktop split; owl stays mounted across child routes |
| 9 | `MomentScreen` | `Momento` | — | `components/layout/moment-screen/` | `tone: "celebrate" \| "calm"`, `scene`, `title`, `children`, `actions`; desktop centered |
| 10 | `AppSplash` | `AberturaApp` | — | `components/brand/app-splash/` | owl 200 px, one-time entrance, never holds the app beyond 1.2 s |

Existing design-system components not needed here yet: `MoneyInput`, `Amount`, `StatusBadge`, `StatHero`, `EntryRow`, `InsightCard`, `BudgetProgress`, `Logo`, `CabecalhoApp`, `PaginaLoja`.

## Forms

- Schemas from `@financas/shared` (`credentialsSchema`, `newUserSchema`, `emailRequestSchema`, `resetPasswordRequestSchema`, invitation schemas). The "Repita a nova senha" match is a **web-only** refinement in `apps/web` (`*.schemas.ts`); the API never receives it.
- `useForm({ mode: "onTouched" })`; a field showing an error is rechecked on every change.
- One submit per tap; while pending the button is `loading` and fields are `readOnly`.

## Done when

Each component has every state from its `preview.html`, passes axe with no violations, works at 360 px and 1024 px, and renders with `prefers-reduced-motion: reduce`.
