---
summary: Functional requirements for planning — recurring bills and incomes, planned occurrences and matching them to payments, budgets, goals and the emergency reserve, the commission split steps, and holidays (screens PLAN-01..07).
read_when: Designing or building any planning screen, or a shortcut that pays a planned bill.
updated: 2026-09-29
---

# Planning

Standards: `../ui-standards.md`. Messages per code: `../error-messages.md`. Domain:
`../../../domain/model/planning.md`, `../../household-finances.md`. API:
`/api/workspaces/:id/{recurrences,occurrences,budgets,goals,allocation-steps,holidays}`.

## Rules that shape these screens
- **A recurrence** ("conta fixa", "salário", "assinatura") plans occurrences ("previstos") from
  today up to the end of the 6th month ahead. The past is never planned. Types: "Despesa" (from a
  money account), "Receita", "Compra no cartão" (a subscription on a card), "Transferência". The type
  can't change after creation.
- **Schedule:** weekly (repeats the weekday of the start date), monthly or yearly, every 1–52;
  monthly/yearly on a day of the month (1–31; a short month uses its last day) or on the N-th
  business day (1–10), or by default on the start date's day. Weekend rule: "Manter a data",
  "Antecipar para o dia útil anterior", "Adiar para o próximo dia útil". Business day = Monday to
  Friday, not a national bank holiday or a workspace holiday. Optional end date (not before the
  start).
- **"Valor aproximado"** (`amountIsEstimate`, e.g. the energy bill, a commission) shows amounts with
  "≈" and widens the match tolerance from 5% to 20%.
- **Occurrence status:** "Pendente", "Pago/Recebido" (matched to an entry), "Pulado" (skipped).
  "Atrasado" is a pending one past its date. A matched occurrence follows its entry: editing the
  entry keeps the match, deleting the entry makes it pending again.
- **Matching is never automatic.** After a payment is recorded, the app suggests the planned bills
  it probably pays (same type, same two accounts, within ±10 days and the tolerance); a member
  confirms. A member may also match by hand any entry with the same type and accounts.
- **Changing a recurrence** re-plans its future pending occurrences: amounts edited on those are
  lost. The web warns about it.
- **Budgets:** a monthly limit for an expense category, valid from a period on until changed; a
  parent category's budget covers its subcategories. Removing a budget = setting no limit from a
  period on.
- **Goals:** each goal lives in one money account and its progress is that account's balance; one
  goal per account; at most one goal is the emergency reserve ("Reserva de emergência").
- **Commission split** ("Divisão da comissão"): up to 10 ordered steps that suggest how to split
  variable income. Nothing moves by itself: the member records the transfers.
- **Holidays:** national bank holidays are built in; the workspace adds local ones (e.g. the city's
  anniversary). They change business days, and so the planned dates computed from now on.

## PLAN-01 Recurring bills and incomes (MVP)
Route `/planejamento`. Permission `planning:view`. `GET /recurrences`.

**RF-PLAN-1** Two sections, "Contas e assinaturas" (expense, card) and "Receitas" (income), plus
"Transferências programadas". Row: description, amount ("≈" when estimate), how it repeats in
words ("Todo dia 10", "No 5º dia útil", "Toda segunda", "A cada 3 meses no dia 15"), account or card,
category, next due date (from the occurrences).
**RF-PLAN-2** A summary on top: "Contas fixas por mês" and "Receitas fixas por mês" (monthly
equivalents of the active rules).
Actions: "Nova conta fixa" / "Nova receita" (`planning:create`) → `PLAN-02`; tap → `PLAN-02` edit
(`planning:update`); "Excluir" (`planning:delete`) with the dialog "Excluir {descrição}? Os
previstos pendentes dela somem; os já pagos continuam no histórico."
Empty: "Nenhuma conta fixa cadastrada. Cadastre aluguel, internet e salário para ver o que está
comprometido." + actions.

## PLAN-02 New or edit recurrence (MVP)
Create `POST /recurrences` (`planning:create`); edit `PATCH /recurrences/:id` (`planning:update`,
always sending the whole schedule).

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| entryType | "Tipo" | segmented: "Despesa", "Receita", "Compra no cartão", "Transferência" | yes (create only) | fixed after creation |
| description | "Descrição" | text | yes | trimmed, 1–200 |
| amountCents | "Valor" | money | yes | > 0 |
| amountIsEstimate | "O valor muda todo mês (aproximado)" | switch | — | default off |
| sourceAccountId | "Pago com" / "Recebido em" / "Cartão" / "De" (by type) | picker | yes | expense, income, transfer: active money account; card: active card |
| categoryAccountId | "Categoria" / "Para" (transfer) | picker | yes | expense and card: expense category; income: income category; transfer: another money account, different from "De" |
| frequency | "Repete" | "Semanal", "Mensal", "Anual" | yes | |
| interval | "A cada" | number + unit ("semanas", "meses", "anos") | yes, default 1 | 1–52 |
| day rule | "Quando" | radio (monthly/yearly): "No dia {n} do mês", "No {n}º dia útil", "No mesmo dia da primeira data" | yes | day 1–31 ("Se o mês tiver menos dias, vale o último.") or business day 1–10; hidden for weekly |
| weekendRule | "Se cair em fim de semana ou feriado" | select: "Manter a data", "Antecipar para o dia útil anterior", "Adiar para o próximo dia útil" | yes, default keep | hidden when "N-th business day" is chosen |
| startsOn | "Primeira data" | date | yes | valid date; help "Só planejamos a partir de hoje." |
| endsOn | "Termina em" | date, with "Sem data para terminar" (default) | no | not before the first date: "A data final não pode ser antes da primeira." |

**RF-PLAN-3** A live preview: "Próximas: 10/10, 10/11, 10/12" (computed with the shared rules and
holidays).
**RF-PLAN-4** Editing a rule with pending future occurrences whose amount was changed shows: "Ao
salvar, os próximos previstos voltam para o valor desta conta fixa."
Actions "Criar" / "Salvar". Errors: `RECURRENCE_INVALID` (fields), `RECURRENCE_ACCOUNTS_INVALID`
("Confira as contas: elas precisam estar ativas e combinar com o tipo."), `RECURRENCE_NOT_FOUND`.

Not in the form: "Lembrar X dias antes" (stored per rule but unused: reminders follow each member's
lead time, `ME-01`) and "Registrar sozinho" (phase 2). See `../api-gaps.md`.

## PLAN-03 Planned occurrences (MVP)
Route `/planejamento/previstos`. Permission `planning:view`. `GET /occurrences?from&to` (up to 366
days; default the current financial period, with "Próximo período" and a month picker).

**RF-PLAN-5** Grouped: "Atrasados" (pending, past due; danger style), "A vencer", "Pagos/Recebidos",
"Pulados". Row: due date, description, amount ("≈" for estimates), type icon, account or card,
status badge.
**RF-PLAN-6** Row actions (`planning:update` unless said):
| Action | Shown when | Does |
|---|---|---|
| "Registrar pagamento" / "Registrar recebimento" | pending | opens `ENT-02` prefilled (type, accounts, amount, description, date = today); after saving, asks "Este lançamento paga {descrição} de {data}?" → match (`entries:create` + `planning:update`) |
| "Já registrei" | pending | picks an existing entry: suggestions first (`GET /occurrences/suggestions?entryId=` is by entry; here the web lists recent entries of the same type and accounts), then match |
| "Pular este mês" | pending | skip; toast with "Desfazer" (unskip) |
| "Mudar o valor deste" | pending | amount only for this occurrence; help "Não muda a conta fixa." |
| "Desfazer pagamento" | matched | unmatch; the entry stays |
| "Ver lançamento" | matched | `ENT-03` |
| "Voltar a esperar" | skipped | unskip |

**RF-PLAN-7** Suggesting matches from the other side: after any expense, income, card purchase or
transfer is saved in `ENT-02`, the web calls `GET /occurrences/suggestions?entryId=` and, when there
are suggestions, shows "Isto paga alguma conta prevista?" with the list and "Não" as the default.
Errors: `OCCURRENCE_NOT_PENDING` ("Este previsto já foi pago ou pulado. Atualize a lista."),
`OCCURRENCE_ENTRY_MISMATCH` ("Esse lançamento não usa as mesmas contas desta conta fixa."),
`ENTRY_ALREADY_MATCHED` ("Esse lançamento já paga outro previsto."), `ENTRY_NOT_AVAILABLE`,
`OCCURRENCE_NOT_MATCHED`, `OCCURRENCE_NOT_SKIPPED`, `OCCURRENCE_INVALID`, `OCCURRENCE_QUERY_INVALID`.
Empty: "Nada previsto neste período."

## PLAN-04 Budgets (MVP)
Route `/planejamento/orcamentos`. Read `budgets:view`; change `budgets:update` (owners and admins
by default). `GET /budgets?period=` for limits, `GET /overview?period=` → `budgetPace` for spent
and pace.

**RF-PLAN-8** For the chosen period: each expense category with a budget shows limit, spent, a
progress bar with the expected-pace mark, and the status: "Dentro do ritmo", "Acima do ritmo",
"Estourado". Categories without a budget are listed below with "Definir orçamento". Subcategories
show under their parent (a parent's budget covers them). A total on top: sum of limits vs. spent.

| Field (dialog "Orçamento de {categoria}") | Label | Required | Rules |
|---|---|---|---|
| limitCents | "Limite por mês" | yes (or the "Sem orçamento" switch) | money > 0 |
| fromPeriod | "Vale a partir de" | yes, default the viewed period | month picker; help "Continua valendo nos meses seguintes até você mudar." |
Actions "Salvar orçamento", "Remover orçamento" (sends no limit from the period on; dialog
"Remover o orçamento de {categoria} a partir de {mês}?"). Errors `BUDGET_INVALID`,
`BUDGET_CATEGORY_INVALID` ("Orçamentos só valem para categorias de despesa ativas."),
`BUDGET_QUERY_INVALID`.

## PLAN-05 Goals and emergency reserve (MVP)
Route `/planejamento/metas`. `GET /goals` (`planning:view`).

**RF-PLAN-9** The reserve first, as a highlighted card: saved, target, progress, and "Cobre {n}
meses de gastos" (from `HOME-01` → reserve coverage). Other goals: name, account, saved of target
(e.g. "R$ 1.200 de R$ 5.000 · 24%"), deadline and "faltam R$ X"; a goal over its target shows
"Meta atingida".
| Field | Label | Required | Rules |
|---|---|---|---|
| name | "Nome da meta" | yes | 1–80 |
| targetCents | "Valor da meta" | yes | money > 0 |
| accountId | "Guardado em" | yes | active money account not used by another goal: `GOAL_ACCOUNT_TAKEN` "Essa conta já é de outra meta." |
| targetOn | "Até quando" | no | date |
| isReserve | "É a reserva de emergência" | no | only one: `RESERVE_ALREADY_SET` "Já existe uma reserva de emergência." |
Help: "O progresso é o saldo da conta escolhida. Use uma conta só para esta meta."
Actions: "Nova meta" (`planning:create`), "Salvar" (`planning:update`), "Excluir"
(`planning:delete`, dialog; when a commission step uses it: "Esta meta está na divisão da comissão.
Tire ela de lá também."). Errors `GOAL_INVALID`, `GOAL_ACCOUNT_INVALID`, `GOAL_NOT_FOUND`.

## PLAN-06 Commission split steps (MVP)
Route `/planejamento/divisao-da-comissao`. Read `planning:view`; save `planning:update`.
`GET/PUT /allocation-steps`.

**RF-PLAN-10** An ordered list (drag to reorder), up to 10 steps, each one of:
| Step | Label | Fields |
|---|---|---|
| `fill_goal` | "Completar uma meta" | goal (picker) |
| `cover_overspent` | "Cobrir o que passou do orçamento no período" | — |
| `percent` | "Porcentagem para uma conta" | account, percent 1–100 ("da comissão inteira") |
| `fixed_amount` | "Valor fixo para uma conta" | account, amount |
| `rest` | "O que sobrar para uma conta" | account; only as the last step |
**RF-PLAN-11** A live example with R$ 1.000 (or the average commission) shows where each real
would go, using the shared `splitVariableIncome`.
A step pointing to a deleted goal is flagged "Meta excluída" and must be removed before saving.
Action "Salvar divisão" replaces the whole list: dialog "Substituir a divisão atual?". Errors
`ALLOCATION_INVALID` ("O passo 'o que sobrar' precisa ser o último."), `ALLOCATION_ACCOUNT_INVALID`,
`ALLOCATION_GOAL_INVALID` ("Uma das metas foi excluída. Remova esse passo.").

## PLAN-07 Holidays (MVP)
Route `/planejamento/feriados`. `GET /holidays?year=` (2000–2100).

**RF-PLAN-12** A year picker; national bank holidays with their pt-BR names ("Carnaval
(segunda-feira)", "Sexta-feira Santa", "Corpus Christi", "Dia da Consciência Negra" from 2024…),
read only; local holidays with "Excluir" (`planning:delete`, dialog).
| Field | Label | Required | Rules |
|---|---|---|---|
| onDate | "Data" | yes | valid date; not a national holiday (`HOLIDAY_ALREADY_NATIONAL` "Esse dia já é feriado nacional."); one per day (`HOLIDAY_DATE_TAKEN` "Já existe um feriado nesse dia.") |
| name | "Nome" | yes | 1–80 |
Action "Adicionar feriado" (`planning:create`). Note: "Previstos já planejados não mudam de data;
a mudança vale para os próximos." Errors `HOLIDAY_INVALID`, `HOLIDAY_QUERY_INVALID`,
`HOLIDAY_NOT_FOUND`.
