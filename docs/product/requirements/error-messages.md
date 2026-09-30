---
summary: Catalog of every API error code — HTTP status, when it happens, the pt-BR message the user sees, and where it shows (field, form, page, toast).
read_when: Showing any API error in the web, writing a screen spec, or adding an error code to the API (add it here in the same PR).
updated: 2026-09-29
---

# Error messages

How errors reach the UI: `ui-standards.md` → API errors. The API's own `message` is English and
for developers; the UI shows the text below. "Shown as" says where: a field (named), the **form**
(above the buttons), the **page** (replaces the content), or a **toast**. `{…}` are values the UI
fills in. Codes marked "(guard)" can only happen if the UI let bad input through; they still get a
message.

## Every request
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `SESSION_REQUIRED` | 401 | Not logged in, or the session ended | "Sua sessão terminou. Entre de novo." | redirect to `AUTH-01` |
| `PERMISSION_DENIED` | 403 | The role lacks the permission (it may have changed meanwhile) | "Você não tem permissão para isso. Peça a um administrador do espaço." | toast; permissions refresh |
| `WORKSPACE_NOT_FOUND` | 404 | Not a member of the workspace (removed, left, or wrong link) | "Você não tem acesso a este espaço." | page → switcher |
| `CROSS_SITE_REQUEST` | 403 | A write that didn't come from the app | "Não foi possível confirmar que o pedido veio do app. Recarregue a página." | form |
| `TOO_MANY_ATTEMPTS` | 429 | Over a limit (login, e-mails, links, password change) | "Muitas tentativas. Tente de novo em {minutos} minutos." (from `Retry-After`) | form |
| `PAYLOAD_TOO_LARGE` | 413 | The request is too big (an upload over the limit) | "O arquivo ou os dados são grandes demais." (on uploads: see `FILE_TOO_LARGE`) | form |
| `BAD_REQUEST` | 400 | Malformed request (guard) | "Não foi possível ler o pedido. Recarregue a página e tente de novo." | form |
| `ROUTE_NOT_FOUND` | 404 | The app called an address that doesn't exist (guard) | "Esta página não existe." | page |
| `INTERNAL_ERROR` | 500 | Unexpected failure | "Algo deu errado. Tente de novo; se continuar, informe o código {ref}." | form or page |
| `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `TOO_MANY_REQUESTS`, `REQUEST_REJECTED` | 401/403/404/429/4xx | Generic framework answers (guard) | same messages as `SESSION_REQUIRED`, `PERMISSION_DENIED`, `ROUTE_NOT_FOUND`, `TOO_MANY_ATTEMPTS`, and "Não foi possível concluir. Código: {ref}." | as those |
| (network) | — | No answer (offline, timeout) | "Sem conexão. Verifique a internet e tente de novo." | banner + form |
| (unknown code) | any | A code missing from this list | "Não foi possível concluir. Código: {ref}." | form |

## Log in, sign-up, links, my account
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `LOGIN_INVALID` | 400 | Fields missing or too long (guard) | "Informe e-mail e senha." | form |
| `INVALID_CREDENTIALS` | 401 | Wrong e-mail or password (never says which) | "E-mail ou senha incorretos." | form |
| `EMAIL_NOT_VERIFIED` | 403 | Right password, e-mail not confirmed | "Confirme seu e-mail antes de entrar. Procure o link que enviamos." + "Reenviar e-mail" | form |
| `USER_INVALID` | 400 | Sign-up fields invalid | per field (standard messages) | fields |
| `SIGNUP_DISABLED` | 403 | Public sign-up is off | "O cadastro está fechado. Peça um convite a quem usa o Finanças." | page |
| `EMAIL_INVALID` | 400 | Invalid e-mail in resend or forgot | "Informe um e-mail válido, como nome@exemplo.com." | field e-mail |
| `LINK_INVALID` | 400 | Verification or reset link unknown, used or expired | "Este link não vale mais: já foi usado ou expirou." | page |
| `PASSWORD_INVALID` | 400 | New password outside 12–128 | "Use de 12 a 128 caracteres." | field new password |
| `CURRENT_PASSWORD_WRONG` | 400 | Wrong current password when changing | "A senha atual está incorreta." | field current password |
| `PROFILE_INVALID` | 400 | Name empty or over 80 | "Informe seu nome (até 80 caracteres)." | field name |
| `PREFERENCES_INVALID` | 400 | Preferences out of range, or quiet hours incomplete | "Confira os valores: horários no formato HH:MM, início e fim juntos, dias de 0 a 30." | form |
| `USER_NOT_FOUND` | 404 | The account no longer exists (guard) | "Não encontramos sua conta. Entre de novo." | page → `AUTH-01` |

## Invitations
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `INVITATION_INVALID` | 400 | Invite form invalid (both or neither contact) | per field; "Informe um e-mail ou um telefone." | fields |
| `INVITATION_SIGN_UP_INVALID` | 400 | Account form invalid | per field | fields |
| `INVITATION_NOT_FOUND` | 404 | Unknown link or invitation | "Convite não encontrado. Confira o link ou peça um novo." | page |
| `INVITATION_EXPIRED` | 409 | Past 7 days | "Este convite expirou. Peça um novo a quem convidou." | page |
| `INVITATION_REVOKED` | 409 | Revoked | "Este convite foi cancelado." | page / toast in `MEM-03` |
| `INVITATION_ALREADY_ACCEPTED` | 409 | Already used | "Este convite já foi aceito. Entre para abrir o espaço." | page / toast |
| `INVITATION_FOR_ANOTHER_EMAIL` | 403 | Logged in with another e-mail | "Este convite é para {email}. Saia e entre com esse e-mail." | page |
| `INVITATION_PENDING` | 409 | A pending invitation already exists for the contact | "Já existe um convite pendente para esse contato. Revogue o anterior para mandar outro." | form |
| `WORKSPACE_NOT_AVAILABLE` | 400 | The invited workspace was deleted | "Este espaço não existe mais. O convite não pode ser usado." | page |
| `ALREADY_MEMBER` | 409 | Already in the workspace | "Você já participa deste espaço." + "Abrir o espaço" | page |
| `EMAIL_TAKEN` | 409 | Creating an account through an invitation with an e-mail that has one | "Já existe uma conta com esse e-mail. Entre com ela para aceitar o convite." | form |
| `EMAIL_REQUIRED` | 400 | Phone invitation without e-mail | "Informe um e-mail para a sua conta." | field e-mail |

## Workspace, members and roles
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `WORKSPACE_NAME_INVALID` | 400 | Name empty or over 80 | "Informe o nome do espaço (até 80 caracteres)." | field name |
| `SETTINGS_INVALID` | 400 | Settings out of range | "Não foi possível salvar. Confira os valores." | form |
| `PIX_INVALID` | 400 | Pix fields missing or too long | per field (key up to 77, name up to 25, city up to 15) | fields |
| `MEMBER_NOT_FOUND` | 404 | Member left or was removed | "Essa pessoa não está mais no espaço." | toast; list refreshes |
| `MEMBER_ROLE_INVALID` | 400 | No role chosen (guard) | "Escolha um papel." | field role |
| `ROLE_NOT_AVAILABLE` | 400 | The role was deleted meanwhile | "Esse papel não existe mais. Escolha outro." | field role |
| `OWNER_ONLY` | 403 | Touching an owner without being one | "Só um dono pode mudar outro dono ou dar o papel de dono." | form |
| `PERMISSION_ESCALATION` | 403 | Granting permissions one doesn't hold | "Você não pode dar permissões que não tem." | form |
| `LAST_OWNER` | 409 | The change would leave no owner | "O espaço precisa de pelo menos um dono. Promova outra pessoa antes." | form |
| `ROLE_INVALID` | 400 | Role form invalid | per field; "Toda área com alguma ação precisa de 'Ver'." | fields |
| `ROLE_NAME_TAKEN` | 409 | Name used by another role | "Já existe um papel com esse nome." | field name |
| `ROLE_NOT_FOUND` | 404 | Role deleted | "Este papel não existe mais." | toast |
| `OWNER_ROLE_LOCKED` | 403 | Editing the owner role | "O papel de dono não pode ser alterado." | form |
| `SYSTEM_ROLE` | 409 | Deleting a system role | "Papéis do sistema não podem ser excluídos." | toast |
| `ROLE_IN_USE` | 409 | Deleting a role used by members or invitations | "Este papel está em uso. Troque o papel dessas pessoas ou revogue os convites antes." | dialog |
| `DELETION_INVALID` | 400 | Reason longer than 200 (or blank sent) | "Use no máximo 200 caracteres no motivo." | field reason |

## Accounts, categories and cards
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `ACCOUNT_INVALID` | 400 | Account form invalid | per field | fields |
| `ACCOUNT_NOT_FOUND` | 404 | Account gone | "Esta conta não existe mais." | page / toast |
| `ACCOUNT_NAME_TAKEN` | 409 | A sibling has the name | "Já existe uma conta com esse nome aqui." | field name |
| `OWNER_NOT_A_MEMBER` | 400 | The owner is not an active member | "Escolha um membro do espaço." | field owner |
| `PARENT_NOT_AVAILABLE` | 400 | Parent deleted | "A categoria escolhida não existe mais." | field parent |
| `PARENT_OF_ANOTHER_CLASS` | 400 | Parent of another class | "Escolha uma categoria do mesmo tipo." | field parent |
| `ACCOUNT_CHANGE_REFUSED` | 409 | Cycle, self-parent, or a system account | "Essa mudança não é permitida: uma categoria não pode ficar dentro dela mesma, e contas do sistema não mudam." | form |
| `ACCOUNT_DELETED` | 409 | The account is in the trash | "Esta conta está na lixeira. Restaure para alterar." | toast |
| `ACCOUNT_CANNOT_BE_DELETED` | 409 | Used by entries, has children, or system | "Esta conta tem lançamentos ou subcategorias. Arquive em vez de excluir." + "Arquivar" | dialog |
| `ACCOUNT_NOT_DELETED` | 409 | Restoring an active account | "Esta conta já está ativa." | toast |
| `ACCOUNT_CANNOT_BE_RESTORED` | 409 | Its parent is in the trash | "A conta mãe está na lixeira. Restaure ela primeiro." | toast |
| `CARD_INVALID` | 400 | Card form invalid | per field | fields |
| `CARD_NOT_FOUND` | 404 | Card gone | "Este cartão não existe mais." | page |
| `PAYMENT_ACCOUNT_NOT_AVAILABLE` | 400 | Payment account not an active money account | "Escolha uma conta ativa de dinheiro." | field payment account |
| `HOLDER_NOT_A_MEMBER` | 400 | The holder is not an active member | "Escolha um membro do espaço." | field holder |
| `INVOICE_NOT_FOUND` | 404 / 400 | Invoice not of this card | "Fatura não encontrada." | page / field invoice |

## Entries
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `ENTRY_INVALID` | 400 | Form invalid | per field (standard messages) | fields |
| `ENTRY_QUERY_INVALID` | 400 | Invalid filters | "Os filtros eram inválidos e foram limpos." | toast |
| `TRASH_QUERY_INVALID` | 400 | Invalid trash paging (guard) | "Não foi possível carregar a lixeira." | page |
| `ENTRY_NOT_FOUND` | 404 | Entry deleted or edited meanwhile | "Este lançamento foi excluído ou editado. Atualize a lista." | page / toast |
| `ENTRY_ALREADY_DELETED` | 409 | Changing a deleted or replaced entry | "Este lançamento foi excluído ou já foi editado por outra pessoa. Atualize a lista." | form |
| `ENTRY_ON_CLOSED_INVOICE` | 409 | Deleting or editing (new version) an entry with a line on a closed invoice | "Parte deste lançamento está em uma fatura fechada, então ele não pode ser excluído nem ter valores alterados. Só a descrição e as observações mudam." | toast |
| `ENTRY_NOT_DELETED` | 409 | Restoring an active entry | "Este lançamento já está ativo." | toast |
| `ENTRY_CANNOT_BE_RESTORED` | 409 | Uses a deleted account, touches a closed invoice, or was replaced | "Não dá para restaurar: ele usa uma conta excluída, está numa fatura fechada ou já tem outra versão." | toast |
| `ACCOUNT_NOT_AVAILABLE` | 400 | An account is archived or deleted | "{Conta} está arquivada ou foi excluída. Escolha outra." | the account field |
| `NOT_A_MONEY_ACCOUNT` | 400 | Not a money account (guard) | "Escolha uma conta de dinheiro." | the account field |
| `NOT_AN_EXPENSE_CATEGORY` | 400 | Not an expense category (guard) | "Escolha uma categoria de despesa." | field category |
| `NOT_AN_INCOME_CATEGORY` | 400 | Not an income category (guard) | "Escolha uma categoria de receita." | field category |
| `SAME_ACCOUNT` | 400 | Transfer to the same account | "Escolha uma conta diferente da de origem." | field "Para" |
| `NOT_A_CARD` | 400 | Not a card (guard) | "Escolha um cartão." | field card |
| `CARD_NOT_SET_UP` | 400 | Card without cycle | "Este cartão não tem fechamento e vencimento. Configure o cartão primeiro." | field card |
| `INVOICE_CLOSED` | 400 | An installment would land on a closed invoice | "A fatura de {mês} já fechou. Registre a partir da parcela {N}." (month and N computed by the web) | field first installment |
| `TOO_MANY_INSTALLMENTS` | 400 | More than 48, or more than the amount in cents | "Use de 1 a 48 parcelas." | field installments |
| `FIRST_INSTALLMENT_OUT_OF_RANGE` | 400 | First installment above the count | "A parcela inicial não pode passar do número de parcelas." | field first installment |
| `PAYMENT_ACCOUNT_REQUIRED` | 400 | Invoice payment without a paying account | "Escolha de qual conta sai o pagamento." | field "Pago com" |
| `SPENT_BY_NOT_A_MEMBER` | 400 | "Quem gastou" isn't in the workspace anymore | "Essa pessoa não participa mais do espaço." | field "Quem gastou" |
| `CONTACT_NOT_AVAILABLE` | 400 | A contact in the split doesn't exist | "Um dos contatos não existe mais. Tire ele da divisão." | shares |
| `CONTACT_TWICE` | 400 | The same contact twice | "Esse contato já está na divisão." | shares |
| `SHARES_EXCEED_AMOUNT` | 400 | Shares above the total | "A soma das partes passa do valor total." | shares |
| `SHARE_NOT_POSITIVE`, `AMOUNT_NOT_POSITIVE`, `BALANCE_IS_ZERO` | 400 | Zero amounts (guard) | "Informe um valor maior que zero." | the amount field |
| `NO_INSTALLMENTS`, `INSTALLMENTS_DO_NOT_MATCH`, `NOT_THE_OPENING_BALANCE_ACCOUNT`, `NOT_THE_RECEIVABLE_ACCOUNT` | 400 | Internal consistency checks; valid input never reaches them (guard) | "Não foi possível registrar o lançamento. Código: {ref}." | form |

## Contacts and charges
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `CONTACT_INVALID` | 400 | Contact form invalid | per field | fields |
| `CONTACT_NOT_FOUND` | 404 | Contact deleted | "Este contato não existe mais." | page / toast |
| `CONTACT_PHONE_TAKEN` | 409 | Another active contact has the number | "Outro contato já usa esse número." | field phone |
| `CONTACT_HAS_BALANCE` | 409 | Archiving with a balance | "Só dá para arquivar quando o saldo estiver zerado." | toast |
| `CHARGE_INVALID` | 400 | Invalid date | "Informe uma data válida (dd/mm/aaaa)." | field date |
| `CHARGE_QUERY_INVALID` | 400 | Invalid filter (guard) | "Não foi possível carregar as cobranças." | section |
| `CHARGE_NOT_FOUND` | 404 | Charge gone | "Esta cobrança não existe mais." | toast |
| `OPEN_ITEMS_QUERY_INVALID` | 400 | Invalid date (guard) | "Informe uma data válida (dd/mm/aaaa)." | field until |
| `NOTHING_TO_CHARGE` | 409 | Nothing open up to the date | "Este contato não tem nada em aberto até essa data." | form |
| `CHARGE_STATUS_REFUSED` | 409 | Action not allowed in the charge's status | sent: "Esta cobrança já foi enviada ou tem pagamento." · cancel: "Cobranças com pagamento não podem ser canceladas." · payment: "Esta cobrança foi cancelada e não recebe pagamentos." | form / toast |
| `CHARGE_PAYMENT_INVALID` | 400 | Payment form invalid | per field | fields |

## Planning
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `RECURRENCE_INVALID` | 400 | Recurrence form invalid | per field; "Escolha um dia do mês ou um dia útil, não os dois." · "A data final não pode ser antes da primeira." | fields |
| `RECURRENCE_ACCOUNTS_INVALID` | 400 | Accounts don't fit the type, or archived | "Confira as contas: elas precisam estar ativas e combinar com o tipo." | form |
| `RECURRENCE_NOT_FOUND` | 404 | Recurrence deleted | "Esta conta fixa não existe mais." | page / toast |
| `OCCURRENCE_QUERY_INVALID` | 400 | Range invalid or over a year | "Escolha um período de até 1 ano." | field period |
| `OCCURRENCE_NOT_FOUND` | 404 | Occurrence gone (re-planned) | "Este previsto mudou. Atualize a lista." | toast |
| `OCCURRENCE_INVALID` | 400 | Amount invalid | "Informe um valor maior que zero." | field amount |
| `OCCURRENCE_MATCH_INVALID` | 400 | No entry chosen (guard) | "Escolha um lançamento." | form |
| `OCCURRENCE_NOT_PENDING` | 409 | Already paid or skipped | "Este previsto já foi pago ou pulado. Atualize a lista." | toast |
| `OCCURRENCE_NOT_MATCHED` | 409 | Undoing a match that isn't there | "Este previsto não está marcado como pago." | toast |
| `OCCURRENCE_NOT_SKIPPED` | 409 | Unskipping one that isn't skipped | "Este previsto não está pulado." | toast |
| `ENTRY_NOT_AVAILABLE` | 400 | The entry was deleted | "Esse lançamento foi excluído." | form |
| `OCCURRENCE_ENTRY_MISMATCH` | 400 | Entry of another type or accounts | "Esse lançamento não usa as mesmas contas desta conta fixa." | form |
| `ENTRY_ALREADY_MATCHED` | 409 | Entry already pays another occurrence | "Esse lançamento já paga outro previsto." | form |
| `BUDGET_QUERY_INVALID` | 400 | Invalid period (guard) | "Escolha um mês válido." | field period |
| `BUDGET_INVALID` | 400 | Limit or month invalid | per field | fields |
| `BUDGET_CATEGORY_NOT_FOUND` | 404 | Bad category address (guard) | "Categoria não encontrada." | page |
| `BUDGET_CATEGORY_INVALID` | 400 | Not an active expense category | "Orçamentos só valem para categorias de despesa ativas." | form |
| `GOAL_INVALID` | 400 | Goal form invalid | per field | fields |
| `GOAL_NOT_FOUND` | 404 | Goal deleted | "Esta meta não existe mais." | toast |
| `GOAL_ACCOUNT_INVALID` | 400 | Not an active money account | "Escolha uma conta ativa de dinheiro." | field account |
| `GOAL_ACCOUNT_TAKEN` | 409 | Account used by another goal | "Essa conta já é de outra meta." | field account |
| `RESERVE_ALREADY_SET` | 409 | A second reserve | "Já existe uma reserva de emergência." | field reserve |
| `ALLOCATION_INVALID` | 400 | Steps invalid | "O passo 'o que sobrar' precisa ser o último." (or per field) | form |
| `ALLOCATION_ACCOUNT_INVALID` | 400 | A step's account isn't an active money account | "Uma das contas não está ativa. Escolha outra no passo {n}." | step |
| `ALLOCATION_GOAL_INVALID` | 400 | A step's goal was deleted | "Uma das metas foi excluída. Remova esse passo." | step |
| `HOLIDAY_QUERY_INVALID` | 400 | Year out of 2000–2100 | "Escolha um ano entre 2000 e 2100." | field year |
| `HOLIDAY_INVALID` | 400 | Form invalid | per field | fields |
| `HOLIDAY_ALREADY_NATIONAL` | 409 | Date is a national holiday | "Esse dia já é feriado nacional." | field date |
| `HOLIDAY_DATE_TAKEN` | 409 | Another local holiday that day | "Já existe um feriado nesse dia." | field date |
| `HOLIDAY_NOT_FOUND` | 404 | Holiday deleted | "Este feriado não existe mais." | toast |

## Dashboard and reports
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `OVERVIEW_QUERY_INVALID` | 400 | Invalid period (guard) | "Mostrando o período atual." | toast |
| `ALLOCATION_QUERY_INVALID` | 400 | Invalid amount | "Informe um valor maior que zero." | field amount |
| `SIMULATION_QUERY_INVALID` | 400 | Simulation form invalid | per field; "Escolha um cartão ou uma conta." · "Só compras no cartão podem ser parceladas." · "Cada parcela precisa de pelo menos R$ 0,01: use menos parcelas." | fields |
| `SIMULATION_CARD_INVALID` | 400 | Card deleted | "Escolha um cartão ativo." | field card |
| `SIMULATION_ACCOUNT_INVALID` | 400 | Account deleted or not money | "Escolha uma conta ativa de dinheiro." | field account |

## Attachments and history
| Code | HTTP | When | Message | Shown as |
|---|---|---|---|---|
| `FILE_REQUIRED` | 400 | No file or empty file | "Escolha um arquivo." | upload |
| `FILE_TOO_LARGE` | 413 | Over the size limit | "O arquivo passa de 10 MB. Tire uma foto menor ou envie um PDF." | upload |
| `FILE_TYPE_NOT_ALLOWED` | 400 | Not JPEG, PNG, WebP, HEIC or PDF | "Envie uma foto (JPG, PNG, WebP ou HEIC) ou um PDF." | upload |
| `ATTACHMENT_NOT_FOUND` | 404 | Already removed | "Este comprovante já foi removido." | toast |
| `FILE_NOT_FOUND` | 404 | File removed | "Este arquivo não está mais disponível." | viewer |
| `AUDIT_QUERY_INVALID` | 400 | Invalid filter (guard) | "Os filtros eram inválidos e foram limpos." | toast |
