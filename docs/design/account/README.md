---
summary: Overview of the designed account area (log in, sign up, verify email, forgot/reset password, invitation, app opening, emails): flow map, layouts, rules and build order.
read_when: Starting any work on AUTH-01..05, INV-01 or SHELL-01.
updated: 2026-10-01
---

# Account area

Requirements: `docs/product/requirements/modules/auth-and-account.md`. Design decisions that change it: `decisions.md`.

## Flow map

| From | Action | To |
|---|---|---|
| App start | session valid | last workspace (or WS-01) |
| App start | `401` | Log in |
| Log in | "Criar conta" | Sign up |
| Log in | "Esqueci minha senha" | Forgot password (email carried over) |
| Sign up | submit | "Confira seu e-mail" (neutral) → person opens the email link in another page |
| Email link `/verify-email#token=` | load | "Confirmando…" → "E-mail confirmado!" or "Este link não vale mais" (same page) |
| Forgot password | submit | "Confira seu e-mail" (neutral) |
| Email link `/reset-password#token=` | submit | Log in with "Senha trocada…" |
| Invite link `/invite#token=` | load | preview → create account / log in / "Entrar no espaço" → "Vocês estão juntos no Casa!" → workspace |

No automatic log in after verify, reset or invitation sign-up: each ends on Log in with a message.

## Two layouts

- **Auth screen** (`TelaConta`): forms. Mint top block with the owl, flexible 160–320 px, shrinks when an alert or banner appears; the form is never cut and fits one screen without scrolling. Desktop: mint panel left (logo, owl, slogan), form right (max 400 px).
- **Moment** (`Momento`): no form. Full screen, owl large in the center, title, short text, actions at the bottom. **Mint** = achievement or waiting; **cream** (`sketch-paper`) = warning or error. Desktop: same color, content grouped in the center, owl block 400 px.

## Rules that apply to every screen here

- Errors show on blur, never while typing; they clear as soon as the value is valid.
- Disabled submit uses `aria-disabled` and shows **no hint text below**; tapping it marks the missing fields and focuses the first one.
- Short forms show the `*` next to labels only; no "* obrigatório" line.
- Loading: spinner inside the button with a gerund label ("Entrando…", "Criando conta…", "Trocando senha…"), fields read-only, links paused.
- 429: warning alert above the button and a countdown button ("Tente de novo em 39:48") from `Retry-After`. Resend: "Reenviar em 52 s" (60 s).
- "Confira seu e-mail" screens hand off to the inbox: they name the email button ("Toque em **Confirmar e-mail**") and say "Pode fechar esta tela." They never claim the screen will update.
- Subtitles fit on one line (14 px). Titles use `text-wrap: balance`; button labels and durations never break ("24&nbsp;horas").
- Owl scene base never changes between screens of the same flow; only the object next to the owl and its expression change (`motion.md`).

## Build order

1. Tokens and fonts in `apps/web/src/styles/tokens/` (`../../architecture/web-design-tokens.md`).
2. Components (`components.md`): Button states, TextField + PasswordInput, Alert with action, Dica, TrilhoDePassos, OwlScene, AuthLayout, MomentScreen.
3. Routes: `/_auth` layout route (keeps the owl mounted) with `/login`, `/signup`, `/forgot-password`, `/reset-password`; moment routes `/verify-email`, `/invite`.
4. Emails (`emails.md`) in `apps/api`.
5. Motion last (`motion.md`); every screen must already work with `prefers-reduced-motion`.

## Open question

**Open question:** desktop versions exist for log in, sign up and the moments; other forms follow the same split layout. Confirm with design if any screen needs its own desktop treatment.
