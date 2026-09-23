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
Exactly two people, the members of one household. Both record transactions and both read the
dashboard. There is no multi-tenant SaaS, no signup and no public access.

## Goals
1. **Recording with no effort:** logging an expense takes one WhatsApp message (text, later audio or a receipt photo).
2. **An honest view of the month:** what was spent per category against the budget, and how much is still free.
3. **Visible future commitments:** open invoices and upcoming installments show how much of next month's income is already spent.
4. **Calm with variable income:** the budget is built from fixed income; commissions are handled as extra (see `household-finances.md`).
5. **Trustworthy numbers:** deterministic code does all the math. The AI only interprets messages.

## Non-goals (for now)
- Bank integrations or Open Finance. Statement/invoice import is a later phase.
- Investment tracking, taxes (IRPF).
- More than one household, or any user beyond the couple.
- Native mobile apps. The web dashboard is an installable PWA.

## Success looks like
- Both partners record most expenses within the same day.
- At any moment they can answer "how much can we still spend this month?" in a few seconds.
- Nobody is surprised by a card invoice.
