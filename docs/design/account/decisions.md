---
summary: Design decisions taken while designing the account area that change the requirement docs, with the exact doc and API edits to make.
read_when: Before building any account screen or email, and when updating product/requirements after the design.
updated: 2026-10-01
---

# Design decisions to apply to the docs

Each item says what changed, why, and which file to edit. Apply the doc edits in the same PR that builds the screen.

**Status (2026-10-01):** sections 1–3 and 5 are applied to `product/requirements` (ui-standards, non-functional, auth-and-account, error-messages); section 4 is built in the API emails (`emails.md` → renderEmail).

## 1. Layout and theme

| # | Decision | Edit |
|---|---|---|
| 1 | Mobile auth screens: mint top block flush with the top of the phone, straight edges, no logo on top (the title and the owl already say where you are). | `../../product/requirements/ui-standards.md` → layout section |
| 2 | Owl block is flexible (160–320 px) and shrinks when alerts/banners appear; account screens fit one phone screen without scrolling. | `../../product/requirements/ui-standards.md` |
| 5 | Subtitle 14 px on one line. | `../../product/requirements/ui-standards.md` |
| 6 | The app **always opens in the light theme**, even if the OS is dark. Dark only by choice. Account screens are always light. | `../../product/requirements/non-functional.md` RNF-RESP-3 and `../../product/requirements/modules/auth-and-account.md` RF-AUTH-16: options "Claro" (default), "Escuro", and "Automático" stops being the default |
| 7 | Screens without a form are full-screen "moments": mint for achievement/waiting (may show a 3-step track), cream for warning/error (no exclamation, no sparkle). | `../../product/requirements/ui-standards.md` (new section) |

## 2. Forms and buttons

| # | Decision | Edit |
|---|---|---|
| 3 | Short forms (≤ ~4 fields, all required) show only the `*` next to labels; the "* obrigatório" line stays only for long forms mixing optional fields. | `../../product/requirements/ui-standards.md` → Forms, item 1 |
| 4 | The disabled submit shows **no** "Preencha X e Y para continuar." text below it. It keeps `aria-disabled`; tapping it marks missing fields and focuses the first. | `../../product/requirements/ui-standards.md` → Button contract, "Enabled when" |
| — | Loading label in the gerund; countdown button for resend (60 s) and 429. | `../../product/requirements/ui-standards.md` → Button contract |

## 3. Copy

| Where | Current | New |
|---|---|---|
| Sign up success (AUTH-02) | "Se esse e-mail puder ser usado, enviamos um link de confirmação. Ele vale por 24 horas." | "Enviamos um e-mail para {email}. Toque em **Confirmar e-mail** e o Twise abre em outra página, já confirmado. O link vale por 24 horas." Still neutral: when the email already has an account, the API sends "Você já tem uma conta", so an email is always sent. |
| Forgot password success (AUTH-04) | "Se houver uma conta com esse e-mail, enviamos um link para trocar a senha. Ele vale por 1 hora." | "Se houver uma conta com {email}, enviamos um e-mail. Toque em **Criar nova senha** e o Twise abre em outra página para você trocar. O link vale por 1 hora." (stays conditional: no email is sent without an account) |
| Both "Confira seu e-mail" | — | add "Pode fechar esta tela." and "Não chegou? Olhe o spam e a aba Promoções." |
| Verify link 429 (AUTH-03) | only the generic 429 message | title "Vamos dar uma pausa", text "Muitas tentativas com links por aqui. Tente de novo em {minutos} minutos. Se você já confirmou, é só entrar." |
| INVITATION_EXPIRED | "Este convite expirou. Peça um novo a quem convidou." | title "Este convite expirou", text "Peça um novo a quem convidou. Convites valem por 7 dias." |
| INVITATION_FOR_ANOTHER_EMAIL | message only | title "Este convite é para outra pessoa" + the message; show "Você está como {email}." |
| Invitation accepted | — | "Vocês estão juntos no Casa!" / "Agora os dois veem o mesmo mês, do mesmo jeito." for ~1.5 s, then open the workspace |
| Logged-in invitation | — | below "Entrar no espaço": "Você está como {email}. Não é você? Sair" |

## 4. Emails (API)

Files: `apps/api/src/core/email/layout.ts`, `modules/identity/identity.emails.ts`, `modules/onboarding/onboarding.emails.ts`. Details in `emails.md`.

- `renderEmail` gains `greeting`, `illustration`, `preheader` and a plain-text link line; the heading becomes the action ("Confirme seu e-mail").
- Invitation email: "workspace" → "espaço" (`"…para o espaço \"Casa\" no Twise."`).
- Account-exists email: no raw URL in the sentence; "Esqueceu a senha? **Peça uma nova**." as a link.

## 5. App opening (SHELL-01)

Owl 200 px with a one-time entrance (≈2 s). The app never waits for it beyond 1.2 s; after 1.5 s without an answer show "Abrindo…". Add to `../../product/requirements/modules/auth-and-account.md` → Session handling.
