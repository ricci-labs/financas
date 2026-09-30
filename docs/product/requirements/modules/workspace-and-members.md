---
summary: Functional requirements for the app shell and workspaces — switcher, creating a workspace, settings (financial period, budget base, installment view, time zone), Pix receiving, members, roles and permissions, invitations (SHELL-01, WS-01, SET-01..02, MEM-01..03).
read_when: Designing or building the shell, workspace settings, members, roles or invitations.
updated: 2026-09-29
---

# Workspace and members

Standards: `../ui-standards.md`. Messages per code: `../error-messages.md`. Domain:
`../../../domain/model/tenancy.md`, `../../../domain/model/access-control.md`. API:
`/api/workspaces`, `/api/workspaces/:id/{settings,members,roles,invitations}`.

## Rules that shape these screens
- **Workspaces** ("espaços", e.g. "Casa", "Pessoal") are isolated; a person can belong to several,
  each with one role. Anyone logged in can create one and becomes its owner.
- **System roles** ("Dono", "Admin", "Membro", "Leitor") and custom roles. Default permissions per
  module (V view, C create, U update, D delete):
  | Module | Dono | Admin | Membro | Leitor |
  |---|---|---|---|---|
  | Lançamentos | VCUD | VCUD | VCUD | V |
  | Contas e categorias | VCUD | VCUD | V | V |
  | Cartões | VCUD | VCUD | VCU | V |
  | Contatos e cobranças | VCUD | VCUD | VCU | V |
  | Planejamento | VCUD | VCUD | VCU | V |
  | Orçamentos | VCUD | VCUD | V | V |
  | Relatórios | V | V | V | V |
  | Comprovantes | VCUD | VCUD | VCU | V |
  | Configurações | VU | VU | V | — |
  | Membros | VCUD | VCU | V | — |
  | Histórico | V | V | — | — |
- **Owner rules beyond the matrix:** only an owner invites or promotes someone to owner, demotes or
  removes an owner; the owner role can't be edited; a workspace always keeps at least one owner.
  With the defaults, only owners remove members, delete roles and revoke invitations.
- **No escalation:** nobody grants (in a role, a role change or an invitation) a permission they
  don't hold.
- **Any action other than "ver" on a module needs "ver" on it.** Relatórios and Histórico only have
  "ver"; Configurações only "ver" and "editar".
- **Invitations** are by e-mail (the link goes only to that inbox; only that e-mail can accept) or
  by phone (the link is shown once, to share by hand). They last 7 days; one pending per contact.

## SHELL-01 App shell (MVP)
**RF-WS-1** Navigation as in `../experience.md` → Navigation, with items hidden by permission.
**RF-WS-2** Workspace switcher (top bar / sidebar): lists `GET /api/workspaces` (name and role);
switching loads that workspace's permissions (`GET /api/workspaces/:id`) and opens its home. The
last used workspace is remembered on the device. "Criar espaço" at the end → `WS-01`.
**RF-WS-3** A person with no workspace lands on `WS-01`. A workspace that answers
`WORKSPACE_NOT_FOUND` (removed from it, or left) sends them to the switcher with "Você não tem
mais acesso a este espaço."
**RF-WS-4** The account menu: name, e-mail, "Minha conta" (`ME-01`), "Sair".

## WS-01 Create a workspace (MVP)
`POST /api/workspaces`, any logged-in person.
| Field | Label | Required | Rules |
|---|---|---|---|
| name | "Nome do espaço" | yes | trimmed, 1–80; placeholder "Casa" |
Action "Criar espaço" → opens the new workspace's home (first-run checklist). Error
`WORKSPACE_NAME_INVALID`.

## SET-01 Workspace settings (MVP)
Route `/configuracoes`. View `settings:view` (not for viewers); change `settings:update`.
`GET/PATCH /settings`, `PATCH /api/workspaces/:id` (name).

| Field | Label | Input | Rules / help |
|---|---|---|---|
| name | "Nome do espaço" | text | 1–80 |
| periodAnchor + periodAnchorValue | "Seu mês financeiro começa" | radio "No dia 1 (mês do calendário)", "Todo dia {n}" (1–31), "No {n}º dia útil" (1–10) | help "Use o dia em que o salário costuma cair. Os números do início passam a seguir esse período." Preview: "Período atual: 5 out – 4 nov." |
| budgetBase | "O orçamento considera" | radio "Só a renda fixa (recomendado)", "Toda a renda, incluindo comissões" | help "Comissões variam; contar com elas no orçamento pode deixar o mês apertado." |
| installmentBudgetView | "Compras parceladas contam" | radio "Em cada parcela, na fatura em que ela cai (recomendado)", "Inteiras, no mês da compra" | |
| weekStartsOn | "A semana começa no" | "Domingo" / "Segunda-feira" | |
| timezone | "Fuso horário" | select of Brazilian zones first, then all | valid IANA zone |
Read only: currency ("Real (R$)"); "Limite diário de mensagens a contatos" and "Lembrar
cobranças a cada {n} dias" appear later, when editable.
**RF-WS-5** Each group saves on its own ("Salvar período", …), enabled when changed; toast
"Configurações salvas." Errors `SETTINGS_INVALID` (form: "Não foi possível salvar. Confira os
valores."), `WORKSPACE_NAME_INVALID`.

## SET-02 Pix receiving (MVP)
A section of `SET-01`. `PUT /settings/pix`, `settings:update`.
**RF-WS-6** The Pix shown in charges (`CON-03`).
| Field | Label | Required | Rules |
|---|---|---|---|
| key | "Chave Pix" | yes | trimmed, 1–77 (CPF, e-mail, telefone ou aleatória; the format isn't checked) |
| receiverName | "Nome de quem recebe" | yes | 1–25; help "Aparece no app do banco de quem paga. Sem acentos fica melhor." |
| receiverCity | "Cidade" | yes | 1–15 |
The three go together. Actions "Salvar Pix", "Remover Pix" (dialog "As próximas cobranças sairão
sem o Pix copia e cola."). Error `PIX_INVALID`.

## MEM-01 Members (MVP)
Route `/membros`. `members:view` (not for viewers). `GET /members`, `GET /roles`.

**RF-WS-7** List: name, e-mail, role, "Desde {data}"; the current user marked "Você".
| Action | Permission | Rule |
|---|---|---|
| "Mudar papel" | `members:update` | role picker; owner options only for owners; `OWNER_ONLY` "Só um dono pode mudar outro dono ou dar o papel de dono."; `PERMISSION_ESCALATION` "Você não pode dar permissões que não tem."; `LAST_OWNER` "O espaço precisa de pelo menos um dono. Promova outra pessoa antes." |
| "Remover do espaço" | `members:delete` | dialog "Remover {nome} do espaço? A pessoa perde o acesso na hora." with optional "Motivo" (up to 200) |
| "Sair do espaço" (own row) | any member | dialog "Sair do espaço {nome}? Você perde o acesso aos dados dele."; `LAST_OWNER` explained as above; success returns to the switcher |
| "Convidar" | `members:create` | `MEM-03` |
| "Papéis" | `members:view` | `MEM-02` |
Errors: `MEMBER_NOT_FOUND` ("Essa pessoa não está mais no espaço."), `ROLE_NOT_AVAILABLE`,
`MEMBER_ROLE_INVALID`, `DELETION_INVALID`.

## MEM-02 Roles (MVP)
Route `/membros/papeis`. `members:view`; create `members:create`; edit `members:update`; delete
`members:delete`.

**RF-WS-8** List roles with name, description, number of members using it (from the members list)
and "Sistema" badge on system roles. The owner role shows "Não pode ser alterado".
**RF-WS-9** Role editor (create or edit):
| Field | Label | Required | Rules |
|---|---|---|---|
| name | "Nome do papel" | yes | 1–60; unique without case among roles, system names included: `ROLE_NAME_TAKEN` "Já existe um papel com esse nome." |
| description | "Descrição" | no | up to 200 |
| permissions | "Permissões" | yes | a matrix modules × "Ver", "Criar", "Editar", "Excluir", showing only the valid actions per module; ticking any action ticks "Ver"; unticking "Ver" unticks the rest; permissions the editor doesn't hold are disabled with the tooltip "Você não tem essa permissão para dar." |
Quick presets: copy from an existing role. Actions "Criar papel" / "Salvar papel", "Excluir papel"
(custom only; dialog). Errors: `ROLE_INVALID`, `PERMISSION_ESCALATION`, `OWNER_ROLE_LOCKED`,
`ROLE_NOT_FOUND`, `SYSTEM_ROLE` ("Papéis do sistema não podem ser excluídos."), `ROLE_IN_USE`
("Este papel está em uso por membros ou convites. Troque o papel deles ou revogue os convites
antes.").

## MEM-03 Invitations (MVP)
Route `/membros/convites`. List `members:view`; invite `members:create`; revoke `members:delete`.

**RF-WS-10** Pending invitations, newest first: e-mail or phone, role, who invited, "Vale até
{data}". Action "Revogar" (dialog "Revogar o convite para {contato}? O link deixa de funcionar.").
**RF-WS-11** Invite form:
| Field | Label | Required | Rules |
|---|---|---|---|
| channel | "Convidar por" | yes | "E-mail" or "Telefone" |
| email | "E-mail" | when e-mail | valid, up to 254 |
| phoneE164 | "Telefone" | when phone | international format, default +55 |
| roleId | "Papel" | yes, default "Membro" | roles the inviter may give (owner only for owners) |
Success, e-mail: "Convite enviado para {email}. Ele vale por 7 dias e só esse e-mail pode aceitar."
Success, phone: the link with "Copiar link" and "Enviar pelo WhatsApp" (`wa.me` with a pt-BR
text), and the warning "Este link aparece só agora. Quem tiver o link pode entrar no espaço."
Errors: `INVITATION_INVALID`, `INVITATION_PENDING` ("Já existe um convite pendente para esse
contato. Revogue o anterior para mandar outro."), `ROLE_NOT_AVAILABLE`, `OWNER_ONLY`,
`PERMISSION_ESCALATION`. On revoke: `INVITATION_NOT_FOUND`, `INVITATION_REVOKED`,
`INVITATION_ALREADY_ACCEPTED` (list refreshes).
