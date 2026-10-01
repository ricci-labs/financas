---
summary: The MoneyInput component: the BRL money field with "R$" prefix, Brazilian decimals, formatting and cents conversion.
read_when: Building or changing a money input, or parsing and formatting typed amounts.
updated: 2026-10-01
---

# MoneyInput

A money field with the "R$" prefix, Brazilian decimals and large tabular numbers.

Same anatomy as TextField, with `fn-input--money` (56px tall, value in 22px/600 tabular) and the `fn-input__affix` prefix in `ink-muted`.

**Behavior:**
- `inputmode="decimal"`.
- Accepts `1234,56`, `1.234,56` or `1234`.
- Formats on blur (`R$ 1.234,56`).
- Always positive, unless the field says otherwise.
- Sent as integer cents (use `parseBrl`/`formatBrl` from the shared package).

**Error:** "Informe um valor maior que zero, como 25,90."

**In shadcn/ui:** a custom component in `components/ui/money-input.tsx` on top of the shadcn `Input`, with the prefix and `parseBrl`/`formatBrl` from `@financas/shared`, used inside `FormControl`.
