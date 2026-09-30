---
summary: Functional requirements for log in, sign-up, email verification, password reset and change, invitations answered by the invitee, session handling, and my account (profile, preferences, notification settings).
read_when: Designing or building AUTH-*, INV-01 or ME-01, or anything about sessions and login.
updated: 2026-09-29
---

# Auth and my account

Standards: `../ui-standards.md`. Messages per code: `../error-messages.md`. API: `/api/auth/*`,
`/api/invitations/*`, `/api/workspaces/:id/members/me/preferences`.

## Rules that shape these screens
- **Session:** an HttpOnly cookie valid 30 days, renewed while used. The web can't read it: it
  calls `GET /api/auth/me` and treats `401` as logged out.
- **Links carry the token in the fragment** (`#token=`). The web must serve `/login`,
  `/forgot-password`, `/verify-email`, `/reset-password` and `/invite`.
- **No automatic log in** after verifying an email, resetting a password, or creating an account
  through an invitation. Each ends on `AUTH-01` with a success message.
- **Neutral answers:** sign-up, resend verification and forgot password always answer "accepted"
  (202), whatever the email, so nobody can learn which emails have accounts. The UI never says
  "this email exists" or "doesn't exist".
- **Limits** (defaults): 5 failed logins per email and 30 per network in 15 min; 3 account emails
  per address and 10 per network per hour (sign-up, resend and forgot share them); 20 invalid links
  per network per hour. Over a limit the API answers `429` with `Retry-After`.
- **Password:** 12 to 128 characters, no composition rules. Email: up to 254 characters, compared
  without case. Display name: 1 to 80 characters.
- **Link lifetimes:** verification 24 h, reset 1 h, invitation 7 days; each works once.

## AUTH-01 Log in (MVP)
Route `/login`, optionally `?next=<path>`. Also the landing for expired sessions.

**RF-AUTH-1** A person logs in with email and password; on success the web opens `next` if it is
an app path, otherwise the last workspace, otherwise `WS-01` when they have none.

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| email | "E-mail" | email, `autocomplete="email"` | yes | valid email, up to 254 |
| password | "Senha" | password with show/hide, `autocomplete="current-password"` | yes | up to 128 (the minimum is not checked here, so old passwords still work) |

| Action | Enabled when | Loading | Success | Errors |
|---|---|---|---|---|
| "Entrar" (primary) | e-mail valid and password filled (button contract) | spinner, fields read-only | go to the destination above | `INVALID_CREDENTIALS` form message, focus on password, password cleared; `EMAIL_NOT_VERIFIED` inline message with the action "Reenviar e-mail de confirmação" (calls resend with the typed email); `TOO_MANY_ATTEMPTS` form message with the wait time, button disabled until it ends; `LOGIN_INVALID` field errors |
| "Esqueci minha senha" (link) | always | — | `AUTH-04`, email carried over | — |
| "Criar conta" (link) | only when `GET /api/auth/config` says sign-up is on | — | `AUTH-02` | — |

States: arriving from an expired session shows "Sua sessão terminou. Entre de novo."; arriving from
`AUTH-03`/`AUTH-05`/`INV-01` shows their success message; offline banner.

## AUTH-02 Sign up (MVP when enabled)
Route `/signup`. Shown only when public sign-up is on; otherwise the route shows "O cadastro está
fechado. Peça um convite a quem usa o Twise." with a link to `AUTH-01`.

**RF-AUTH-2** A person creates an account and receives a confirmation email.

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| displayName | "Seu nome" | text | yes | trimmed, 1–80 |
| email | "E-mail" | email | yes | valid, up to 254 |
| password | "Senha" | new password with show/hide, `autocomplete="new-password"` | yes | 12–128; help "Use pelo menos 12 caracteres. Uma frase fácil de lembrar funciona bem." |

| Action | Success | Errors |
|---|---|---|
| "Criar conta" | a confirmation panel: "Se esse e-mail puder ser usado, enviamos um link de confirmação. Ele vale por 24 horas." with "Reenviar" (60 s cooldown) and "Voltar para o login" | `USER_INVALID` field errors; `SIGNUP_DISABLED` switches to the closed message; `TOO_MANY_ATTEMPTS` |

## AUTH-03 Verify email (MVP)
Route `/verify-email#token=…` (landing) and a resend form.

**RF-AUTH-3** Opening the link confirms the email automatically (no button), then offers log in.

- On load: read the token, clear it from the address bar, call `POST /api/auth/verify-email`.
- Success: "E-mail confirmado. Agora é só entrar." + "Entrar" (to `AUTH-01`).
- `LINK_INVALID`: "Este link não vale mais: já foi usado ou expirou. Se você já confirmou, é só
  entrar." + "Entrar" + "Reenviar confirmação" (a form with the email field, same rules as log in).
- Resend success: the same neutral message as sign-up.
- `TOO_MANY_ATTEMPTS` with the wait.

## AUTH-04 Forgot password (MVP)
Route `/forgot-password`.

**RF-AUTH-4** A person asks for a reset link by email.

| Field | Label | Required | Rules |
|---|---|---|---|
| email | "E-mail da conta" | yes | valid, up to 254 |

Action "Enviar link" → neutral success: "Se houver uma conta com esse e-mail, enviamos um link para
trocar a senha. Ele vale por 1 hora." + "Voltar para o login". Errors: `EMAIL_INVALID`,
`TOO_MANY_ATTEMPTS`.

## AUTH-05 Reset password (MVP)
Route `/reset-password#token=…`.

**RF-AUTH-5** With a valid link, a person sets a new password; every session of the account ends.

| Field | Label | Required | Rules |
|---|---|---|---|
| password | "Nova senha" | yes | 12–128, show/hide, `autocomplete="new-password"` |
| confirmation | "Repita a nova senha" | yes | equal to the new password (client only): "As senhas não são iguais." |

Action "Trocar senha" → success on `AUTH-01`: "Senha trocada. Entre com a nova senha. Por
segurança, saímos de todos os aparelhos." Errors: `PASSWORD_INVALID` (field), `LINK_INVALID` (the
form is replaced by the expired-link message with "Pedir um novo link" → `AUTH-04`),
`TOO_MANY_ATTEMPTS`.

The token is read on load and removed from the address bar, but only sent with the new password.

## INV-01 Invitation (MVP)
Route `/invite#token=…`.

**RF-AUTH-6** Anyone with the link sees what the invitation is before logging in.
On load: `POST /api/invitations/preview`. Shows: "{inviterName} convidou você para o espaço
{workspaceName} como {roleName}." and, for an email invitation, "Convite para {email}", plus the
expiry ("Vale até 12/10/2026").

Invalid states replace the page: `INVITATION_NOT_FOUND` ("Convite não encontrado. Confira o link
ou peça um novo."), `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`
(each with its message and "Ir para o login").

**RF-AUTH-7** Logged-in person: "Entrar no espaço" calls accept, then opens the workspace.
- `INVITATION_FOR_ANOTHER_EMAIL`: "Este convite é para {email}. Saia e entre com esse e-mail."
  with "Sair e entrar com outro e-mail".
- `ALREADY_MEMBER`: "Você já participa deste espaço." + "Abrir o espaço".

**RF-AUTH-8** Not logged in: two choices, "Já tenho conta" (log in, then back to the invitation
via `next`) and "Criar conta".

"Criar conta" form:
| Field | Label | Required | Rules |
|---|---|---|---|
| email | "E-mail" | only for a phone invitation; for an email invitation it is shown read-only with the invited address | valid, up to 254 |
| displayName | "Seu nome" | yes | 1–80 |
| password | "Senha" | yes | 12–128 |

Action "Criar conta e entrar no espaço" → when the email is already verified (email invitation):
`AUTH-01` with "Conta criada. Entre para abrir o espaço {workspaceName}."; when not (phone
invitation): "Conta criada. Confirme seu e-mail pelo link que enviamos e depois entre." Errors:
`EMAIL_TAKEN` ("Já existe uma conta com esse e-mail. Entre com ela para aceitar o convite." +
"Entrar"), `EMAIL_REQUIRED`, `INVITATION_SIGN_UP_INVALID`, the invalid states above,
`TOO_MANY_ATTEMPTS`.

## Session handling (SHELL-01, MVP)
**RF-AUTH-9** On start, the web calls `GET /api/auth/me`; `401` shows `AUTH-01`.
**RF-AUTH-10** Any `401 SESSION_REQUIRED` later clears cached data and opens `AUTH-01` with
`next`, showing "Sua sessão terminou. Entre de novo." Typed form data is lost; unsaved long forms
warn before (they can't be saved without a session).
**RF-AUTH-11** "Sair" (in "Mais" / the account menu) calls logout, clears cached data and opens
`AUTH-01` with "Você saiu.". No confirmation.

## ME-01 My account (MVP)
Route `/conta`. Sections:

**RF-AUTH-12 Profile.** Shows the email (read only; it can't be changed yet) and the display name.
| Field | Label | Required | Rules |
|---|---|---|---|
| displayName | "Nome" | yes | 1–80 |
"Salvar nome" is enabled only when the name changed. Success toast "Nome atualizado." Error
`PROFILE_INVALID`.

**RF-AUTH-13 Password.**
| Field | Label | Required | Rules |
|---|---|---|---|
| currentPassword | "Senha atual" | yes | 1–128 |
| newPassword | "Nova senha" | yes | 12–128 |
| confirmation | "Repita a nova senha" | yes | equal to the new one |
"Trocar senha" → toast "Senha trocada. Saímos dos outros aparelhos." Errors:
`CURRENT_PASSWORD_WRONG` (field "Senha atual": "A senha atual está incorreta."),
`PASSWORD_INVALID`, `TOO_MANY_ATTEMPTS` (5 wrong attempts in 15 min).

**RF-AUTH-14 Quiet hours** ("Horário de silêncio", no reminders in this window, for every
workspace).
| Field | Label | Required | Rules |
|---|---|---|---|
| quiet hours on | "Não enviar lembretes à noite" | — | switch |
| quietHoursStart | "Das" | when on | `HH:MM`, 00:00–23:59 |
| quietHoursEnd | "Até" | when on | `HH:MM`; may cross midnight (22:00 → 07:00) |
Both times are sent together, or both `null` when switched off. Help: "Lembretes que cairiam nesse
horário chegam no fim dele." Error `PREFERENCES_INVALID`. The language stays pt-BR (no selector in
the MVP).

**RF-AUTH-15 Notifications for this workspace** (per workspace; the section title names it).
Today the only reminders are bills and card invoices, **always by e-mail**, and the lead time is the
only preference with an effect (`attachments-and-audit.md` → Notifications). The screen shows only
what works:
| Field | Label | Required | Rules | Default |
|---|---|---|---|---|
| notifyBillsDaysBefore | "Avisar contas e faturas com quantos dias de antecedência" | yes | integer 0–30 ("0" = só no dia do vencimento) | 3 |

Help under it: "Os lembretes chegam por e-mail, uma vez por conta ou fatura." "Salvar preferências"
is enabled when the value changed; success toast "Preferências salvas." Error
`PREFERENCES_INVALID`.

**Later** (the API stores them, but nothing uses them yet): channel "Por onde avisar" (WhatsApp or
e-mail, when the WhatsApp channel exists), "Avisar quando um orçamento chegar a {80}%", "Resumo
diário", "Sugerir divisão quando entrar comissão". They appear when their feature exists.

**RF-AUTH-16 Theme** ("Tema": "Automático", "Claro", "Escuro"), stored on the device only.

**RF-AUTH-17 Sessions** (Later): list and end sessions on other devices. No API yet.
