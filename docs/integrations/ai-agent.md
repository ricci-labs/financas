---
summary: Design of the Claude agent — responsibilities, tools, confirmation flow, context/prompt caching, model choice, cost tracking, safety, evals.
read_when: Working on apps/api/src/agent, adding a tool, changing prompts, or changing the model.
updated: 2026-09-22
---

# AI agent

Decision and alternatives: `../decisions/0004-anthropic-sdk-direct.md`.
Before writing SDK code, load the `claude-api` skill. SDK APIs change, so don't write them from memory.

## Responsibilities
| Claude does | Code does |
|---|---|
| Understand free-form pt-BR messages ("gastei 87,50 no mercado no nubank") | All arithmetic, dates, invoice assignment, installment splitting |
| Pick the right tool and fill its arguments | Validation (Zod) and business rules (services) |
| Ask a short question when something required is missing | Persistence, and confirmation state |
| Write a short, friendly reply in pt-BR | Formatting money and dates for the reply data |

**Claude never computes a total and never writes to the DB.** If a reply needs a number, a tool returns it.

## Tools
One file per tool in `agent/tools/`. Each tool has a Zod input schema from `packages/shared/src/schemas` and calls **exactly one service**.

| Tool | Kind | Calls |
|---|---|---|
| `register_expense` | write → pending | `ledger.previewExpense` (supports installments and contact shares) |
| `register_income` | write → pending | `ledger.previewIncome` |
| `register_transfer` | write → pending | `ledger.previewTransfer` (e.g. "guardar a comissão na reserva") |
| `register_settlement` | write → pending | `contacts.previewSettlement` ("o J me pagou 100") |
| `send_charge` | write → pending | `contacts.previewCharge` ("cobra o J") |
| `confirm_pending` / `cancel_pending` | write | `agent.pendingActions` → the target service |
| `undo_last` | write → pending | `ledger.previewReversal` |
| `period_overview` | read | `reports.getPeriodOverview` ("quanto ainda posso gastar?") |
| `invoice_summary` | read | `reports.getInvoiceSummary` (own vs fronted for others) |
| `contact_balance` | read | `reports.getContactBalances` |
| `upcoming_bills` | read | `planning.listUpcoming` |
| `list_recent_entries` | read | `ledger.listRecent` |
| `lookup_names` | read | accounts, cards, categories, contacts (used when names are ambiguous) |

Tool rules:
- Tool descriptions say *when* to use the tool, not only what it does.
- Tool inputs use names the user would say (a card nickname, a category name). The service resolves them to IDs and returns a helpful error when the name is ambiguous.
- Errors come back as `is_error` tool results with a pt-BR message Claude can relay.

## Confirmation flow
1. A write tool validates and builds a **preview**, e.g. "Mercado · R$ 87,50 · Nubank (fatura de outubro) · categoria Mercado · 1×". It stores a `pendingAction` (expires in 15 min) and returns the preview.
2. Claude shows the preview and asks "Confirma?".
3. The user replies "sim"/"ok"/👍 and Claude calls `confirm_pending`. Any correction ("foi no inter") produces a new preview that replaces the pending one.
4. Only one pending action per user per workspace at a time.

MVP: always confirm. Later we may auto-confirm high-confidence simple expenses, with "desfazer" still available.

## Context and prompt caching
- **System prompt** (`prompts/system.ts`) is stable: role, tone, rules, pt-BR style. It has no dates, names or IDs, so it stays cacheable.
- Tool definitions are deterministic (fixed order), also cacheable.
- **Per-turn context** is injected after the cached prefix: today's date in `America/Sao_Paulo`, the sender's name, and the workspace's account/card/category/contact names.
- Memory: the last ~20 messages per member (`agentMessage`), trimmed by age (e.g. 24h). Summarize older history only if it's ever needed.

## Model
- Default: `claude-opus-5`, adaptive thinking, low effort (the agent's job is interpretation, not deep reasoning).
- Cost reduction by switching model (Sonnet/Haiku) is **the user's decision**. Measure against the eval set first.
- Don't use forced `tool_choice`. Use `auto` and steer through the prompt.

## Cost and observability
- Store `usage` (input/output/cache tokens) and the computed cost on each `agentMessage`.
- The dashboard settings page shows the monthly agent cost.
- Log every tool call with its input and result status (never secrets).

## Safety
- Only verified `channel_identities` reach the agent, scoped to one workspace per turn (`whatsapp.md`).
- Tools can't delete permanently and can't change cards, budgets or settings. Settings belong to the web dashboard. The only outbound messages a tool can trigger are charges to the workspace's own contacts, always after confirmation.
- Treat message content as data. A message cannot widen what the tools allow.

## Evals (phase 1.5)
Collect real messages (with the couple's consent, anonymized) into `apps/api/src/agent/evals/cases.jsonl` with the expected tool call and arguments. Run the set before any prompt or model change.
