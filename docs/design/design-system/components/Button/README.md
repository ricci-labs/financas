---
summary: The Button component: pill buttons, variants, sizes, the floating button, and the disabled, loading and waiting states.
read_when: Building or changing the Button component or any button state.
updated: 2026-10-01
---

# Button

A pill button for every action. Only one primary per screen.

**Variants** (`fn-btn--…`):
- `primary`: `action-primary` background, `on-action-primary` text.
- `secondary`: `action-secondary` background.
- `outline`: white with an `ink` outline, for the second action on `mint` or `sketch-paper`.
- `tertiary`: link in `mint-ink`.
- `danger`: `danger` text on `danger-soft`. Never primary.

**Sizes:**
- Default (`control-height`, 48px).
- `sm` (`control-height-sm`, with the touch area extended to `touch-min`).
- `icon` for icon only. It requires `aria-label` and a tooltip.

**Floating button** (`fn-fab`): "Novo lançamento" (new entry), in `mint` with an `on-mint` icon and `shadow-float`. Mobile only, above the bottom bar.

**States**
- Hover: `action-primary-hover` / `action-secondary-hover`.
- Pressed: scale 0.98 (feedback in under 100ms).
- Focus: 2px `focus-ring` with a 2px offset.
- **Disabled:** `bg-sunken` background, `ink-subtle` text, with `aria-disabled` (stays focusable).
  - **No sentence below it** ("Preencha X e Y…" was removed).
  - Tapping the disabled button marks the missing fields and moves focus to the first one, without submitting.
- **Loading** (`fn-btn--loading`): `action-primary-hover` background, spinner + label in the gerund ("Entrando…", "Criando conta…", "Trocando senha…"), `aria-busy` and `aria-disabled`.
  - Fields become read-only and links are paused.
  - One submit per tap.
- **Waiting** (`fn-btn--wait`): countdown with a clock icon and tabular numbers.
  - Two uses: resending an email ("Reenviar em 52 s", 60 s after each send) and the attempt limit ("Tente de novo em 39:48", from `Retry-After`).
  - It releases on its own when it reaches zero.
  - On `mint`, the background is `mint-soft`.

**What the screen provides:**
- The label as verb + result ("Salvar conta", "Registrar pagamento"), never "OK" or "Enviar" alone.
- The enabled condition.
- The success and failure action (see ui-standards → Button contract).

**In shadcn/ui:**
- `Button` with `rounded-full`.
- Variants: `default` (primary), `secondary`, `outline` (restyled: white with an `ink` outline), `link` (tertiary) and `destructive` (soft `danger-soft` background).
- Sizes: `default`, `sm` and `icon`.
- Loading and waiting are props of the same `Button` (`loading`, `waitUntil`), not new components.
- The floating button is a `Button` with the `fn-fab` classes.
- Icons: `lucide-react` (`Loader2`, `Clock`, `ArrowRight`).
