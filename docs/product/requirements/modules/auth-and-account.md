---
summary: Functional requirements for log in, sign-up, email verification, password reset and change, invitations answered by the invitee, session handling, and my account (profile, preferences, notification settings).
read_when: Designing or building AUTH-*, INV-01 or ME-01, or anything about sessions and login.
updated: 2026-10-02
---

# Auth and my account

Standards: `../ui-standards.md` (layouts in Account screens). Messages per code:
`../error-messages.md`. API: `/api/auth/*`, `/api/invitations/*`,
`/api/workspaces/:id/members/me/preferences`. **Design:** every screen and state below is drawn in
`../../../design/account/screens.md` (HTML + PNG); copy quoted here is the final copy.

## Rules that shape these screens
- **Session:** an HttpOnly cookie valid 30 days, renewed while used. The web can't read it: it
  calls `GET /api/auth/me` and treats `401` as logged out.
- **Links carry the token in the fragment** (`#token=`). The web must serve `/login`,
  `/forgot-password`, `/verify-email`, `/reset-password` and `/invite`.
- **No automatic log in** after verifying an email, resetting a password, or creating an account
  through an invitation. Each ends on `AUTH-01` with an arrival message.
- **Neutral answers:** sign-up, resend verification and forgot password always answer "accepted"
  (202), whatever the email, so nobody can learn which emails have accounts. The UI never says
  "this email exists" or "doesn't exist".
- **"Confira seu e-mail" screens hand off to the inbox:** they name the button to tap in the email
  ("Toque em **Confirmar e-mail**", "Toque em **Criar nova senha**"), say "Pode fechar esta tela."
  and "Não chegou? Olhe o spam e a aba Promoções.", and never claim the screen will update.
- **Limits** (defaults): 5 failed logins per email and 30 per network in 15 min; 3 account emails
  per address and 10 per network per hour (sign-up, resend and forgot share them); 20 invalid links
  per network per hour. Over a limit the API answers `429` with `Retry-After`, shown as a warning
  above the button and a countdown button ("Tente de novo em 14:52") that releases itself.
- **Resend** buttons wait 60 s after each send ("Reenviar em 52 s"); a resend shows the toast
  "Enviamos de novo." and the wait starts again.
- **Password:** 12 to 128 characters, no composition rules. Email: up to 254 characters, compared
  without case. Display name: 1 to 80 characters.
- **Link lifetimes:** verification 24 h, reset 1 h, invitation 7 days; each works once.

## AUTH-01 Log in (MVP)
Route `/login`, optionally `?next=<path>`. Also the landing for expired sessions. Auth layout;
title "Entrar no Twise", subtitle "Bom te ver de novo! Vamos ver como anda o mês?". Opens with
focus on "E-mail".

**RF-AUTH-1** A person logs in with email and password; on success the web opens `next` if it is
an app path, otherwise the last workspace, otherwise `WS-01` when they have none.

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| email | "E-mail" | email, `autocomplete="email"`, placeholder "nome@exemplo.com" | yes | valid email, up to 254 |
| password | "Senha" | password with "Mostrar"/"Ocultar", `autocomplete="current-password"` | yes | up to 128 (the minimum is not checked here, so old passwords still work) |

| Action | Enabled when | Loading | Success | Errors |
|---|---|---|---|---|
| "Entrar" (primary) | e-mail valid and password filled (button contract) | "Entrando…", fields read-only, links paused | go to the destination above | `INVALID_CREDENTIALS` form message, password cleared and focused, e-mail kept; `EMAIL_NOT_VERIFIED` warning with the action "Reenviar e-mail de confirmação" (resends to the typed email, then "Reenviar em 60 s"); `TOO_MANY_ATTEMPTS` warning + countdown button, with "Enquanto isso, você pode trocar a senha em “Esqueci minha senha”." under it; `LOGIN_INVALID` field errors; 5xx form message with the `ref`, button stays enabled |
| "Esqueci minha senha" (link) | always | — | `AUTH-04`, email carried over | — |
| "Criar conta" (link, footer "Ainda não tem conta?") | only when `GET /api/auth/config` says sign-up is on | — | `AUTH-02` | — |

**Arrival messages** (under the title, `role="status"`): "Sua sessão terminou. Entre de novo."
(expired session), "Senha trocada. Entre com a nova senha. Por segurança, saímos de todos os
aparelhos." (`AUTH-05`), "E-mail confirmado" (`AUTH-03`), "Conta criada. Entre para abrir o espaço
{workspaceName}." (`INV-01`, with the email filled in and focus on the password), "Você saiu."
(log out). **Offline:** the banner "Sem conexão. Verifique a internet e tente de novo." and the
button locked with "Sem conexão. Assim que a internet voltar, o botão libera." under it; typed
data stays.

## AUTH-02 Sign up (MVP when enabled)
Route `/signup`. Auth layout; title "Criar sua conta", subtitle "Leva menos de um minuto.", focus
on "Seu nome", footer "Já tem conta? Entrar". When public sign-up is off (or `SIGNUP_DISABLED`)
the route is a calm moment: "O cadastro está fechado" / "Peça um convite a quem usa o Twise." +
"Ir para o login"; on `AUTH-01` "Criar conta" doesn't appear.

**RF-AUTH-2** A person creates an account and receives a confirmation email.

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| displayName | "Seu nome" | text | yes | trimmed, 1–80 |
| email | "E-mail" | email | yes | valid, up to 254 |
| password | "Senha" | new password with show/hide, `autocomplete="new-password"` | yes | 12–128; help, always visible above the field: "Use pelo menos 12 caracteres. Uma frase fácil de lembrar funciona bem." |

| Action | Loading | Success | Errors |
|---|---|---|---|
| "Criar conta" | "Criando conta…" | a mint moment "Confira seu e-mail": "Enviamos um e-mail para {email}. Toque em **Confirmar e-mail** e o Twise abre em outra página, já confirmado. O link vale por 24 horas.", the track "Conta criada" → "Confirmar e-mail" → "Entrar", the handoff lines, "Reenviar em 60 s" and "Já confirmou? Voltar para o login" | `USER_INVALID` field errors; `SIGNUP_DISABLED` switches to the closed moment; `TOO_MANY_ATTEMPTS` (typed data stays) |

The success copy stays neutral: when the email already has an account, the API sends "Você já tem
uma conta", so an email is always sent.

## AUTH-03 Verify email (MVP)
Route `/verify-email#token=…`. One page that changes in place (a moment).

**RF-AUTH-3** Opening the link confirms the email automatically (no button), then offers log in.

- On load: read the token, clear it from the address bar, call `POST /api/auth/verify-email`.
  Mint moment "Confirmando seu e-mail" / "Só um instante." with the track on "E-mail confirmado"
  (spinner) and "Pode deixar esta tela aberta. Ela muda sozinha."
- Success: "E-mail confirmado!" / "Agora é só entrar.", the first two steps done, the dashed card
  "Depois de entrar, vocês montam o espaço do casal e já veem quanto ainda podem gastar no mês."
  and "Entrar" (to `AUTH-01` with "E-mail confirmado").
- `LINK_INVALID`: the background turns cream; "Este link não vale mais" / "Já foi usado ou
  expirou. Se você já confirmou, é só entrar." + "Entrar", and "Ainda não confirmou?" with an
  "E-mail" field and "Reenviar confirmação" (same rules as log in).
- Resend success: "Confira seu e-mail" with "Se {email} puder ser usado, enviamos um novo link de
  confirmação. Toque em **Confirmar e-mail** no e-mail. Ele vale por 24 horas."
- `TOO_MANY_ATTEMPTS`: calm moment "Vamos dar uma pausa" / "Muitas tentativas com links por aqui.
  Tente de novo em {minutos} minutos. Se você já confirmou, é só entrar." + "Entrar".
- A link with no token is treated as `LINK_INVALID`, with no call.
- Unexpected failure (5xx) or no connection: calm moment "Não deu para confirmar agora" with the
  error message (the `ref`, or the offline one), "Tentar de novo" (sends the same token again)
  and "Entrar".

## AUTH-04 Forgot password (MVP)
Route `/forgot-password`. Auth layout; title "Esqueceu a senha?", subtitle "A gente manda um link
para criar outra.", footer "Lembrou? Voltar para o login".

**RF-AUTH-4** A person asks for a reset link by email.

| Field | Label | Required | Rules |
|---|---|---|---|
| email | "E-mail da conta" | yes | valid, up to 254; filled in when coming from `AUTH-01` (never through the URL) |

Action "Enviar link" → mint moment "Confira seu e-mail": "Se houver uma conta com {email},
enviamos um e-mail. Toque em **Criar nova senha** e o Twise abre em outra página para você trocar.
O link vale por 1 hora.", the track "Pedir o link" → "Abrir o e-mail" → "Nova senha", the handoff
lines and "Voltar para o login" (no resend). Stays conditional: no email is sent without an
account. Errors: `EMAIL_INVALID` (field), `TOO_MANY_ATTEMPTS`.

## AUTH-05 Reset password (MVP)
Route `/reset-password#token=…`. Auth layout; title "Crie uma nova senha", subtitle "Depois, é só
entrar com ela.", footer "Lembrou? Voltar para o login".

**RF-AUTH-5** With a valid link, a person sets a new password; every session of the account ends.

| Field | Label | Required | Rules |
|---|---|---|---|
| password | "Nova senha" | yes | 12–128, show/hide, `autocomplete="new-password"`, the same help as sign-up |
| confirmation | "Repita a nova senha" | yes | equal to the new password (client only, a web schema): "As senhas não são iguais." on leaving the field, gone as soon as they match |

Action "Trocar senha" ("Trocando senha…") → `AUTH-01` with "Senha trocada…". Errors:
`PASSWORD_INVALID` (field), `LINK_INVALID` (the form is replaced by a calm moment "Este link não
vale mais" / "Já foi usado ou expirou. O link para trocar a senha vale por 1 hora." with "Pedir um
novo link" → `AUTH-04`), `TOO_MANY_ATTEMPTS` (typed data stays).

The token is read on load and removed from the address bar, but only sent with the new password.

## INV-01 Invitation (MVP)
Route `/invite#token=…`. A moment.

**RF-AUTH-6** Anyone with the link sees what the invitation is before logging in.
On load: `POST /api/invitations/preview` (the app opening shows meanwhile). Mint moment: title
"{inviterName} convidou você", text "para o espaço **{workspaceName}** como **{roleName}**." and
"Convite para **{email}** · Vale até 12/10/2026" (a phone invitation: only "Vale até 12/10/2026";
the date in São Paulo).

Invalid states replace the page with a calm moment and "Ir para o login"; the title is the first
sentence of the message in `../error-messages.md`, the text the rest: `INVITATION_EXPIRED` ("Este
convite expirou" / "Peça um novo a quem convidou. Convites valem por 7 dias."),
`INVITATION_NOT_FOUND` (also a link with no token), `INVITATION_REVOKED`,
`INVITATION_ALREADY_ACCEPTED`, `WORKSPACE_NOT_AVAILABLE`. `TOO_MANY_ATTEMPTS`: calm "Vamos dar uma
pausa" with its message. Unexpected failure or no connection: calm "Não deu para abrir o convite"
with the message and "Tentar de novo".

Leaving for the log in ("Já tenho conta", "Entre com ela", "Sair e entrar com outro e-mail")
keeps the invitation: the token travels in the browser's history state, never in the URL
(`../../../architecture/web-application.md` → Routes), and the log in returns to `/invite`.

**RF-AUTH-7** Logged-in person: "Entrar no espaço" calls accept; under it "Você está como {email}.
Não é você? Sair". On success the moment "Vocês estão juntos no {workspaceName}!" / "Agora os dois
veem o mesmo mês, do mesmo jeito." shows for about 1.5 s ("Abrindo o espaço…"), then the workspace
opens.
- `INVITATION_FOR_ANOTHER_EMAIL`: calm moment "Este convite é para outra pessoa" / "Este convite é
  para {email}. Saia e entre com esse e-mail." + "Sair e entrar com outro e-mail" (log out, then
  `AUTH-01` with `next` back to the invitation) and "Você está como {email}."
- `ALREADY_MEMBER`: mint, no celebration: "Você já participa deste espaço" / "Você e {inviterName}
  já estão juntos no {workspaceName}." + "Abrir o espaço".

**RF-AUTH-8** Not logged in: "Criar conta" (primary) and "Já tenho conta" (log in, then back to the
invitation via `next`).

"Criar conta" form (auth layout; title "Criar sua conta", subtitle "Para entrar no espaço
{workspaceName} com {inviterName}."):
| Field | Label | Required | Rules |
|---|---|---|---|
| email | "E-mail" | only for a phone invitation; for an email invitation it is read-only with the invited address and the help "Convite para este e-mail. Ele não pode ser trocado." | valid, up to 254 |
| displayName | "Seu nome" | yes | 1–80 |
| password | "Senha" | yes | 12–128, the sign-up help |

Action "Criar conta e entrar no espaço" → when the email is already verified (email invitation):
`AUTH-01` with "Conta criada. Entre para abrir o espaço {workspaceName}."; when not (phone
invitation): mint moment "Falta só confirmar o e-mail" / "Conta criada. Confirme seu e-mail pelo
link que enviamos e depois entre para abrir o espaço {workspaceName}." Errors: `EMAIL_TAKEN`
(warning "Já existe uma conta com esse e-mail. Entre com ela para aceitar o convite.", "Entre com
ela" links to `AUTH-01` and back), `EMAIL_REQUIRED`, `INVITATION_SIGN_UP_INVALID`, the invalid
states above, `TOO_MANY_ATTEMPTS`.

## Session handling (SHELL-01, MVP)
**RF-AUTH-9** On start, the web shows the app opening (mint, the owl at 200 px, "twise" and "Leve,
claro, a dois.") while it calls `GET /api/auth/me`; `401` shows `AUTH-01`. The opening's one-time
entrance never holds the app beyond 1.2 s (the wink is skipped if the answer came first); after
1.5 s without an answer, "Abrindo…" appears with a small spinner. No network: `AUTH-01` with the
offline banner.
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

**RF-AUTH-16 Theme** ("Tema": "Claro" (default), "Escuro", "Automático"), stored on the device
only. "Automático" follows the system; nothing follows it by default (RNF-RESP-3).

**RF-AUTH-17 Sessions** (Later): list and end sessions on other devices. No API yet.
