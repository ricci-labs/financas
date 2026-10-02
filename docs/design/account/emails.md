---
summary: Design of the five account emails (verify, account exists, reset, password changed, invitation): layout, per-template copy and the renderEmail changes.
read_when: Changing apps/api/src/core/email/layout.ts or any *.emails.ts.
updated: 2026-10-01
---

# Account emails

Mockups: `screens/html/Email-*.html` and `screens/png/Email-*.png`.

## Layout

Subject and sender "Twise" → logo (icon + "twise") → white card, max 520 px, radius 20, 1 px `border`:

1. Mint band (188 px) with the owl scene of the same flow (PNG 2x, hosted; SVG does not render in every client).
2. Greeting, `ink-muted` 15 px ("Olá, Member A!").
3. Heading = the action, 28 px display font ("Confirme seu e-mail").
4. One or two paragraphs, 16 px.
5. Black pill button, the **same label the app screen quotes**.
6. Fallback line: "Se o botão não abrir, copie este endereço no navegador:" + the URL.
7. Notes under a divider, 13 px `ink-muted`.

Footer: "**Twise** · Leve, claro, a dois." + why the email was sent. Light theme only, no animation. Tables + inline styles; Bricolage/Figtree fall back to Arial.

## renderEmail (built 2026-10-01)

`apps/api/src/core/email/layout.ts`. `EmailContent` has `preheader`, `greeting`, `illustration` (`'envelope' | 'welcome' | 'key' | 'padlock' | 'invitation'`, the scenes `coruja-email`, `coruja-boas-vindas`, `coruja-chave`, `coruja-fechado`, `coruja-convite`) and `reason`, all optional (the reminder emails use none of them yet). Paragraphs may hold spans: plain text, `{ strong }` or `{ link }` (rendered as "label (url)" in the text version). The HTML renders the fallback URL line from `action.url`. The text version keeps the order: greeting, heading, paragraphs, action, notes.

- **Images:** PNG 2x renders of the owl scenes and the logo, in `apps/web/public/email/` (`owl-<scene>.png`, `twise-logo.png`), made from the SVGs in `../assets/` with Chromium. Emails load them from the origin of their action link (`<PUBLIC_URL>/email/…`), so they appear once the API serves the web build (web foundation 9).
- **Colours:** `brand-colors.gen.ts`, generated from the tokens (`../../architecture/web-design-tokens.md` → Tokens in JavaScript).

## Templates

| Template | Subject | Preheader | Illustration | Greeting · Heading | Button | Changes |
|---|---|---|---|---|---|---|
| `email_verification` | Confirme seu e-mail | Falta um toque para começar a usar o Twise. | email | Olá, {nome}! · Confirme seu e-mail | Confirmar e-mail | paragraph "Falta um toque para vocês começarem a usar o Twise." |
| `account_already_exists` | Você já tem uma conta | Alguém tentou criar uma conta com este e-mail. | boas-vindas | Olá, {nome}! · Você já tem uma conta | Entrar | 2nd paragraph "Se foi você, é só entrar. Esqueceu a senha? **Peça uma nova**." (link, no raw URL) |
| `password_reset` | Troque sua senha | O link vale por 1 hora. | chave | Olá, {nome}! · Vamos criar uma nova senha | Criar nova senha | — |
| `password_changed` | Sua senha foi trocada | Saímos de todos os aparelhos por segurança. | fechado | Olá, {nome}! · Sua senha foi trocada | Não fui eu: trocar a senha | security notice: padlock, no sparkle |
| `workspace_invitation` | Você recebeu um convite no Twise | {inviter} convidou você para o espaço {workspace}. | convite | Oi! · {inviter} convidou você | Ver convite | "workspace" → "espaço"; paragraph "…para cuidarem juntos do dinheiro do mês." |

Notes and validity lines stay as they are today in the API.
