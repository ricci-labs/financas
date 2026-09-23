---
summary: The problem, the users, the goals and non-goals of the project.
read_when: You need product context, or need to judge whether a feature belongs in the product.
updated: 2026-09-22
---

# Vision

## Problem
A couple pools their incomes into one household budget and struggles to keep track of it. Spending
happens mostly on credit cards, so the real cost of a month only shows up weeks later on the
invoice, and installments quietly eat into future months. One partner's income is partly variable
(sales commissions), which makes planning harder.

## Users
It starts with one couple sharing a workspace, but the product is **multi-tenant from day one**
(`../decisions/0012-multi-tenancy.md`). Any person can sign up, create private isolated
workspaces ("Casa", "Pessoal") and invite members. Friends are the next audience, and possibly the
public later.

## Goals
1. **Recording with no effort:** logging an expense takes one WhatsApp message (text, later audio or a receipt photo).
2. **An honest view of the month:** what was spent, what is still committed (fixed bills, installments), and how much is still free to spend, for a configurable financial month.
3. **Visible future commitments:** open invoices and upcoming installments show how much of next month's income is already spent.
4. **Calm with variable income:** the budget is built from fixed income; commissions are handled as extra (see `household-finances.md`).
5. **Trustworthy numbers:** a double-entry ledger enforced by the database, and deterministic code for all math. The AI only interprets messages.
6. **Third parties under control:** card purchases shared with other people (even in installments, several people at once) are separated from own spending, charged over WhatsApp, and settled.
7. **No late fees:** reminders before bills and invoices are due.

## Non-goals (for now)
- Bank integrations or Open Finance. Statement/invoice import is a later phase.
- Investment tracking, taxes (IRPF).
- Cross-workspace grouped views (later).
- Billing/subscriptions for the product (later; per-workspace AI cost is tracked from day one).
- Native mobile apps. The web dashboard is an installable PWA.

## Success looks like
- Both partners record most expenses within the same day.
- At any moment they can answer "how much can we still spend this month?" in a few seconds.
- Nobody is surprised by a card invoice.
