---
summary: The Alert component (in-screen message) and the full-screen state banner, with placement, actions and shadcn mapping.
read_when: Building or changing an alert, a banner, a toast, or where form errors and arrival messages appear.
updated: 2026-10-01
---

# Alert

A message on the screen itself (alert), or a strip for a state of the whole screen (banner).

**Alert** (`fn-alert--info|success|warning|danger`):
- `*-soft` background, icon in the tone color, text in `ink`.
- Always with an icon: color never appears alone.

**Where it goes:**
- **Form error** (wrong credentials, 429, 5xx with `ref`): right **above the primary button**, with `role="alert"`.
- **Arrival message** ("Senha trocada…", "Você saiu.", "Conta criada…", "Sua sessão terminou…"): right **below the title**, with `role="status"`, in `success` or `info`.

**With an action:** the body (`fn-alert__body`) accepts:
- a small button (`fn-btn fn-btn--sm`, white with an outline) when the action is the next step ("Reenviar e-mail de confirmação");
- or a link inside the sentence when it is a shortcut ("Entre com ela").

**Banner** (`fn-banner`): an `ink` strip at the top, for whole-screen states: offline, read-only ("Você está vendo este espaço sem poder alterar nada."), session expiring.

**What the screen provides:**
- The pt-BR message taken from `docs/product/requirements/error-messages.md`, never the API message.
- On 5xx errors, the `ref` code.

**In shadcn/ui:**
- `Alert` + `AlertDescription`, with added `info`, `success`, `warning` and `danger` variants and an action slot.
- The banner is a layout component (`components/layout`).
- Toasts use `Sonner` (the shadcn toast), with `bg-surface`, `shadow-float` and a "Desfazer" (undo) action. Example: "Enviamos de novo." after resending an email.
