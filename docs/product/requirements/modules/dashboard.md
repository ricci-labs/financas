---
summary: Functional requirements for the home screens — the period overview (free to spend, per day, spent, committed, budgets, next invoices, balance forecast, reserve, what is committed ahead, insights), "posso comprar?" and the commission split suggestion (HOME-01..03).
read_when: Designing or building HOME-01, HOME-02 or HOME-03, or writing the pt-BR text of an insight.
updated: 2026-09-29
---

# Dashboard

Standards: `../ui-standards.md`. Messages per code: `../error-messages.md`. Why the numbers are what
they are: `../../household-finances.md`, ADR 0024. API: `/api/workspaces/:id/overview`,
`/allocation/suggestion`, `/simulations/purchase` (all `reports:view`, every role).

## Rules that shape these screens
- **The financial period** follows the workspace settings (`SET-01`): calendar month, from day N,
  or from the N-th business day. Periods are named by the month they start in, and every label
  shows its range ("out/26 · 5 out – 4 nov").
- **Installments count** on each invoice's due date ("por parcela", default) or all at once in the
  purchase month ("no mês da compra"), per the workspace setting.
- **Budget income** is the fixed income (salaries, received or still expected) by default, or all
  income. Commissions are shown apart and never inflate the budget unless that setting says so.
- **"Today"** is the workspace time zone's today, also when looking at another period.
- All numbers come from the API; the web never recomputes a metric, it only formats it.

## HOME-01 Period overview (MVP)
Route `/` (inside a workspace). `GET /overview?period=YYYY-MM` (omitted = the current period).

**RF-HOME-1 Period header.** Period picker (previous / next), with the range. A past period shows
"Período encerrado"; a future one "Período futuro".

**RF-HOME-2 Hero: free to spend.** Big number "Livre para gastar" (`freeToSpend`) and under it
"R$ X por dia até {fim}" (`dailyAllowance`; hidden when null: a finished period). Negative shows in
the danger style as "Passou R$ X do planejado". Help "?": "Renda fixa do período, menos o que já foi
gasto, menos as contas que ainda vão vencer."

**RF-HOME-3 Breakdown** (three stat cards, each with help):
| Card | Metric | Help |
|---|---|---|
| "Renda do orçamento" | `budgetIncome` (and `fixedIncome` when the base includes commissions) | "Salários recebidos e previstos no período." |
| "Gasto" | `spent` | "Despesas e parcelas que caem neste período." |
| "Comprometido" | `committed` | "Contas fixas previstas que ainda não foram pagas, incluindo atrasadas." |

**RF-HOME-4 Insights** (max 3 visible, "Ver todos" for the rest), in the order the API sends them
(alerts first). Each card: severity style, the pt-BR sentence below, and an action.
| Code | Severity | Sentence (values formatted) | Action |
|---|---|---|---|
| `period_overspent` | alert | "Os gastos e as contas deste período já passaram da renda em {overspentCents}." | "Ver gastos" → `ENT-01` |
| `budget_over` | alert | "{categoria} estourou o orçamento: {spentCents} de {limitCents}." | "Ver orçamento" → `PLAN-04` |
| `balance_going_negative` | alert | "O saldo de {conta} deve ficar negativo: {lowestCents} em {lowestOn}." | "Ver previsão" → balance section |
| `occurrence_overdue` | warning | expense: "{descrição} venceu em {dueOn} ({amountCents}) e ainda não foi registrada." · income: "{descrição} era esperada em {dueOn} ({amountCents}) e ainda não entrou." | "Registrar" → `PLAN-03` |
| `budget_ahead` | warning | "{categoria} está gastando acima do ritmo: {spentCents} até agora, o esperado era {expectedCents}." | "Ver orçamento" |
| `period_heavily_committed` | warning | "{mês} já tem {percentOfIncome}% da renda fixa comprometida ({committedCents})." | "Ver próximos meses" |
| `contact_overdue` | warning | "{contato} está com {overdueCents} em atraso." | "Cobrar" → `CON-03` |
| `variable_income_to_split` | info | "Ainda há {amountCents} de comissão para dividir neste período." | "Ver sugestão" → `HOME-03` |
Names come from other lists already loaded (categories, accounts, contacts, occurrences by id).
Unknown codes are skipped. None: "Tudo em ordem por aqui." (a calm success line, not a card).

**RF-HOME-5 Budgets** (`budgetPace`): top 5 categories by how far ahead of pace, each with a progress
bar showing limit, spent and the expected mark; "Ver todos" → `PLAN-04`. Hidden when there are no
budgets, replaced by "Defina orçamentos para acompanhar o ritmo dos gastos." (`budgets:update`).

**RF-HOME-6 Next invoices** (`nextInvoice`, one per card): card name, closes and due dates, "Já
lançado" (`postedCents`), "Previsto" (subscriptions, `plannedCents`), "Total previsto"
(`forecastCents`). Tap → `CARD-03`.

**RF-HOME-7 Balance forecast** (`balanceForecast`, one per money account): a line chart from today to
`until` with a zero line; the lowest point marked ("Menor saldo: R$ X em {data}"); negative stretches
in the danger style. Text alternative: "Conta X: hoje R$ A, termina em R$ B, menor saldo R$ C em
{data}."

**RF-HOME-8 Commitments ahead** (`committedAhead`, 6 periods): bars per coming month, split in
"Parcelas" and "Contas previstas", with "{n}% da renda fixa"; 70% or more highlighted. Help: "Quanto
da renda fixa dos próximos meses já está comprometido."

**RF-HOME-9 Reserve and commissions:**
- reserve (`reserveCoverage`, when a reserve goal exists): "Reserva: R$ X de R$ Y · cobre {months}
  meses de gastos" (one decimal; "—" when there is no spending history);
- commissions: "Comissão no período: R$ X" (`variableIncome`) and "Média dos últimos meses: R$ Y"
  (`variableAverage`, "—" when null), with "Dividir" → `HOME-03` when there is commission.

**RF-HOME-10 Shortcuts:** "Posso comprar?" → `HOME-02`; "Novo lançamento" (floating).

States: skeletons per section; each section fails alone with its own retry (`../ui-standards.md` →
Partial); `OVERVIEW_QUERY_INVALID` resets to the current period. First run (no accounts): an
onboarding checklist instead of numbers: "Cadastre suas contas", "Cadastre seus cartões", "Cadastre
salário e contas fixas", "Registre os primeiros gastos".

## HOME-02 "Posso comprar?" (MVP)
Route `/posso-comprar`. `GET /simulations/purchase` (read-only, nothing is recorded).

| Field | Label | Input | Required | Rules |
|---|---|---|---|---|
| amountCents | "Valor da compra" | money | yes | > 0 |
| payment | "Como vai pagar" | radio "No cartão" / "Na conta" | yes | |
| cardAccountId | "Cartão" | card picker (archived allowed but hidden by default) | when "No cartão" | a card |
| installmentCount | "Parcelas" | stepper, default 1 | when "No cartão" | 1–48 and ≤ the amount in cents (prevents a known API error, `../api-gaps.md`) |
| paidFromAccountId | "Conta" | money-account picker | when "Na conta" | a money account; installments hidden |
| occurredOn | "Quando" | date, default "Hoje" | no | valid date |

**RF-HOME-11** "Simular" (or live, debounced 500 ms after a valid change) shows:
- this period: "Livre para gastar: R$ A → R$ B" and "Por dia: R$ C → R$ D";
- the next 6 months: a list or bars with "Comprometido: R$ X → R$ Y ({p}% → {q}% da renda fixa)",
  only months that change highlighted;
- new alerts (`newInsights`) with the insight sentences, e.g. "Março ficaria com 82% da renda fixa
  comprometida.";
- a verdict line: no new alert → "Cabe no orçamento."; only warnings → "Cabe, mas aperta."; any
  alert → "Não cabe sem estourar." (wording to validate in design).
Errors: `SIMULATION_QUERY_INVALID` (fields), `SIMULATION_CARD_INVALID` / `SIMULATION_ACCOUNT_INVALID`
(field: "Escolha um cartão/conta ativo."). The same simulation becomes an agent tool on WhatsApp
later (`../../../integrations/ai-agent.md`).

## HOME-03 Commission split suggestion (MVP)
Route `/dividir-comissao`, opened from the insight, from an income entry of variable nature, or from
the menu. `GET /allocation/suggestion?amountCents=`.

| Field | Label | Required | Rules |
|---|---|---|---|
| amountCents | "Valor da comissão" | yes, default the period's commission not split yet | money > 0 |

**RF-HOME-12** Shows the steps (from `PLAN-06`) with the amount each would take and the destination:
"1. Reserva de emergência → Poupança X: R$ 600,00"; "Cobrir o orçamento estourado: R$ 150,00 (fica
na conta)"; what is left over. Without steps: "Você ainda não definiu como dividir a comissão." +
"Definir divisão" → `PLAN-06`.
**RF-HOME-13** Each part with a destination has "Transferir" (`entries:create`), opening `ENT-02`
as a transfer prefilled with the amount and destination; the source is the account where the
commission landed (asked once, then remembered for the screen). Recorded parts show "Feito".
Error `ALLOCATION_QUERY_INVALID` (field amount).
