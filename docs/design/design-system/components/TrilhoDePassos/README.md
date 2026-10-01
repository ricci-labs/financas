---
summary: The TrilhoDePassos component: a three-step track that shows where the person is in a journey across screens and email.
read_when: Building or changing the step track on sign-up or password moments.
updated: 2026-10-01
---

# TrilhoDePassos

TrilhoDePassos (`StepTrack` in apps/web) is three steps that show where the person is in a journey that crosses screens and email. It orients; it does not navigate: no step is clickable.

**States per step** (`fn-step--done|now|next`):
- Done: `ink` dot with a check in `mint`.
- Current: white dot with an `ink` ring, `aria-current="step"`.
- Next: ring only, lighter text.
- The line between steps is solid up to the current step and dashed after it.

**Tracks that exist:**
- Sign-up: "Conta criada" → "Confirmar e-mail" → "Entrar" (on the "Confira seu e-mail", "Confirmando" and "E-mail confirmado" screens).
- Password: "Pedir o link" → "Abrir o e-mail" → "Nova senha" (on the forgot-password "Confira seu e-mail" screen).

**While something is loading** in the current step (e.g. "Confirmando"), the current dot shows a spinner instead of the number.

**Rules:**
- Always three steps, with labels of up to two words.
- Used inside Momento, below the text.
- Read as an ordered list (`<ol>`) with an `aria-label`.

**In shadcn/ui:** there is no ready-made piece. It is a custom `<ol>` in `components/` with the classes described here.
