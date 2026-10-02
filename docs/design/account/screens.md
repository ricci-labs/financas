---
summary: Every account screen and state (log in, sign up, verify email, forgot/reset password, invitation, app opening, emails) with its file, image and designer notes.
read_when: Building or reviewing any AUTH-*, INV-01 or SHELL-01 screen, or an account email.
updated: 2026-10-02
---

# Account screens

Each row links the standalone HTML (open in a browser, exact spacing and copy) and a PNG (look at it before building). Mobile frames are 390×844, desktop 1440×900, emails 600×780. Animations are looped demos; in the app each plays **once**.

Notes were translated from the design canvas. UI copy in them is quoted and stays in **pt-BR**; it is final, so use it exactly.

## App opening (SHELL-01)

Shown while `GET /api/auth/me` runs on start.

| Screen | Kind | Files | Notes |
|---|---|---|---|
| Abertura do app | mobile | [html](screens/html/Abertura.html) · [png](screens/png/Abertura.png) | SHELL-01 (RF-AUTH-9): on open, the app calls GET /api/auth/me. Valid session: goes to the last workspace (or WS-01 if there is none). 401: login. Same color as the manifest (mint), so the hand-off from the icon to the app is seamless. Owl at 200 px with the brand entrance (see "Animação · abertura do app"). |
| Abertura do app · demorando | mobile | [html](screens/html/Abertura-lenta.html) · [png](screens/png/Abertura-lenta.png) | If the response takes longer than 1.5 s, "Abrindo…" appears below, with a small spinner. No network: opens the login with the offline banner (there is no offline use in the MVP). |
| Animação · abertura do app | animation | [html](animations/Animacao-abertura.html) | Loops only for viewing here; in the app it plays once on open. Larger owl (200 px). The owl appears from below (0–0.45 s), wakes up: the eyelids disappear and the eyes open (0.55–0.8 s), the three sparkle strokes pop one by one (0.85 / 0.95 / 1.05 s), the name rises (0.6–0.9 s) and the slogan comes in (0.8–1.1 s); it ends with the mint eye's Wink (Piscadinha) (1.55–2.1 s). The app never waits for the animation beyond 1.2 s: if the session has already been checked, the wink is skipped. |

## Log in (AUTH-01)

Route: `/login`.

| Screen | Kind | Files | Notes |
|---|---|---|---|
| Login · padrão | mobile | [html](screens/html/Main.html) · [png](screens/png/Main.png) | Opens with focus on "E-mail" (email keyboard on mobile). The "Entrar" button is disabled with aria-disabled: it stays focusable and, if the person taps it, it marks the missing fields and moves focus to the first one. No "Preencha…" sentence below and no "* obrigatório" line: on this screen the asterisks are enough. shadcn: Form + Input + Button. |
| Login · e-mail inválido | mobile | [html](screens/html/Login-erro-campo.html) · [png](screens/png/Login-erro-campo.png) | The error appears on leaving the field, never while the person is typing. It disappears as soon as the value becomes valid. The field has aria-invalid and the message is linked through aria-describedby. |
| Login · pronto, senha visível | mobile | [html](screens/html/Login-pronto.html) · [png](screens/png/Login-pronto.png) | Valid email and password filled in: the button is enabled. "Mostrar/Ocultar" toggles the field type without losing focus. Enter in any field submits. |
| Login · entrando | mobile | [html](screens/html/Login-carregando.html) · [png](screens/png/Login-carregando.png) | Spinner inside the button, text kept ("Entrando…"), fields read-only and links paused. One submission per tap: there is no way to click twice. |
| Login · e-mail ou senha incorretos | mobile | [html](screens/html/Login-credenciais.html) · [png](screens/png/Login-credenciais.png) | Never says which of the two is wrong. The password is cleared and gets focus; the email stays. Form message above the button (INVALID_CREDENTIALS). |
| Login · e-mail não confirmado | mobile | [html](screens/html/Login-nao-confirmado.html) · [png](screens/png/Login-nao-confirmado.png) | Correct password, email not confirmed yet (EMAIL_NOT_VERIFIED). The action resends to the typed email and becomes "Reenviar em 60 s" after the tap. |
| Login · muitas tentativas | mobile | [html](screens/html/Login-tentativas.html) · [png](screens/png/Login-tentativas.png) | Limit of 5 attempts per email in 15 min (429). The button counts down the Retry-After time and re-enables on its own. The suggested way out is "Esqueci minha senha". |
| Login · sessão terminou | mobile | [html](screens/html/Login-sessao.html) · [png](screens/png/Login-sessao.png) | Arrival from an expired session (SESSION_REQUIRED). After logging in, the person returns to the screen they were on (?next=). |
| Login · senha trocada | mobile | [html](screens/html/Login-senha-trocada.html) · [png](screens/png/Login-senha-trocada.png) | Arrival from the password change (AUTH-05). The same spot shows the email-confirmed (AUTH-03) and invitation-accepted (INV-01) messages. |
| Login · sem conexão | mobile | [html](screens/html/Login-offline.html) · [png](screens/png/Login-offline.png) | Offline banner at the top and the button locked, with the reason below (there is no offline submission in the MVP). The typed data stays. |
| Login · erro inesperado | mobile | [html](screens/html/Login-erro-inesperado.html) · [png](screens/png/Login-erro-inesperado.png) | 5xx error: form message with the ref code for support. The button stays active to try again, and what was typed stays. |
| Login · padrão · desktop | desktop | [html](screens/html/Login-desktop-padrao.html) · [png](screens/png/Login-desktop-padrao.png) | Desktop split: mint panel left (logo, owl, slogan), form right, max 400 px. |
| Login · e-mail ou senha incorretos · desktop | desktop | [html](screens/html/Login-desktop-credenciais.html) · [png](screens/png/Login-desktop-credenciais.png) | Desktop with the INVALID_CREDENTIALS form message. |
| Login · você saiu | mobile | [html](screens/html/Login-saiu.html) · [png](screens/png/Login-saiu.png) | Coming from "Sair" (RF-AUTH-11): logs out, clears the stored data and opens the login with "Você saiu." No confirmation before logging out. |
| Login · conta criada pelo convite | mobile | [html](screens/html/Login-conta-criada-convite.html) · [png](screens/png/Login-conta-criada-convite.png) | Arrival after creating an account through an email invitation: email already filled in and focus on the password. After logging in, it opens the invitation's workspace directly. |

## Sign up (AUTH-02)

Route: `/signup`.

| Screen | Kind | Files | Notes |
|---|---|---|---|
| Cadastro · padrão | mobile | [html](screens/html/Cadastro-padrao.html) · [png](screens/png/Cadastro-padrao.png) | Only shown when sign-up is open (GET /api/auth/config). Focus on "Seu nome". The password hint is always visible, before the field. The button is enabled only when everything is valid (newUserSchema from @financas/shared). |
| Cadastro · senha curta | mobile | [html](screens/html/Cadastro-senha-curta.html) · [png](screens/png/Cadastro-senha-curta.png) | Error on leaving the field, never while typing. Password of 12 to 128 characters, with no number or symbol rule. Default message: "Use pelo menos 12 caracteres." |
| Cadastro · pronto | mobile | [html](screens/html/Cadastro-pronto.html) · [png](screens/png/Cadastro-pronto.png) | Everything valid: button enabled. On tap: spinner in the button and fields read-only, as in the login ("Criando conta…"). API errors: USER_INVALID on the fields, TOO_MANY_ATTEMPTS on the form. |
| Cadastro · confira o e-mail | mobile | [html](screens/html/Cadastro-enviado.html) · [png](screens/png/Cadastro-enviado.png) | A hand-off, not a wait: this tab does not change. The email has the "Confirmar e-mail" button, which opens /verify-email in another page. The text stays neutral: people who already have an account also get an email ("Você já tem uma conta"), so "Enviamos um e-mail" is always true. "Reenviar" counts down 60 s. |
| Cadastro · fechado | mobile | [html](screens/html/Cadastro-fechado.html) · [png](screens/png/Cadastro-fechado.png) | Calm version (cream): a notice, not an achievement. SIGNUP_DISABLED or sign-up turned off: the /signup route shows this page. On the login, "Criar conta" does not appear at all. |
| Cadastro · padrão · desktop | desktop | [html](screens/html/Cadastro-desktop.html) · [png](screens/png/Cadastro-desktop.png) | Desktop sign-up, same split layout as login. |
| Animação · cadastro → confira o e-mail | animation | [html](animations/Animacao-cadastro-enviado.html) | Loops only for viewing here; in the app it plays once on arrival. The sign-up screen's form leaves (Leave (Sair), 0.5 s), the envelope appears and floats once (Appear (Surgir), 0.8 s), sparkles pop (1.2 s and 1.4 s), text comes in (0.9 s), actions rise (1.3 s) and a wink at the end (2.4 s): a created account is an achievement. |
| Animação · cadastro fechado | animation | [html](animations/Animacao-cadastro-fechado.html) | Its own entrance, with no previous object. The padlock appears with the shackle open (0.3 s), the shackle drops and locks (Lock (Travar), 0.95 s) with a small jolt in the body, and the owl slowly closes its eyes (Doze (Fechar os olhos), 1.4 s). Text comes in at 0.5 s and the button at 1.0 s. No sparkle and no wink: it is a notice. |
| Animação · cadastro fechado · desktop | animation | [html](animations/Animacao-cadastro-fechado-desktop.html) | Desktop: sign-up closed entrance. |
| Cadastro · criando conta | mobile | [html](screens/html/Cadastro-criando.html) · [png](screens/png/Cadastro-criando.png) | Spinner in the button, fields read-only and links paused, same as the login. One submission per tap. |
| Cadastro · reenviar liberado | mobile | [html](screens/html/Cadastro-reenviar.html) · [png](screens/png/Cadastro-reenviar.png) | After the 60 s the button re-enables. On tap: toast "Enviamos de novo." and the countdown restarts. The limit is 3 emails per hour for the address. |
| Cadastro · muitas tentativas | mobile | [html](screens/html/Cadastro-tentativas.html) · [png](screens/png/Cadastro-tentativas.png) | 429 on sign-up: notice above the button and Retry-After countdown. What was typed stays. |

## Verify email (AUTH-03)

Route: `/verify-email#token=`.

| Screen | Kind | Files | Notes |
|---|---|---|---|
| Confirmar e-mail · confirmando | mobile | [html](screens/html/Confirmar-carregando.html) · [png](screens/png/Confirmar-carregando.png) | A moment, not a form: full mint screen, like the app opening. Opens from the email link (/verify-email#token=), clears the token from the address bar and confirms on its own. The steps show where the person is (aria-current on the current step). Only the spinner spins; with reduced motion, nothing animates. |
| Confirmar e-mail · confirmado | mobile | [html](screens/html/Confirmar-ok.html) · [png](screens/png/Confirmar-ok.png) | Short celebration: title with an exclamation mark, both steps done and the next one highlighted. The dashed card (InsightCard style) tells what comes after logging in (WS-01, creating the workspace). It does not log in on its own: "Entrar" leads to the login with "E-mail confirmado". |
| Confirmar e-mail · link vencido | mobile | [html](screens/html/Confirmar-link-vencido.html) · [png](screens/png/Confirmar-link-vencido.png) | Calm version (cream). LINK_INVALID (already used, or older than 24 h). People who already confirmed just log in; people who have not confirmed ask for another link right here, with the same neutral response as sign-up. |
| Animação · confirmando → confirmado | animation | [html](animations/Animacao-confirmar.html) | Looped sample only for viewing here; in the app it plays once. The screen does not change: the scene (owl, coins, plant) stays still and only the object and the expression change. Sequence: 0.6 s hourglass turns (Wait (Esperar)) · 2.5 s hourglass and "zz" disappear (Leave) and the owl opens its eyes · 3.0 s check circle appears (Appear) · 3.5 s the check draws itself (Draw (Desenhar)) · 3.8 s sparkles pop (Pop (Estalar)) · texts swap in place · 4.0 s card and "Entrar" rise (Raise actions (Subir ações)) · 4.7 s mint eye's wink. With reduce motion on: goes straight to the final state. Names and timings are recorded in the design system (Estados e movimento). |
| Animação · confirmando → link vencido | animation | [html](animations/Animacao-confirmar-vencido.html) | Same page (/verify-email): while confirming, the hourglass turns (Wait). If the API responds LINK_INVALID: hourglass and "zz" leave (2.4 s), the background goes from mint to cream (2.4–2.8 s), texts swap in place, the chain appears (2.8 s) and swings once (Swing (Balançar)), and the actions rise (3.2 s). |
| Animação · confirmando → confirmado · desktop | animation | [html](animations/Animacao-confirmar-desktop.html) | Desktop moment: same full screen, content grouped in the center, owl block 400 px. |
| Animação · confirmando → link vencido · desktop | animation | [html](animations/Animacao-confirmar-vencido-desktop.html) | Desktop: confirming → link expired, mint fades to cream. |
| Confirmar e-mail · novo link enviado | mobile | [html](screens/html/Confirmar-reenviado.html) · [png](screens/png/Confirmar-reenviado.png) | After "Reenviar confirmação" on the expired link. Neutral response (202), same logic as sign-up. |
| Confirmar e-mail · muitas tentativas | mobile | [html](screens/html/Confirmar-tentativas.html) · [png](screens/png/Confirmar-tentativas.png) | Calm version (cream). 20 invalid links per network per hour: 429. People who already confirmed can still log in. |

## Forgot password (AUTH-04)

Route: `/forgot-password`.

| Screen | Kind | Files | Notes |
|---|---|---|---|
| Esqueci a senha · padrão | mobile | [html](screens/html/Esqueci-padrao.html) · [png](screens/png/Esqueci-padrao.png) | Coming from the login, the email arrives already filled in. Label "E-mail da conta" (emailRequestSchema). |
| Esqueci a senha · confira o e-mail | mobile | [html](screens/html/Esqueci-enviado.html) · [png](screens/png/Esqueci-enviado.png) | A hand-off: this tab does not change. The email has the "Criar nova senha" button, which opens /reset-password in another page. Neutral response ("Se houver uma conta…"). The link is valid for 1 hour and works once. |
| Esqueci a senha · muitas tentativas | mobile | [html](screens/html/Esqueci-tentativas.html) · [png](screens/png/Esqueci-tentativas.png) | 429: 3 emails per address per hour (counting sign-up, resend and forgot password together). The button counts down the Retry-After and re-enables on its own. |
| Esqueci a senha · confira o e-mail · desktop | desktop | [html](screens/html/Esqueci-enviado-desktop.html) · [png](screens/png/Esqueci-enviado-desktop.png) | Desktop moments (from 1024 px): full screen in the same color as on mobile, with everything grouped in the center. The owl sits in a fixed block 400 px tall, titles fit on one line and actions are at most 400 px wide. The animation is the same as on mobile, with the same timings. The other moments (sign-up and forgot password → check your email, new password → link expired) follow the same pattern. |
| Animação · esqueci → confira o e-mail | animation | [html](animations/Animacao-esqueci-enviado.html) | The key from the previous screen leaves (0.5 s), the envelope appears and floats once (0.8 s), one sparkle group pops (1.3 s), text comes in (0.9 s) and actions rise (1.3 s). No wink: it is help, not an achievement. |
| Esqueci a senha · e-mail inválido | mobile | [html](screens/html/Esqueci-email-invalido.html) · [png](screens/png/Esqueci-email-invalido.png) | EMAIL_INVALID, on leaving the field. It disappears as soon as the email becomes valid. |

## Reset password (AUTH-05)

Route: `/reset-password#token=`.

| Screen | Kind | Files | Notes |
|---|---|---|---|
| Nova senha · padrão | mobile | [html](screens/html/Nova-senha-padrao.html) · [png](screens/png/Nova-senha-padrao.png) | Opens from the link (/reset-password#token=). The token is removed from the address bar and is only sent together with the new password. |
| Nova senha · senhas diferentes | mobile | [html](screens/html/Nova-senha-diferentes.html) · [png](screens/png/Nova-senha-diferentes.png) | Checked only in the app: "As senhas não são iguais." on leaving the second field, and it disappears as soon as they match. Success: login with "Senha trocada" and logout from all devices. |
| Nova senha · link vencido | mobile | [html](screens/html/Nova-senha-link-vencido.html) · [png](screens/png/Nova-senha-link-vencido.png) | Calm version (cream). LINK_INVALID: the page replaces the form with this notice. "Pedir um novo link" goes back to the "Esqueci a senha" screen. |
| Animação · nova senha → link vencido | animation | [html](animations/Animacao-senha-vencido.html) | Cream background from start to finish. The key leaves (0.5 s), the owl slowly closes its eyes (0.6 s), the chain appears (0.9 s) and swings once, text comes in (0.9 s) and actions rise (1.3 s). |
| Nova senha · trocando | mobile | [html](screens/html/Nova-senha-trocando.html) · [png](screens/png/Nova-senha-trocando.png) | Spinner in the button and fields read-only. Success: login with "Senha trocada". |
| Nova senha · muitas tentativas | mobile | [html](screens/html/Nova-senha-tentativas.html) · [png](screens/png/Nova-senha-tentativas.png) | 429 on the change (invalid links per network). What was typed stays. |

## Invitation (INV-01)

Route: `/invite#token=`.

| Screen | Kind | Files | Notes |
|---|---|---|---|
| Convite · prévia | mobile | [html](screens/html/Convite-previa.html) · [png](screens/png/Convite-previa.png) | Opens from the link (/invite#token=) and calls POST /api/invitations/preview: who invited, workspace, role, invitation email and expiry. Mint moment with the owl and the invitation card. Someone who is not logged in chooses: "Criar conta" (primary) or "Já tenho conta" (login with ?next= back to the invitation). |
| Convite · criar conta | mobile | [html](screens/html/Convite-criar-conta.html) · [png](screens/png/Convite-criar-conta.png) | Email invitation: the email comes locked (only that address can accept). Phone invitation: the "E-mail" field is free and required (EMAIL_REQUIRED "Informe um e-mail para a sua conta."). Name 1–80, password 12–128. |
| Convite · e-mail já tem conta | mobile | [html](screens/html/Convite-email-em-uso.html) · [png](screens/png/Convite-email-em-uso.png) | EMAIL_TAKEN: notice above the button with an "Entrar" shortcut, which leads to the login and returns to the invitation afterwards. |
| Convite · conta criada (convite por telefone) | mobile | [html](screens/html/Convite-telefone-criada.html) · [png](screens/png/Convite-telefone-criada.png) | Phone invitation: the email has not been confirmed yet, so the account is created and the person confirms through the link before logging in. With an email invitation, it goes straight to the login with "Conta criada. Entre para abrir o espaço Casa." |
| Convite · já logado | mobile | [html](screens/html/Convite-logado.html) · [png](screens/png/Convite-logado.png) | Logged in: "Entrar no espaço" calls the accept and opens the workspace. The bottom line shows which email the person is logged in with, to avoid accepting with the wrong account. |
| Convite · aceito | mobile | [html](screens/html/Convite-entrando.html) · [png](screens/png/Convite-entrando.png) | Achievement: the second owl arrives next to the first (the mint eyes meet in the middle). It stays for about 1.5 s and then opens the workspace. |
| Animação · aceitar convite | animation | [html](animations/Animacao-convite.html) | Loops only for viewing here. Tap on "Entrar no espaço" (1.0 s, the button becomes "Entrando…"), the invitation card leaves (2.0 s), the second owl slides in from the right (Arrive (Chegar), 2.2 s), the sparkle pops between the two (2.8 s), texts swap and the first owl winks (3.4 s). |
| Convite · você já participa | mobile | [html](screens/html/Convite-ja-participa.html) · [png](screens/png/Convite-ja-participa.png) | ALREADY_MEMBER: no celebration, but mint (it is not an error). "Abrir o espaço". |
| Convite · expirado | mobile | [html](screens/html/Convite-expirado.html) · [png](screens/png/Convite-expirado.png) | Calm version. Same layout for the others: INVITATION_NOT_FOUND "Convite não encontrado. Confira o link ou peça um novo.", INVITATION_REVOKED "Este convite foi cancelado.", INVITATION_ALREADY_ACCEPTED "Este convite já foi aceito. Entre para abrir o espaço."; all with "Ir para o login". |
| Convite · para outro e-mail | mobile | [html](screens/html/Convite-outro-email.html) · [png](screens/png/Convite-outro-email.png) | INVITATION_FOR_ANOTHER_EMAIL: logged in with another account. "Sair e entrar com outro e-mail" logs out and opens the login with ?next= back to the invitation. |

## Entrances of static screens

Looped demos of the one-time entrance each static screen plays on open (form screens: first opening in the session only; only the owl moves). The last frame of every demo equals the static screen.

| Screen | Route | Demo | Kit |
|---|---|---|---|
| Log in | /login | [html](animations/Animacao-entrada-login.html) | `kit-boas-vindas` |
| Sign up | /signup | [html](animations/Animacao-entrada-cadastro.html) | `kit-cadastro` |
| Forgot password · Reset password | /forgot-password, /reset-password | [html](animations/Animacao-entrada-chave.html) | `kit-chave` |
| Offline (any auth form) | — | [html](animations/Animacao-entrada-sem-conexao.html) | `kit-sem-conexao` |
| Too many attempts (any auth form) | — | [html](animations/Animacao-entrada-espera.html) | `kit-espera` |
| Link expired opened directly · invitation expired | /verify-email, /reset-password, /invite | [html](animations/Animacao-entrada-link-vencido.html) | `kit-link-vencido` |
| Invitation preview | /invite | [html](animations/Animacao-entrada-convite.html) | `kit-convite-previa` |
| Already a member | /invite | [html](animations/Animacao-entrada-ja-participa.html) | `kit-juntos` |
| Confirm your email (phone invite) · new link sent | /invite, /verify-email | [html](animations/Animacao-entrada-envelope.html) | `kit-email` |

## Account emails

Sent by the API (`apps/api/src/modules/identity/identity.emails.ts`, `onboarding/onboarding.emails.ts`).

| Screen | Kind | Files | Notes |
|---|---|---|---|
| E-mail · confirme seu e-mail | email | [html](screens/html/Email-confirmar.html) · [png](screens/png/Email-confirmar.png) | Subject: "Confirme seu e-mail". Preheader: "Falta um toque para começar a usar o Twise.". email_verification. Copy change: the title becomes the action ("Confirme seu e-mail") and the "Olá" moves to the line above. |
| E-mail · você já tem uma conta | email | [html](screens/html/Email-ja-tem-conta.html) · [png](screens/png/Email-ja-tem-conta.png) | Subject: "Você já tem uma conta". Preheader: "Alguém tentou criar uma conta com este e-mail.". account_already_exists. Change: the forgot-password link comes out of the middle of the text (today the full address shows) and becomes a "Peça uma nova" link. |
| E-mail · troque sua senha | email | [html](screens/html/Email-trocar-senha.html) · [png](screens/png/Email-trocar-senha.png) | Subject: "Troque sua senha". Preheader: "O link vale por 1 hora.". password_reset. The "Criar nova senha" button has the same name quoted on the "Confira seu e-mail" screen. |
| E-mail · sua senha foi trocada | email | [html](screens/html/Email-senha-trocada.html) · [png](screens/png/Email-senha-trocada.png) | Subject: "Sua senha foi trocada". Preheader: "Saímos de todos os aparelhos por segurança.". password_changed. It is a security notice: padlock, no sparkle. The button is the way out for anyone who does not recognize the change. |
| E-mail · convite | email | [html](screens/html/Email-convite.html) · [png](screens/png/Email-convite.png) | Subject: "Você recebeu um convite no Twise". Preheader: "Member A convidou você para o espaço Casa.". workspace_invitation (onboarding module). Copy fix: today it says "workspace"; in the interface it is always "espaço". |
